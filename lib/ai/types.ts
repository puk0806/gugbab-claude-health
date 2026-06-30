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

export interface UserContext {
    gender: Gender;
    goals: Goal[];
    recentMetrics: MetricContext[];
    ingredients: IngredientContext[];
    recentMealSummaries: string[];
}

export type ChatSseEvent =
    | { type: "chunk"; text: string }
    | { type: "done" }
    | { type: "error"; message: string };
