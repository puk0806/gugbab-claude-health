import { describe, expect, it } from "vitest";
import type { MuscleGroup, WorkoutSet } from "@/lib/db/types";
import { sessionScore, topSet, trendStatus, weeklyVolume } from "./trends";

const s = (weightKg: number, reps: number, done = true): WorkoutSet => ({ weightKg, reps, done });

describe("topSet", () => {
    it("가장 무거운 무게 중 반복이 가장 많은 세트", () => {
        expect(topSet([s(40, 12), s(60, 8), s(60, 10), s(70, 5, false)])).toEqual({ weightKg: 60, reps: 10 });
    });

    it("완료 세트가 없으면 null", () => {
        expect(topSet([s(60, 10, false)])).toBeNull();
        expect(topSet([])).toBeNull();
    });
});

describe("sessionScore", () => {
    it("무게가 있으면 Epley 추정치, 맨몸이면 반복 수", () => {
        expect(sessionScore({ weightKg: 60, reps: 15 })).toBe(90);
        expect(sessionScore({ weightKg: 0, reps: 12 })).toBe(12);
    });
});

describe("trendStatus", () => {
    it("3회 미만은 기록 부족", () => {
        expect(trendStatus([])).toBe("insufficient");
        expect(trendStatus([80, 82])).toBe("insufficient");
    });

    it("최신이 이전 최고를 넘으면 상승", () => {
        expect(trendStatus([80, 82, 85])).toBe("rising");
    });

    it("최고 기록 이후 3회 이상 갱신 없음이면 정체", () => {
        expect(trendStatus([80, 85, 84, 85, 83])).toBe("plateau");
    });

    it("최고 기록이 최근 2회 안이면 유지", () => {
        expect(trendStatus([80, 85, 84])).toBe("steady");
    });

    it("최고 대비 10% 넘게 떨어지면 하락", () => {
        expect(trendStatus([80, 90, 80])).toBe("falling");
    });
});

describe("weeklyVolume", () => {
    const groups: Record<string, MuscleGroup> = { bench: "chest", row: "back" };
    const muscleOf = (id: string) => groups[id];
    const session = (date: string, exerciseId: string, n: number) => ({
        date,
        entries: [{ exerciseId, sets: Array.from({ length: n }, () => s(60, 10)) }],
    });

    it("오늘 포함 7일 단위로 4주를 센다", () => {
        const result = weeklyVolume(
            [
                session("2026-11-20", "bench", 3), // 0일 전 → 0주
                session("2026-11-14", "bench", 2), // 6일 전 → 0주
                session("2026-11-13", "bench", 4), // 7일 전 → 1주
                session("2026-10-24", "row", 5), // 27일 전 → 3주
                session("2026-10-23", "row", 9), // 28일 전 → 범위 밖
            ],
            muscleOf,
            "2026-11-20",
        );
        expect(result.find((v) => v.muscleGroup === "chest")?.weeklySets).toEqual([5, 4, 0, 0]);
        expect(result.find((v) => v.muscleGroup === "back")?.weeklySets).toEqual([0, 0, 0, 5]);
        // 기록 없는 부위도 0으로 포함 — 덜 한 부위를 판단할 근거
        expect(result.map((v) => v.muscleGroup)).toEqual(["chest", "back", "shoulders", "legs", "arms", "core"]);
    });

    it("미래 날짜·깨진 날짜·삭제된 종목·미완료 세트는 세지 않는다", () => {
        const result = weeklyVolume(
            [
                session("2026-11-21", "bench", 3),
                session("어제", "bench", 3),
                session("2026-11-20", "deleted", 3),
                { date: "2026-11-20", entries: [{ exerciseId: "bench", sets: [s(60, 10, false)] }] },
            ],
            muscleOf,
            "2026-11-20",
        );
        expect(result.every((v) => v.weeklySets.every((n) => n === 0))).toBe(true);
    });

    it("주간 세트 수는 999에서 멈춘다(API 스키마 상한)", () => {
        const many = Array.from({ length: 150 }, () => session("2026-11-20", "bench", 10));
        expect(weeklyVolume(many, muscleOf, "2026-11-20")[0]?.weeklySets[0]).toBe(999);
    });

    it("월·연 경계를 넘어도 일수를 정확히 센다", () => {
        const result = weeklyVolume([session("2025-12-31", "bench", 2)], muscleOf, "2026-01-01");
        expect(result[0]?.weeklySets).toEqual([2, 0, 0, 0]);
    });
});
