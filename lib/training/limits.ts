// 운동 기록 허용 범위 — 입력 UI·진행 규칙·/api/chat zod 스키마가 반드시 이 상수를 공유한다.
// (UI는 저장되는데 API가 거부하는 정합성 함정 방지)
export const WORKOUT_LIMITS = {
    weightKg: { min: 0, max: 500 },
    reps: { min: 0, max: 100 },
    sets: { min: 1, max: 10 },
    repRange: { min: 1, max: 50 },
    incrementKg: { min: 0, max: 20 },
    nameLength: 30,
    maxRoutineExercises: 15,
    maxRoutines: 30,
} as const;

/** 무게는 0.25kg 단위까지만 의미가 있다(가장 작은 원판 0.25kg×2 기준) — 잡값 제거 */
export function roundWeight(value: number): number {
    if (!Number.isFinite(value)) return value;
    return Math.round(value * 4) / 4;
}

export function isValidWeight(value: number): boolean {
    return Number.isFinite(value) && value >= WORKOUT_LIMITS.weightKg.min && value <= WORKOUT_LIMITS.weightKg.max;
}

export function isValidReps(value: number): boolean {
    return Number.isInteger(value) && value >= WORKOUT_LIMITS.reps.min && value <= WORKOUT_LIMITS.reps.max;
}

/** 루틴 목표(세트·반복 범위)를 허용 범위로 정규화 — 레거시·변조 값이 계산을 깨지 않게 */
export function normalizeTarget(t: { sets: number; repMin: number; repMax: number }): {
    sets: number;
    repMin: number;
    repMax: number;
} {
    const clampInt = (v: number, min: number, max: number, fallback: number) =>
        Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
    const R = WORKOUT_LIMITS.repRange;
    const sets = clampInt(t.sets, WORKOUT_LIMITS.sets.min, WORKOUT_LIMITS.sets.max, 3);
    const repMin = clampInt(t.repMin, R.min, R.max, 8);
    const repMax = Math.max(repMin, clampInt(t.repMax, R.min, R.max, 12));
    return { sets, repMin, repMax };
}
