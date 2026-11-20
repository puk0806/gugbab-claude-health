import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Exercise } from "./types";

const put = vi.fn();
const getAll = vi.fn();
const get = vi.fn();

vi.mock("./index", () => ({
    getDB: vi.fn(async () => ({ put, get, getAll })),
    getLocalDateString: vi.fn().mockReturnValue("2026-11-20"),
}));

const { saveRoutineDraft } = await import("./routineDraft");

beforeEach(() => {
    put.mockReset();
    get.mockReset();
    getAll.mockReset().mockResolvedValue([]);
});

function savedRoutine() {
    const call = put.mock.calls.find(([store]) => store === "routines");
    return call?.[1];
}

describe("saveRoutineDraft", () => {
    it("기본 종목은 연결하고, 없는 종목은 한 번만 만들고, 만들 수 없는 종목은 뺀다", async () => {
        const fly = {
            name: "케이블 플라이",
            sets: 3,
            repMin: 12,
            repMax: 15,
            muscleGroup: "chest",
            equipment: "cable",
        } as const;
        const result = await saveRoutineDraft({
            name: "상체 A",
            exercises: [
                { name: "바벨 벤치프레스", sets: 3, repMin: 8, repMax: 12 },
                fly,
                fly,
                { name: "무언가", sets: 3, repMin: 8, repMax: 12 },
            ],
        });
        expect(result.skipped).toEqual(["무언가"]);
        expect(result.created).toEqual(["케이블 플라이"]);
        const exercisePuts = put.mock.calls.filter(([store]) => store === "exercises");
        expect(exercisePuts).toHaveLength(1);
        const created = exercisePuts[0]?.[1] as Exercise;
        const routine = savedRoutine();
        expect(routine.name).toBe("상체 A");
        expect(routine.exercises).toEqual([
            { exerciseId: "bi-bench-press", sets: 3, repMin: 8, repMax: 12 },
            { exerciseId: created.id, sets: 3, repMin: 12, repMax: 15 },
            { exerciseId: created.id, sets: 3, repMin: 12, repMax: 15 },
        ]);
    });

    it("저장 시점의 사용자 종목을 다시 읽어 중복 생성하지 않는다", async () => {
        const existing: Exercise = {
            id: "c1",
            name: "케이블 플라이",
            muscleGroup: "chest",
            equipment: "cable",
            incrementKg: 2.5,
            builtIn: false,
        };
        getAll.mockResolvedValue([existing]);
        await saveRoutineDraft({
            name: "A",
            exercises: [
                { name: "케이블플라이", sets: 3, repMin: 12, repMax: 15, muscleGroup: "chest", equipment: "cable" },
            ],
        });
        expect(put.mock.calls.filter(([store]) => store === "exercises")).toHaveLength(0);
        expect(savedRoutine().exercises[0].exerciseId).toBe("c1");
    });

    it("id를 주면 기존 루틴을 덮어쓴다", async () => {
        get.mockResolvedValue({ id: "r1", name: "상체 A", exercises: [], createdAt: "2026-01-01", updatedAt: "" });
        await saveRoutineDraft(
            { name: "상체 A", exercises: [{ name: "풀업", sets: 3, repMin: 5, repMax: 8 }] },
            { id: "r1" },
        );
        expect(savedRoutine()).toMatchObject({ id: "r1", createdAt: "2026-01-01" });
    });

    it("저장할 종목이 하나도 없으면 오류", async () => {
        await expect(
            saveRoutineDraft({ name: "A", exercises: [{ name: "무언가", sets: 3, repMin: 8, repMax: 12 }] }),
        ).rejects.toThrow("저장할 수 없어요");
        expect(put).not.toHaveBeenCalled();
    });
});
