import type { Gender, Goal, MuscleGroup } from "@/lib/db/types";

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

/** 부위별 주간 완료 세트 수 — weeklySets[0]이 최근 7일, [3]이 22~28일 전 */
export interface MuscleVolumeContext {
    muscleGroup: MuscleGroup;
    weeklySets: number[];
}

export type TrendStatus = "rising" | "steady" | "plateau" | "falling" | "insufficient";

/** 종목별 장기 추세 — 회차별 최고 세트(오래된→최신)와 앱이 판정한 상태 */
export interface ExerciseTrendContext {
    name: string;
    status: TrendStatus;
    points: { date: string; weightKg: number; reps: number }[];
}

/** 현재 루틴 구성 — 종목 목표(세트·반복)는 nextTargets에 있다 */
export interface RoutineContext {
    name: string;
    exercises: string[];
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
    weeklyVolume?: MuscleVolumeContext[];
    exerciseTrends?: ExerciseTrendContext[];
    routines?: RoutineContext[];
}
