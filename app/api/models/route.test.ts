import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const MODELS_RESPONSE = {
    models: [
        { id: "claude-sonnet-4-6", alias: "sonnet", name: "Claude Sonnet 4.6", description: "속도·품질 균형" },
    ],
    default: "sonnet",
};

describe("GET /api/models (relay 프록시)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        process.env.RELAY_URL = "https://relay.example.com";
    });

    it("RELAY_URL 미설정 시 503 반환", async () => {
        delete process.env.RELAY_URL;
        const { GET } = await import("./route");
        const res = await GET();
        expect(res.status).toBe(503);
    });

    it("relay 응답을 그대로 전달", async () => {
        mockFetch.mockResolvedValueOnce(
            new Response(JSON.stringify(MODELS_RESPONSE), {
                status: 200,
                headers: { "content-type": "application/json" },
            }),
        );
        const { GET } = await import("./route");
        const res = await GET();

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual(MODELS_RESPONSE);
        const [url] = mockFetch.mock.calls[0] as [string];
        expect(url).toBe("https://relay.example.com/api/models");
    });

    it("relay 오류 응답 시 503 반환", async () => {
        mockFetch.mockResolvedValueOnce(new Response("Server Error", { status: 500 }));
        const { GET } = await import("./route");
        const res = await GET();
        expect(res.status).toBe(503);
    });

    it("relay fetch 실패 시 503 반환", async () => {
        mockFetch.mockRejectedValueOnce(new Error("network down"));
        const { GET } = await import("./route");
        const res = await GET();
        expect(res.status).toBe(503);
    });
});
