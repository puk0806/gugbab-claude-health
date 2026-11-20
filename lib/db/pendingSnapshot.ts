import { isPlainObject } from "@gugbab/utils";
import { MESSAGE_LIMITS } from "@/lib/ai/limits";
import type { ChatMessage, MealPlanMode } from "./types";

/**
 * 페이지가 닫히는 순간(새로고침·창 닫기)의 대화 사본.
 * IndexedDB 저장은 비동기라 페이지가 닫히기 전에 끝나지 않을 수 있어, 동기 저장소인
 * localStorage에 남겼다가 다음 실행 때 DB로 옮긴다.
 */
export interface PendingSnapshot {
    /** 저장 대상 방 — null이면 첫 저장이 끝나기 전이라 새 방으로 만든다 */
    id: string | null;
    messages: ChatMessage[];
    mealPlanMode: MealPlanMode | null;
}

export const PENDING_SNAPSHOT_KEY = "gugbab-health:pending-snapshot";

// localStorage 값은 다른 탭·확장·손상으로 바뀔 수 있다 — DB로 옮기기 전에 모양과 크기를 검증한다
const MAX_SNAPSHOT_MESSAGES = 200;

function isChatMessage(value: unknown): value is ChatMessage {
    if (!isPlainObject(value)) return false;
    const { role, content, summary } = value;
    return (
        (role === "user" || role === "assistant") &&
        typeof content === "string" &&
        content.length > 0 &&
        content.length <= MESSAGE_LIMITS.maxContentLength * 4 &&
        (summary === undefined || typeof summary === "string")
    );
}

export function parsePendingSnapshot(raw: string | null): PendingSnapshot | null {
    if (!raw) return null;
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }
    if (!isPlainObject(parsed)) return null;
    const { id, messages, mealPlanMode } = parsed;
    if (!(id === null || (typeof id === "string" && id.length > 0 && id.length <= 64))) return null;
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_SNAPSHOT_MESSAGES) return null;
    if (!messages.every(isChatMessage)) return null;
    if (!(mealPlanMode === null || mealPlanMode === "pantry-only" || mealPlanMode === "free")) return null;
    // 저장 대상 필드만 다시 조립 — 알 수 없는 키(transient 등)는 버린다
    return {
        id,
        messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
            ...(m.summary ? { summary: m.summary } : {}),
        })),
        mealPlanMode,
    };
}

export function writePendingSnapshot(snapshot: PendingSnapshot): void {
    try {
        window.localStorage.setItem(PENDING_SNAPSHOT_KEY, JSON.stringify(snapshot));
    } catch {
        // 용량 초과 등 — IndexedDB 저장 경로가 남아 있으므로 무시
    }
}

/** 사본을 읽고 바로 지운다 — 같은 사본을 두 번 옮기지 않도록 */
export function takePendingSnapshot(): PendingSnapshot | null {
    try {
        const raw = window.localStorage.getItem(PENDING_SNAPSHOT_KEY);
        window.localStorage.removeItem(PENDING_SNAPSHOT_KEY);
        return parsePendingSnapshot(raw);
    } catch {
        return null;
    }
}

export function clearPendingSnapshot(): void {
    try {
        window.localStorage.removeItem(PENDING_SNAPSHOT_KEY);
    } catch {
        // 무시
    }
}
