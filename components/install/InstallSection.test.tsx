import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useInstallPrompt } from "./useInstallPrompt";
import { InstallSection } from "./InstallSection";

vi.mock("./useInstallPrompt", () => ({
    useInstallPrompt: vi.fn(),
}));

describe("InstallSection", () => {
    beforeEach(() => {
        vi.mocked(useInstallPrompt).mockReset();
    });

    it("설치 가능하면 제목·설명·버튼을 표시한다", () => {
        vi.mocked(useInstallPrompt).mockReturnValue({
            mode: "native",
            canInstall: true,
            promptInstall: vi.fn(),
        });
        render(<InstallSection title="앱으로 설치" description="홈 화면에 추가하면 빨라요" />);
        expect(screen.getByText("앱으로 설치")).toBeInTheDocument();
        expect(screen.getByText("홈 화면에 추가하면 빨라요")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "앱 설치" })).toBeInTheDocument();
    });

    it("이미 설치됐거나 미지원이면 섹션 전체를 숨긴다 (죽은 CTA 방지)", () => {
        vi.mocked(useInstallPrompt).mockReturnValue({
            mode: "installed",
            canInstall: false,
            promptInstall: vi.fn(),
        });
        const { container } = render(
            <InstallSection title="앱으로 설치" description="홈 화면에 추가하면 빨라요" />,
        );
        expect(container).toBeEmptyDOMElement();
    });
});
