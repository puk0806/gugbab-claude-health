import { getDB } from "./index";
import type { Gender, Goal, UserProfile } from "./types";

const PROFILE_KEY = "user-profile";

export async function getUserProfile(): Promise<UserProfile | undefined> {
    const db = await getDB();
    return db.get("userProfile", PROFILE_KEY);
}

export async function saveUserProfile(data: {
    gender: Gender;
    goals: Goal[];
    heightCm?: number;
    weightKg?: number;
}): Promise<UserProfile> {
    const db = await getDB();
    const existing = await getUserProfile();
    const now = new Date().toISOString();

    const profile: UserProfile = existing
        ? { ...existing, ...data, updatedAt: now }
        : { id: PROFILE_KEY, ...data, createdAt: now, updatedAt: now };

    await db.put("userProfile", profile);
    return profile;
}

export async function updateGoals(goals: Goal[]): Promise<void> {
    const db = await getDB();
    const existing = await getUserProfile();
    if (!existing) return;
    await db.put("userProfile", { ...existing, goals, updatedAt: new Date().toISOString() });
}
