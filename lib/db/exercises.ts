import { ulid } from "ulid";
import { BUILT_IN_EXERCISES, defaultIncrementKg } from "@/lib/training/catalog";
import { WORKOUT_LIMITS } from "@/lib/training/limits";
import { getDB } from "./index";
import type { Equipment, Exercise, MuscleGroup } from "./types";

export async function getCustomExercises(): Promise<Exercise[]> {
    const db = await getDB();
    return db.getAll("exercises");
}

/** 기본 종목 + 사용자 종목 (기본 종목 먼저) */
export async function getAllExercises(): Promise<Exercise[]> {
    const custom = await getCustomExercises().catch(() => []);
    return [...BUILT_IN_EXERCISES, ...custom];
}

export async function addCustomExercise(data: {
    name: string;
    muscleGroup: MuscleGroup;
    equipment: Equipment;
}): Promise<Exercise> {
    const name = data.name.trim().slice(0, WORKOUT_LIMITS.nameLength);
    if (!name) throw new Error("종목 이름이 비어 있어요");
    const db = await getDB();
    const exercise: Exercise = {
        id: ulid(),
        name,
        muscleGroup: data.muscleGroup,
        equipment: data.equipment,
        incrementKg: defaultIncrementKg(data.equipment, data.muscleGroup),
        builtIn: false,
        createdAt: new Date().toISOString(),
    };
    await db.put("exercises", exercise);
    return exercise;
}
