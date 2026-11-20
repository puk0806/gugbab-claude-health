import { isPlainObject } from "@gugbab/utils";

/** 기록 중인 세트 입력 — 문자열 그대로 보관해 입력 도중 값("62.")을 깨뜨리지 않는다 */
export interface DraftSet {
    weight: string;
    reps: string;
    done: boolean;
}

export interface DraftEntry {
    exerciseId: string;
    sets: DraftSet[];
}

const KEY_PREFIX = "gugbab-health:workout-draft:";
const MAX_DRAFT_CHARS = 50_000;

function key(routineId: string): string {
    return `${KEY_PREFIX}${routineId}`;
}

function isDraftSet(v: unknown): v is DraftSet {
    return (
        isPlainObject(v) &&
        typeof v.weight === "string" &&
        typeof v.reps === "string" &&
        typeof v.done === "boolean" &&
        v.weight.length <= 10 &&
        v.reps.length <= 10
    );
}

function isDraftEntry(v: unknown): v is DraftEntry {
    return isPlainObject(v) && typeof v.exerciseId === "string" && Array.isArray(v.sets) && v.sets.every(isDraftSet);
}

/**
 * 운동 중 새로고침·앱 전환으로 입력이 사라지지 않게 브라우저에 임시 저장.
 * 저장소 접근 실패(사생활 보호 모드 등)는 조용히 무시 — 기록 자체는 계속 가능해야 한다.
 */
export function loadDraft(routineId: string): DraftEntry[] | null {
    try {
        const raw = localStorage.getItem(key(routineId));
        if (!raw || raw.length > MAX_DRAFT_CHARS) return null;
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) && parsed.every(isDraftEntry) ? parsed : null;
    } catch {
        return null;
    }
}

export function saveDraft(routineId: string, entries: DraftEntry[]): void {
    try {
        localStorage.setItem(key(routineId), JSON.stringify(entries));
    } catch {
        // 저장소 가득 참·차단 — 무시
    }
}

export function clearDraft(routineId: string): void {
    try {
        localStorage.removeItem(key(routineId));
    } catch {
        // 무시
    }
}
