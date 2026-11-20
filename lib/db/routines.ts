import { ulid } from "ulid";
import { normalizeTarget, WORKOUT_LIMITS } from "@/lib/training/limits";
import { getDB } from "./index";
import type { Routine, RoutineExercise } from "./types";

/** 최근 수정순 */
export async function listRoutines(): Promise<Routine[]> {
    const db = await getDB();
    const all = await db.getAllFromIndex("routines", "byUpdatedAt");
    return all.reverse();
}

export async function getRoutine(id: string): Promise<Routine | undefined> {
    const db = await getDB();
    return db.get("routines", id);
}

/** 신규(id 없음) 또는 수정. 이름·종목 수·목표 값을 상한 내로 정규화해 저장한다 */
export async function saveRoutine(data: { id?: string; name: string; exercises: RoutineExercise[] }): Promise<Routine> {
    const name = data.name.trim().slice(0, WORKOUT_LIMITS.nameLength);
    if (!name) throw new Error("루틴 이름이 비어 있어요");
    const exercises = data.exercises
        .slice(0, WORKOUT_LIMITS.maxRoutineExercises)
        .map((e) => ({ exerciseId: e.exerciseId, ...normalizeTarget(e) }));
    if (exercises.length === 0) throw new Error("종목을 하나 이상 추가해 주세요");

    const db = await getDB();
    const now = new Date().toISOString();
    const existing = data.id ? await db.get("routines", data.id) : undefined;
    const routine: Routine = {
        id: existing?.id ?? ulid(),
        name,
        exercises,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
    };
    await db.put("routines", routine);
    return routine;
}

export async function deleteRoutine(id: string): Promise<void> {
    const db = await getDB();
    await db.delete("routines", id);
}
