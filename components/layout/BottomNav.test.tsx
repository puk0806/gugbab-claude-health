import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BottomNav from "./BottomNav";

vi.mock("next/link", () => ({
    default: ({
        href,
        children,
        className,
    }: {
        href: string;
        children: import("react").ReactNode;
        className?: string;
    }) => (
        <a href={href} className={className}>
            {children}
        </a>
    ),
}));

describe("BottomNav", () => {
    it("renders 4 navigation links", () => {
        render(<BottomNav active="chat" />);
        expect(screen.getAllByRole("link")).toHaveLength(4);
    });

    it("renders all tab labels", () => {
        render(<BottomNav active="chat" />);
        expect(screen.getByText("식단")).toBeInTheDocument();
        expect(screen.getByText("식재료")).toBeInTheDocument();
        expect(screen.getByText("지표")).toBeInTheDocument();
        expect(screen.getByText("설정")).toBeInTheDocument();
    });

    it("active tab gets active class", () => {
        render(<BottomNav active="body" />);
        expect(screen.getByText("지표").closest("a")?.className).toContain("active");
    });

    it("inactive tabs do not have active class", () => {
        render(<BottomNav active="chat" />);
        expect(screen.getByText("식재료").closest("a")?.className).not.toContain("active");
        expect(screen.getByText("지표").closest("a")?.className).not.toContain("active");
        expect(screen.getByText("설정").closest("a")?.className).not.toContain("active");
    });

    it("each tab links to correct href", () => {
        render(<BottomNav active="chat" />);
        expect(screen.getByText("식단").closest("a")).toHaveAttribute("href", "/");
        expect(screen.getByText("식재료").closest("a")).toHaveAttribute("href", "/ingredients");
        expect(screen.getByText("지표").closest("a")).toHaveAttribute("href", "/body");
        expect(screen.getByText("설정").closest("a")).toHaveAttribute("href", "/settings");
    });

    it("renders tab icons", () => {
        render(<BottomNav active="chat" />);
        expect(screen.getByText("🍽️")).toBeInTheDocument();
        expect(screen.getByText("🥦")).toBeInTheDocument();
        expect(screen.getByText("📊")).toBeInTheDocument();
        expect(screen.getByText("⚙️")).toBeInTheDocument();
    });
});
