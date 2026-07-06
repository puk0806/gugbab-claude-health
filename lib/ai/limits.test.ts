import { describe, expect, it } from "vitest";
import { BODY_LIMITS, isInRange } from "./limits";

describe("BODY_LIMITS", () => {
    it("키·몸무게 범위가 현실적인 값으로 정의되어 있다", () => {
        expect(BODY_LIMITS.heightCm.min).toBeLessThan(BODY_LIMITS.heightCm.max);
        expect(BODY_LIMITS.weightKg.min).toBeLessThan(BODY_LIMITS.weightKg.max);
    });

    it("isInRange가 경계값을 포함한다", () => {
        expect(isInRange(50, BODY_LIMITS.heightCm)).toBe(true);
        expect(isInRange(300, BODY_LIMITS.heightCm)).toBe(true);
        expect(isInRange(49.9, BODY_LIMITS.heightCm)).toBe(false);
        expect(isInRange(300.1, BODY_LIMITS.heightCm)).toBe(false);
    });

    it("isInRange가 NaN·Infinity를 거부한다", () => {
        expect(isInRange(Number.NaN, BODY_LIMITS.weightKg)).toBe(false);
        expect(isInRange(Number.POSITIVE_INFINITY, BODY_LIMITS.weightKg)).toBe(false);
    });
});
