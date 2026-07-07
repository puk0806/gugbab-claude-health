import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addBodyMetric } from "@/lib/db/bodyMetrics";
import { saveUserProfile } from "@/lib/db/userProfile";
import OnboardingPage from "./page";

vi.mock("next/navigation", () => ({
    useRouter: vi.fn(),
}));

vi.mock("@/lib/db/userProfile", () => ({
    saveUserProfile: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/db/bodyMetrics", () => ({
    addBodyMetric: vi.fn().mockResolvedValue({}),
}));

function fillRequired() {
    fireEvent.click(screen.getByRole("button", { name: "여성" }));
    fireEvent.click(screen.getByRole("button", { name: "건강 유지" }));
    fireEvent.change(screen.getByLabelText("키 (cm)"), { target: { value: "165" } });
    fireEvent.change(screen.getByLabelText("몸무게 (kg)"), { target: { value: "55" } });
}

describe("OnboardingPage", () => {
    const mockPush = vi.fn();

    beforeEach(() => {
        vi.mocked(useRouter).mockReturnValue({
            push: mockPush,
        } as unknown as ReturnType<typeof useRouter>);
        mockPush.mockClear();
        vi.mocked(saveUserProfile).mockClear();
        vi.mocked(addBodyMetric).mockClear();
    });

    it("renders gender, goal, body info sections", () => {
        render(<OnboardingPage />);
        expect(screen.getByText("성별")).toBeInTheDocument();
        expect(screen.getByText("목표 (복수 선택)")).toBeInTheDocument();
        expect(screen.getByText("신체 정보")).toBeInTheDocument();
        expect(screen.getByLabelText("키 (cm)")).toBeInTheDocument();
        expect(screen.getByLabelText("몸무게 (kg)")).toBeInTheDocument();
        expect(screen.getByLabelText("체지방률 (%)")).toBeInTheDocument();
        expect(screen.getByLabelText("골격근량 (kg)")).toBeInTheDocument();
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

    it("성별·목표만 선택하면 아직 비활성 — 키·몸무게(필수)까지 입력해야 활성화", () => {
        render(<OnboardingPage />);
        fireEvent.click(screen.getByRole("button", { name: "남성" }));
        fireEvent.click(screen.getByRole("button", { name: "체중 감량" }));
        expect(screen.getByRole("button", { name: "시작하기" })).toBeDisabled();

        fireEvent.change(screen.getByLabelText("키 (cm)"), { target: { value: "178" } });
        fireEvent.change(screen.getByLabelText("몸무게 (kg)"), { target: { value: "78" } });
        expect(screen.getByRole("button", { name: "시작하기" })).toBeEnabled();
    });

    it("범위 밖 값은 빨간 에러 문구 표시 + 시작하기 차단", () => {
        render(<OnboardingPage />);
        fillRequired();

        fireEvent.change(screen.getByLabelText("키 (cm)"), { target: { value: "301" } });
        expect(screen.getByText("50~300 사이 숫자로 입력해주세요")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "시작하기" })).toBeDisabled();

        fireEvent.change(screen.getByLabelText("체지방률 (%)"), { target: { value: "80" } });
        expect(screen.getByText("1~70 사이 숫자로 입력해주세요")).toBeInTheDocument();
    });

    it("저장 시 프로필(키·몸무게 포함) + 첫 신체 지표 기록 생성 후 이동", async () => {
        render(<OnboardingPage />);
        fillRequired();
        fireEvent.change(screen.getByLabelText("체지방률 (%)"), { target: { value: "22.5" } });
        fireEvent.click(screen.getByRole("button", { name: "시작하기" }));

        await waitFor(() =>
            expect(vi.mocked(saveUserProfile)).toHaveBeenCalledWith({
                gender: "female",
                goals: ["health"],
                heightCm: 165,
                weightKg: 55,
            }),
        );
        expect(vi.mocked(addBodyMetric)).toHaveBeenCalledWith({
            weight: 55,
            bodyFatPct: 22.5,
        });
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/"));
    });

    it("지표 기록 저장이 실패해도 온보딩은 완료된다", async () => {
        vi.mocked(addBodyMetric).mockRejectedValue(new Error("db error"));
        render(<OnboardingPage />);
        fillRequired();
        fireEvent.click(screen.getByRole("button", { name: "시작하기" }));

        await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/"));
    });
});
