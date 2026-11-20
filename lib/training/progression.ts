import type { WorkoutSet } from "@/lib/db/types";
import { isValidReps, isValidWeight, normalizeTarget, roundWeight } from "./limits";

/** 한 종목의 과거 1회 기록 — 최신순 배열로 넘긴다 */
export interface ExerciseHistoryItem {
    date: string;
    sets: WorkoutSet[];
}

export interface ProgressionInput {
    incrementKg: number;
    /** 현재 루틴의 목표 — 판정은 과거 기록 시점이 아니라 지금 목표 기준 */
    sets: number;
    repMin: number;
    repMax: number;
    history: ExerciseHistoryItem[];
}

export type RecommendationKind = "start" | "increase" | "hold" | "deload";

export interface Recommendation {
    kind: RecommendationKind;
    /** 권장 무게(kg). start면 기록이 없어 undefined */
    weightKg?: number;
    /** 직전 회차의 작업 무게(가장 무거운 세트) */
    lastWeightKg?: number;
    reason: string;
}

/** 완료 표시되고 값이 정상인 세트만 판정에 쓴다 — 0회·음수·NaN·범위 밖은 버린다 */
export function completedSets(sets: readonly WorkoutSet[]): WorkoutSet[] {
    return sets.filter((s) => s.done && isValidWeight(s.weightKg) && isValidReps(s.reps) && s.reps > 0);
}

interface TopSets {
    weightKg: number;
    sets: WorkoutSet[];
}

/** 가장 무거운 무게로 한 세트들 — 워밍업 세트를 판정에서 빼기 위함 */
function topSets(sets: readonly WorkoutSet[]): TopSets | null {
    const valid = completedSets(sets);
    if (valid.length === 0) return null;
    const weightKg = Math.max(...valid.map((s) => s.weightKg));
    return { weightKg, sets: valid.filter((s) => s.weightKg === weightKg) };
}

function missedLowerBound(top: TopSets, repMin: number): boolean {
    return top.sets.some((s) => s.reps < repMin);
}

function deloadWeight(weightKg: number, incrementKg: number): number {
    // 약 10% 감량을 증량 단위에 맞춘다 — 원판으로 만들 수 없는 무게를 권하지 않도록
    const step = incrementKg > 0 ? incrementKg : 0.25;
    let next = Math.round((weightKg * 0.9) / step) * step;
    if (next >= weightKg) next = weightKg - step;
    return roundWeight(Math.max(0, next));
}

/**
 * 더블 프로그레션 — 반복 범위(repMin~repMax) 안에서 반복을 먼저 늘리고,
 * 목표 세트 전부에서 상한을 채우면 무게를 올린다.
 * - 목표 세트 수만큼 상한 달성 → 증량 단위만큼 올림
 * - 하한 미달이 2회 연속(같거나 더 무거운 무게) → 약 10% 디로드
 * - 그 외 → 같은 무게 유지(반복 늘리기)
 */
export function recommendNext(input: ProgressionInput): Recommendation {
    const { sets: targetSets, repMin, repMax } = normalizeTarget(input);
    const incrementKg = isValidWeight(input.incrementKg) ? input.incrementKg : 0;

    const tops = input.history.map((h) => topSets(h.sets)).filter((t): t is TopSets => t !== null);
    const last = tops[0];
    if (!last) {
        return { kind: "start", reason: "기록이 없어요. 반복 범위 하한을 겨우 채울 무게로 시작해 보세요" };
    }

    const reachedTop = last.sets.length >= targetSets && last.sets.every((s) => s.reps >= repMax);
    if (reachedTop) {
        if (incrementKg === 0) {
            return {
                kind: "increase",
                weightKg: last.weightKg,
                lastWeightKg: last.weightKg,
                reason: `${targetSets}세트 모두 ${repMax}회 달성 — 반복 범위를 높이거나 중량을 더해 보세요`,
            };
        }
        const next = roundWeight(Math.min(last.weightKg + incrementKg, 500));
        return {
            kind: "increase",
            weightKg: next,
            lastWeightKg: last.weightKg,
            reason: `${targetSets}세트 모두 ${repMax}회 달성 — ${incrementKg}kg 올려요`,
        };
    }

    const prev = tops[1];
    if (missedLowerBound(last, repMin) && prev && prev.weightKg >= last.weightKg && missedLowerBound(prev, repMin)) {
        if (last.weightKg === 0) {
            // 맨몸 — 뺄 무게가 없으므로 반복 범위를 낮추거나 보조를 쓰라고 안내
            return {
                kind: "deload",
                weightKg: 0,
                lastWeightKg: 0,
                reason: `${repMin}회를 2회 연속 못 채웠어요 — 반복 범위를 낮추거나 보조 밴드를 써 보세요`,
            };
        }
        return {
            kind: "deload",
            weightKg: deloadWeight(last.weightKg, incrementKg),
            lastWeightKg: last.weightKg,
            reason: `${repMin}회를 2회 연속 못 채웠어요 — 약 10% 낮춰 다시 쌓아요`,
        };
    }

    return {
        kind: "hold",
        weightKg: last.weightKg,
        lastWeightKg: last.weightKg,
        reason: `같은 무게로 세트마다 ${repMax}회까지 반복을 늘려요`,
    };
}

/**
 * 추정 1RM (Epley: 무게 × (1 + 반복/30)).
 * 반복이 많을수록 오차가 커져 10회 이하 기록에만 계산한다. 계산 불가면 null.
 */
export function estimateOneRepMax(weightKg: number, reps: number): number | null {
    if (!isValidWeight(weightKg) || weightKg <= 0) return null;
    if (!Number.isInteger(reps) || reps < 1 || reps > 10) return null;
    if (reps === 1) return weightKg;
    return Math.floor(weightKg * (1 + reps / 30) * 10) / 10;
}

/** 세션 기록 중 최고 추정 1RM — 10회 이하 세트가 없으면 null */
export function bestOneRepMax(sets: readonly WorkoutSet[]): number | null {
    let best: number | null = null;
    for (const s of completedSets(sets)) {
        const e = estimateOneRepMax(s.weightKg, s.reps);
        if (e !== null && (best === null || e > best)) best = e;
    }
    return best;
}

/** "60kg×12, 12, 10" 형태 요약 — 무게가 바뀌면 무게를 다시 적는다 */
export function formatSets(sets: readonly WorkoutSet[]): string {
    const valid = completedSets(sets);
    if (valid.length === 0) return "완료 세트 없음";
    const parts: string[] = [];
    let currentWeight: number | null = null;
    for (const s of valid) {
        if (s.weightKg !== currentWeight) {
            parts.push(`${s.weightKg}kg×${s.reps}`);
            currentWeight = s.weightKg;
        } else {
            parts.push(String(s.reps));
        }
    }
    return parts.join(", ");
}

export const RECOMMENDATION_LABELS: Record<RecommendationKind, string> = {
    start: "첫 기록",
    increase: "증량",
    hold: "유지",
    deload: "디로드",
};

/** 배지 문구 — "다음 62.5kg ↑" */
export function recommendationText(rec: Recommendation): string {
    if (rec.kind === "start" || rec.weightKg === undefined) return RECOMMENDATION_LABELS.start;
    const arrow = rec.kind === "increase" ? " ↑" : rec.kind === "deload" ? " ↓" : "";
    // 맨몸(0kg)은 무게 대신 반복 범위로 조절한다
    if (rec.weightKg === 0) return `맨몸 · 반복${arrow || " 늘리기"}`;
    return `다음 ${rec.weightKg}kg${arrow}`;
}
