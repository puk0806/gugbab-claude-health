import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveUserProfile } from "@/lib/db/userProfile";
import OnboardingPage from "./page";

vi.mock("next/navigation", () => ({
    useRouter: vi.fn(),
}));

vi.mock("@/lib/db/userProfile", () => ({
    saveUserProfile: vi.fn().mockResolvedValue({}),
}));

describe("OnboardingPage", () => {
    const mockPush = vi.fn();

    beforeEach(() => {
        vi.mocked(useRouter).mockReturnValue({
            push: mockPush,
        } as unknown as ReturnType<typeof useRouter>);
        mockPush.mockClear();
        vi.mocked(saveUserProfile).mockClear();
    });

    it("renders gender and goal sections", () => {
        render(<OnboardingPage />);
        expect(screen.getByText("성별")).toBeInTheDocument();
        expect(screen.getByText("목표 (복수 선택)")).toBeInTheDocument();
    });

    it("renders male and female buttons", () => {
        render(<OnboardingPage />);
        expect(screen.getByRole("button", { name: "남성" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "여성" })).toBeInTheDocument();
    });

    it("save button is disabled when nothing selected", () => {
        render(<OnboardingPage />);
        expect(screen.getByRole("button", { name: "시작하기" })).toBeDisabled();
    });

    it("save button enables after gender and goal selected", () => {
        render(<OnboardingPage />);
        fireEvent.click(screen.getByRole("button", { name: "남성" }));
        fireEvent.click(screen.getByRole("button", { name: "체중 감량" }));
        expect(screen.getByRole("button", { name: "시작하기" })).not.toBeDisabled();
    });

    it("calls saveUserProfile and redirects on save", async () => {
        vi.mocked(saveUserProfile).mockResolvedValue({
            id: "user-profile",
            gender: "female",
            goals: ["health"],
            createdAt: "",
            updatedAt: "",
        });
        render(<OnboardingPage />);
        fireEvent.click(screen.getByRole("button", { name: "여성" }));
        fireEvent.click(screen.getByRole("button", { name: "건강 유지" }));
        fireEvent.click(screen.getByRole("button", { name: "시작하기" }));

        await waitFor(() =>
            expect(vi.mocked(saveUserProfile)).toHaveBeenCalledWith({
                gender: "female",
                goals: ["health"],
            }),
        );
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/"));
    });
});
