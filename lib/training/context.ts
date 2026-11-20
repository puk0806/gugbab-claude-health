import type {
    ExerciseTrendContext,
    MuscleVolumeContext,
    NextTargetContext,
    RoutineContext,
    WorkoutContext,
} from "@/lib/ai/types";
import { getLocalDateString } from "@/lib/db/index";
import type { Exercise, Routine, WorkoutSession } from "@/lib/db/types";
import { historyByExercise } from "@/lib/db/workouts";
import { completedSets, recommendNext } from "./progression";
import { sessionScore, type TopSet, TREND_HISTORY_LIMIT, topSet, trendStatus, weeklyVolume } from "./trends";

export interface WorkoutContextParts {
    recentWorkouts: WorkoutContext[];
    nextTargets: NextTargetContext[];
    weeklyVolume: MuscleVolumeContext[];
    exerciseTrends: ExerciseTrendContext[];
    routines: RoutineContext[];
}

export interface WorkoutContextOptions {
    /** 최근 세션 상세를 몇 회까지 넣을지 */
    sessionLimit?: number;
    /** 주간 볼륨 기준일(YYYY-MM-DD) — 테스트 고정용, 기본은 오늘 */
    today?: string;
}

/**
 * 대화 컨텍스트용 운동 요약 — 원본 기록 대신 요약을 보내 프롬프트 상한 안에서 장기 흐름을 전달한다.
 * - recentWorkouts: 최근 세션 상세(최신순)
 * - nextTargets: 루틴 종목별 다음 권장. 같은 종목이 여러 루틴에 있으면 한 번만(최근 수정 루틴 기준)
 * - weeklyVolume: 부위별 최근 4주 주간 완료 세트
 * - exerciseTrends: 최근 수행 종목의 회차별 최고 세트와 추세 판정
 * - routines: 현재 루틴 구성(종목 이름)
 * 상한 절삭은 서버(trimContextForPrompt)가 다시 하므로 여기서는 넉넉히 넘긴다.
 */
export function buildWorkoutContext(
    sessions: readonly WorkoutSession[],
    routines: readonly Routine[],
    exercises: readonly Exercise[],
    options: WorkoutContextOptions = {},
): WorkoutContextParts {
    const { sessionLimit = 3, today = getLocalDateString() } = options;
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

    // 종목 이름은 현재 이름 우선, 삭제된 종목은 기록 당시 이름
    const nameOf = (id: string, snapshot: string) => byId.get(id)?.name ?? snapshot;
    const snapshotNames = new Map<string, string>();
    for (const s of sessions)
        for (const e of s.entries)
            if (!snapshotNames.has(e.exerciseId)) snapshotNames.set(e.exerciseId, e.exerciseName);

    const exerciseTrends: ExerciseTrendContext[] = [];
    // historyByExercise는 세션(최신순)을 돌며 처음 나온 순서로 넣는다 → 최근 수행 종목 순
    for (const [exerciseId, items] of historyByExercise(sessions, TREND_HISTORY_LIMIT)) {
        const points = items
            .map((h) => ({ date: h.date, top: topSet(h.sets) }))
            .filter((p): p is { date: string; top: TopSet } => p.top !== null)
            .reverse();
        if (points.length === 0) continue;
        exerciseTrends.push({
            name: nameOf(exerciseId, snapshotNames.get(exerciseId) ?? ""),
            status: trendStatus(points.map((p) => sessionScore(p.top))),
            points: points.map((p) => ({ date: p.date, weightKg: p.top.weightKg, reps: p.top.reps })),
        });
    }

    const routineContexts: RoutineContext[] = routines
        .map((r) => ({
            name: r.name,
            exercises: r.exercises.flatMap((item) => {
                const name = byId.get(item.exerciseId)?.name;
                return name ? [name] : [];
            }),
        }))
        .filter((r) => r.exercises.length > 0);

    return {
        recentWorkouts,
        nextTargets,
        weeklyVolume: weeklyVolume(sessions, (id) => byId.get(id)?.muscleGroup, today),
        exerciseTrends,
        routines: routineContexts,
    };
}
