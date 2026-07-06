import { describe, expect, expectTypeOf, it } from "vitest";
import type { ModelInfo, ModelsResponse } from "./types";

describe("AI 타입 계약", () => {
    it("ModelsResponse가 relay GET /api/models 응답 형태와 일치", () => {
        const sample: ModelsResponse = {
            models: [
                {
                    id: "claude-sonnet-4-6",
                    alias: "sonnet",
                    name: "Claude Sonnet 4.6",
                    description: "속도·품질 균형 — 일반적인 대화에 권장 (기본값)",
                },
            ],
            default: "sonnet",
        };
        expect(sample.models[0].alias).toBe("sonnet");
        expectTypeOf(sample.models).items.toEqualTypeOf<ModelInfo>();
        expectTypeOf(sample.default).toEqualTypeOf<string>();
    });
});
