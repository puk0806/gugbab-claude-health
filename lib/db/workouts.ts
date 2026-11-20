import { ulid } from "ulid";
import { isValidReps, isValidWeight, normalizeTarget, roundWeight, WORKOUT_LIMITS } from "@/lib/training/limits";
import type { ExerciseHistoryItem } from "@/lib/training/progression";
import { getDB, getLocalDateString } from "./index";
import type { WorkoutEntry, WorkoutSession } from "./types";

/** 최근 완료순 */
export async function listWorkoutSessions(limit?: number): Promise<WorkoutSession[]> {
    const db = await getDB();
    const all = await db.getAllFromIndex("workoutSessions", "byCompletedAt");
    const desc = all.reverse();
    return limit === undefined ? desc : desc.slice(0, limit);
}

/**
 * 완료 세트만 남겨 저장 — 완료 세트가 하나도 없는 종목은 버린다.
 * 무게는 0.25kg 단위로, 반복·목표는 허용 범위로 정규화한다.
 */
export async function addWorkoutSession(data: {
    routineId?: string;
    routineName?: string;
    entries: WorkoutEntry[];
}): Promise<WorkoutSession> {
    const entries: WorkoutEntry[] = data.entries
        .map((e) => {
            const target = normalizeTarget({ sets: e.targetSets, repMin: e.repMin, repMax: e.repMax });
            return {
                exerciseId: e.exerciseId,
                exerciseName: e.exerciseName.slice(0, WORKOUT_LIMITS.nameLength),
                targetSets: target.sets,
                repMin: target.repMin,
                repMax: target.repMax,
                sets: e.sets
                    .filter((s) => s.done && isValidWeight(s.weightKg) && isValidReps(s.reps) && s.reps > 0)
                    .map((s) => ({ weightKg: roundWeight(s.weightKg), reps: s.reps, done: true })),
            };
        })
        .filter((e) => e.sets.length > 0);
    if (entries.length === 0) throw new Error("완료한 세트가 없어요");

    const db = await getDB();
    const session: WorkoutSession = {
        id: ulid(),
        date: getLocalDateString(),
        ...(data.routineId ? { routineId: data.routineId } : {}),
        ...(data.routineName ? { routineName: data.routineName.slice(0, WORKOUT_LIMITS.nameLength) } : {}),
        entries,
        completedAt: new Date().toISOString(),
    };
    await db.put("workoutSessions", session);
    return session;
}

export async function deleteWorkoutSession(id: string): Promise<void> {
    const db = await getDB();
    await db.delete("workoutSessions", id);
}

/** 세션 목록(최신순)에서 종목별 이력(최신순)을 뽑는다 — DB 없이 테스트 가능한 순수 함수 */
export function historyByExercise(
    sessions: readonly WorkoutSession[],
    perExerciseLimit = 5,
): Map<string, ExerciseHistoryItem[]> {
    const map = new Map<string, ExerciseHistoryItem[]>();
    for (const s of sessions) {
        for (const e of s.entries) {
            const list = map.get(e.exerciseId) ?? [];
            if (list.length >= perExerciseLimit) continue;
            list.push({ date: s.date, sets: e.sets });
            map.set(e.exerciseId, list);
        }
    }
    return map;
}
