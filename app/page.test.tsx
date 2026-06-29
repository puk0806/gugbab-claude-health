import { render, screen, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getUserProfile } from "@/lib/db/userProfile";
import ChatPage from "./page";

vi.mock("next/navigation", () => ({
    useRouter: vi.fn(),
}));

vi.mock("@/lib/db/userProfile", () => ({
    getUserProfile: vi.fn(),
}));

vi.mock("@/components/layout/BottomNav", () => ({
    default: ({ active }: { active: string }) => <nav data-testid="bottom-nav" data-active={active} />,
}));

describe("ChatPage", () => {
    const mockReplace = vi.fn();

    beforeEach(() => {
        vi.mocked(useRouter).mockReturnValue({
            replace: mockReplace,
            push: vi.fn(),
        } as unknown as ReturnType<typeof useRouter>);
        mockReplace.mockClear();
    });

    it("redirects to /onboarding when no profile", async () => {
        vi.mocked(getUserProfile).mockResolvedValue(undefined);
        render(<ChatPage />);
        await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/onboarding"));
    });

    it("renders chat placeholder when profile exists", async () => {
        vi.mocked(getUserProfile).mockResolvedValue({
            id: "user-profile",
            gender: "male",
            goals: ["health"],
            createdAt: "",
            updatedAt: "",
        });
        render(<ChatPage />);
        await waitFor(() => expect(screen.getByText("식단 채팅 — Phase 3에서 구현")).toBeInTheDocument());
    });

    it("renders BottomNav with active=chat when profile exists", async () => {
        vi.mocked(getUserProfile).mockResolvedValue({
            id: "user-profile",
            gender: "female",
            goals: ["health"],
            createdAt: "",
            updatedAt: "",
        });
        render(<ChatPage />);
        await waitFor(() => expect(screen.getByTestId("bottom-nav")).toHaveAttribute("data-active", "chat"));
    });
});
