import type { NextTargetContext, WorkoutContext } from "@/lib/ai/types";
import type { Exercise, Routine, WorkoutSession } from "@/lib/db/types";
import { historyByExercise } from "@/lib/db/workouts";
import { completedSets, recommendNext } from "./progression";

/**
 * 대화 컨텍스트용 운동 요약 — 최근 세션(최신순)과 루틴 종목별 다음 권장.
 * 같은 종목이 여러 루틴에 있으면 권장은 한 번만(최근 수정 루틴 기준) 넣는다.
 * 상한 절삭은 서버(trimContextForPrompt)가 다시 하므로 여기서는 넉넉히 넘긴다.
 */
export function buildWorkoutContext(
    sessions: readonly WorkoutSession[],
    routines: readonly Routine[],
    exercises: readonly Exercise[],
    sessionLimit = 3,
): { recentWorkouts: WorkoutContext[]; nextTargets: NextTargetContext[] } {
    const recentWorkouts: WorkoutContext[] = sessions.slice(0, sessionLimit).map((s) => ({
        date: s.date,
        ...(s.routineName ? { routineName: s.routineName } : {}),
        exercises: s.entries
            .map((e) => ({
                name: e.exerciseName,
                sets: completedSets(e.sets).map((set) => ({ weightKg: set.weightKg, reps: set.reps })),
            }))
            .filter((e) => e.sets.length > 0),
    }));

    const byId = new Map(exercises.map((e) => [e.id, e]));
    const history = historyByExercise(sessions);
    const seen = new Set<string>();
    const nextTargets: NextTargetContext[] = [];
    for (const routine of routines) {
        for (const item of routine.exercises) {
            const exercise = byId.get(item.exerciseId);
            if (!exercise || seen.has(item.exerciseId)) continue;
            seen.add(item.exerciseId);
            const rec = recommendNext({
                incrementKg: exercise.incrementKg,
                sets: item.sets,
                repMin: item.repMin,
                repMax: item.repMax,
                history: history.get(item.exerciseId) ?? [],
            });
            nextTargets.push({
                name: exercise.name,
                kind: rec.kind,
                ...(rec.weightKg !== undefined ? { weightKg: rec.weightKg } : {}),
                sets: item.sets,
                repMin: item.repMin,
                repMax: item.repMax,
            });
        }
    }
    return { recentWorkouts, nextTargets };
}
