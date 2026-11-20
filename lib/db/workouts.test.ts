import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Routine, WorkoutEntry, WorkoutSession } from "./types";

const put = vi.fn();
const get = vi.fn();
const getAllFromIndex = vi.fn();
const del = vi.fn();

vi.mock("./index", () => ({
    getDB: vi.fn(async () => ({ put, get, getAllFromIndex, delete: del, getAll: vi.fn().mockResolvedValue([]) })),
    getLocalDateString: vi.fn().mockReturnValue("2026-11-20"),
}));

const { addWorkoutSession, historyByExercise, listWorkoutSessions } = await import("./workouts");
const { saveRoutine, listRoutines } = await import("./routines");
const { addCustomExercise, getAllExercises } = await import("./exercises");

function entry(overrides: Partial<WorkoutEntry> = {}): WorkoutEntry {
    return {
        exerciseId: "bi-bench-press",
        exerciseName: "바벨 벤치프레스",
        targetSets: 3,
        repMin: 8,
        repMax: 12,
        sets: [
            { weightKg: 60, reps: 12, done: true },
            { weightKg: 60, reps: 10, done: true },
            { weightKg: 60, reps: 0, done: false },
        ],
        ...overrides,
    };
}

beforeEach(() => {
    put.mockReset();
    get.mockReset();
    getAllFromIndex.mockReset();
});

describe("addWorkoutSession", () => {
    it("완료 세트만 저장하고 오늘 날짜·루틴 정보를 붙인다", async () => {
        const saved = await addWorkoutSession({ routineId: "r1", routineName: "상체 A", entries: [entry()] });
        expect(saved.date).toBe("2026-11-20");
        expect(saved.routineName).toBe("상체 A");
        expect(saved.entries[0]?.sets).toEqual([
            { weightKg: 60, reps: 12, done: true },
            { weightKg: 60, reps: 10, done: true },
        ]);
        expect(put).toHaveBeenCalledWith("workoutSessions", saved);
    });

    it("이상값(NaN·음수·범위 밖·소수 반복)은 완료 표시여도 버리고, 무게는 0.25kg 단위로 정리", async () => {
        const saved = await addWorkoutSession({
            entries: [
                entry({
                    sets: [
                        { weightKg: Number.NaN, reps: 10, done: true },
                        { weightKg: -5, reps: 10, done: true },
                        { weightKg: 9999, reps: 10, done: true },
                        { weightKg: 60, reps: 7.5, done: true },
                        { weightKg: 60.1, reps: 10, done: true },
                    ],
                }),
            ],
        });
        expect(saved.entries[0]?.sets).toEqual([{ weightKg: 60, reps: 10, done: true }]);
    });

    it("완료 세트가 없는 종목은 빼고, 전부 없으면 저장하지 않는다", async () => {
        await expect(
            addWorkoutSession({ entries: [entry({ sets: [{ weightKg: 60, reps: 10, done: false }] })] }),
        ).rejects.toThrow();
        expect(put).not.toHaveBeenCalled();
    });

    it("이름·목표를 상한으로 정규화한다", async () => {
        const saved = await addWorkoutSession({
            routineName: "가".repeat(100),
            entries: [entry({ exerciseName: "나".repeat(100), targetSets: 99, repMin: 20, repMax: 5 })],
        });
        expect(saved.routineName?.length).toBe(30);
        expect(saved.entries[0]?.exerciseName.length).toBe(30);
        expect(saved.entries[0]).toMatchObject({ targetSets: 10, repMin: 20, repMax: 20 });
    });
});

describe("listWorkoutSessions / historyByExercise", () => {
    const sessions: WorkoutSession[] = [
        { id: "1", date: "2026-11-01", entries: [entry()], completedAt: "2026-11-01T10:00:00.000Z" },
        { id: "2", date: "2026-11-05", entries: [entry()], completedAt: "2026-11-05T10:00:00.000Z" },
    ];

    it("최근 완료순으로 돌려준다", async () => {
        getAllFromIndex.mockResolvedValue([...sessions]);
        const list = await listWorkoutSessions();
        expect(list.map((s) => s.id)).toEqual(["2", "1"]);
        getAllFromIndex.mockResolvedValue([...sessions]);
        expect(await listWorkoutSessions(1)).toHaveLength(1);
    });

    it("종목별 최신순 이력을 상한 개수만큼 뽑는다", () => {
        const many: WorkoutSession[] = Array.from({ length: 8 }, (_, i) => ({
            id: String(i),
            date: `d${i}`,
            entries: [entry(), entry({ exerciseId: "bi-back-squat" })],
            completedAt: "",
        }));
        const map = historyByExercise(many, 3);
        expect(map.get("bi-bench-press")?.map((h) => h.date)).toEqual(["d0", "d1", "d2"]);
        expect(map.get("bi-back-squat")).toHaveLength(3);
        expect(historyByExercise([]).size).toBe(0);
    });
});

describe("saveRoutine / listRoutines", () => {
    it("신규 저장 시 목표를 정규화하고 종목 수를 상한으로 자른다", async () => {
        get.mockResolvedValue(undefined);
        const routine = await saveRoutine({
            name: "  상체 A  ",
            exercises: Array.from({ length: 20 }, () => ({
                exerciseId: "bi-bench-press",
                sets: 0,
                repMin: 12,
                repMax: 8,
            })),
        });
        expect(routine.name).toBe("상체 A");
        expect(routine.exercises).toHaveLength(15);
        expect(routine.exercises[0]).toEqual({ exerciseId: "bi-bench-press", sets: 1, repMin: 12, repMax: 12 });
    });

    it("기존 루틴 수정 시 id·createdAt을 유지한다", async () => {
        const existing: Routine = { id: "r1", name: "old", exercises: [], createdAt: "2026-01-01", updatedAt: "x" };
        get.mockResolvedValue(existing);
        const routine = await saveRoutine({
            id: "r1",
            name: "new",
            exercises: [{ exerciseId: "bi-pull-up", sets: 3, repMin: 5, repMax: 8 }],
        });
        expect(routine).toMatchObject({ id: "r1", name: "new", createdAt: "2026-01-01" });
    });

    it("빈 이름·빈 종목은 거부한다", async () => {
        await expect(saveRoutine({ name: "   ", exercises: [] })).rejects.toThrow();
        await expect(saveRoutine({ name: "A", exercises: [] })).rejects.toThrow();
    });

    it("최근 수정순으로 돌려준다", async () => {
        getAllFromIndex.mockResolvedValue([{ id: "a" }, { id: "b" }]);
        expect((await listRoutines()).map((r) => r.id)).toEqual(["b", "a"]);
    });
});

describe("exercises", () => {
    it("사용자 종목은 장비·부위 기준 증량 단위로 만든다", async () => {
        const ex = await addCustomExercise({ name: "  힙 쓰러스트 ", muscleGroup: "legs", equipment: "barbell" });
        expect(ex).toMatchObject({ name: "힙 쓰러스트", incrementKg: 5, builtIn: false });
        await expect(addCustomExercise({ name: " ", muscleGroup: "legs", equipment: "barbell" })).rejects.toThrow();
    });

    it("getAllExercises는 기본 종목을 포함한다", async () => {
        const all = await getAllExercises();
        expect(all.some((e) => e.id === "bi-bench-press")).toBe(true);
    });
});
