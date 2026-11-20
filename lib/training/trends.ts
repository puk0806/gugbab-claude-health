import type { TrendStatus } from "@/lib/ai/types";
import type { MuscleGroup, WorkoutSet } from "@/lib/db/types";
import { MUSCLE_GROUPS } from "./catalog";
import { completedSets } from "./progression";

/** 추세 판정에 쓰는 회차 수 상한 */
export const TREND_HISTORY_LIMIT = 6;
/** 이 회차 이상 최고 기록을 못 넘기면 정체 */
export const PLATEAU_SESSIONS = 3;
/** 최고 기록 대비 이 비율 아래면 하락 */
export const FALLING_RATIO = 0.9;
/** 주간 볼륨을 보는 주 수 */
export const VOLUME_WEEKS = 4;
/** 주간 세트 수 상한 — /api/chat 스키마와 같은 값(넘으면 요청이 400) */
export const MAX_WEEKLY_SETS = 999;

export interface TopSet {
    weightKg: number;
    reps: number;
}

/** 회차의 대표 세트 — 가장 무거운 무게 중 반복이 가장 많은 세트 */
export function topSet(sets: readonly WorkoutSet[]): TopSet | null {
    let best: TopSet | null = null;
    for (const s of completedSets(sets)) {
        if (!best || s.weightKg > best.weightKg || (s.weightKg === best.weightKg && s.reps > best.reps)) {
            best = { weightKg: s.weightKg, reps: s.reps };
        }
    }
    return best;
}

/**
 * 회차 성과 점수 — 무게가 있으면 Epley 추정치(무게×(1+반복/30)), 맨몸이면 반복 수.
 * 비교용이라 1RM 표시(10회 이하 제한)와 달리 반복 상한 없이 계산한다.
 */
export function sessionScore(top: TopSet): number {
    return top.weightKg > 0 ? top.weightKg * (1 + top.reps / 30) : top.reps;
}

/**
 * 점수(오래된→최신)로 추세 판정.
 * - 3회 미만: insufficient
 * - 최신이 이전 최고를 넘으면 rising
 * - 최신이 최고의 90% 미만이면 falling
 * - 최고 기록 이후 3회 이상 갱신 없음이면 plateau
 * - 그 외 steady
 */
export function trendStatus(scores: readonly number[]): TrendStatus {
    if (scores.length < 3) return "insufficient";
    const latest = scores[scores.length - 1] as number;
    const earlierBest = Math.max(...scores.slice(0, -1));
    if (latest > earlierBest) return "rising";
    if (latest < earlierBest * FALLING_RATIO) return "falling";
    // 같은 최고 기록이 여러 번이면 처음 달성한 회차부터 센다
    const bestIdx = scores.indexOf(earlierBest);
    if (scores.length - 1 - bestIdx >= PLATEAU_SESSIONS) return "plateau";
    return "steady";
}

/** YYYY-MM-DD 두 날짜의 일수 차 — 형식이 아니면 null */
function daysBetween(from: string, to: string): number | null {
    const re = /^\d{4}-\d{2}-\d{2}$/;
    if (!re.test(from) || !re.test(to)) return null;
    const a = Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10)));
    const b = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10)));
    return Math.round((b - a) / 86_400_000);
}

/**
 * 부위별 주간 완료 세트 수. 주 0 = 오늘 포함 최근 7일.
 * 종목을 찾을 수 없는(삭제된) 기록과 미래 날짜·형식이 깨진 날짜는 세지 않는다.
 */
export function weeklyVolume(
    sessions: readonly { date: string; entries: readonly { exerciseId: string; sets: readonly WorkoutSet[] }[] }[],
    muscleOf: (exerciseId: string) => MuscleGroup | undefined,
    today: string,
): { muscleGroup: MuscleGroup; weeklySets: number[] }[] {
    const counts = new Map<MuscleGroup, number[]>(MUSCLE_GROUPS.map((g) => [g, Array(VOLUME_WEEKS).fill(0)]));
    for (const s of sessions) {
        const diff = daysBetween(s.date, today);
        if (diff === null || diff < 0) continue;
        const week = Math.floor(diff / 7);
        if (week >= VOLUME_WEEKS) continue;
        for (const e of s.entries) {
            const group = muscleOf(e.exerciseId);
            const row = group ? counts.get(group) : undefined;
            if (row) row[week] = (row[week] ?? 0) + completedSets(e.sets).length;
        }
    }
    return MUSCLE_GROUPS.map((g) => ({
        muscleGroup: g,
        weeklySets: (counts.get(g) ?? []).map((n) => Math.min(MAX_WEEKLY_SETS, n)),
    }));
}
