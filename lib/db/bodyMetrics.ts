import { ulid } from "ulid";
import { getDB, getLocalDateString } from "./index";
import type { BodyMetric } from "./types";

export async function getAllBodyMetrics(): Promise<BodyMetric[]> {
    const db = await getDB();
    return db.getAllFromIndex("bodyMetrics", "byDate");
}

export async function getLatestBodyMetrics(limit = 3): Promise<BodyMetric[]> {
    const all = await getAllBodyMetrics();
    return all.slice(-limit);
}

export async function addBodyMetric(data: {
    weight: number;
    bodyFatPct?: number;
    skeletalMuscleMass?: number;
}): Promise<BodyMetric> {
    const db = await getDB();
    const now = new Date().toISOString();
    const metric: BodyMetric = {
        id: ulid(),
        date: getLocalDateString(),
        recordedAt: now,
        ...data,
    };
    await db.put("bodyMetrics", metric);
    return metric;
}
