import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UseSSEChatResult } from "@gugbab/hooks";
import { getAllIngredients } from "@/lib/db/ingredients";
import { getLatestBodyMetrics } from "@/lib/db/bodyMetrics";
import { getTodayMealHistory, saveMealHistory } from "@/lib/db/mealHistory";
import { getUserProfile } from "@/lib/db/userProfile";
import ChatPage from "./page";

const { sendMock, abortMock, sseState } = vi.hoisted(() => ({
    sendMock: vi.fn(),
    abortMock: vi.fn(),
    sseState: { text: "", status: "idle" as UseSSEChatResult["status"] },
}));

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

vi.mock("@gugbab/hooks", () => ({
    useSSEChat: () => ({ ...sseState, send: sendMock, abort: abortMock }),
}));

const MOCK_PROFILE = {
    id: "user-profile",
    gender: "male" as const,
    goals: ["lose-weight" as const],
    createdAt: "",
    updatedAt: "",
};

const MODELS_RESPONSE = {
    models: [
        { id: "claude-haiku-4-5-20251001", alias: "haiku", name: "Claude Haiku 4.5", description: "빠르고 가벼움" },
        { id: "claude-sonnet-4-6", alias: "sonnet", name: "Claude Sonnet 4.6", description: "속도·품질 균형 (기본값)" },
        { id: "claude-opus-4-8", alias: "opus", name: "Claude Opus 4.8", description: "최고 품질" },
        { id: "claude-fable-5", alias: "fable", name: "Claude Fable 5", description: "최상위 모델 — 비용 높음" },
    ],
    default: "sonnet",
};

const mockFetch = vi.fn();
global.fetch = mockFetch;

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
        vi.mocked(saveMealHistory).mockClear();
        vi.mocked(saveMealHistory).mockResolvedValue({
            id: "h0",
            date: "2026-07-06",
            messages: [],
            createdAt: "",
            updatedAt: "",
        });
        sendMock.mockReset();
        abortMock.mockClear();
        sseState.text = "";
        sseState.status = "idle";
        window.localStorage.clear();
        mockFetch.mockReset();
        mockFetch.mockResolvedValue(
            new Response(JSON.stringify(MODELS_RESPONSE), {
                status: 200,
                headers: { "content-type": "application/json" },
            }),
        );
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

    describe("모델 선택", () => {
        beforeEach(() => {
            vi.mocked(getUserProfile).mockResolvedValue(MOCK_PROFILE);
            // 식재료 풍부 상태로 두어 모드 선택 강제에 걸리지 않게 한다
            vi.mocked(getAllIngredients).mockResolvedValue([
                { id: "i1", name: "닭가슴살", category: "protein", addedAt: "" },
                { id: "i2", name: "브로콜리", category: "vegetable-fruit", addedAt: "" },
                { id: "i3", name: "현미", category: "grain", addedAt: "" },
            ]);
        });

        async function renderAndWaitChip() {
            render(<ChatPage />);
            return waitFor(() => {
                const chip = screen.getByRole("button", { name: /Sonnet/ });
                expect(chip).toBeEnabled();
                return chip;
            });
        }

        it("모델 목록 로드 후 기본 모델 칩을 표시한다", async () => {
            const chip = await renderAndWaitChip();
            expect(chip).toBeInTheDocument();
            expect(mockFetch).toHaveBeenCalledWith("/api/models");
        });

        it("칩 탭 → 시트에서 모델 선택 시 저장·표시 갱신", async () => {
            const chip = await renderAndWaitChip();
            fireEvent.click(chip);

            expect(screen.getByRole("dialog", { name: "모델 선택" })).toBeInTheDocument();
            expect(screen.getByText("Claude Haiku 4.5")).toBeInTheDocument();
            expect(screen.getByText("Claude Fable 5")).toBeInTheDocument();

            fireEvent.click(screen.getByText("Claude Opus 4.8"));

            expect(window.localStorage.getItem("gugbab-health:model")).toBe("opus");
            expect(screen.queryByRole("dialog", { name: "모델 선택" })).not.toBeInTheDocument();
            expect(screen.getByRole("button", { name: /Opus/ })).toBeInTheDocument();
        });

        it("저장된 모델이 목록에 없으면 기본값으로 폴백한다", async () => {
            window.localStorage.setItem("gugbab-health:model", "removed-model");
            await renderAndWaitChip();
            expect(window.localStorage.getItem("gugbab-health:model")).toBe("sonnet");
        });

        it("전송 시 선택된 모델 alias를 포함해 send를 호출한다", async () => {
            await renderAndWaitChip();
            fireEvent.change(screen.getByPlaceholderText("식단을 요청해보세요..."), {
                target: { value: "저녁 추천해줘" },
            });
            fireEvent.click(screen.getByRole("button", { name: "전송" }));

            expect(sendMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: "sonnet",
                    messages: [{ role: "user", content: "저녁 추천해줘" }],
                }),
            );
        });

        it("응답 완료 시 어시스턴트 말풍선 표시 + 식단 이력 저장", async () => {
            sendMock.mockImplementation(() => {
                sseState.text = "연어 스테이크를 추천해요";
                sseState.status = "done";
            });
            await renderAndWaitChip();
            fireEvent.change(screen.getByPlaceholderText("식단을 요청해보세요..."), {
                target: { value: "저녁 추천해줘" },
            });
            fireEvent.click(screen.getByRole("button", { name: "전송" }));

            await waitFor(() =>
                expect(screen.getByText("연어 스테이크를 추천해요")).toBeInTheDocument(),
            );
            expect(saveMealHistory).toHaveBeenCalledWith([
                { role: "user", content: "저녁 추천해줘" },
                { role: "assistant", content: "연어 스테이크를 추천해요" },
            ]);
        });

        it("스트리밍 중에는 모델 칩이 비활성화된다", async () => {
            sseState.status = "streaming";
            render(<ChatPage />);
            await waitFor(() => screen.getByPlaceholderText("식단을 요청해보세요..."));
            expect(screen.getByRole("button", { name: /Sonnet/ })).toBeDisabled();
        });

        it("모델 목록 로드 실패 시 칩은 중립 라벨로 비활성, 채팅 입력은 가능", async () => {
            mockFetch.mockRejectedValue(new Error("network down"));
            render(<ChatPage />);
            await waitFor(() => screen.getByPlaceholderText("식단을 요청해보세요..."));
            // 실제 사용될 모델(relay 기본값)을 알 수 없으므로 특정 모델명을 표시하지 않는다
            expect(screen.queryByRole("button", { name: /Sonnet/ })).not.toBeInTheDocument();
            expect(screen.getByRole("button", { name: /모델/ })).toBeDisabled();
            expect(screen.getByPlaceholderText("식단을 요청해보세요...")).toBeEnabled();
        });

        it("모델 목록 로드 실패 시 검증 안 된 model은 전송하지 않는다", async () => {
            window.localStorage.setItem("gugbab-health:model", "removed-model");
            mockFetch.mockRejectedValue(new Error("network down"));
            render(<ChatPage />);
            await waitFor(() => screen.getByPlaceholderText("식단을 요청해보세요..."));

            fireEvent.change(screen.getByPlaceholderText("식단을 요청해보세요..."), {
                target: { value: "저녁 추천해줘" },
            });
            fireEvent.click(screen.getByRole("button", { name: "전송" }));

            expect(sendMock).toHaveBeenCalledTimes(1);
            const sentBody = sendMock.mock.calls[0][0] as Record<string, unknown>;
            expect("model" in sentBody).toBe(false);
        });

        it("새 대화 시 진행 중 스트림을 중단하고 대화를 비운다", async () => {
            await renderAndWaitChip();
            fireEvent.click(screen.getByRole("button", { name: "새 대화" }));
            expect(abortMock).toHaveBeenCalled();
            expect(saveMealHistory).toHaveBeenCalledWith([]);
        });
    });

    describe("식재료 부족 시 추천 방식 선택 (강제)", () => {
        beforeEach(() => {
            vi.mocked(getUserProfile).mockResolvedValue(MOCK_PROFILE);
            // 부족 상태: 3개 미만
            vi.mocked(getAllIngredients).mockResolvedValue([
                { id: "i1", name: "계란", category: "protein", addedAt: "" },
            ]);
        });

        async function renderAndWaitInput() {
            render(<ChatPage />);
            await waitFor(() => screen.getByPlaceholderText("식단을 요청해보세요..."));
        }

        function typeAndSend(text: string) {
            fireEvent.change(screen.getByPlaceholderText("식단을 요청해보세요..."), {
                target: { value: text },
            });
            fireEvent.click(screen.getByRole("button", { name: "전송" }));
        }

        it("부족하면 선택 배너를 표시하고, 선택 전에는 전송이 차단된다", async () => {
            await renderAndWaitInput();

            expect(screen.getByText(/어떻게 추천해드릴까요/)).toBeInTheDocument();
            expect(screen.getByRole("button", { name: "보유 재료로만" })).toBeInTheDocument();
            expect(screen.getByRole("button", { name: "자유롭게 추천" })).toBeInTheDocument();

            typeAndSend("식단 짜줘");
            expect(sendMock).not.toHaveBeenCalled();
        });

        it("보유 재료로만 선택 시 pantry-only 모드로 전송한다", async () => {
            await renderAndWaitInput();
            fireEvent.click(screen.getByRole("button", { name: "보유 재료로만" }));
            typeAndSend("식단 짜줘");

            expect(sendMock).toHaveBeenCalledTimes(1);
            const body = sendMock.mock.calls[0][0] as { context: { mealPlanMode?: string } };
            expect(body.context.mealPlanMode).toBe("pantry-only");
        });

        it("자유롭게 추천 선택 시 free 모드로 전송한다", async () => {
            await renderAndWaitInput();
            fireEvent.click(screen.getByRole("button", { name: "자유롭게 추천" }));
            typeAndSend("식단 짜줘");

            const body = sendMock.mock.calls[0][0] as { context: { mealPlanMode?: string } };
            expect(body.context.mealPlanMode).toBe("free");
        });

        it("식재료가 풍부하면 배너 없이 바로 전송 가능하다", async () => {
            vi.mocked(getAllIngredients).mockResolvedValue([
                { id: "i1", name: "닭가슴살", category: "protein", addedAt: "" },
                { id: "i2", name: "브로콜리", category: "vegetable-fruit", addedAt: "" },
                { id: "i3", name: "현미", category: "grain", addedAt: "" },
            ]);
            await renderAndWaitInput();

            expect(screen.queryByText(/어떻게 추천해드릴까요/)).not.toBeInTheDocument();
            typeAndSend("식단 짜줘");

            expect(sendMock).toHaveBeenCalledTimes(1);
            const body = sendMock.mock.calls[0][0] as { context: { mealPlanMode?: string } };
            expect(body.context.mealPlanMode).toBeUndefined();
        });

        it("새 대화 시 선택이 초기화되어 배너가 다시 표시된다", async () => {
            await renderAndWaitInput();
            fireEvent.click(screen.getByRole("button", { name: "보유 재료로만" }));
            expect(screen.queryByText(/어떻게 추천해드릴까요/)).not.toBeInTheDocument();

            fireEvent.click(screen.getByRole("button", { name: "새 대화" }));
            expect(screen.getByText(/어떻게 추천해드릴까요/)).toBeInTheDocument();
        });

        it("프로필의 키·몸무게를 컨텍스트에 포함해 전송한다", async () => {
            vi.mocked(getUserProfile).mockResolvedValue({
                ...MOCK_PROFILE,
                heightCm: 178,
                weightKg: 78,
            });
            await renderAndWaitInput();
            fireEvent.click(screen.getByRole("button", { name: "자유롭게 추천" }));
            typeAndSend("식단 짜줘");

            const body = sendMock.mock.calls[0][0] as {
                context: { heightCm?: number; weightKg?: number };
            };
            expect(body.context.heightCm).toBe(178);
            expect(body.context.weightKg).toBe(78);
        });
    });
});
