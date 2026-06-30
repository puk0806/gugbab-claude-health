import { GoogleGenAI } from "@google/genai";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { buildSystemPrompt } from "@/lib/ai/context";
import type { ChatSseEvent } from "@/lib/ai/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MetricSchema = z.object({
    date: z.string(),
    weight: z.number(),
    bodyFatPct: z.number().optional(),
    skeletalMuscleMass: z.number().optional(),
});

const IngredientSchema = z.object({
    name: z.string(),
    category: z.enum(["vegetable-fruit", "protein", "grain", "dairy", "seasoning", "etc"]),
});

const UserContextSchema = z.object({
    gender: z.enum(["male", "female"]),
    goals: z.array(z.enum(["lose-weight", "gain-weight", "maintain-weight", "lean-mass", "health"])),
    recentMetrics: z.array(MetricSchema),
    ingredients: z.array(IngredientSchema),
    recentMealSummaries: z.array(z.string()),
});

const ChatRequestSchema = z.object({
    messages: z
        .array(
            z.object({
                role: z.enum(["user", "assistant"]),
                content: z.string().min(1).max(4000),
            }),
        )
        .min(1)
        .max(50),
    context: UserContextSchema,
});

function parseLlmError(e: unknown): string {
    const raw = e instanceof Error ? e.message : String(e);
    if (raw.includes("429") || raw.includes("RESOURCE_EXHAUSTED") || raw.includes("quota") || raw.includes("rate_limit")) {
        return "API 사용 한도를 초과했어요. 잠시 후 다시 시도해주세요.";
    }
    if (raw.includes("401") || raw.includes("403") || raw.includes("API_KEY_INVALID") || raw.includes("Unauthorized") || raw.includes("permission")) {
        return "API 키가 유효하지 않아요. 서버 설정을 확인해주세요.";
    }
    if (raw.includes("SAFETY") || raw.includes("blocked") || raw.includes("content_filter")) {
        return "안전 정책으로 처리가 차단됐어요. 다른 내용으로 다시 시도해주세요.";
    }
    if (raw.includes("503") || raw.includes("UNAVAILABLE") || raw.includes("overloaded")) {
        return "AI 서버가 일시적으로 혼잡해요. 잠시 후 다시 시도해주세요.";
    }
    return "일시적인 오류가 발생했어요. 잠시 후 다시 시도해주세요.";
}

function sseLine(event: ChatSseEvent): string {
    return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: NextRequest): Promise<Response> {
    let parsed: z.infer<typeof ChatRequestSchema>;
    try {
        const body = (await req.json()) as unknown;
        parsed = ChatRequestSchema.parse(body);
    } catch {
        return new Response(JSON.stringify({ error: "입력을 확인해주세요" }), {
            status: 400,
            headers: { "content-type": "application/json" },
        });
    }

    const systemPrompt = buildSystemPrompt(parsed.context);
    const { signal } = req;

    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            const encoder = new TextEncoder();
            const send = (event: ChatSseEvent) =>
                controller.enqueue(encoder.encode(sseLine(event)));

            try {
                if (!process.env.GEMINI_API_KEY) {
                    throw new Error("401 API key not configured");
                }
                const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
                const llmStream = await genai.models.generateContentStream({
                    model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
                    contents: parsed.messages.map((m) => ({
                        role: m.role === "assistant" ? "model" : "user",
                        parts: [{ text: m.content }],
                    })),
                    config: {
                        systemInstruction: systemPrompt,
                        maxOutputTokens: 1024,
                        temperature: 0.7,
                    },
                });

                for await (const chunk of llmStream) {
                    if (signal.aborted) break;
                    const text = chunk.text ?? "";
                    if (text) send({ type: "chunk", text });
                }
                if (!signal.aborted) send({ type: "done" });
            } catch (e) {
                if (!signal.aborted) send({ type: "error", message: parseLlmError(e) });
            } finally {
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            "content-type": "text/event-stream; charset=utf-8",
            "cache-control": "no-cache",
            connection: "keep-alive",
            "x-accel-buffering": "no",
        },
    });
}
