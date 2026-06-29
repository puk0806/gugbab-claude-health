import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getUserProfile } from "@/lib/db/userProfile";
import SettingsPage from "./page";

vi.mock("@/components/layout/BottomNav", () => ({
    default: ({ active }: { active: string }) => <nav data-testid="bottom-nav" data-active={active} />,
}));

vi.mock("@/lib/db/userProfile", () => ({
    getUserProfile: vi.fn(),
    saveUserProfile: vi.fn().mockResolvedValue({}),
}));

describe("SettingsPage", () => {
    beforeEach(() => {
        vi.mocked(getUserProfile).mockResolvedValue(undefined);
    });

    it("renders BottomNav with active=settings", () => {
        render(<SettingsPage />);
        expect(screen.getByTestId("bottom-nav")).toHaveAttribute("data-active", "settings");
    });

    it("shows loading state initially", () => {
        render(<SettingsPage />);
        expect(screen.getByText("불러오는 중...")).toBeInTheDocument();
    });

    it("shows empty message when no profile", async () => {
        render(<SettingsPage />);
        await waitFor(() => expect(screen.getByText(/온보딩을 완료해주세요/)).toBeInTheDocument());
    });

    it("shows gender buttons when profile loaded", async () => {
        vi.mocked(getUserProfile).mockResolvedValue({
            id: "user-profile",
            gender: "male",
            goals: ["health"],
            createdAt: "",
            updatedAt: "",
        });

        render(<SettingsPage />);
        await waitFor(() => {
            expect(screen.getByRole("button", { name: "남성" })).toBeInTheDocument();
            expect(screen.getByRole("button", { name: "여성" })).toBeInTheDocument();
        });
    });

    it("shows goal chips when profile loaded", async () => {
        vi.mocked(getUserProfile).mockResolvedValue({
            id: "user-profile",
            gender: "female",
            goals: ["lose-weight", "health"],
            createdAt: "",
            updatedAt: "",
        });

        render(<SettingsPage />);
        await waitFor(() => expect(screen.getByRole("button", { name: "체중 감량" })).toBeInTheDocument());
    });
});
