"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import BottomNav from "@/components/layout/BottomNav";
import { getLatestBodyMetrics } from "@/lib/db/bodyMetrics";
import { getAllIngredients } from "@/lib/db/ingredients";
import { getTodayMealHistory, saveMealHistory } from "@/lib/db/mealHistory";
import type { ChatMessage } from "@/lib/db/types";
import { getUserProfile } from "@/lib/db/userProfile";
import type { ChatSseEvent, UserContext } from "@/lib/ai/types";
import styles from "./page.module.css";

export default function ChatPage() {
    const router = useRouter();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [context, setContext] = useState<UserContext | null>(null);
    const [input, setInput] = useState("");
    const [streaming, setStreaming] = useState(false);
    const [streamingText, setStreamingText] = useState("");
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const abortRef = useRef<AbortController | null>(null);

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
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, streamingText]);

    async function handleSend() {
        if (!input.trim() || streaming || !context) return;

        const abort = new AbortController();
        abortRef.current = abort;

        const userMsg: ChatMessage = { role: "user", content: input.trim() };
        const nextMessages = [...messages, userMsg];
        setMessages(nextMessages);
        setInput("");
        setStreaming(true);
        setStreamingText("");

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ messages: nextMessages, context }),
                signal: abort.signal,
            });

            if (!res.ok || !res.body) throw new Error("network");

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let fullText = "";

            while (true) {
                const { done, value } = await reader.read();
                buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
                if (done) break;

                const parts = buffer.split("\n\n");
                buffer = parts.pop() ?? "";

                for (const part of parts) {
                    if (!part.startsWith("data: ")) continue;
                    let event: ChatSseEvent;
                    try {
                        event = JSON.parse(part.slice(6)) as ChatSseEvent;
                    } catch {
                        continue;
                    }
                    if (event.type === "chunk") {
                        fullText += event.text;
                        setStreamingText(fullText);
                    } else if (event.type === "error") {
                        throw new Error(event.message);
                    }
                }
            }

            if (!abort.signal.aborted) {
                const assistantMsg: ChatMessage = { role: "assistant", content: fullText };
                const finalMessages = [...nextMessages, assistantMsg];
                setMessages(finalMessages);
                setStreamingText("");
                await saveMealHistory(finalMessages);
            }
        } catch (e) {
            if (e instanceof DOMException && e.name === "AbortError") return;
            const msg = e instanceof Error ? e.message : "오류가 발생했어요. 잠시 후 다시 시도해주세요.";
            setMessages((prev) => [...prev, { role: "assistant", content: msg }]);
            setStreamingText("");
        } finally {
            // 이 요청이 여전히 현재 활성 요청인 경우에만 streaming 상태를 해제한다
            if (abortRef.current === abort) {
                setStreaming(false);
                inputRef.current?.focus();
            }
        }
    }

    function handleNewChat() {
        abortRef.current?.abort();
        abortRef.current = null;
        setMessages([]);
        setStreaming(false);
        setStreamingText("");
        saveMealHistory([]).catch(() => undefined);
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }

    if (!context) return null;

    return (
        <main className={styles.main}>
            <header className={styles.header}>
                <span className={styles.headerTitle}>식단 채팅</span>
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
                    <div className={styles.typing} aria-label="입력 중">
                        <span />
                        <span />
                        <span />
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

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
                    disabled={!input.trim() || streaming}
                >
                    전송
                </button>
            </div>

            <BottomNav active="chat" />
        </main>
    );
}
