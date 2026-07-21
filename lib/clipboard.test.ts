import { afterEach, describe, expect, it, vi } from "vitest";
import { copyToClipboard } from "./clipboard";

describe("copyToClipboard", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("navigator.clipboard.writeText로 복사하고 true를 반환한다", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal("navigator", { clipboard: { writeText } });

        const ok = await copyToClipboard("안녕");

        expect(writeText).toHaveBeenCalledWith("안녕");
        expect(ok).toBe(true);
    });

    it("clipboard API 실패 시 execCommand 폴백으로 복사한다", async () => {
        const writeText = vi.fn().mockRejectedValue(new Error("denied"));
        vi.stubGlobal("navigator", { clipboard: { writeText } });
        const execCommand = vi.fn().mockReturnValue(true);
        // jsdom에는 execCommand가 없으므로 주입
        (document as unknown as { execCommand: unknown }).execCommand = execCommand;

        const ok = await copyToClipboard("폴백");

        expect(execCommand).toHaveBeenCalledWith("copy");
        expect(ok).toBe(true);
    });

    it("clipboard API가 없어도 execCommand 폴백을 사용한다", async () => {
        vi.stubGlobal("navigator", {});
        const execCommand = vi.fn().mockReturnValue(true);
        (document as unknown as { execCommand: unknown }).execCommand = execCommand;

        const ok = await copyToClipboard("텍스트");

        expect(execCommand).toHaveBeenCalledWith("copy");
        expect(ok).toBe(true);
    });

    it("모든 방법이 실패하면 false를 반환한다", async () => {
        vi.stubGlobal("navigator", {});
        const execCommand = vi.fn().mockReturnValue(false);
        (document as unknown as { execCommand: unknown }).execCommand = execCommand;

        const ok = await copyToClipboard("실패");

        expect(ok).toBe(false);
    });
});
