import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getUserProfile, saveUserProfile } from "@/lib/db/userProfile";
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

    describe("키·몸무게 입력", () => {
        beforeEach(() => {
            vi.mocked(saveUserProfile).mockClear();
            vi.mocked(getUserProfile).mockResolvedValue({
                id: "user-profile",
                gender: "male",
                goals: ["health"],
                heightCm: 178,
                weightKg: 78.5,
                createdAt: "",
                updatedAt: "",
            });
        });

        it("저장된 키·몸무게를 입력 필드에 표시한다", async () => {
            render(<SettingsPage />);
            await waitFor(() => {
                expect(screen.getByLabelText("키 (cm)")).toHaveValue(178);
                expect(screen.getByLabelText("몸무게 (kg)")).toHaveValue(78.5);
            });
        });

        it("키·몸무게 수정 후 저장 시 saveUserProfile에 포함한다", async () => {
            render(<SettingsPage />);
            await waitFor(() => screen.getByLabelText("키 (cm)"));

            fireEvent.change(screen.getByLabelText("키 (cm)"), { target: { value: "180" } });
            fireEvent.change(screen.getByLabelText("몸무게 (kg)"), { target: { value: "80" } });
            fireEvent.click(screen.getByRole("button", { name: "저장" }));

            await waitFor(() =>
                expect(saveUserProfile).toHaveBeenCalledWith(
                    expect.objectContaining({ heightCm: 180, weightKg: 80 }),
                ),
            );
        });

        it("범위 초과 값은 에러 문구를 표시하고 저장 버튼을 차단한다", async () => {
            render(<SettingsPage />);
            await waitFor(() => screen.getByLabelText("키 (cm)"));

            fireEvent.change(screen.getByLabelText("키 (cm)"), { target: { value: "301" } });
            fireEvent.change(screen.getByLabelText("몸무게 (kg)"), { target: { value: "501" } });

            expect(screen.getByText("50~300 사이 숫자로 입력해주세요")).toBeInTheDocument();
            expect(screen.getByText("10~500 사이 숫자로 입력해주세요")).toBeInTheDocument();
            expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();

            fireEvent.click(screen.getByRole("button", { name: "저장" }));
            expect(saveUserProfile).not.toHaveBeenCalled();
        });

        it("범위 미만 값도 동일하게 차단한다", async () => {
            render(<SettingsPage />);
            await waitFor(() => screen.getByLabelText("키 (cm)"));

            fireEvent.change(screen.getByLabelText("키 (cm)"), { target: { value: "30" } });
            expect(screen.getByText("50~300 사이 숫자로 입력해주세요")).toBeInTheDocument();
            expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
        });

        it("레거시 범위 밖 저장값은 빈 필드로 로드해 저장을 막지 않는다", async () => {
            vi.mocked(getUserProfile).mockResolvedValue({
                id: "user-profile",
                gender: "male",
                goals: ["health"],
                heightCm: 30,
                weightKg: 501,
                createdAt: "",
                updatedAt: "",
            });
            render(<SettingsPage />);
            await waitFor(() => screen.getByLabelText("키 (cm)"));

            expect(screen.getByLabelText("키 (cm)")).toHaveValue(null);
            expect(screen.getByLabelText("몸무게 (kg)")).toHaveValue(null);
            expect(screen.getByRole("button", { name: "저장" })).toBeEnabled();
        });

        it("에러를 고치면 저장 버튼이 다시 활성화된다", async () => {
            render(<SettingsPage />);
            await waitFor(() => screen.getByLabelText("키 (cm)"));

            fireEvent.change(screen.getByLabelText("키 (cm)"), { target: { value: "301" } });
            expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();

            fireEvent.change(screen.getByLabelText("키 (cm)"), { target: { value: "180" } });
            expect(screen.queryByText("50~300 사이 숫자로 입력해주세요")).not.toBeInTheDocument();
            expect(screen.getByRole("button", { name: "저장" })).toBeEnabled();
        });

        it("빈 값이면 undefined로 저장한다", async () => {
            render(<SettingsPage />);
            await waitFor(() => screen.getByLabelText("키 (cm)"));

            fireEvent.change(screen.getByLabelText("키 (cm)"), { target: { value: "" } });
            fireEvent.change(screen.getByLabelText("몸무게 (kg)"), { target: { value: "" } });
            fireEvent.click(screen.getByRole("button", { name: "저장" }));

            await waitFor(() =>
                expect(saveUserProfile).toHaveBeenCalledWith(
                    expect.objectContaining({ heightCm: undefined, weightKg: undefined }),
                ),
            );
        });
    });
});
