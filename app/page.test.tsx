import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ChatPage from "./page";

vi.mock("@/components/layout/BottomNav", () => ({
    default: ({ active }: { active: string }) => <nav data-testid="bottom-nav" data-active={active} />,
}));

describe("ChatPage", () => {
    it("renders placeholder text", () => {
        render(<ChatPage />);
        expect(screen.getByText("식단 채팅 — Phase 3에서 구현")).toBeInTheDocument();
    });

    it("renders chat icon", () => {
        render(<ChatPage />);
        expect(screen.getByText("🍽️")).toBeInTheDocument();
    });

    it("renders BottomNav with chat active", () => {
        render(<ChatPage />);
        const nav = screen.getByTestId("bottom-nav");
        expect(nav).toBeInTheDocument();
        expect(nav).toHaveAttribute("data-active", "chat");
    });
});
