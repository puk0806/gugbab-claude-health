import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@google/genai", () => ({
    GoogleGenAI: vi.fn(),
}));

vi.mock("@/lib/ai/context", () => ({
    buildSystemPrompt: vi.fn().mockReturnValue("test system prompt"),
}));

const VALID_BODY = {
    messages: [{ role: "user", content: "오늘 식단 추천해줘" }],
    context: {
        gender: "male",
        goals: ["lose-weight"],
        recentMetrics: [],
        ingredients: [],
        recentMealSummaries: [],
    },
};

function makeReq(body: unknown): NextRequest {
    return new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    }) as unknown as NextRequest;
}

async function* mockStream(chunks: string[]) {
    for (const text of chunks) {
        yield { text };
    }
}

describe("POST /api/chat", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.GEMINI_API_KEY = "test-key";
    });

    it("유효하지 않은 바디에 400 반환", async () => {
        const res = await POST(makeReq({ invalid: true }));
        expect(res.status).toBe(400);
    });

    it("빈 메시지 배열에 400 반환", async () => {
        const res = await POST(makeReq({ ...VALID_BODY, messages: [] }));
        expect(res.status).toBe(400);
    });

    it("유효한 요청에 SSE 스트리밍 헤더 반환", async () => {
        const { GoogleGenAI } = await import("@google/genai");
        vi.mocked(GoogleGenAI).mockImplementation(
            () =>
                ({
                    models: {
                        generateContentStream: vi.fn().mockResolvedValue(mockStream(["안녕", "하세요"])),
                    },
                }) as unknown as InstanceType<typeof GoogleGenAI>,
        );

        const res = await POST(makeReq(VALID_BODY));
        expect(res.headers.get("content-type")).toContain("text/event-stream");
    });

    it("SSE 스트림에 chunk·done 이벤트 포함", async () => {
        const { GoogleGenAI } = await import("@google/genai");
        vi.mocked(GoogleGenAI).mockImplementation(
            () =>
                ({
                    models: {
                        generateContentStream: vi.fn().mockResolvedValue(mockStream(["안녕", "하세요"])),
                    },
                }) as unknown as InstanceType<typeof GoogleGenAI>,
        );

        const res = await POST(makeReq(VALID_BODY));
        const text = await res.text();
        expect(text).toContain('"type":"chunk"');
        expect(text).toContain('"type":"done"');
        expect(text).toContain("안녕");
    });

    it("Gemini 에러 시 error 이벤트 반환", async () => {
        const { GoogleGenAI } = await import("@google/genai");
        vi.mocked(GoogleGenAI).mockImplementation(
            () =>
                ({
                    models: {
                        generateContentStream: vi.fn().mockRejectedValue(new Error("429 RESOURCE_EXHAUSTED")),
                    },
                }) as unknown as InstanceType<typeof GoogleGenAI>,
        );

        const res = await POST(makeReq(VALID_BODY));
        const text = await res.text();
        expect(text).toContain('"type":"error"');
        expect(text).toContain("한도");
    });
});
