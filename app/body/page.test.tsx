import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addBodyMetric, getLatestBodyMetrics } from "@/lib/db/bodyMetrics";
import BodyPage from "./page";

vi.mock("@/components/layout/BottomNav", () => ({
    default: ({ active }: { active: string }) => <nav data-testid="bottom-nav" data-active={active} />,
}));

vi.mock("@/lib/db/bodyMetrics", () => ({
    getLatestBodyMetrics: vi.fn().mockResolvedValue([]),
    addBodyMetric: vi.fn(),
}));

vi.mock("@/lib/db/index", () => ({
    getLocalDateString: vi.fn().mockReturnValue("2026-06-27"),
    getDB: vi.fn(),
}));

describe("BodyPage", () => {
    beforeEach(() => {
        vi.mocked(getLatestBodyMetrics).mockResolvedValue([]);
        vi.mocked(addBodyMetric).mockClear();
    });

    it("renders weight input and save button", () => {
        render(<BodyPage />);
        expect(screen.getByLabelText(/체중/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "저장" })).toBeInTheDocument();
    });

    it("save button is disabled when weight is empty", () => {
        render(<BodyPage />);
        expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
    });

    it("shows empty state when no records", async () => {
        render(<BodyPage />);
        await waitFor(() => expect(screen.getByText("기록이 없습니다")).toBeInTheDocument());
    });

    it("renders BottomNav with active=body", () => {
        render(<BodyPage />);
        expect(screen.getByTestId("bottom-nav")).toHaveAttribute("data-active", "body");
    });

    it("saves metric and shows record in list", async () => {
        vi.mocked(addBodyMetric).mockResolvedValue({
            id: "01",
            date: "2026-06-27",
            weight: 70,
            recordedAt: "",
        });

        render(<BodyPage />);
        fireEvent.change(screen.getByLabelText(/체중/), { target: { value: "70" } });
        fireEvent.click(screen.getByRole("button", { name: "저장" }));

        await waitFor(() => expect(screen.getByText("70 kg")).toBeInTheDocument());
    });
});
