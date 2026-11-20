"use client";

import { useSSEChat } from "@gugbab/hooks";
import { capitalize } from "@gugbab/utils";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import ChatInputBar from "@/components/chat/ChatInputBar";
import ConversationListSheet from "@/components/chat/ConversationListSheet";
import MealPlanModeSheet from "@/components/chat/MealPlanModeSheet";
import ModelSheet from "@/components/chat/ModelSheet";
import RoutineSuggestion from "@/components/chat/RoutineSuggestion";
import BottomNav from "@/components/layout/BottomNav";
import { toOutgoingMessages } from "@/lib/ai/history";
import { BODY_LIMITS, isInRange, MESSAGE_LIMITS, type NumberRange } from "@/lib/ai/limits";
import type { ModelInfo, ModelsResponse, UserContext } from "@/lib/ai/types";
import { copyToClipboard } from "@/lib/clipboard";
import { getLatestBodyMetrics } from "@/lib/db/bodyMetrics";
import {
    deleteConversation,
    getConversation,
    getLatestConversation,
    listConversations,
    saveConversation,
} from "@/lib/db/conversations";
import { getAllExercises } from "@/lib/db/exercises";
import { getAllIngredients } from "@/lib/db/ingredients";
import { clearPendingSnapshot, takePendingSnapshot, writePendingSnapshot } from "@/lib/db/pendingSnapshot";
import { listRoutines } from "@/lib/db/routines";
import type { ChatMessage, Conversation, Exercise, MealPlanMode, Routine } from "@/lib/db/types";
import { getUserProfile } from "@/lib/db/userProfile";
import { listWorkoutSessions } from "@/lib/db/workouts";
import { useLongPress } from "@/lib/hooks/useLongPress";
import { buildWorkoutContext } from "@/lib/training/context";
import { extractRoutineBlocks } from "@/lib/training/routineBlock";
import styles from "./page.module.css";

const MODEL_STORAGE_KEY = "gugbab-health:model";
// 활성 대화방 참조 — 방 id 또는 "new"(빈 새 대화). 새로고침해도 보던 방/새 대화 상태 유지
const ACTIVE_CONVERSATION_KEY = "gugbab-health:conversation";
const NEW_CONVERSATION_REF = "new";
const FALLBACK_MODEL = "sonnet";
const GENERIC_ERROR = "오류가 발생했어요. 잠시 후 다시 시도해주세요.";
const INTERRUPTED_NOTICE = "이전 응답이 중간에 끊겼어요. 입력창에 질문을 다시 넣어뒀으니 전송을 눌러주세요.";

/** 답을 받지 못한 마지막 질문 — 복원 시 입력창에 다시 채워 사용자가 쓴 내용을 잃지 않게 한다 */
function unansweredQuestion(messages: ChatMessage[]): string | null {
    const last = messages.at(-1);
    return last?.role === "user" && !last.transient ? last.content : null;
}

/**
 * 답을 받지 못하고 저장된 마지막 질문(화면 이탈로 스트림이 끊긴 경우)을 복원할 때 처리한다.
 * 질문은 화면에 남기되 transient로 바꿔 다음 전송·저장에서 빼고(연속 user 턴 방지), 안내 버블을 붙인다
 */
function withInterruptedNotice(messages: ChatMessage[]): ChatMessage[] {
    const last = messages.at(-1);
    if (last?.role !== "user" || last.transient) return messages;
    return [
        ...messages.slice(0, -1),
        { ...last, transient: true },
        { role: "assistant", content: INTERRUPTED_NOTICE, transient: true },
    ];
}

/**
 * 지난 실행이 받는 중에 닫혔으면 남긴 사본을 DB로 옮기고 그 방을 돌려준다.
 * DB에 이미 더 긴(이후에 이어진) 대화가 있으면 사본이 낡은 것이므로 덮어쓰지 않는다
 */
async function recoverPendingSnapshot(): Promise<Conversation | undefined> {
    const snap = takePendingSnapshot();
    if (!snap) return undefined;
    try {
        const existing = snap.id ? await getConversation(snap.id) : undefined;
        if (existing && existing.messages.length >= snap.messages.length) return undefined;
        // 사본의 방이 지워졌으면(id는 있는데 DB에 없음) 되살리지 않는다
        if (snap.id && !existing) return undefined;
        return await saveConversation({ id: snap.id, messages: snap.messages, mealPlanMode: snap.mealPlanMode });
    } catch {
        return undefined;
    }
}

/** 받는 중이던 답변 — 받은 본문이 있으면 assistant 턴으로 붙이고, 없으면 질문까지만 */
function withPartialAnswer(pending: ChatMessage[], partial: string): ChatMessage[] {
    return partial ? [...pending, { role: "assistant", content: partial }] : pending;
}
// 이 개수 미만이면 "보유 재료로만 vs 자유 추천" 선택을 강제한다 (대화방당 1회)
const SCARCE_INGREDIENT_THRESHOLD = 3;
// 시스템 프롬프트 "최근 식단 이력"에 넣을 다른 방 요약 최대 개수
const RECENT_SUMMARY_COUNT = 5;
// 하단에서 이만큼 이상 올라가면 자동 스크롤을 멈추고 최하단 이동 버튼을 띄운다
const JUMP_BUTTON_THRESHOLD = 160;

// 과거 규칙으로 저장된 범위 밖 값이 채팅 400을 유발하지 않도록 컨텍스트에서 제외
function sanitizeBodyValue(value: number | undefined, range: NumberRange): number | undefined {
    return value !== undefined && isInRange(value, range) ? value : undefined;
}

function loadStoredModel(): string {
    if (typeof window === "undefined") return FALLBACK_MODEL;
    try {
        return window.localStorage.getItem(MODEL_STORAGE_KEY) ?? FALLBACK_MODEL;
    } catch {
        return FALLBACK_MODEL;
    }
}

function loadConversationRef(): string | null {
    if (typeof window === "undefined") return null;
    try {
        return window.localStorage.getItem(ACTIVE_CONVERSATION_KEY);
    } catch {
        return null;
    }
}

function storeConversationRef(ref: string): void {
    try {
        window.localStorage.setItem(ACTIVE_CONVERSATION_KEY, ref);
    } catch {
        // 저장 실패는 무시 — 세션 내 상태는 유지된다
    }
}

export default function ChatPage() {
    const router = useRouter();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    // null = 아직 저장되지 않은 새 대화방
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [listOpen, setListOpen] = useState(false);
    const [context, setContext] = useState<UserContext | null>(null);
    // 대화 속 루틴 제안 카드가 기존 종목·루틴과 대조하는 데 쓴다
    const [workoutLibrary, setWorkoutLibrary] = useState<{ exercises: Exercise[]; routines: Routine[] }>({
        exercises: [],
        routines: [],
    });
    const [input, setInput] = useState("");
    const [models, setModels] = useState<ModelInfo[] | null>(null);
    const [model, setModel] = useState<string>(loadStoredModel);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [mealPlanMode, setMealPlanMode] = useState<MealPlanMode | null>(null);
    // 이 방에서 식단 방식 선택을 건너뜀(운동 질문 등) — 방을 바꾸면 다시 묻는다
    const [modeSkipped, setModeSkipped] = useState(false);
    // 롱프레스로 연 복사 메뉴 — null이면 닫힘. 대상 메시지 내용과 표시 좌표를 담는다
    const [copyMenu, setCopyMenu] = useState<{ content: string; x: number; y: number } | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const bindLongPress = useLongPress();
    const bottomRef = useRef<HTMLDivElement>(null);
    const messagesRef = useRef<HTMLDivElement>(null);
    // 하단 근접 여부 — 자동 스크롤 유지 조건. 렌더와 무관하게 스크롤마다 갱신되므로 ref
    const nearBottomRef = useRef(true);
    const [showJumpBtn, setShowJumpBtn] = useState(false);
    // 방 전환 신호 — 새 방 첫 저장의 id 부여(null→id)를 방 전환으로 오인하지 않도록 명시적으로 올린다
    const [roomSwitchKey, setRoomSwitchKey] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    // 전송 후 완료 시점에 확정할 메시지 목록 — null이면 대기 중인 응답 없음
    const pendingRef = useRef<ChatMessage[] | null>(null);
    // done 이벤트로 수신한 답변 요약 — 확정 시 assistant 메시지에 부착
    const summaryRef = useRef<string | undefined>(undefined);
    // 방별 최신 답변 요약 — 다른 방 요약을 recentMealSummaries로 전달 (최신순)
    const [roomSummaries, setRoomSummaries] = useState<Array<{ id: string; summary: string }>>([]);
    // 방 전환 세대 — 늦게 끝난 저장 콜백이 이전 방으로 상태를 되돌리는 것 방지
    const roomEpochRef = useRef(0);
    // 저장 경로(전송 즉시·화면 이탈·완료)가 같은 방을 쓰도록 현재 방 id를 ref로도 유지한다.
    // 새 방의 첫 저장이 끝나기 전에 다음 저장이 오면 방이 두 개 생기므로 저장은 큐로 직렬화한다
    const conversationIdRef = useRef<string | null>(null);
    const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
    // 화면 이탈 시점에 받은 데까지 저장하려면 렌더 밖에서 최신 값을 읽어야 한다
    const streamTextRef = useRef("");
    const mealPlanModeRef = useRef<MealPlanMode | null>(null);

    const bindRoom = useCallback((id: string | null) => {
        conversationIdRef.current = id;
        setConversationId(id);
    }, []);

    // 현재 방에 메시지를 저장한다. 방이 바뀌면(세대 변경) 대기 중인 저장은 버린다
    const persistRoom = useCallback(
        (msgs: ChatMessage[], mode: MealPlanMode | null) => {
            const epoch = roomEpochRef.current;
            const run = saveQueueRef.current.then(async () => {
                if (roomEpochRef.current !== epoch) return undefined;
                // transient(에러 안내 버블)는 화면에만 남기고 DB에는 저장하지 않는다
                const saved = await saveConversation({
                    id: conversationIdRef.current,
                    messages: msgs.filter((m) => !m.transient),
                    mealPlanMode: mode,
                });
                // 저장 중 방이 전환됐으면 이전 방으로 재바인딩하지 않는다
                if (roomEpochRef.current !== epoch) return undefined;
                bindRoom(saved.id);
                storeConversationRef(saved.id);
                return saved;
            });
            saveQueueRef.current = run.catch(() => undefined);
            return run;
        },
        [bindRoom],
    );

    // 응답을 받지 못한 요청의 마무리 — 방금 보낸 user 턴을 transient로 전환(화면 유지,
    // 저장·전송 제외)하고 안내 버블을 붙인다. 미응답 질문이 다음 전송 이력에 끼어
    // 연속 user 턴으로 relay에 전달되는 것을 방지한다
    const settleFailedTurn = useCallback((notice: string) => {
        pendingRef.current = null;
        setMessages((prev) => [
            ...prev.map((m, i) => (i === prev.length - 1 && m.role === "user" ? { ...m, transient: true } : m)),
            { role: "assistant", content: notice, transient: true },
        ]);
        inputRef.current?.focus();
    }, []);

    const handleError = useCallback(
        (err: Error | { type: "error"; message: string }) => {
            settleFailedTurn(err instanceof Error ? GENERIC_ERROR : err.message);
        },
        [settleFailedTurn],
    );

    // 대화에서 루틴을 저장하면 다음 질문부터 새 루틴·종목이 컨텍스트에 반영되게 다시 읽는다
    const refreshWorkoutContext = useCallback(async () => {
        const [sessions, routines, exercises] = await Promise.all([
            listWorkoutSessions().catch(() => []),
            listRoutines().catch(() => []),
            getAllExercises().catch(() => []),
        ]);
        setWorkoutLibrary({ exercises, routines });
        setContext((prev) => (prev ? { ...prev, ...buildWorkoutContext(sessions, routines, exercises) } : prev));
    }, []);

    const handleDone = useCallback((event?: { type: "done"; summary?: string }) => {
        // relay 계약상 문자열이지만 런타임 방어 — 비문자열·빈 문자열은 없는 것으로 취급 (원문 유지 폴백)
        const summary = event?.summary;
        summaryRef.current = typeof summary === "string" && summary ? summary : undefined;
    }, []);

    const { text, status, send, abort } = useSSEChat({ url: "/api/chat", onDone: handleDone, onError: handleError });
    const streaming = status === "streaming";

    useEffect(() => {
        async function init() {
            let profile: Awaited<ReturnType<typeof getUserProfile>>;
            try {
                profile = await getUserProfile();
            } catch {
                router.replace("/onboarding");
                return;
            }
            if (!profile) {
                router.replace("/onboarding");
                return;
            }
            // 저장된 활성 방 참조 복원 — "new"면 빈 새 대화 유지, id면 그 방, 없으면 최근 방
            const ref = loadConversationRef();
            async function restoreConversation() {
                const recovered = await recoverPendingSnapshot();
                if (recovered) {
                    storeConversationRef(recovered.id);
                    return recovered;
                }
                if (ref === NEW_CONVERSATION_REF) return undefined;
                if (ref) {
                    const found = await getConversation(ref).catch(() => undefined);
                    if (found) return found;
                }
                return getLatestConversation().catch(() => undefined);
            }

            // 프로필 확인 후 추가 DB 읽기 — 실패해도 온보딩으로 보내지 않고 빈 값으로 처리
            const [ingredients, metrics, latest, allConversations, sessions, routines, exercises] = await Promise.all([
                getAllIngredients().catch(() => []),
                getLatestBodyMetrics(7).catch(() => []),
                restoreConversation(),
                listConversations().catch(() => []),
                listWorkoutSessions().catch(() => []),
                listRoutines().catch(() => []),
                getAllExercises().catch(() => []),
            ]);
            // 방별 마지막 답변 요약 수집 (목록은 최근 수정순)
            setRoomSummaries(
                allConversations.flatMap((c) => {
                    const summary = c.messages.findLast((m) => m.role === "assistant" && m.summary)?.summary;
                    return summary ? [{ id: c.id, summary }] : [];
                }),
            );
            setContext({
                gender: profile.gender,
                goals: profile.goals,
                heightCm: sanitizeBodyValue(profile.heightCm, BODY_LIMITS.heightCm),
                weightKg: sanitizeBodyValue(profile.weightKg, BODY_LIMITS.weightKg),
                // 범위 밖 레거시 지표 방어 — API zod가 BODY_LIMITS로 거부하므로,
                // weight가 범위 밖이면 항목을 제외하고 선택 필드는 범위 밖 값만 제거한다
                recentMetrics: [...metrics]
                    .reverse()
                    .filter((m) => isInRange(m.weight, BODY_LIMITS.weightKg))
                    .map((m) => ({
                        date: m.date,
                        weight: m.weight,
                        bodyFatPct: sanitizeBodyValue(m.bodyFatPct, BODY_LIMITS.bodyFatPct),
                        skeletalMuscleMass: sanitizeBodyValue(m.skeletalMuscleMass, BODY_LIMITS.skeletalMuscleKg),
                    })),
                ingredients: ingredients.map((i) => ({ name: i.name })),
                recentMealSummaries: [],
                // 운동 기록 — 다음 무게를 물으면 앱 계산값을 근거로 답하게 한다
                ...buildWorkoutContext(sessions, routines, exercises),
            });
            setWorkoutLibrary({ exercises, routines });
            if (latest) {
                bindRoom(latest.id);
                setMessages(withInterruptedNotice(latest.messages));
                const unanswered = unansweredQuestion(latest.messages);
                if (unanswered) setInput(unanswered);
                setMealPlanMode(latest.mealPlanMode ?? null);
                setModeSkipped(false);
                setRoomSwitchKey((k) => k + 1);
            }
        }
        init().catch(() => router.replace("/onboarding"));
    }, [router, bindRoom]);

    useEffect(() => {
        let cancelled = false;
        async function loadModels() {
            try {
                const res = await fetch("/api/models");
                if (!res.ok || cancelled) return;
                const data = (await res.json()) as ModelsResponse;
                if (cancelled) return;
                setModels(data.models);
                // 저장된 alias가 목록에 없으면(모델 폐기 등) 기본값으로 폴백
                setModel((prev) => {
                    const next = data.models.some((m) => m.alias === prev) ? prev : data.default;
                    try {
                        window.localStorage.setItem(MODEL_STORAGE_KEY, next);
                    } catch {
                        // 저장 실패는 무시 — 세션 내 선택은 유지된다
                    }
                    return next;
                });
            } catch {
                // 목록 로드 실패 — 칩 비활성 유지, 채팅은 저장값으로 계속 동작
            }
        }
        loadModels();
        return () => {
            cancelled = true;
        };
    }, []);

    // 스트리밍 완료 시 어시스턴트 메시지 확정 + 대화방 저장
    useEffect(() => {
        if (status !== "done" || !pendingRef.current) return;
        const summary = summaryRef.current;
        summaryRef.current = undefined;
        // 빈 응답(chunk 없이 done)은 확정·저장하지 않고 에러 경로와 동일하게 처리한다.
        // 빈 content가 저장되면 이후 모든 전송이 API 검증(min 1)에 걸려 방이 영구 전송 불가가 된다
        if (!text) {
            settleFailedTurn("응답을 받지 못했어요. 다시 시도해주세요.");
            return;
        }
        const finalMessages: ChatMessage[] = [
            ...pendingRef.current,
            { role: "assistant", content: text, ...(summary ? { summary } : {}) },
        ];
        pendingRef.current = null;
        setMessages(finalMessages);
        persistRoom(finalMessages, mealPlanMode)
            .then((saved) => {
                // 완료본이 저장됐으면 이전에 남긴 닫힘 사본은 낡은 것 — 다음 실행에 덮어쓰지 않게 지운다
                if (saved) clearPendingSnapshot();
                if (saved && summary) {
                    setRoomSummaries((prev) => [{ id: saved.id, summary }, ...prev.filter((r) => r.id !== saved.id)]);
                }
            })
            .catch(() => undefined);
        inputRef.current?.focus();
    }, [status, text, mealPlanMode, settleFailedTurn, persistRoom]);

    useEffect(() => {
        streamTextRef.current = text;
    }, [text]);

    useEffect(() => {
        mealPlanModeRef.current = mealPlanMode;
    }, [mealPlanMode]);

    // 받는 중에 화면을 떠나면 받은 데까지 저장한다.
    // relay는 본문 뒤에 보이지 않는 요약을 더 만든 뒤 done을 보내므로, 본문이 다 보인 직후
    // 다른 탭으로 가도 done 전이라 이 경로를 탄다. 요약만 빠지고 본문은 그대로 남는다
    useEffect(() => {
        function snapshot() {
            const pending = pendingRef.current;
            if (!pending) return;
            persistRoom(withPartialAnswer(pending, streamTextRef.current), mealPlanModeRef.current).catch(
                () => undefined,
            );
        }
        // 브라우저 탭 전환·앱 전환 — 스트림은 계속될 수 있으니 대기 상태는 유지하고 사본만 저장
        function handleVisibility() {
            if (document.visibilityState === "hidden") snapshot();
        }
        document.addEventListener("visibilitychange", handleVisibility);
        // 새로고침·창 닫기 — IndexedDB 저장은 페이지가 닫히기 전에 끝나지 않을 수 있어
        // 동기 저장소(localStorage)에도 사본을 남기고 다음 실행 때 DB로 옮긴다
        function handlePageHide() {
            const pending = pendingRef.current;
            if (!pending) return;
            writePendingSnapshot({
                id: conversationIdRef.current,
                messages: withPartialAnswer(pending, streamTextRef.current).filter((m) => !m.transient),
                mealPlanMode: mealPlanModeRef.current,
            });
            snapshot();
        }
        window.addEventListener("pagehide", handlePageHide);
        return () => {
            document.removeEventListener("visibilitychange", handleVisibility);
            window.removeEventListener("pagehide", handlePageHide);
            // 앱 안 탭 이동(언마운트) — useSSEChat이 스트림을 끊으므로 여기서 마지막으로 저장
            snapshot();
            pendingRef.current = null;
        };
    }, [persistRoom]);

    // 하단 근처일 때만 자동 스크롤 — 위로 올려 과거 메시지를 읽는 중에는 방해하지 않는다
    // biome-ignore lint/correctness/useExhaustiveDependencies: messages·text는 새 내용 도착 시점을 잡는 트리거 의존성 (본문은 ref만 읽음)
    useEffect(() => {
        if (nearBottomRef.current) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, text]);

    // 방 전환·초기 로드 시에는 항상 최하단에서 시작
    // biome-ignore lint/correctness/useExhaustiveDependencies: roomSwitchKey는 방 전환 시점을 잡는 트리거 의존성
    useEffect(() => {
        nearBottomRef.current = true;
        setShowJumpBtn(false);
        bottomRef.current?.scrollIntoView({ behavior: "auto" });
    }, [roomSwitchKey]);

    function handleMessagesScroll() {
        const el = messagesRef.current;
        if (!el) return;
        const near = el.scrollHeight - el.scrollTop - el.clientHeight < JUMP_BUTTON_THRESHOLD;
        nearBottomRef.current = near;
        setShowJumpBtn(!near);
    }

    function scrollToBottom() {
        nearBottomRef.current = true;
        setShowJumpBtn(false);
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }

    // 토스트는 잠깐 보여주고 자동으로 사라진다
    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 1600);
        return () => clearTimeout(timer);
    }, [toast]);

    async function handleCopy(content: string) {
        setCopyMenu(null);
        const ok = await copyToClipboard(content);
        setToast(ok ? "복사됨" : "복사에 실패했어요");
    }

    const ingredientsScarce = context !== null && context.ingredients.length < SCARCE_INGREDIENT_THRESHOLD;
    // 식재료 부족 시 추천 방식 선택은 강제 — 빈 새 대화에서 첫 질문 전에만 묻는다.
    // 이미 대화가 있는 방(다른 탭에서 돌아오기·새로고침·목록에서 열기)은 창으로 대화를 가리지 않는다.
    // 방식 없이 진행된 방은 기본 지침(보유 식재료로 만들 수 있는 식단)으로 답한다
    const roomHasHistory = messages.length > 0;
    const needsModeChoice = ingredientsScarce && mealPlanMode === null && !modeSkipped && !roomHasHistory;

    function handleSend() {
        if (!input.trim() || streaming || !context || needsModeChoice) return;

        const userMsg: ChatMessage = { role: "user", content: input.trim() };
        const nextMessages = [...messages, userMsg];
        pendingRef.current = nextMessages;
        summaryRef.current = undefined;
        // 이전 답변 본문이 남아 있으면 이탈 저장이 그걸 이번 답으로 오인한다
        streamTextRef.current = "";
        // 질문은 보내는 즉시 저장 — 답을 받기 전에 화면을 떠나도 대화방과 질문이 남는다
        persistRoom(nextMessages, mealPlanMode).catch(() => undefined);
        // 전송 시에는 위로 올려둔 상태여도 최신 메시지로 따라간다
        nearBottomRef.current = true;
        setShowJumpBtn(false);
        setMessages(nextMessages);
        setInput("");
        // 현재 방 요약은 메시지 이력으로 이미 전달되므로 다른 방 요약만 담는다
        const recentMealSummaries = roomSummaries
            .filter((r) => r.id !== conversationId)
            .map((r) => r.summary)
            .slice(0, RECENT_SUMMARY_COUNT);
        const contextWithMode: UserContext = {
            ...(ingredientsScarce && mealPlanMode ? { ...context, mealPlanMode } : context),
            recentMealSummaries,
        };
        // 긴 답변이 쌓여도 API 한도를 넘지 않도록 오래된 턴은 요약·절삭해 전송
        // 목록으로 검증된 경우에만 model 전달 — 미로드 시 relay 기본값에 위임 (폐기된 alias 전송 방지)
        send({ messages: toOutgoingMessages(nextMessages), context: contextWithMode, ...(models ? { model } : {}) });
    }

    function handleNewChat() {
        abort();
        pendingRef.current = null;
        roomEpochRef.current += 1;
        bindRoom(null);
        setMessages([]);
        setMealPlanMode(null);
        setModeSkipped(false);
        setRoomSwitchKey((k) => k + 1);
        storeConversationRef(NEW_CONVERSATION_REF);
    }

    async function handleOpenList() {
        try {
            setConversations(await listConversations());
        } catch {
            setConversations([]);
        }
        setListOpen(true);
    }

    function handleSelectConversation(conversation: Conversation) {
        abort();
        pendingRef.current = null;
        roomEpochRef.current += 1;
        bindRoom(conversation.id);
        setMessages(withInterruptedNotice(conversation.messages));
        const unanswered = unansweredQuestion(conversation.messages);
        if (unanswered) setInput(unanswered);
        setMealPlanMode(conversation.mealPlanMode ?? null);
        setModeSkipped(false);
        setRoomSwitchKey((k) => k + 1);
        storeConversationRef(conversation.id);
        setListOpen(false);
    }

    async function handleDeleteConversation(id: string) {
        const deletingActive = id === conversationId;
        if (deletingActive) {
            // 진행 중 스트림·대기 중 저장이 삭제된 방을 되살리지 않도록 삭제 전에 무효화
            abort();
            pendingRef.current = null;
            roomEpochRef.current += 1;
        }
        try {
            // 이미 실행 중인 저장이 삭제 뒤에 끝나면 방이 되살아나므로 먼저 끝나기를 기다린다
            await saveQueueRef.current;
            await deleteConversation(id);
        } catch {
            return;
        }
        setConversations((prev) => prev.filter((c) => c.id !== id));
        setRoomSummaries((prev) => prev.filter((r) => r.id !== id));
        if (deletingActive) {
            // 현재 열려 있던 방을 지우면 새 대화 상태로 초기화
            handleNewChat();
        }
    }

    function handleSkipMode() {
        setModeSkipped(true);
        inputRef.current?.focus();
    }

    function handleSelectMode(mode: MealPlanMode) {
        setMealPlanMode(mode);
        // 강제 선택 시트가 포커스를 가져갔으므로, 닫힌 뒤 바로 입력할 수 있게 되돌린다
        inputRef.current?.focus();
        // 이미 저장된 방이면 선택 즉시 영속화 (새 방은 첫 저장 시 함께 기록)
        // transient(에러 안내 버블)는 확정 저장 경로와 동일하게 제외한다
        if (conversationIdRef.current) {
            persistRoom(messages, mode).catch(() => undefined);
        }
    }

    function handleSelectModel(alias: string) {
        setModel(alias);
        try {
            window.localStorage.setItem(MODEL_STORAGE_KEY, alias);
        } catch {
            // 저장 실패는 무시 — 세션 내 선택은 유지된다
        }
        setSheetOpen(false);
    }

    if (!context) return null;

    const streamingText = streaming ? text : "";
    // 스트리밍 중에도 루틴 블록(JSON)은 감춘다 — 완료 후 카드로 나타난다
    const streamingVisibleText = streamingText ? extractRoutineBlocks(streamingText).text : "";

    return (
        <main className={styles.main}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <button type="button" className={styles.listBtn} onClick={handleOpenList} aria-label="대화 목록">
                        ☰
                    </button>
                    <span className={styles.headerTitle}>식단·운동</span>
                    <button
                        type="button"
                        className={styles.modelChip}
                        onClick={() => setSheetOpen(true)}
                        disabled={streaming || !models}
                        aria-haspopup="dialog"
                    >
                        {models ? capitalize(model) : "모델"} <span aria-hidden>▾</span>
                    </button>
                </div>
                <button type="button" className={styles.newChatBtn} onClick={handleNewChat}>
                    새 대화
                </button>
            </header>

            <div className={styles.messages} ref={messagesRef} onScroll={handleMessagesScroll}>
                {messages.length === 0 && !streaming && (
                    <div className={styles.empty}>
                        <p>
                            안녕하세요! 오늘 어떤 식단이나 운동이 궁금하세요?
                            <br />
                            보유 식재료·신체 지표·운동 기록을 바탕으로 알려드릴게요.
                        </p>
                    </div>
                )}
                {messages.map((msg, i) => {
                    // 답변 속 루틴 블록은 본문에서 떼어 저장 카드로 보인다(복사도 본문만)
                    const { text: body, drafts } =
                        msg.role === "assistant"
                            ? extractRoutineBlocks(msg.content)
                            : { text: msg.content, drafts: [] };
                    return (
                        // biome-ignore lint/suspicious/noArrayIndexKey: 메시지는 방 안에서 append-only라 순서가 안정적 (id 없음)
                        <Fragment key={i}>
                            {body && (
                                <div
                                    className={msg.role === "user" ? styles.userBubble : styles.assistantBubble}
                                    {...bindLongPress(({ x, y }) => setCopyMenu({ content: body, x, y }))}
                                >
                                    {body}
                                </div>
                            )}
                            {drafts.map((draft, j) => (
                                <RoutineSuggestion
                                    // biome-ignore lint/suspicious/noArrayIndexKey: 한 답변 안의 블록 순서는 고정이다
                                    key={j}
                                    draft={draft}
                                    exercises={workoutLibrary.exercises}
                                    routines={workoutLibrary.routines}
                                    onSaved={() => void refreshWorkoutContext()}
                                />
                            ))}
                        </Fragment>
                    );
                })}
                {streaming && streamingVisibleText && (
                    <div className={styles.assistantBubble}>{streamingVisibleText}</div>
                )}
                {streaming && !streamingVisibleText && (
                    <div className={styles.typing} role="status" aria-label="입력 중">
                        <span />
                        <span />
                        <span />
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            {showJumpBtn && (
                <button
                    type="button"
                    className={styles.jumpToBottom}
                    onClick={scrollToBottom}
                    aria-label="최신 메시지로 이동"
                >
                    ↓
                </button>
            )}

            {sheetOpen && models && (
                <ModelSheet
                    models={models}
                    selected={model}
                    onSelect={handleSelectModel}
                    onClose={() => setSheetOpen(false)}
                />
            )}

            {listOpen && (
                <ConversationListSheet
                    conversations={conversations}
                    activeId={conversationId}
                    onSelect={handleSelectConversation}
                    onDelete={handleDeleteConversation}
                    onClose={() => setListOpen(false)}
                />
            )}

            {needsModeChoice && <MealPlanModeSheet onSelect={handleSelectMode} onSkip={handleSkipMode} />}

            <ChatInputBar
                value={input}
                onChange={setInput}
                onSend={handleSend}
                disabled={streaming}
                sendBlocked={needsModeChoice}
                maxLength={MESSAGE_LIMITS.maxContentLength}
                inputRef={inputRef}
            />

            {copyMenu && (
                // biome-ignore lint/a11y/useKeyWithClickEvents: 백드롭 탭으로 닫기 (ESC·바깥 클릭, 복사 버튼 별도 제공)
                <div
                    className={styles.copyMenuBackdrop}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setCopyMenu(null);
                    }}
                    role="dialog"
                    aria-modal="true"
                    aria-label="복사 메뉴"
                >
                    <div
                        className={styles.copyMenu}
                        // 롱프레스 지점에 맞춰 위치 — 동적 좌표라 CSS로 표현 불가
                        style={{ left: copyMenu.x, top: copyMenu.y }}
                    >
                        <button
                            type="button"
                            className={styles.copyMenuItem}
                            onClick={() => handleCopy(copyMenu.content)}
                        >
                            복사
                        </button>
                    </div>
                </div>
            )}

            {toast && (
                <div className={styles.toast} role="status">
                    {toast}
                </div>
            )}

            <BottomNav active="chat" />
        </main>
    );
}
