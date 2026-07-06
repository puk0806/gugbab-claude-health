"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSSEChat } from "@gugbab/hooks";
import { capitalize } from "@gugbab/utils";
import BottomNav from "@/components/layout/BottomNav";
import { getLatestBodyMetrics } from "@/lib/db/bodyMetrics";
import { getAllIngredients } from "@/lib/db/ingredients";
import { getTodayMealHistory, saveMealHistory } from "@/lib/db/mealHistory";
import type { ChatMessage } from "@/lib/db/types";
import { getUserProfile } from "@/lib/db/userProfile";
import type { MealPlanMode, ModelInfo, ModelsResponse, UserContext } from "@/lib/ai/types";
import styles from "./page.module.css";

const MODEL_STORAGE_KEY = "gugbab-health:model";
const FALLBACK_MODEL = "sonnet";
const GENERIC_ERROR = "오류가 발생했어요. 잠시 후 다시 시도해주세요.";
// 이 개수 미만이면 "보유 재료로만 vs 자유 추천" 선택을 강제한다
const SCARCE_INGREDIENT_THRESHOLD = 3;

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
                heightCm: profile.heightCm,
                weightKg: profile.weightKg,
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

    useEffect(() => {
        if (!sheetOpen) return;
        function onKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") setSheetOpen(false);
        }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [sheetOpen]);

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

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
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
                // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click-to-close (ESC 별도 처리)
                <div
                    className={styles.sheetBackdrop}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setSheetOpen(false);
                    }}
                    role="dialog"
                    aria-modal="true"
                    aria-label="모델 선택"
                >
                    <div className={styles.sheet}>
                        <div className={styles.sheetTitle}>
                            모델 선택 <small>다음 메시지부터 적용</small>
                        </div>
                        {models.map((m) => (
                            <button
                                key={m.alias}
                                type="button"
                                className={m.alias === model ? styles.modelRowSelected : styles.modelRow}
                                onClick={() => handleSelectModel(m.alias)}
                            >
                                <span className={styles.modelCheck} aria-hidden>
                                    {m.alias === model ? "✓" : ""}
                                </span>
                                <span className={styles.modelInfo}>
                                    <span className={styles.modelName}>
                                        {m.name}
                                        {m.description.includes("비용 높음") && (
                                            <span className={styles.modelCostBadge}>비용 높음</span>
                                        )}
                                    </span>
                                    <span className={styles.modelDesc}>{m.description}</span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {needsModeChoice && (
                <div className={styles.modeBanner}>
                    <p className={styles.modeBannerText}>
                        등록된 식재료가 부족해요. 어떻게 추천해드릴까요?
                    </p>
                    <div className={styles.modeChips}>
                        <button
                            type="button"
                            className={styles.modeChip}
                            onClick={() => setMealPlanMode("pantry-only")}
                        >
                            보유 재료로만
                        </button>
                        <button
                            type="button"
                            className={styles.modeChip}
                            onClick={() => setMealPlanMode("free")}
                        >
                            자유롭게 추천
                        </button>
                    </div>
                </div>
            )}

            <div className={styles.inputBar}>
                <input
                    ref={inputRef}
                    className={styles.input}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="식단을 요청해보세요..."
                    disabled={streaming}
                />
                <button
                    type="button"
                    className={styles.sendBtn}
                    onClick={handleSend}
                    disabled={!input.trim() || streaming || needsModeChoice}
                >
                    전송
                </button>
            </div>

            <BottomNav active="chat" />
        </main>
    );
}
