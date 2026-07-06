import type { NextRequest } from "next/server";
import { z } from "zod";
import { toSSELine } from "@gugbab/utils";
import { buildSystemPrompt } from "@/lib/ai/context";
import { BODY_LIMITS } from "@/lib/ai/limits";

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
    heightCm: z.number().min(BODY_LIMITS.heightCm.min).max(BODY_LIMITS.heightCm.max).optional(),
    weightKg: z.number().min(BODY_LIMITS.weightKg.min).max(BODY_LIMITS.weightKg.max).optional(),
    recentMetrics: z.array(MetricSchema),
    ingredients: z.array(IngredientSchema),
    recentMealSummaries: z.array(z.string()),
    mealPlanMode: z.enum(["pantry-only", "free"]).optional(),
});

const ChatRequestSchema = z.object({
    messages: z
        .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) }))
        .min(1)
        .max(50),
    context: UserContextSchema,
    // 형식만 검증하고 그대로 relay에 전달 — 모델 유효성의 단일 소스는 relay
    model: z.string().min(1).max(64).optional(),
});

const SSE_HEADERS = {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache",
    connection: "keep-alive",
    "x-accel-buffering": "no",
};

function sseErrorResponse(): Response {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(encoder.encode(toSSELine({ type: "error", message: "릴레이 서버 오류가 발생했어요" })));
            controller.close();
        },
    });
    return new Response(stream, { headers: SSE_HEADERS });
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

    const relayUrl = process.env.RELAY_URL;
    const relaySecret = process.env.RELAY_SECRET;

    if (!relayUrl || !relaySecret) {
        return new Response(JSON.stringify({ error: "릴레이 서버가 설정되지 않았어요" }), {
            status: 503,
            headers: { "content-type": "application/json" },
        });
    }

    const systemPrompt = buildSystemPrompt(parsed.context);

    let relayRes: Response;
    try {
        relayRes = await fetch(`${relayUrl}/api/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Relay-Secret": relaySecret,
            },
            body: JSON.stringify({
                app: "health",
                systemPrompt,
                messages: parsed.messages,
                ...(parsed.model ? { model: parsed.model } : {}),
            }),
            signal: req.signal,
        });
    } catch {
        // 네트워크 단절·타임아웃 등 transport 실패 — 클라이언트가 처리 가능한 SSE error로 변환
        return sseErrorResponse();
    }

    if (!relayRes.ok || !relayRes.body) {
        return sseErrorResponse();
    }

    return new Response(relayRes.body, { headers: SSE_HEADERS });
}
