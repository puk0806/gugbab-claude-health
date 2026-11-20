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
        const ctx = buildWorkoutContext([session("2", "2026-11-18", 60, 12)], [routine], [...BUILT_IN_EXERCISES], {
            today: "2026-11-20",
        });
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
        expect(buildWorkoutContext(sessions, [], [], { sessionLimit: 3 }).recentWorkouts).toHaveLength(3);
    });

    it("빈 입력이면 빈 배열(주간 볼륨은 부위별 0)", () => {
        const ctx = buildWorkoutContext([], [], [], { today: "2026-11-20" });
        expect(ctx.recentWorkouts).toEqual([]);
        expect(ctx.nextTargets).toEqual([]);
        expect(ctx.exerciseTrends).toEqual([]);
        expect(ctx.routines).toEqual([]);
        expect(ctx.weeklyVolume.every((v) => v.weeklySets.every((n) => n === 0))).toBe(true);
    });

    it("부위별 주간 세트·종목 추세·루틴 구성을 만든다", () => {
        // 최신순 — 벤치 60kg×10이 4회 이어진 뒤 최근 회차도 같은 기록 → 정체
        const sessions = [
            session("5", "2026-11-19", 60, 10),
            session("4", "2026-11-15", 60, 10),
            session("3", "2026-11-12", 60, 10),
            session("2", "2026-11-08", 60, 10),
            session("1", "2026-10-01", 55, 10),
        ];
        const ctx = buildWorkoutContext(sessions, [routine], [...BUILT_IN_EXERCISES], { today: "2026-11-20" });
        expect(ctx.weeklyVolume.find((v) => v.muscleGroup === "chest")?.weeklySets).toEqual([6, 6, 0, 0]);
        expect(ctx.exerciseTrends).toEqual([
            {
                name: "바벨 벤치프레스",
                status: "plateau",
                points: [
                    { date: "2026-10-01", weightKg: 55, reps: 10 },
                    { date: "2026-11-08", weightKg: 60, reps: 10 },
                    { date: "2026-11-12", weightKg: 60, reps: 10 },
                    { date: "2026-11-15", weightKg: 60, reps: 10 },
                    { date: "2026-11-19", weightKg: 60, reps: 10 },
                ],
            },
        ]);
        // 삭제된 종목은 루틴 구성에서 빠진다
        expect(ctx.routines).toEqual([{ name: "상체 A", exercises: ["바벨 벤치프레스", "바벨 벤치프레스", "풀업"] }]);
    });

    it("삭제된 종목의 추세는 기록 당시 이름으로 남긴다", () => {
        const s = session("1", "2026-11-19", 60, 10);
        const ctx = buildWorkoutContext([s], [], [], { today: "2026-11-20" });
        expect(ctx.exerciseTrends[0]?.name).toBe("바벨 벤치프레스");
        expect(ctx.exerciseTrends[0]?.status).toBe("insufficient");
    });
});
