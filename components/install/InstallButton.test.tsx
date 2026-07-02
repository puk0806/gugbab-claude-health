import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InstallButton } from "./InstallButton";

vi.mock("./useInstallPrompt", () => ({
    useInstallPrompt: vi.fn(),
}));

import { useInstallPrompt } from "./useInstallPrompt";

const mockPromptInstall = vi.fn().mockResolvedValue({ outcome: "accepted" });

describe("InstallButton", () => {
    it("renders nothing when canInstall is false", () => {
        vi.mocked(useInstallPrompt).mockReturnValue({
            mode: "unsupported",
            canInstall: false,
            promptInstall: mockPromptInstall,
        });
        const { container } = render(<InstallButton />);
        expect(container.firstChild).toBeNull();
    });

    it("renders nothing when mode is installed", () => {
        vi.mocked(useInstallPrompt).mockReturnValue({
            mode: "installed",
            canInstall: false,
            promptInstall: mockPromptInstall,
        });
        const { container } = render(<InstallButton />);
        expect(container.firstChild).toBeNull();
    });

    it("renders install button when mode is native", () => {
        vi.mocked(useInstallPrompt).mockReturnValue({
            mode: "native",
            canInstall: true,
            promptInstall: mockPromptInstall,
        });
        render(<InstallButton />);
        expect(screen.getByRole("button", { name: "앱 설치" })).toBeInTheDocument();
    });

    it("calls promptInstall when clicked in native mode", async () => {
        vi.mocked(useInstallPrompt).mockReturnValue({
            mode: "native",
            canInstall: true,
            promptInstall: mockPromptInstall,
        });
        render(<InstallButton />);
        fireEvent.click(screen.getByRole("button", { name: "앱 설치" }));
        expect(mockPromptInstall).toHaveBeenCalledTimes(1);
    });

    it("renders install button when mode is ios-guide", () => {
        vi.mocked(useInstallPrompt).mockReturnValue({
            mode: "ios-guide",
            canInstall: true,
            promptInstall: mockPromptInstall,
        });
        render(<InstallButton />);
        expect(screen.getByRole("button", { name: "앱 설치" })).toBeInTheDocument();
    });

    it("shows IosInstallGuide when clicked in ios-guide mode", () => {
        vi.mocked(useInstallPrompt).mockReturnValue({
            mode: "ios-guide",
            canInstall: true,
            promptInstall: mockPromptInstall,
        });
        render(<InstallButton />);
        fireEvent.click(screen.getByRole("button", { name: "앱 설치" }));
        expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("closes IosInstallGuide when onClose is triggered", () => {
        vi.mocked(useInstallPrompt).mockReturnValue({
            mode: "ios-guide",
            canInstall: true,
            promptInstall: mockPromptInstall,
        });
        render(<InstallButton />);
        fireEvent.click(screen.getByRole("button", { name: "앱 설치" }));
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        fireEvent.keyDown(window, { key: "Escape" });
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
});
