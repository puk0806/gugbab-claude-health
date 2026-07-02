import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IosInstallGuide } from "./IosInstallGuide";

describe("IosInstallGuide", () => {
    it("renders 4-step installation guide", () => {
        render(<IosInstallGuide onClose={vi.fn()} />);
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(screen.getByText("iPhone에 앱 설치하기")).toBeInTheDocument();
        expect(screen.getByText(/공유 버튼/)).toBeInTheDocument();
        expect(screen.getByText(/홈 화면에 추가/)).toBeInTheDocument();
    });

    it("calls onClose when close button is clicked", () => {
        const onClose = vi.fn();
        render(<IosInstallGuide onClose={onClose} />);
        fireEvent.click(screen.getByRole("button", { name: "닫기" }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when Escape key is pressed", () => {
        const onClose = vi.fn();
        render(<IosInstallGuide onClose={onClose} />);
        fireEvent.keyDown(window, { key: "Escape" });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when backdrop is clicked", () => {
        const onClose = vi.fn();
        render(<IosInstallGuide onClose={onClose} />);
        const backdrop = screen.getByRole("dialog");
        fireEvent.click(backdrop);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("does not call onClose when modal content is clicked", () => {
        const onClose = vi.fn();
        render(<IosInstallGuide onClose={onClose} />);
        fireEvent.click(screen.getByText("iPhone에 앱 설치하기"));
        expect(onClose).not.toHaveBeenCalled();
    });
});
