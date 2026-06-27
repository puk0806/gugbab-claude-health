export type Gender = "male" | "female";

export type Goal = "lose-weight" | "gain-weight" | "maintain-weight" | "lean-mass" | "health";

export type IngredientCategory = "vegetable-fruit" | "protein" | "grain" | "dairy" | "seasoning" | "etc";

export interface UserProfile {
    id: string;
    gender: Gender;
    goals: Goal[];
    createdAt: string;
    updatedAt: string;
}

export interface Ingredient {
    id: string;
    name: string;
    category: IngredientCategory;
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
}

export interface MealHistory {
    id: string;
    date: string;
    messages: ChatMessage[];
    summary?: string;
    createdAt: string;
    updatedAt: string;
}
