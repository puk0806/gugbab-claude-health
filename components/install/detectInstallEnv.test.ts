import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectIOSSafari, detectStandalone } from "./detectInstallEnv";

describe("detectStandalone", () => {
    it("returns false in SSR (no window)", () => {
        const original = global.window;
        // biome-ignore lint/suspicious/noExplicitAny: test only
        (global as any).window = undefined;
        expect(detectStandalone()).toBe(false);
        // biome-ignore lint/suspicious/noExplicitAny: test only
        (global as any).window = original;
    });

    it("returns true when display-mode: standalone matches", () => {
        Object.defineProperty(window, "matchMedia", {
            writable: true,
            value: (query: string) => ({
                matches: query === "(display-mode: standalone)",
                addEventListener: () => {},
                removeEventListener: () => {},
            }),
        });
        expect(detectStandalone()).toBe(true);
    });

    it("returns false when matchMedia does not match and navigator.standalone is false", () => {
        Object.defineProperty(window, "matchMedia", {
            writable: true,
            value: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
        });
        Object.defineProperty(window.navigator, "standalone", { value: false, configurable: true });
        expect(detectStandalone()).toBe(false);
    });

    it("returns true when navigator.standalone is true", () => {
        Object.defineProperty(window, "matchMedia", {
            writable: true,
            value: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
        });
        Object.defineProperty(window.navigator, "standalone", { value: true, configurable: true, writable: true });
        expect(detectStandalone()).toBe(true);
    });
});

describe("detectIOSSafari", () => {
    const originalUA = window.navigator.userAgent;

    beforeEach(() => {
        Object.defineProperty(window.navigator, "userAgent", { value: originalUA, configurable: true, writable: true });
    });

    afterEach(() => {
        Object.defineProperty(window.navigator, "userAgent", { value: originalUA, configurable: true, writable: true });
    });

    it("returns false in SSR (no window)", () => {
        const original = global.window;
        // biome-ignore lint/suspicious/noExplicitAny: test only
        (global as any).window = undefined;
        expect(detectIOSSafari()).toBe(false);
        // biome-ignore lint/suspicious/noExplicitAny: test only
        (global as any).window = original;
    });

    it("returns true for iPhone Safari UA", () => {
        Object.defineProperty(window.navigator, "userAgent", {
            value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
            configurable: true,
            writable: true,
        });
        expect(detectIOSSafari()).toBe(true);
    });

    it("returns false for iPhone Chrome (CriOS)", () => {
        Object.defineProperty(window.navigator, "userAgent", {
            value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1",
            configurable: true,
            writable: true,
        });
        expect(detectIOSSafari()).toBe(false);
    });

    it("returns false for desktop Chrome", () => {
        Object.defineProperty(window.navigator, "userAgent", {
            value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            configurable: true,
            writable: true,
        });
        expect(detectIOSSafari()).toBe(false);
    });

    it("returns false for Android Chrome", () => {
        Object.defineProperty(window.navigator, "userAgent", {
            value: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.210 Mobile Safari/537.36",
            configurable: true,
            writable: true,
        });
        expect(detectIOSSafari()).toBe(false);
    });
});
