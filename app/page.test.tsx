import { render, screen, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAllIngredients } from "@/lib/db/ingredients";
import { getLatestBodyMetrics } from "@/lib/db/bodyMetrics";
import { getTodayMealHistory } from "@/lib/db/mealHistory";
import { getUserProfile } from "@/lib/db/userProfile";
import ChatPage from "./page";

vi.mock("next/navigation", () => ({
    useRouter: vi.fn(),
}));

vi.mock("@/lib/db/userProfile", () => ({
    getUserProfile: vi.fn(),
}));

vi.mock("@/lib/db/ingredients", () => ({
    getAllIngredients: vi.fn(),
}));

vi.mock("@/lib/db/bodyMetrics", () => ({
    getLatestBodyMetrics: vi.fn(),
}));

vi.mock("@/lib/db/mealHistory", () => ({
    getTodayMealHistory: vi.fn(),
    saveMealHistory: vi.fn(),
}));

vi.mock("@/components/layout/BottomNav", () => ({
    default: ({ active }: { active: string }) => <nav data-testid="bottom-nav" data-active={active} />,
}));

const MOCK_PROFILE = {
    id: "user-profile",
    gender: "male" as const,
    goals: ["lose-weight" as const],
    createdAt: "",
    updatedAt: "",
};

describe("ChatPage", () => {
    const mockReplace = vi.fn();

    beforeEach(() => {
        vi.mocked(useRouter).mockReturnValue({
            replace: mockReplace,
            push: vi.fn(),
        } as unknown as ReturnType<typeof useRouter>);
        mockReplace.mockClear();
        vi.mocked(getAllIngredients).mockResolvedValue([]);
        vi.mocked(getLatestBodyMetrics).mockResolvedValue([]);
        vi.mocked(getTodayMealHistory).mockResolvedValue(undefined);
    });

    it("프로필 없으면 /onboarding으로 리다이렉트", async () => {
        vi.mocked(getUserProfile).mockResolvedValue(undefined);
        render(<ChatPage />);
        await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/onboarding"));
    });

    it("프로필 있으면 입력창 표시", async () => {
        vi.mocked(getUserProfile).mockResolvedValue(MOCK_PROFILE);
        render(<ChatPage />);
        await waitFor(() =>
            expect(screen.getByPlaceholderText("식단을 요청해보세요...")).toBeInTheDocument(),
        );
    });

    it("프로필 있으면 전송 버튼 표시", async () => {
        vi.mocked(getUserProfile).mockResolvedValue(MOCK_PROFILE);
        render(<ChatPage />);
        await waitFor(() => expect(screen.getByRole("button", { name: "전송" })).toBeInTheDocument());
    });

    it("BottomNav active=chat", async () => {
        vi.mocked(getUserProfile).mockResolvedValue(MOCK_PROFILE);
        render(<ChatPage />);
        await waitFor(() =>
            expect(screen.getByTestId("bottom-nav")).toHaveAttribute("data-active", "chat"),
        );
    });

    it("오늘 대화 이력이 있으면 메시지를 표시한다", async () => {
        vi.mocked(getUserProfile).mockResolvedValue(MOCK_PROFILE);
        vi.mocked(getTodayMealHistory).mockResolvedValue({
            id: "h1",
            date: "2026-06-29",
            messages: [
                { role: "user", content: "닭가슴살로 뭐 해먹을까요?" },
                { role: "assistant", content: "닭가슴살 샐러드를 추천드려요." },
            ],
            createdAt: "",
            updatedAt: "",
        });
        render(<ChatPage />);
        await waitFor(() =>
            expect(screen.getByText("닭가슴살로 뭐 해먹을까요?")).toBeInTheDocument(),
        );
        expect(screen.getByText("닭가슴살 샐러드를 추천드려요.")).toBeInTheDocument();
    });
});
