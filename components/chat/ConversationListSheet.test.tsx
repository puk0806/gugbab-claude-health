import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Conversation } from "@/lib/db/types";
import ConversationListSheet from "./ConversationListSheet";

const CONVERSATIONS: Conversation[] = [
    {
        id: "c2",
        title: "저녁 뭐 먹을까?",
        messages: [{ role: "user", content: "저녁 뭐 먹을까?" }],
        createdAt: "2026-07-07T09:00:00.000Z",
        updatedAt: "2026-07-07T09:30:00.000Z",
    },
    {
        id: "c1",
        title: "닭가슴살 요리",
        messages: [{ role: "user", content: "닭가슴살 요리" }],
        mealPlanMode: "pantry-only",
        createdAt: "2026-07-06T08:00:00.000Z",
        updatedAt: "2026-07-06T08:10:00.000Z",
    },
];

function baseProps() {
    return {
        conversations: CONVERSATIONS,
        activeId: "c2",
        onSelect: vi.fn(),
        onDelete: vi.fn(),
        onClose: vi.fn(),
    };
}

describe("ConversationListSheet", () => {
    it("대화방 목록을 제목·날짜와 함께 표시한다", () => {
        render(<ConversationListSheet {...baseProps()} />);
        expect(screen.getByRole("dialog", { name: "대화 목록" })).toBeInTheDocument();
        expect(screen.getByText("저녁 뭐 먹을까?")).toBeInTheDocument();
        expect(screen.getByText("닭가슴살 요리")).toBeInTheDocument();
        expect(screen.getByText("2026-07-06")).toBeInTheDocument();
    });

    it("대화가 없으면 빈 안내를 표시한다", () => {
        render(<ConversationListSheet {...baseProps()} conversations={[]} />);
        expect(screen.getByText(/대화가 없습니다/)).toBeInTheDocument();
    });

    it("방 탭 시 해당 대화로 onSelect 호출", () => {
        const props = baseProps();
        render(<ConversationListSheet {...props} />);
        fireEvent.click(screen.getByText("닭가슴살 요리"));
        expect(props.onSelect).toHaveBeenCalledWith(CONVERSATIONS[1]);
    });

    it("삭제 버튼 클릭 시 onDelete 호출 (onSelect는 호출 안 됨)", () => {
        const props = baseProps();
        render(<ConversationListSheet {...props} />);
        fireEvent.click(screen.getByRole("button", { name: "닭가슴살 요리 삭제" }));
        expect(props.onDelete).toHaveBeenCalledWith("c1");
        expect(props.onSelect).not.toHaveBeenCalled();
    });

    it("백드롭 클릭·Escape로 onClose 호출", () => {
        const props = baseProps();
        render(<ConversationListSheet {...props} />);
        fireEvent.click(screen.getByRole("dialog", { name: "대화 목록" }));
        expect(props.onClose).toHaveBeenCalledTimes(1);
        fireEvent.keyDown(window, { key: "Escape" });
        expect(props.onClose).toHaveBeenCalledTimes(2);
    });
});
