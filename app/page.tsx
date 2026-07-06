"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSSEChat } from "@gugbab/hooks";
import { capitalize } from "@gugbab/utils";
import ChatInputBar from "@/components/chat/ChatInputBar";
import MealPlanModeBanner from "@/components/chat/MealPlanModeBanner";
import ModelSheet from "@/components/chat/ModelSheet";
import BottomNav from "@/components/layout/BottomNav";
import { getLatestBodyMetrics } from "@/lib/db/bodyMetrics";
import { getAllIngredients } from "@/lib/db/ingredients";
import { getTodayMealHistory, saveMealHistory } from "@/lib/db/mealHistory";
import type { ChatMessage } from "@/lib/db/types";
import { getUserProfile } from "@/lib/db/userProfile";
import { BODY_LIMITS, isInRange, type NumberRange } from "@/lib/ai/limits";
import type { MealPlanMode, ModelInfo, ModelsResponse, UserContext } from "@/lib/ai/types";
import styles from "./page.module.css";

const MODEL_STORAGE_KEY = "gugbab-health:model";
const FALLBACK_MODEL = "sonnet";
const GENERIC_ERROR = "오류가 발생했어요. 잠시 후 다시 시도해주세요.";
// 이 개수 미만이면 "보유 재료로만 vs 자유 추천" 선택을 강제한다
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

export default function ChatPage() {
    const router = useRouter();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
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
            // 프로필 확인 후 추가 DB 읽기 — 실패해도 온보딩으로 보내지 않고 빈 값으로 처리
            const [ingredients, metrics, history] = await Promise.all([
                getAllIngredients().catch(() => []),
                getLatestBodyMetrics(7).catch(() => []),
                getTodayMealHistory().catch(() => undefined),
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
            if (history) setMessages(history.messages);
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

    // 스트리밍 완료 시 어시스턴트 메시지 확정 + 식단 이력 저장
    useEffect(() => {
        if (status !== "done" || !pendingRef.current) return;
        const finalMessages: ChatMessage[] = [...pendingRef.current, { role: "assistant", content: text }];
        pendingRef.current = null;
        setMessages(finalMessages);
        saveMealHistory(finalMessages).catch(() => undefined);
        inputRef.current?.focus();
    }, [status, text]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, text]);

    const ingredientsScarce =
        context !== null && context.ingredients.length < SCARCE_INGREDIENT_THRESHOLD;
    // 식재료 부족 시 추천 방식 선택은 강제 — 선택 전에는 전송 불가
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
        setMessages([]);
        setMealPlanMode(null);
        saveMealHistory([]).catch(() => undefined);
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

            {needsModeChoice && <MealPlanModeBanner onSelect={setMealPlanMode} />}

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
