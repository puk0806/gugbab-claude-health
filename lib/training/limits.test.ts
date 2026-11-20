import { describe, expect, it } from "vitest";
import { BUILT_IN_EXERCISES, defaultIncrementKg } from "./catalog";
import { isValidReps, isValidWeight, normalizeTarget, roundWeight, WORKOUT_LIMITS } from "./limits";

describe("roundWeight", () => {
    it("0.25kg 단위로 반올림", () => {
        expect(roundWeight(62.5)).toBe(62.5);
        expect(roundWeight(62.6)).toBe(62.5);
        expect(roundWeight(62.13)).toBe(62.25);
        expect(roundWeight(0.1)).toBe(0);
    });

    it("NaN·Infinity는 그대로(호출부 검증 대상)", () => {
        expect(roundWeight(Number.NaN)).toBeNaN();
        expect(roundWeight(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);
    });
});

describe("isValidWeight / isValidReps", () => {
    it("범위 경계", () => {
        expect(isValidWeight(0)).toBe(true);
        expect(isValidWeight(WORKOUT_LIMITS.weightKg.max)).toBe(true);
        expect(isValidWeight(WORKOUT_LIMITS.weightKg.max + 0.01)).toBe(false);
        expect(isValidWeight(-0.01)).toBe(false);
        expect(isValidWeight(Number.NaN)).toBe(false);
        expect(isValidReps(0)).toBe(true);
        expect(isValidReps(100)).toBe(true);
        expect(isValidReps(101)).toBe(false);
        expect(isValidReps(5.5)).toBe(false);
    });
});

describe("normalizeTarget", () => {
    it("정상 값은 그대로", () => {
        expect(normalizeTarget({ sets: 3, repMin: 8, repMax: 12 })).toEqual({ sets: 3, repMin: 8, repMax: 12 });
    });

    it("범위 밖은 경계로, NaN은 기본값으로, 하한>상한이면 상한을 하한에 맞춘다", () => {
        expect(normalizeTarget({ sets: 99, repMin: 0, repMax: 999 })).toEqual({ sets: 10, repMin: 1, repMax: 50 });
        expect(normalizeTarget({ sets: Number.NaN, repMin: Number.NaN, repMax: Number.NaN })).toEqual({
            sets: 3,
            repMin: 8,
            repMax: 12,
        });
        expect(normalizeTarget({ sets: 3, repMin: 12, repMax: 8 })).toEqual({ sets: 3, repMin: 12, repMax: 12 });
        expect(normalizeTarget({ sets: 2.6, repMin: 7.4, repMax: 9.5 })).toEqual({ sets: 3, repMin: 7, repMax: 10 });
    });
});

describe("기본 종목 카탈로그", () => {
    it("id가 유일하다", () => {
        const ids = BUILT_IN_EXERCISES.map((e) => e.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("이름이 저장 상한 안이고 증량 단위가 허용 범위 안이다", () => {
        for (const e of BUILT_IN_EXERCISES) {
            expect(e.name.length).toBeLessThanOrEqual(WORKOUT_LIMITS.nameLength);
            expect(e.incrementKg).toBeGreaterThanOrEqual(WORKOUT_LIMITS.incrementKg.min);
            expect(e.incrementKg).toBeLessThanOrEqual(WORKOUT_LIMITS.incrementKg.max);
            expect(e.builtIn).toBe(true);
        }
    });

    it("증량 기본값: 바벨 상체 2.5 · 하체 5 · 덤벨 2 · 맨몸 0", () => {
        expect(defaultIncrementKg("barbell", "chest")).toBe(2.5);
        expect(defaultIncrementKg("barbell", "legs")).toBe(5);
        expect(defaultIncrementKg("dumbbell", "arms")).toBe(2);
        expect(defaultIncrementKg("bodyweight", "back")).toBe(0);
    });
});
