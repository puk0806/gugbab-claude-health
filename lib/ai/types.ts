import type { Gender, Goal } from "@/lib/db/types";

// relay API 계약 타입 — 단일 소스는 @gugbab/relay-types (OpenAPI 생성)
export type { ModelAlias, ModelInfo, ModelsResponse } from "@gugbab/relay-types";

export interface MetricContext {
    date: string;
    weight: number;
    bodyFatPct?: number;
    skeletalMuscleMass?: number;
}

export interface IngredientContext {
    name: string;
}

export type MealPlanMode = "pantry-only" | "free";

export interface WorkoutSetContext {
    weightKg: number;
    reps: number;
}

export interface WorkoutExerciseContext {
    name: string;
    /** 완료 세트만 */
    sets: WorkoutSetContext[];
}

export interface WorkoutContext {
    date: string;
    routineName?: string;
    exercises: WorkoutExerciseContext[];
}

/** 앱이 계산한 다음 회차 권장(더블 프로그레션) — 모델이 임의 무게를 지어내지 않게 근거로 준다 */
export interface NextTargetContext {
    name: string;
    kind: "start" | "increase" | "hold" | "deload";
    weightKg?: number;
    sets: number;
    repMin: number;
    repMax: number;
}

export interface UserContext {
    gender: Gender;
    goals: Goal[];
    heightCm?: number;
    weightKg?: number;
    recentMetrics: MetricContext[];
    ingredients: IngredientContext[];
    recentMealSummaries: string[];
    mealPlanMode?: MealPlanMode;
    /** 최근 운동 세션(최신순) — 구버전 클라이언트 호환을 위해 선택 */
    recentWorkouts?: WorkoutContext[];
    nextTargets?: NextTargetContext[];
}
