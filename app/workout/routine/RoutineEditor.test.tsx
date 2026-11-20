import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addCustomExercise } from "@/lib/db/exercises";
import { deleteRoutine, getRoutine, saveRoutine } from "@/lib/db/routines";
import RoutineEditor from "./RoutineEditor";

const push = vi.fn();
let search = "";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push }),
    useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("next/link", () => ({
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}));
vi.mock("@/components/layout/BottomNav", () => ({ default: () => <nav /> }));
vi.mock("@/lib/db/routines", () => ({
    getRoutine: vi.fn(),
    saveRoutine: vi.fn().mockResolvedValue({}),
    deleteRoutine: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/db/exercises", async () => {
    const { BUILT_IN_EXERCISES: builtIns } = await import("@/lib/training/catalog");
    return {
        getAllExercises: vi.fn().mockResolvedValue([...builtIns]),
        addCustomExercise: vi.fn(),
    };
});

describe("RoutineEditor", () => {
    beforeEach(() => {
        search = "";
        push.mockReset();
        vi.mocked(saveRoutine).mockClear();
    });

    it("이름과 종목이 있어야 저장할 수 있고, 기본 목표는 3×8~12", async () => {
        render(<RoutineEditor />);
        const save = screen.getByRole("button", { name: "루틴 저장" });
        expect(save).toBeDisabled();
        fireEvent.change(screen.getByLabelText("루틴 이름"), { target: { value: "상체 A" } });
        expect(save).toBeDisabled();
        fireEvent.change(screen.getByLabelText("종목 추가"), { target: { value: "bi-bench-press" } });
        expect(screen.getByLabelText("바벨 벤치프레스 세트 수")).toHaveValue(3);
        expect(screen.getByLabelText("바벨 벤치프레스 반복 하한")).toHaveValue(8);
        expect(save).toBeEnabled();

        fireEvent.click(save);
        await waitFor(() => expect(push).toHaveBeenCalledWith("/workout"));
        expect(saveRoutine).toHaveBeenCalledWith({
            name: "상체 A",
            exercises: [{ exerciseId: "bi-bench-press", sets: 3, repMin: 8, repMax: 12 }],
        });
    });

    it("하한>상한·범위 밖·빈 값이면 오류를 보이고 저장을 막는다", () => {
        render(<RoutineEditor />);
        fireEvent.change(screen.getByLabelText("루틴 이름"), { target: { value: "A" } });
        fireEvent.change(screen.getByLabelText("종목 추가"), { target: { value: "bi-back-squat" } });
        fireEvent.change(screen.getByLabelText("바벨 백스쿼트 반복 하한"), { target: { value: "15" } });
        expect(screen.getByText("반복 하한이 상한보다 클 수 없어요")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "루틴 저장" })).toBeDisabled();
        fireEvent.change(screen.getByLabelText("바벨 백스쿼트 반복 하한"), { target: { value: "8" } });
        fireEvent.change(screen.getByLabelText("바벨 백스쿼트 세트 수"), { target: { value: "99" } });
        expect(screen.getByText(/세트는 1~10/)).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText("바벨 백스쿼트 세트 수"), { target: { value: "" } });
        expect(screen.getByRole("button", { name: "루틴 저장" })).toBeDisabled();
    });

    it("목적별 프리셋을 모든 종목에 적용한다", () => {
        render(<RoutineEditor />);
        fireEvent.change(screen.getByLabelText("종목 추가"), { target: { value: "bi-back-squat" } });
        fireEvent.change(screen.getByLabelText("종목 추가"), { target: { value: "bi-bench-press" } });
        fireEvent.change(screen.getByLabelText(/목적별 반복 범위/), { target: { value: "strength" } });
        expect(screen.getByLabelText("바벨 백스쿼트 반복 상한")).toHaveValue(6);
        expect(screen.getByLabelText("바벨 벤치프레스 반복 하한")).toHaveValue(3);
    });

    it("종목 순서를 바꾸고 뺄 수 있다", () => {
        render(<RoutineEditor />);
        fireEvent.change(screen.getByLabelText("종목 추가"), { target: { value: "bi-back-squat" } });
        fireEvent.change(screen.getByLabelText("종목 추가"), { target: { value: "bi-bench-press" } });
        fireEvent.click(screen.getByRole("button", { name: "바벨 벤치프레스 위로" }));
        const titles = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
        expect(titles).toEqual(["바벨 벤치프레스", "바벨 백스쿼트"]);
        fireEvent.click(screen.getByRole("button", { name: "바벨 백스쿼트 빼기" }));
        expect(screen.queryByRole("heading", { name: "바벨 백스쿼트" })).not.toBeInTheDocument();
    });

    it("직접 만든 종목을 추가한다", async () => {
        vi.mocked(addCustomExercise).mockResolvedValue({
            id: "c1",
            name: "힙 쓰러스트",
            muscleGroup: "legs",
            equipment: "barbell",
            incrementKg: 5,
            builtIn: false,
        });
        render(<RoutineEditor />);
        fireEvent.change(screen.getByLabelText("새 종목 이름"), { target: { value: "힙 쓰러스트" } });
        fireEvent.click(screen.getByRole("button", { name: "종목 만들고 추가" }));
        await waitFor(() => expect(screen.getByRole("heading", { name: "힙 쓰러스트" })).toBeInTheDocument());
    });

    it("편집 모드: 기존 루틴을 불러오고 두 번 눌러야 삭제된다", async () => {
        search = "id=r1";
        vi.mocked(getRoutine).mockResolvedValue({
            id: "r1",
            name: "하체",
            exercises: [{ exerciseId: "bi-back-squat", sets: 5, repMin: 3, repMax: 5 }],
            createdAt: "",
            updatedAt: "",
        });
        render(<RoutineEditor />);
        await waitFor(() => expect(screen.getByLabelText("루틴 이름")).toHaveValue("하체"));
        expect(screen.getByLabelText("바벨 백스쿼트 세트 수")).toHaveValue(5);
        fireEvent.click(screen.getByRole("button", { name: "루틴 삭제" }));
        expect(deleteRoutine).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "한 번 더 누르면 삭제돼요" }));
        await waitFor(() => expect(deleteRoutine).toHaveBeenCalledWith("r1"));
        expect(push).toHaveBeenCalledWith("/workout");
    });

    it("없는 루틴 id면 안내", async () => {
        search = "id=nope";
        vi.mocked(getRoutine).mockResolvedValue(undefined);
        render(<RoutineEditor />);
        await waitFor(() => expect(screen.getByText("루틴을 찾을 수 없어요")).toBeInTheDocument());
    });
});
