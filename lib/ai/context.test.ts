import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "./context";
import type { UserContext } from "./types";

const BASE: UserContext = {
    gender: "male",
    goals: ["lose-weight", "lean-mass"],
    recentMetrics: [{ date: "2026-06-27", weight: 74, bodyFatPct: 21.5, skeletalMuscleMass: 35.2 }],
    ingredients: [
        { name: "닭가슴살", category: "protein" },
        { name: "브로콜리", category: "vegetable-fruit" },
    ],
    recentMealSummaries: [],
};

describe("buildSystemPrompt", () => {
    it("성별·목표를 포함한다", () => {
        const p = buildSystemPrompt(BASE);
        expect(p).toContain("남성");
        expect(p).toContain("체중 감량");
        expect(p).toContain("근육량 증가");
    });

    it("신체 지표를 포함한다", () => {
        const p = buildSystemPrompt(BASE);
        expect(p).toContain("74kg");
        expect(p).toContain("21.5%");
        expect(p).toContain("35.2kg");
    });

    it("식재료를 카테고리별로 포함한다", () => {
        const p = buildSystemPrompt(BASE);
        expect(p).toContain("닭가슴살");
        expect(p).toContain("브로콜리");
        expect(p).toContain("단백질");
        expect(p).toContain("채소·과일");
    });

    it("식재료 없으면 없음 메시지", () => {
        const p = buildSystemPrompt({ ...BASE, ingredients: [] });
        expect(p).toContain("등록된 식재료 없음");
    });

    it("신체 지표 없으면 없음 메시지", () => {
        const p = buildSystemPrompt({ ...BASE, recentMetrics: [] });
        expect(p).toContain("기록 없음");
    });

    it("여성 프로필", () => {
        const p = buildSystemPrompt({ ...BASE, gender: "female" });
        expect(p).toContain("여성");
    });

    it("체지방률·골격근량 없는 지표도 처리", () => {
        const p = buildSystemPrompt({
            ...BASE,
            recentMetrics: [{ date: "2026-06-27", weight: 70 }],
        });
        expect(p).toContain("70kg");
        expect(p).not.toContain("체지방률");
    });

    it("최근 식단 이력을 포함한다", () => {
        const p = buildSystemPrompt({ ...BASE, recentMealSummaries: ["2026-06-26: 닭가슴살 샐러드"] });
        expect(p).toContain("닭가슴살 샐러드");
    });
});
