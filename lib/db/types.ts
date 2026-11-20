export type Gender = "male" | "female";

export type Goal = "lose-weight" | "gain-weight" | "maintain-weight" | "lean-mass" | "health";

export interface UserProfile {
    id: string;
    gender: Gender;
    goals: Goal[];
    heightCm?: number;
    weightKg?: number;
    createdAt: string;
    updatedAt: string;
}

export interface Ingredient {
    id: string;
    name: string;
    addedAt: string;
}

export interface BodyMetric {
    id: string;
    date: string;
    weight: number;
    bodyFatPct?: number;
    skeletalMuscleMass?: number;
    recordedAt: string;
}

export interface ChatMessage {
    role: "user" | "assistant";
    content: string;
    /** relay가 내려준 답변 요약 — 오래된 턴을 압축 전송할 때 원문 대신 사용 (assistant 전용) */
    summary?: string;
    /** UI 전용 임시 메시지(에러 안내 버블 등) — DB 저장·relay 전송에서 제외 */
    transient?: boolean;
}

export type MealPlanMode = "pantry-only" | "free";

export interface Conversation {
    id: string;
    title: string;
    messages: ChatMessage[];
    mealPlanMode?: MealPlanMode;
    createdAt: string;
    updatedAt: string;
}

export type MuscleGroup = "chest" | "back" | "shoulders" | "legs" | "arms" | "core";

export type Equipment = "barbell" | "dumbbell" | "machine" | "cable" | "bodyweight";

/** 운동 종목 — 기본 종목은 코드 상수(lib/training/catalog.ts), 사용자 추가 종목만 DB에 저장 */
export interface Exercise {
    id: string;
    name: string;
    muscleGroup: MuscleGroup;
    equipment: Equipment;
    /** 반복 상한 달성 시 올릴 무게(kg). 맨몸 운동은 0 */
    incrementKg: number;
    builtIn: boolean;
    createdAt?: string;
}

export interface RoutineExercise {
    exerciseId: string;
    sets: number;
    repMin: number;
    repMax: number;
}

export interface Routine {
    id: string;
    name: string;
    exercises: RoutineExercise[];
    createdAt: string;
    updatedAt: string;
}

export interface WorkoutSet {
    weightKg: number;
    reps: number;
    done: boolean;
}

export interface WorkoutEntry {
    exerciseId: string;
    /** 기록 시점 이름 스냅샷 — 사용자 종목이 지워져도 이력이 읽히도록 */
    exerciseName: string;
    /** 기록 시점 목표 세트 수 */
    targetSets: number;
    repMin: number;
    repMax: number;
    sets: WorkoutSet[];
}

export interface WorkoutSession {
    id: string;
    date: string;
    routineId?: string;
    routineName?: string;
    entries: WorkoutEntry[];
    completedAt: string;
}

/** v1 mealHistory 스토어 레코드 — v2 마이그레이션 전용 */
export interface LegacyMealHistory {
    id: string;
    date: string;
    messages: ChatMessage[];
    summary?: string;
    createdAt: string;
    updatedAt: string;
}
