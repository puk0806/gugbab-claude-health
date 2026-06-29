/**
 * 시각 회귀 테스트용 고정 시드 데이터.
 *
 * 실제 DB 시드는 routes.spec.ts의 seedAndGoto() 헬퍼가 담당한다.
 * page.evaluate로 Promise를 await하기 때문에 addInitScript의 경쟁 조건 없음.
 */

export interface SeedData {
    userProfile?: {
        id: string;
        gender: "male" | "female";
        goals: string[];
        createdAt: string;
        updatedAt: string;
    };
    ingredients?: Array<{
        id: string;
        name: string;
        category: string;
        addedAt: string;
    }>;
    bodyMetrics?: Array<{
        id: string;
        date: string;
        weight: number;
        bodyFatPct?: number;
        skeletalMuscleMass?: number;
        recordedAt: string;
    }>;
}

export const SEED_PROFILE: NonNullable<SeedData["userProfile"]> = {
    id: "user-profile",
    gender: "male",
    goals: ["lose-weight", "lean-mass"],
    createdAt: "2026-06-27T00:00:00.000Z",
    updatedAt: "2026-06-27T00:00:00.000Z",
};

export const SEED_INGREDIENTS: NonNullable<SeedData["ingredients"]> = [
    { id: "ing-001", name: "닭가슴살", category: "protein", addedAt: "2026-06-25T00:00:00.000Z" },
    { id: "ing-002", name: "브로콜리", category: "vegetable-fruit", addedAt: "2026-06-25T00:01:00.000Z" },
    { id: "ing-003", name: "현미밥", category: "grain", addedAt: "2026-06-25T00:02:00.000Z" },
];

export const SEED_BODY_METRICS: NonNullable<SeedData["bodyMetrics"]> = [
    {
        id: "metric-001",
        date: "2026-06-25",
        weight: 75,
        bodyFatPct: 22,
        skeletalMuscleMass: 35,
        recordedAt: "2026-06-25T00:00:00.000Z",
    },
    {
        id: "metric-002",
        date: "2026-06-26",
        weight: 74.5,
        bodyFatPct: 21.8,
        skeletalMuscleMass: 35.1,
        recordedAt: "2026-06-26T00:00:00.000Z",
    },
    {
        id: "metric-003",
        date: "2026-06-27",
        weight: 74,
        bodyFatPct: 21.5,
        skeletalMuscleMass: 35.2,
        recordedAt: "2026-06-27T00:00:00.000Z",
    },
];
