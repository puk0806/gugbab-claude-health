import { ulid } from "ulid";
import { getDB, getLocalDateString } from "./index";
import type { ChatMessage, MealHistory } from "./types";

export async function getTodayMealHistory(): Promise<MealHistory | undefined> {
    const db = await getDB();
    const today = getLocalDateString();
    const all = await db.getAllFromIndex("mealHistory", "byDate", today);
    return all.at(-1);
}

export async function getRecentMealHistory(days = 7): Promise<MealHistory[]> {
    const db = await getDB();
    const all = await db.getAllFromIndex("mealHistory", "byDate");
    const cutoff = getLocalDateString(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));
    return all.filter((h) => h.date >= cutoff);
}

export async function saveMealHistory(messages: ChatMessage[], summary?: string): Promise<MealHistory> {
    const db = await getDB();
    const now = new Date().toISOString();
    const today = getLocalDateString();
    const existing = await getTodayMealHistory();

    const history: MealHistory = existing
        ? { ...existing, messages, summary, updatedAt: now }
        : { id: ulid(), date: today, messages, summary, createdAt: now, updatedAt: now };

    await db.put("mealHistory", history);
    return history;
}
