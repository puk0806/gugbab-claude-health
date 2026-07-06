export const runtime = "nodejs";

const ERROR_HEADERS = { "content-type": "application/json" };

export async function GET(): Promise<Response> {
    const relayUrl = process.env.RELAY_URL;

    if (!relayUrl) {
        return new Response(JSON.stringify({ error: "릴레이 서버가 설정되지 않았어요" }), {
            status: 503,
            headers: ERROR_HEADERS,
        });
    }

    try {
        const relayRes = await fetch(`${relayUrl}/api/models`, { next: { revalidate: 300 } });
        if (!relayRes.ok) {
            return new Response(JSON.stringify({ error: "모델 목록을 불러오지 못했어요" }), {
                status: 503,
                headers: ERROR_HEADERS,
            });
        }
        const data = (await relayRes.json()) as unknown;
        return new Response(JSON.stringify(data), {
            headers: { "content-type": "application/json" },
        });
    } catch {
        return new Response(JSON.stringify({ error: "모델 목록을 불러오지 못했어요" }), {
            status: 503,
            headers: ERROR_HEADERS,
        });
    }
}
