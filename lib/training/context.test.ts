import { describe, expect, it } from "vitest";
import type { Routine, WorkoutSession } from "@/lib/db/types";
import { BUILT_IN_EXERCISES } from "./catalog";
import { buildWorkoutContext } from "./context";

const session = (id: string, date: string, weightKg: number, reps: number): WorkoutSession => ({
    id,
    date,
    routineName: "상체 A",
    entries: [
        {
            exerciseId: "bi-bench-press",
            exerciseName: "바벨 벤치프레스",
            targetSets: 3,
            repMin: 8,
            repMax: 12,
            sets: [
                { weightKg, reps, done: true },
                { weightKg, reps, done: true },
                { weightKg, reps, done: true },
            ],
        },
    ],
    completedAt: date,
});

const routine: Routine = {
    id: "r1",
    name: "상체 A",
    exercises: [
        { exerciseId: "bi-bench-press", sets: 3, repMin: 8, repMax: 12 },
        { exerciseId: "bi-bench-press", sets: 3, repMin: 8, repMax: 12 },
        { exerciseId: "bi-pull-up", sets: 3, repMin: 5, repMax: 8 },
        { exerciseId: "deleted-custom", sets: 3, repMin: 5, repMax: 8 },
    ],
    createdAt: "",
    updatedAt: "",
};

describe("buildWorkoutContext", () => {
    it("최근 세션과 종목별 다음 권장을 만든다(중복·삭제 종목 제외)", () => {
        const ctx = buildWorkoutContext([session("2", "2026-11-18", 60, 12)], [routine], [...BUILT_IN_EXERCISES]);
        expect(ctx.recentWorkouts).toEqual([
            {
                date: "2026-11-18",
                routineName: "상체 A",
                exercises: [
                    {
                        name: "바벨 벤치프레스",
                        sets: [
                            { weightKg: 60, reps: 12 },
                            { weightKg: 60, reps: 12 },
                            { weightKg: 60, reps: 12 },
                        ],
                    },
                ],
            },
        ]);
        expect(ctx.nextTargets).toEqual([
            { name: "바벨 벤치프레스", kind: "increase", weightKg: 62.5, sets: 3, repMin: 8, repMax: 12 },
            { name: "풀업", kind: "start", sets: 3, repMin: 5, repMax: 8 },
        ]);
    });

    it("세션 개수 상한을 지킨다", () => {
        const sessions = Array.from({ length: 10 }, (_, i) => session(String(i), `d${i}`, 60, 10));
        expect(buildWorkoutContext(sessions, [], [], 3).recentWorkouts).toHaveLength(3);
    });

    it("빈 입력이면 빈 배열", () => {
        expect(buildWorkoutContext([], [], [])).toEqual({ recentWorkouts: [], nextTargets: [] });
    });
});
