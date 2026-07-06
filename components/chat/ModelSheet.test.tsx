import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ModelSheet from "./ModelSheet";

const MODELS = [
    { id: "claude-sonnet-4-6", alias: "sonnet", name: "Claude Sonnet 4.6", description: "균형 (기본값)" },
    { id: "claude-fable-5", alias: "fable", name: "Claude Fable 5", description: "최상위 모델 — 비용 높음" },
];

describe("ModelSheet", () => {
    it("모델 목록과 현재 선택을 표시한다", () => {
        render(<ModelSheet models={MODELS} selected="sonnet" onSelect={vi.fn()} onClose={vi.fn()} />);
        expect(screen.getByRole("dialog", { name: "모델 선택" })).toBeInTheDocument();
        expect(screen.getByText("Claude Sonnet 4.6")).toBeInTheDocument();
        expect(screen.getByText("✓")).toBeInTheDocument();
    });

    it("비용 높음 모델에 배지를 표시한다", () => {
        render(<ModelSheet models={MODELS} selected="sonnet" onSelect={vi.fn()} onClose={vi.fn()} />);
        expect(screen.getByText("비용 높음", { selector: "span" })).toBeInTheDocument();
    });

    it("모델 선택 시 alias로 onSelect 호출", () => {
        const onSelect = vi.fn();
        render(<ModelSheet models={MODELS} selected="sonnet" onSelect={onSelect} onClose={vi.fn()} />);
        fireEvent.click(screen.getByText("Claude Fable 5"));
        expect(onSelect).toHaveBeenCalledWith("fable");
    });

    it("백드롭 클릭 시 onClose 호출 (시트 내부 클릭은 무시)", () => {
        const onClose = vi.fn();
        render(<ModelSheet models={MODELS} selected="sonnet" onSelect={vi.fn()} onClose={onClose} />);
        fireEvent.click(screen.getByText("Claude Sonnet 4.6"));
        expect(onClose).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("dialog", { name: "모델 선택" }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("Escape 키로 onClose 호출", () => {
        const onClose = vi.fn();
        render(<ModelSheet models={MODELS} selected="sonnet" onSelect={vi.fn()} onClose={onClose} />);
        fireEvent.keyDown(window, { key: "Escape" });
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
