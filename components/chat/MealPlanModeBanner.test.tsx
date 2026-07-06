import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MealPlanModeBanner from "./MealPlanModeBanner";

describe("MealPlanModeBanner", () => {
    it("안내 문구와 두 선택지를 표시한다", () => {
        render(<MealPlanModeBanner onSelect={vi.fn()} />);
        expect(screen.getByText(/어떻게 추천해드릴까요/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "보유 재료로만" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "자유롭게 추천" })).toBeInTheDocument();
    });

    it("선택 시 해당 모드로 onSelect 호출", () => {
        const onSelect = vi.fn();
        render(<MealPlanModeBanner onSelect={onSelect} />);
        fireEvent.click(screen.getByRole("button", { name: "보유 재료로만" }));
        expect(onSelect).toHaveBeenCalledWith("pantry-only");
        fireEvent.click(screen.getByRole("button", { name: "자유롭게 추천" }));
        expect(onSelect).toHaveBeenCalledWith("free");
    });
});
