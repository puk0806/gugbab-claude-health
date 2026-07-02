import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useInstallPrompt } from "./useInstallPrompt";

vi.mock("./detectInstallEnv", () => ({
    detectStandalone: vi.fn(() => false),
    detectIOSSafari: vi.fn(() => false),
}));

import { detectIOSSafari, detectStandalone } from "./detectInstallEnv";

describe("useInstallPrompt", () => {
    beforeEach(() => {
        vi.mocked(detectStandalone).mockReturnValue(false);
        vi.mocked(detectIOSSafari).mockReturnValue(false);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("returns mode=unsupported when no beforeinstallprompt and not iOS", () => {
        const { result } = renderHook(() => useInstallPrompt());
        expect(result.current.mode).toBe("unsupported");
        expect(result.current.canInstall).toBe(false);
    });

    it("returns mode=installed when detectStandalone is true", () => {
        vi.mocked(detectStandalone).mockReturnValue(true);
        const { result } = renderHook(() => useInstallPrompt());
        expect(result.current.mode).toBe("installed");
        expect(result.current.canInstall).toBe(false);
    });

    it("returns mode=ios-guide when detectIOSSafari is true", () => {
        vi.mocked(detectIOSSafari).mockReturnValue(true);
        const { result } = renderHook(() => useInstallPrompt());
        expect(result.current.mode).toBe("ios-guide");
        expect(result.current.canInstall).toBe(true);
    });

    it("returns mode=native when beforeinstallprompt fires", async () => {
        const { result } = renderHook(() => useInstallPrompt());
        const fakeEvent = {
            preventDefault: vi.fn(),
            prompt: vi.fn().mockResolvedValue(undefined),
            userChoice: Promise.resolve({ outcome: "accepted" as const, platform: "web" }),
        };
        await act(async () => {
            window.dispatchEvent(Object.assign(new Event("beforeinstallprompt"), fakeEvent));
        });
        expect(result.current.mode).toBe("native");
        expect(result.current.canInstall).toBe(true);
    });

    it("promptInstall returns null when mode is not native", async () => {
        const { result } = renderHook(() => useInstallPrompt());
        const outcome = await result.current.promptInstall();
        expect(outcome).toBeNull();
    });

    it("becomes installed after appinstalled event", async () => {
        const { result } = renderHook(() => useInstallPrompt());
        await act(async () => {
            window.dispatchEvent(new Event("appinstalled"));
        });
        expect(result.current.mode).toBe("installed");
    });
});
