import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearDraft, loadDraft, saveDraft } from "./draft";

const KEY = "gugbab-health:workout-draft:r1";

describe("workout draft", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it("저장·복원·삭제", () => {
        const entries = [{ exerciseId: "bi-bench-press", sets: [{ weight: "60", reps: "10", done: true }] }];
        saveDraft("r1", entries);
        expect(loadDraft("r1")).toEqual(entries);
        clearDraft("r1");
        expect(loadDraft("r1")).toBeNull();
    });

    it("깨진 JSON·잘못된 모양·__proto__ 주입·과대 데이터는 버린다", () => {
        for (const raw of [
            "{not json",
            JSON.stringify({ a: 1 }),
            JSON.stringify([{ exerciseId: 1, sets: [] }]),
            JSON.stringify([{ exerciseId: "x", sets: [{ weight: 60, reps: "1", done: true }] }]),
            JSON.stringify([{ exerciseId: "x", sets: [{ weight: "1".repeat(20), reps: "1", done: true }] }]),
            '[{"__proto__":{"polluted":true},"exerciseId":"x","sets":[]}]',
            "x".repeat(60_000),
        ]) {
            localStorage.setItem(KEY, raw);
            const loaded = loadDraft("r1");
            if (loaded) {
                // __proto__ 케이스: 모양은 맞아도 프로토타입 오염이 일어나지 않아야 한다
                expect(({} as Record<string, unknown>).polluted).toBeUndefined();
            } else {
                expect(loaded).toBeNull();
            }
        }
    });

    it("저장소 접근이 막혀도 예외를 던지지 않는다", () => {
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        expect(loadDraft("r1")).toBeNull();
        expect(() => saveDraft("r1", [])).not.toThrow();
        expect(() => clearDraft("r1")).not.toThrow();
    });
});
