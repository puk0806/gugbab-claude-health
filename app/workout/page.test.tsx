import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listRoutines } from "@/lib/db/routines";
import type { Routine, WorkoutSession } from "@/lib/db/types";
import { deleteWorkoutSession, listWorkoutSessions } from "@/lib/db/workouts";
import { BUILT_IN_EXERCISES } from "@/lib/training/catalog";
import WorkoutPage from "./page";

vi.mock("next/link", () => ({
    default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
        <a href={href} className={className}>
            {children}
        </a>
    ),
}));

vi.mock("@/components/layout/BottomNav", () => ({
    default: ({ active }: { active: string }) => <nav data-testid="bottom-nav" data-active={active} />,
}));

vi.mock("@/lib/db/routines", () => ({ listRoutines: vi.fn() }));
vi.mock("@/lib/db/exercises", async () => {
    const { BUILT_IN_EXERCISES: builtIns } = await import("@/lib/training/catalog");
    return { getAllExercises: vi.fn().mockResolvedValue([...builtIns]) };
});
vi.mock("@/lib/db/workouts", async (orig) => {
    const actual = await orig<typeof import("@/lib/db/workouts")>();
    return {
        historyByExercise: actual.historyByExercise,
        listWorkoutSessions: vi.fn(),
        deleteWorkoutSession: vi.fn().mockResolvedValue(undefined),
    };
});

const ROUTINE: Routine = {
    id: "r1",
    name: "상체 A",
    exercises: [
        { exerciseId: "bi-bench-press", sets: 3, repMin: 8, repMax: 12 },
        { exerciseId: "bi-pull-up", sets: 3, repMin: 5, repMax: 8 },
    ],
    createdAt: "",
    updatedAt: "",
};

const BENCH_ENTRY: WorkoutSession["entries"][number] = {
    exerciseId: "bi-bench-press",
    exerciseName: "바벨 벤치프레스",
    targetSets: 3,
    repMin: 8,
    repMax: 12,
    sets: [
        { weightKg: 60, reps: 12, done: true },
        { weightKg: 60, reps: 12, done: true },
        { weightKg: 60, reps: 12, done: true },
    ],
};

const SESSION: WorkoutSession = {
    id: "s1",
    date: "2026-11-18",
    routineId: "r1",
    routineName: "상체 A",
    entries: [
        {
            exerciseId: "bi-bench-press",
            exerciseName: "바벨 벤치프레스",
            targetSets: 3,
            repMin: 8,
            repMax: 12,
            sets: [
                { weightKg: 60, reps: 12, done: true },
                { weightKg: 60, reps: 12, done: true },
                { weightKg: 60, reps: 12, done: true },
            ],
        },
    ],
    completedAt: "2026-11-18T10:00:00.000Z",
};

describe("WorkoutPage", () => {
    beforeEach(() => {
        vi.mocked(listRoutines).mockResolvedValue([]);
        vi.mocked(listWorkoutSessions).mockResolvedValue([]);
    });

    it("빈 상태 안내와 새 루틴 링크", async () => {
        render(<WorkoutPage />);
        await waitFor(() => expect(screen.getByText(/아직 루틴이 없어요/)).toBeInTheDocument());
        expect(screen.getByText("운동 기록이 없습니다")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "+ 새 루틴" })).toHaveAttribute("href", "/workout/routine");
        expect(screen.getByTestId("bottom-nav")).toHaveAttribute("data-active", "workout");
    });

    it("루틴별 다음 권장 무게와 시작·편집 링크를 보여준다", async () => {
        vi.mocked(listRoutines).mockResolvedValue([ROUTINE]);
        vi.mocked(listWorkoutSessions).mockResolvedValue([SESSION]);
        render(<WorkoutPage />);
        await waitFor(() => expect(screen.getByText("다음 62.5kg ↑")).toBeInTheDocument());
        expect(screen.getByText("첫 기록")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "시작" })).toHaveAttribute("href", "/workout/session?routine=r1");
        expect(screen.getByRole("link", { name: "편집" })).toHaveAttribute("href", "/workout/routine?id=r1");
    });

    it("최근 운동 기록을 요약과 추정 1RM 없이(12회) 보여주고 삭제할 수 있다", async () => {
        vi.mocked(listWorkoutSessions).mockResolvedValue([SESSION]);
        render(<WorkoutPage />);
        await waitFor(() => expect(screen.getByText("60kg×12, 12, 12")).toBeInTheDocument());
        expect(screen.queryByText(/1RM/)).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "2026-11-18 운동 기록 삭제" }));
        await waitFor(() => expect(screen.queryByText("60kg×12, 12, 12")).not.toBeInTheDocument());
        expect(deleteWorkoutSession).toHaveBeenCalledWith("s1");
    });

    it("10회 이하 기록이면 추정 1RM을 보여준다", async () => {
        vi.mocked(listWorkoutSessions).mockResolvedValue([
            {
                ...SESSION,
                entries: [{ ...BENCH_ENTRY, sets: [{ weightKg: 62.5, reps: 10, done: true }] }],
            },
        ]);
        render(<WorkoutPage />);
        await waitFor(() => expect(screen.getByText("1RM 약 83.3kg")).toBeInTheDocument());
    });

    it("DB 읽기 실패해도 화면은 뜬다", async () => {
        vi.mocked(listRoutines).mockRejectedValue(new Error("x"));
        vi.mocked(listWorkoutSessions).mockRejectedValue(new Error("x"));
        render(<WorkoutPage />);
        await waitFor(() => expect(screen.getByText(/아직 루틴이 없어요/)).toBeInTheDocument());
        expect(BUILT_IN_EXERCISES.length).toBeGreaterThan(0);
    });
});
