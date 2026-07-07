"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSSEChat } from "@gugbab/hooks";
import { capitalize } from "@gugbab/utils";
import ChatInputBar from "@/components/chat/ChatInputBar";
import ConversationListSheet from "@/components/chat/ConversationListSheet";
import MealPlanModeBanner from "@/components/chat/MealPlanModeBanner";
import ModelSheet from "@/components/chat/ModelSheet";
import BottomNav from "@/components/layout/BottomNav";
import { getLatestBodyMetrics } from "@/lib/db/bodyMetrics";
import {
    deleteConversation,
    getConversation,
    getLatestConversation,
    listConversations,
    saveConversation,
} from "@/lib/db/conversations";
import { getAllIngredients } from "@/lib/db/ingredients";
import type { ChatMessage, Conversation, MealPlanMode } from "@/lib/db/types";
import { getUserProfile } from "@/lib/db/userProfile";
import { BODY_LIMITS, isInRange, type NumberRange } from "@/lib/ai/limits";
import type { ModelInfo, ModelsResponse, UserContext } from "@/lib/ai/types";
import styles from "./page.module.css";

const MODEL_STORAGE_KEY = "gugbab-health:model";
// 활성 대화방 참조 — 방 id 또는 "new"(빈 새 대화). 새로고침해도 보던 방/새 대화 상태 유지
const ACTIVE_CONVERSATION_KEY = "gugbab-health:conversation";
const NEW_CONVERSATION_REF = "new";
const FALLBACK_MODEL = "sonnet";
const GENERIC_ERROR = "오류가 발생했어요. 잠시 후 다시 시도해주세요.";
// 이 개수 미만이면 "보유 재료로만 vs 자유 추천" 선택을 강제한다 (대화방당 1회)
const SCARCE_INGREDIENT_THRESHOLD = 3;

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
    const [input, setInput] = useState("");
    const [models, setModels] = useState<ModelInfo[] | null>(null);
    const [model, setModel] = useState<string>(loadStoredModel);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [mealPlanMode, setMealPlanMode] = useState<MealPlanMode | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    // 전송 후 완료 시점에 확정할 메시지 목록 — null이면 대기 중인 응답 없음
    const pendingRef = useRef<ChatMessage[] | null>(null);
    // 방 전환 세대 — 늦게 끝난 저장 콜백이 이전 방으로 상태를 되돌리는 것 방지
    const roomEpochRef = useRef(0);

    const handleError = useCallback((err: Error | { type: "error"; message: string }) => {
        pendingRef.current = null;
        const message = err instanceof Error ? GENERIC_ERROR : err.message;
        setMessages((prev) => [...prev, { role: "assistant", content: message }]);
        inputRef.current?.focus();
    }, []);

    const { text, status, send, abort } = useSSEChat({ url: "/api/chat", onError: handleError });
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
                if (ref === NEW_CONVERSATION_REF) return undefined;
                if (ref) {
                    const found = await getConversation(ref).catch(() => undefined);
                    if (found) return found;
                }
                return getLatestConversation().catch(() => undefined);
            }

            // 프로필 확인 후 추가 DB 읽기 — 실패해도 온보딩으로 보내지 않고 빈 값으로 처리
            const [ingredients, metrics, latest] = await Promise.all([
                getAllIngredients().catch(() => []),
                getLatestBodyMetrics(7).catch(() => []),
                restoreConversation(),
            ]);
            setContext({
                gender: profile.gender,
                goals: profile.goals,
                heightCm: sanitizeBodyValue(profile.heightCm, BODY_LIMITS.heightCm),
                weightKg: sanitizeBodyValue(profile.weightKg, BODY_LIMITS.weightKg),
                recentMetrics: [...metrics].reverse().map((m) => ({
                    date: m.date,
                    weight: m.weight,
                    bodyFatPct: m.bodyFatPct,
                    skeletalMuscleMass: m.skeletalMuscleMass,
                })),
                ingredients: ingredients.map((i) => ({ name: i.name, category: i.category })),
                recentMealSummaries: [],
            });
            if (latest) {
                setConversationId(latest.id);
                setMessages(latest.messages);
                setMealPlanMode(latest.mealPlanMode ?? null);
            }
        }
        init().catch(() => router.replace("/onboarding"));
    }, [router]);

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
        const finalMessages: ChatMessage[] = [...pendingRef.current, { role: "assistant", content: text }];
        pendingRef.current = null;
        setMessages(finalMessages);
        const epoch = roomEpochRef.current;
        saveConversation({ id: conversationId, messages: finalMessages, mealPlanMode })
            .then((saved) => {
                // 저장 중 방이 전환됐으면 이전 방으로 재바인딩하지 않는다
                if (roomEpochRef.current !== epoch) return;
                setConversationId(saved.id);
                storeConversationRef(saved.id);
            })
            .catch(() => undefined);
        inputRef.current?.focus();
    }, [status, text, conversationId, mealPlanMode]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, text]);

    const ingredientsScarce =
        context !== null && context.ingredients.length < SCARCE_INGREDIENT_THRESHOLD;
    // 식재료 부족 시 추천 방식 선택은 강제 — 대화방당 1회, 선택 전에는 전송 불가
    const needsModeChoice = ingredientsScarce && mealPlanMode === null;

    function handleSend() {
        if (!input.trim() || streaming || !context || needsModeChoice) return;

        const userMsg: ChatMessage = { role: "user", content: input.trim() };
        const nextMessages = [...messages, userMsg];
        pendingRef.current = nextMessages;
        setMessages(nextMessages);
        setInput("");
        const contextWithMode: UserContext =
            ingredientsScarce && mealPlanMode ? { ...context, mealPlanMode } : context;
        // 목록으로 검증된 경우에만 model 전달 — 미로드 시 relay 기본값에 위임 (폐기된 alias 전송 방지)
        send({ messages: nextMessages, context: contextWithMode, ...(models ? { model } : {}) });
    }

    function handleNewChat() {
        abort();
        pendingRef.current = null;
        roomEpochRef.current += 1;
        setConversationId(null);
        setMessages([]);
        setMealPlanMode(null);
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
        setConversationId(conversation.id);
        setMessages(conversation.messages);
        setMealPlanMode(conversation.mealPlanMode ?? null);
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
            await deleteConversation(id);
        } catch {
            return;
        }
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (deletingActive) {
            // 현재 열려 있던 방을 지우면 새 대화 상태로 초기화
            handleNewChat();
        }
    }

    function handleSelectMode(mode: MealPlanMode) {
        setMealPlanMode(mode);
        // 이미 저장된 방이면 선택 즉시 영속화 (새 방은 첫 저장 시 함께 기록)
        if (conversationId) {
            saveConversation({ id: conversationId, messages, mealPlanMode: mode }).catch(() => undefined);
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

    return (
        <main className={styles.main}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <button
                        type="button"
                        className={styles.listBtn}
                        onClick={handleOpenList}
                        aria-label="대화 목록"
                    >
                        ☰
                    </button>
                    <span className={styles.headerTitle}>식단 채팅</span>
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

            <div className={styles.messages}>
                {messages.length === 0 && !streaming && (
                    <div className={styles.empty}>
                        <p>
                            안녕하세요! 오늘 어떤 식단을 원하시나요?
                            <br />
                            보유한 식재료와 신체 지표를 바탕으로 추천해드릴게요.
                        </p>
                    </div>
                )}
                {messages.map((msg, i) => (
                    <div
                        key={i}
                        className={msg.role === "user" ? styles.userBubble : styles.assistantBubble}
                    >
                        {msg.content}
                    </div>
                ))}
                {streaming && streamingText && (
                    <div className={styles.assistantBubble}>{streamingText}</div>
                )}
                {streaming && !streamingText && (
                    <div className={styles.typing} role="status" aria-label="입력 중">
                        <span />
                        <span />
                        <span />
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

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

            {needsModeChoice && <MealPlanModeBanner onSelect={handleSelectMode} />}

            <ChatInputBar
                value={input}
                onChange={setInput}
                onSend={handleSend}
                disabled={streaming}
                sendBlocked={needsModeChoice}
                inputRef={inputRef}
            />

            <BottomNav active="chat" />
        </main>
    );
}
