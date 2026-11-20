import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Routine } from "@/lib/db/types";
import { BUILT_IN_EXERCISES } from "@/lib/training/catalog";
import type { RoutineDraft } from "@/lib/training/routineBlock";

const saveRoutineDraft = vi.fn();
vi.mock("@/lib/db/routineDraft", () => ({ saveRoutineDraft: (...args: unknown[]) => saveRoutineDraft(...args) }));

const { default: RoutineSuggestion } = await import("./RoutineSuggestion");

const DRAFT: RoutineDraft = {
    name: "상체 A",
    exercises: [
        { name: "바벨 벤치프레스", sets: 3, repMin: 8, repMax: 12 },
        { name: "케이블 플라이", sets: 3, repMin: 12, repMax: 15, muscleGroup: "chest", equipment: "cable" },
        { name: "무언가", sets: 3, repMin: 8, repMax: 12 },
    ],
};

const EXISTING: Routine = {
    id: "r1",
    name: "상체 A",
    exercises: [{ exerciseId: "bi-bench-press", sets: 3, repMin: 8, repMax: 12 }],
    createdAt: "",
    updatedAt: "",
};

function renderCard(routines: Routine[] = [], draft = DRAFT) {
    const onSaved = vi.fn();
    render(<RoutineSuggestion draft={draft} exercises={BUILT_IN_EXERCISES} routines={routines} onSaved={onSaved} />);
    return onSaved;
}

beforeEach(() => {
    saveRoutineDraft.mockReset().mockResolvedValue({ routine: EXISTING, skipped: ["무언가"], created: [] });
});

describe("RoutineSuggestion", () => {
    it("종목·목표와 새 종목/제외 표시를 보인다", () => {
        renderCard();
        expect(screen.getByRole("region", { name: "루틴 제안: 상체 A" })).toBeInTheDocument();
        expect(screen.getByText("바벨 벤치프레스")).toBeInTheDocument();
        expect(screen.getByText("3세트 12~15회")).toBeInTheDocument();
        expect(screen.getByText("새 종목")).toBeInTheDocument();
        expect(screen.getByText("앱에 없어 제외")).toBeInTheDocument();
    });

    it("저장하면 저장됨으로 바뀌고 onSaved를 부른다", async () => {
        const onSaved = renderCard();
        fireEvent.click(screen.getByRole("button", { name: "루틴으로 저장" }));
        expect(await screen.findByRole("status")).toHaveTextContent("저장됨 (제외 1개)");
        expect(screen.getByRole("link", { name: "운동 탭에서 보기" })).toHaveAttribute("href", "/workout");
        expect(saveRoutineDraft).toHaveBeenCalledWith(DRAFT, {});
        expect(onSaved).toHaveBeenCalled();
    });

    it("같은 이름 루틴이 있으면 업데이트(id 전달)와 새로 저장을 고른다", async () => {
        renderCard([EXISTING]);
        fireEvent.click(screen.getByRole("button", { name: "기존 루틴 수정" }));
        await waitFor(() => expect(saveRoutineDraft).toHaveBeenCalledWith(DRAFT, { id: "r1" }));
    });

    it("같은 이름·같은 구성이면 처음부터 저장됨", () => {
        renderCard([EXISTING], { name: "상체 A", exercises: [DRAFT.exercises[0] as RoutineDraft["exercises"][0]] });
        expect(screen.getByRole("status")).toHaveTextContent("저장됨");
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("저장할 종목이 없으면 버튼 대신 안내", () => {
        renderCard([], { name: "A", exercises: [{ name: "무언가", sets: 3, repMin: 8, repMax: 12 }] });
        expect(screen.getByText("앱에 있는 종목이 없어 저장할 수 없어요")).toBeInTheDocument();
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("저장 실패 시 오류를 보이고 다시 시도할 수 있다", async () => {
        saveRoutineDraft.mockRejectedValueOnce(new Error("디스크 오류"));
        renderCard();
        fireEvent.click(screen.getByRole("button", { name: "루틴으로 저장" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("디스크 오류");
        expect(screen.getByRole("button", { name: "루틴으로 저장" })).toBeEnabled();
    });
});
