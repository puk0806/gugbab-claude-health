import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BodyPage from "./page";

vi.mock("@/components/layout/BottomNav", () => ({
    default: ({ active }: { active: string }) => <nav data-testid="bottom-nav" data-active={active} />,
}));

describe("BodyPage", () => {
    it("renders placeholder text", () => {
        render(<BodyPage />);
        expect(screen.getByText("신체 지표 — Phase 2에서 구현")).toBeInTheDocument();
    });

    it("renders body icon", () => {
        render(<BodyPage />);
        expect(screen.getByText("📊")).toBeInTheDocument();
    });

    it("renders BottomNav with body active", () => {
        render(<BodyPage />);
        const nav = screen.getByTestId("bottom-nav");
        expect(nav).toBeInTheDocument();
        expect(nav).toHaveAttribute("data-active", "body");
    });
});
