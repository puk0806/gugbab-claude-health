import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import IngredientsPage from "./page";

vi.mock("@/components/layout/BottomNav", () => ({
    default: ({ active }: { active: string }) => <nav data-testid="bottom-nav" data-active={active} />,
}));

describe("IngredientsPage", () => {
    it("renders placeholder text", () => {
        render(<IngredientsPage />);
        expect(screen.getByText("식재료 관리 — Phase 2에서 구현")).toBeInTheDocument();
    });

    it("renders ingredients icon", () => {
        render(<IngredientsPage />);
        expect(screen.getByText("🥦")).toBeInTheDocument();
    });

    it("renders BottomNav with ingredients active", () => {
        render(<IngredientsPage />);
        const nav = screen.getByTestId("bottom-nav");
        expect(nav).toBeInTheDocument();
        expect(nav).toHaveAttribute("data-active", "ingredients");
    });
});
