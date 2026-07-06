import type { Gender, Goal, IngredientCategory } from "@/lib/db/types";

export interface MetricContext {
    date: string;
    weight: number;
    bodyFatPct?: number;
    skeletalMuscleMass?: number;
}

export interface IngredientContext {
    name: string;
    category: IngredientCategory;
}

export type MealPlanMode = "pantry-only" | "free";

export interface UserContext {
    gender: Gender;
    goals: Goal[];
    heightCm?: number;
    weightKg?: number;
    recentMetrics: MetricContext[];
    ingredients: IngredientContext[];
    recentMealSummaries: string[];
    mealPlanMode?: MealPlanMode;
}

export interface ModelInfo {
    id: string;
    alias: string;
    name: string;
    description: string;
}

export interface ModelsResponse {
    models: ModelInfo[];
    default: string;
}
