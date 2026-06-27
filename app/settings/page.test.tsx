import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SettingsPage from "./page";

vi.mock("@/components/layout/BottomNav", () => ({
    default: ({ active }: { active: string }) => <nav data-testid="bottom-nav" data-active={active} />,
}));

describe("SettingsPage", () => {
    it("renders placeholder text", () => {
        render(<SettingsPage />);
        expect(screen.getByText("설정 — Phase 2에서 구현")).toBeInTheDocument();
    });

    it("renders settings icon", () => {
        render(<SettingsPage />);
        expect(screen.getByText("⚙️")).toBeInTheDocument();
    });

    it("renders BottomNav with settings active", () => {
        render(<SettingsPage />);
        const nav = screen.getByTestId("bottom-nav");
        expect(nav).toBeInTheDocument();
        expect(nav).toHaveAttribute("data-active", "settings");
    });
});
