import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRoutine } from "@/lib/db/routines";
import type { Routine, WorkoutSession } from "@/lib/db/types";
import { addWorkoutSession, listWorkoutSessions } from "@/lib/db/workouts";
import WorkoutLogger from "./WorkoutLogger";

const push = vi.fn();
let search = "routine=r1";

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
vi.mock("@/lib/db/routines", () => ({ getRoutine: vi.fn() }));
vi.mock("@/lib/db/exercises", async () => {
    const { BUILT_IN_EXERCISES: builtIns } = await import("@/lib/training/catalog");
    return { getAllExercises: vi.fn().mockResolvedValue([...builtIns]) };
});
vi.mock("@/lib/db/workouts", async (orig) => {
    const actual = await orig<typeof import("@/lib/db/workouts")>();
    return {
        historyByExercise: actual.historyByExercise,
        listWorkoutSessions: vi.fn(),
        addWorkoutSession: vi.fn().mockResolvedValue({}),
    };
});

const ROUTINE: Routine = {
    id: "r1",
    name: "상체 A",
    exercises: [{ exerciseId: "bi-bench-press", sets: 2, repMin: 8, repMax: 12 }],
    createdAt: "",
    updatedAt: "",
};

const LAST: WorkoutSession = {
    id: "s1",
    date: "2026-11-18",
    entries: [
        {
            exerciseId: "bi-bench-press",
            exerciseName: "바벨 벤치프레스",
            targetSets: 2,
            repMin: 8,
            repMax: 12,
            sets: [
                { weightKg: 60, reps: 12, done: true },
                { weightKg: 60, reps: 12, done: true },
            ],
        },
    ],
    completedAt: "2026-11-18T10:00:00.000Z",
};

describe("WorkoutLogger", () => {
    beforeEach(() => {
        search = "routine=r1";
        push.mockReset();
        localStorage.clear();
        vi.mocked(getRoutine).mockResolvedValue(ROUTINE);
        vi.mocked(listWorkoutSessions).mockResolvedValue([LAST]);
        vi.mocked(addWorkoutSession).mockClear();
    });

    it("권장 무게를 미리 채우고 지난 기록·근거를 보여준다", async () => {
        render(<WorkoutLogger />);
        await waitFor(() => expect(screen.getByLabelText("바벨 벤치프레스 1세트 무게")).toHaveValue(62.5));
        expect(screen.getByLabelText("바벨 벤치프레스 2세트 무게")).toHaveValue(62.5);
        expect(screen.getByText("다음 62.5kg ↑")).toBeInTheDocument();
        expect(screen.getByText(/지난번\(2026-11-18\) 60kg×12, 12/)).toBeInTheDocument();
    });

    it("반복을 적어야 완료할 수 있고, 완료 세트만 저장한다", async () => {
        render(<WorkoutLogger />);
        const done1 = await screen.findByRole("button", { name: "바벨 벤치프레스 1세트 완료" });
        const finish = screen.getByRole("button", { name: /운동 완료/ });
        expect(done1).toBeDisabled();
        expect(finish).toBeDisabled();

        fireEvent.change(screen.getByLabelText("바벨 벤치프레스 1세트 반복"), { target: { value: "10" } });
        fireEvent.click(done1);
        expect(done1).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("button", { name: "운동 완료 (1세트)" })).toBeEnabled();

        fireEvent.click(screen.getByRole("button", { name: "운동 완료 (1세트)" }));
        await waitFor(() => expect(push).toHaveBeenCalledWith("/workout"));
        const arg = vi.mocked(addWorkoutSession).mock.calls[0]?.[0];
        expect(arg?.routineName).toBe("상체 A");
        expect(arg?.entries[0]?.sets).toEqual([
            { weightKg: 62.5, reps: 10, done: true },
            { weightKg: 62.5, reps: 0, done: false },
        ]);
    });

    it("완료 후 값을 잘못 고치면 완료가 풀린다", async () => {
        render(<WorkoutLogger />);
        const reps = await screen.findByLabelText("바벨 벤치프레스 1세트 반복");
        fireEvent.change(reps, { target: { value: "10" } });
        const done = screen.getByRole("button", { name: "바벨 벤치프레스 1세트 완료" });
        fireEvent.click(done);
        fireEvent.change(screen.getByLabelText("바벨 벤치프레스 1세트 무게"), { target: { value: "-5" } });
        expect(done).toHaveAttribute("aria-pressed", "false");
        fireEvent.change(screen.getByLabelText("바벨 벤치프레스 1세트 무게"), { target: { value: "9999" } });
        expect(done).toBeDisabled();
    });

    it("세트를 늘리고 줄일 수 있다(최소 1세트)", async () => {
        render(<WorkoutLogger />);
        await screen.findByLabelText("바벨 벤치프레스 2세트 무게");
        fireEvent.click(screen.getByRole("button", { name: "+ 세트" }));
        expect(screen.getByLabelText("바벨 벤치프레스 3세트 무게")).toHaveValue(62.5);
        fireEvent.click(screen.getByRole("button", { name: "− 세트" }));
        fireEvent.click(screen.getByRole("button", { name: "− 세트" }));
        expect(screen.queryByLabelText("바벨 벤치프레스 2세트 무게")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "− 세트" })).toBeDisabled();
    });

    it("새로고침해도 입력 중인 기록을 이어서 보여준다", async () => {
        const { unmount } = render(<WorkoutLogger />);
        const reps = await screen.findByLabelText("바벨 벤치프레스 1세트 반복");
        fireEvent.change(reps, { target: { value: "11" } });
        unmount();
        render(<WorkoutLogger />);
        await waitFor(() => expect(screen.getByLabelText("바벨 벤치프레스 1세트 반복")).toHaveValue(11));
    });

    it("루틴이 없으면 안내", async () => {
        vi.mocked(getRoutine).mockResolvedValue(undefined);
        render(<WorkoutLogger />);
        await waitFor(() => expect(screen.getByText("루틴을 찾을 수 없어요")).toBeInTheDocument());
    });

    it("routine 파라미터가 없으면 안내", async () => {
        search = "";
        render(<WorkoutLogger />);
        await waitFor(() => expect(screen.getByText("루틴을 찾을 수 없어요")).toBeInTheDocument());
    });

    it("저장 실패 시 오류를 보여주고 다시 시도할 수 있다", async () => {
        vi.mocked(addWorkoutSession).mockRejectedValueOnce(new Error("x"));
        render(<WorkoutLogger />);
        fireEvent.change(await screen.findByLabelText("바벨 벤치프레스 1세트 반복"), { target: { value: "10" } });
        fireEvent.click(screen.getByRole("button", { name: "바벨 벤치프레스 1세트 완료" }));
        fireEvent.click(screen.getByRole("button", { name: "운동 완료 (1세트)" }));
        await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("저장하지 못했어요"));
        expect(screen.getByRole("button", { name: "운동 완료 (1세트)" })).toBeEnabled();
    });
});
