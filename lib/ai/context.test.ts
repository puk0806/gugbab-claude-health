import { describe, expect, it } from "vitest";
import { MAX_CUSTOM_PROMPT_CHARS } from "@/lib/relay-limits";
import { buildSystemPrompt, PROMPT_CONTEXT_LIMITS, trimContextForPrompt } from "./context";
import type { MuscleVolumeContext, UserContext } from "./types";

const BASE: UserContext = {
    gender: "male",
    goals: ["lose-weight", "lean-mass"],
    recentMetrics: [{ date: "2026-06-27", weight: 74, bodyFatPct: 21.5, skeletalMuscleMass: 35.2 }],
    ingredients: [{ name: "닭가슴살" }, { name: "브로콜리" }],
    recentMealSummaries: [],
};

describe("buildSystemPrompt", () => {
    it("성별·목표를 포함한다", () => {
        const p = buildSystemPrompt(BASE);
        expect(p).toContain("남성");
        expect(p).toContain("체중 감량");
        expect(p).toContain("근육량 증가");
    });

    it("신체 지표를 포함한다", () => {
        const p = buildSystemPrompt(BASE);
        expect(p).toContain("74kg");
        expect(p).toContain("21.5%");
        expect(p).toContain("35.2kg");
    });

    it("식재료를 평면 목록으로 포함한다 (카테고리 그룹핑 없음)", () => {
        const p = buildSystemPrompt(BASE);
        expect(p).toContain("- 닭가슴살");
        expect(p).toContain("- 브로콜리");
    });

    it("식재료 없으면 없음 메시지", () => {
        const p = buildSystemPrompt({ ...BASE, ingredients: [] });
        expect(p).toContain("등록된 식재료 없음");
    });

    it("신체 지표 없으면 없음 메시지", () => {
        const p = buildSystemPrompt({ ...BASE, recentMetrics: [] });
        expect(p).toContain("기록 없음");
    });

    it("여성 프로필", () => {
        const p = buildSystemPrompt({ ...BASE, gender: "female" });
        expect(p).toContain("여성");
    });

    it("체지방률·골격근량 없는 지표도 처리", () => {
        const p = buildSystemPrompt({
            ...BASE,
            recentMetrics: [{ date: "2026-06-27", weight: 70 }],
        });
        expect(p).toContain("70kg");
        expect(p).not.toContain("체지방률");
    });

    it("최근 식단 이력을 포함한다", () => {
        const p = buildSystemPrompt({ ...BASE, recentMealSummaries: ["2026-06-26: 닭가슴살 샐러드"] });
        expect(p).toContain("닭가슴살 샐러드");
    });

    it("키를 프로필에 포함한다", () => {
        const p = buildSystemPrompt({ ...BASE, heightCm: 178 });
        expect(p).toContain("178cm");
    });

    it("지표 기록이 없으면 기본 몸무게를 사용한다", () => {
        const p = buildSystemPrompt({ ...BASE, recentMetrics: [], weightKg: 78 });
        expect(p).toContain("78kg");
        expect(p).toContain("기본 몸무게");
    });

    it("지표 기록이 있으면 기본 몸무게는 표기하지 않는다", () => {
        const p = buildSystemPrompt({ ...BASE, weightKg: 78 });
        expect(p).not.toContain("기본 몸무게");
    });

    it("pantry-only 모드는 보유 재료 강제 지침을 포함한다", () => {
        const p = buildSystemPrompt({ ...BASE, mealPlanMode: "pantry-only" });
        expect(p).toContain("보유 식재료 목록에 있는 재료만");
        expect(p).toContain("절대 포함하지 마세요");
    });

    it("free 모드는 자유 추천 지침 + 구매 목록 안내를 포함한다", () => {
        const p = buildSystemPrompt({ ...BASE, mealPlanMode: "free" });
        expect(p).toContain("자유롭게 추천");
        expect(p).toContain("구매 목록");
    });

    it("모드 미지정 시 기존 지침을 유지한다", () => {
        const p = buildSystemPrompt(BASE);
        expect(p).toContain("현재 식재료로 만들 수 있는 실제 식단");
        expect(p).not.toContain("절대 포함하지 마세요");
    });
});

describe("trimContextForPrompt", () => {
    it("상한 내 컨텍스트는 그대로 유지한다", () => {
        expect(trimContextForPrompt(BASE)).toEqual(BASE);
    });

    it("배열·문자열을 상한 내로 잘라낸다", () => {
        const L = PROMPT_CONTEXT_LIMITS;
        const bloated: UserContext = {
            ...BASE,
            recentMetrics: Array.from({ length: 200 }, (_, i) => ({
                date: `2026-06-27-비정상적으로-긴-날짜-문자열-${i}`,
                weight: 74,
            })),
            ingredients: Array.from({ length: 500 }, (_, i) => ({
                name: `식재료-${"가".repeat(100)}-${i}`,
            })),
            recentMealSummaries: Array.from({ length: 50 }, () => "요약 ".repeat(500)),
        };
        const trimmed = trimContextForPrompt(bloated);
        expect(trimmed.recentMetrics.length).toBe(L.maxRecentMetrics);
        expect(trimmed.goals.length).toBeLessThanOrEqual(5);
        expect(trimmed.ingredients.length).toBe(L.maxIngredients);
        expect(trimmed.recentMealSummaries.length).toBe(L.maxRecentMealSummaries);
        for (const m of trimmed.recentMetrics) expect(m.date.length).toBeLessThanOrEqual(L.maxMetricDateLength);
        for (const i of trimmed.ingredients) expect(i.name.length).toBeLessThanOrEqual(L.maxIngredientNameLength);
        for (const s of trimmed.recentMealSummaries) expect(s.length).toBeLessThanOrEqual(L.maxSummaryLength);
    });

    it("직렬화가 긴 숫자는 소수 1자리로 버린다 (앱 입력 정규화와 동일 기준)", () => {
        const trimmed = trimContextForPrompt({
            ...BASE,
            recentMetrics: [
                // 74.99999999999994는 75의 부동소수 잡음 — 보정되어 75
                { date: "2026-08-14", weight: 74.99999999999994, bodyFatPct: 21.59, skeletalMuscleMass: 33.333 },
            ],
        });
        expect(trimmed.recentMetrics[0].weight).toBe(75);
        expect(trimmed.recentMetrics[0].bodyFatPct).toBe(21.5);
        expect(trimmed.recentMetrics[0].skeletalMuscleMass).toBe(33.3);
        expect(String(trimmed.recentMetrics[0].weight).length).toBeLessThanOrEqual(6);
    });

    it("식재료는 최신 항목(뒤쪽)을 보존한다 — addedAt 오름차순 입력", () => {
        const L = PROMPT_CONTEXT_LIMITS;
        const ingredients = Array.from({ length: 500 }, (_, i) => ({
            name: `재료${i}`,
        }));
        const trimmed = trimContextForPrompt({ ...BASE, ingredients });
        expect(trimmed.ingredients.length).toBe(L.maxIngredients);
        // 가장 최근에 추가된 항목이 남고, 가장 오래된 항목이 잘려나간다
        expect(trimmed.ingredients.at(-1)?.name).toBe("재료499");
        expect(trimmed.ingredients[0]?.name).toBe(`재료${500 - L.maxIngredients}`);
    });

    it("상한까지 채운 최악 케이스에서도 systemPrompt가 relay 상한을 넘지 않는다", () => {
        const L = PROMPT_CONTEXT_LIMITS;
        const worst: UserContext = {
            gender: "female",
            goals: ["lose-weight", "gain-weight", "maintain-weight", "lean-mass", "health"],
            heightCm: 200.55,
            weightKg: 499.99,
            recentMetrics: Array.from({ length: L.maxRecentMetrics }, () => ({
                date: "가".repeat(L.maxMetricDateLength),
                weight: 499.99,
                bodyFatPct: 69.99,
                skeletalMuscleMass: 99.99,
            })),
            ingredients: Array.from({ length: L.maxIngredients }, () => ({
                name: "가".repeat(L.maxIngredientNameLength),
            })),
            recentMealSummaries: Array.from({ length: L.maxRecentMealSummaries }, () =>
                "가".repeat(L.maxSummaryLength),
            ),
            mealPlanMode: "pantry-only",
            // 운동도 상한을 크게 넘겨 넣는다 — 절삭이 상한을 보장하는지 확인
            recentWorkouts: Array.from({ length: 50 }, () => ({
                date: "가".repeat(100),
                routineName: "가".repeat(100),
                exercises: Array.from({ length: 50 }, () => ({
                    name: "가".repeat(100),
                    sets: Array.from({ length: 30 }, (_, i) => ({ weightKg: 499.123456789 - i, reps: 100 })),
                })),
            })),
            nextTargets: Array.from({ length: 50 }, () => ({
                name: "가".repeat(100),
                kind: "deload" as const,
                weightKg: 499.333333,
                sets: 10,
                repMin: 50,
                repMax: 50,
            })),
            weeklyVolume: Array.from(
                { length: 50 },
                (): MuscleVolumeContext => ({
                    muscleGroup: "shoulders",
                    weeklySets: Array.from({ length: 20 }, () => 123456.789),
                }),
            ).concat(
                (["chest", "back", "legs", "arms", "core"] as const).map((g) => ({
                    muscleGroup: g,
                    weeklySets: [99999, 99999, 99999, 99999],
                })),
            ),
            exerciseTrends: Array.from({ length: 50 }, () => ({
                name: "가".repeat(100),
                status: "insufficient" as const,
                points: Array.from({ length: 30 }, () => ({
                    date: "가".repeat(100),
                    weightKg: 499.123456789,
                    reps: 100,
                })),
            })),
            routines: Array.from({ length: 50 }, () => ({
                name: "가".repeat(100),
                exercises: Array.from({ length: 50 }, () => "가".repeat(100)),
            })),
        };
        const p = buildSystemPrompt(trimContextForPrompt(worst));
        expect(p.length).toBeLessThanOrEqual(MAX_CUSTOM_PROMPT_CHARS);
    });
});

describe("운동 컨텍스트", () => {
    const WITH_WORKOUT: UserContext = {
        ...BASE,
        recentWorkouts: [
            {
                date: "2026-11-18",
                routineName: "상체 A",
                exercises: [
                    {
                        name: "바벨 벤치프레스",
                        sets: [
                            { weightKg: 60, reps: 12 },
                            { weightKg: 60, reps: 12 },
                            { weightKg: 60, reps: 12 },
                        ],
                    },
                ],
            },
        ],
        nextTargets: [
            { name: "바벨 벤치프레스", kind: "increase", weightKg: 62.5, sets: 3, repMin: 8, repMax: 12 },
            { name: "풀업", kind: "start", sets: 3, repMin: 5, repMax: 8 },
            { name: "푸시업", kind: "hold", weightKg: 0, sets: 3, repMin: 10, repMax: 20 },
        ],
    };

    it("최근 운동 기록과 다음 권장 무게를 포함한다", () => {
        const p = buildSystemPrompt(WITH_WORKOUT);
        expect(p).toContain("2026-11-18 상체 A: 바벨 벤치프레스 60kg×12, 12, 12");
        expect(p).toContain("바벨 벤치프레스: 3세트 8~12회 62.5kg (증량)");
        expect(p).toContain("풀업: 3세트 5~8회 (첫 기록");
        expect(p).toContain("푸시업: 3세트 10~20회 맨몸 (유지");
        expect(p).toContain("식단·운동 코치");
    });

    it("루틴 구성·부위별 주간 세트·종목 추세를 포함한다", () => {
        const p = buildSystemPrompt({
            ...BASE,
            routines: [{ name: "상체 A", exercises: ["바벨 벤치프레스", "바벨 로우"] }],
            weeklyVolume: [
                { muscleGroup: "chest", weeklySets: [9, 6, 0, 3] },
                { muscleGroup: "legs", weeklySets: [0, 0, 0, 0] },
            ],
            exerciseTrends: [
                {
                    name: "바벨 벤치프레스",
                    status: "plateau",
                    points: [
                        { date: "2026-11-12", weightKg: 60, reps: 10 },
                        { date: "2026-11-19", weightKg: 60, reps: 9 },
                    ],
                },
                { name: "풀업", status: "rising", points: [{ date: "2026-11-19", weightKg: 0, reps: 8 }] },
            ],
        });
        expect(p).toContain("- 상체 A: 바벨 벤치프레스, 바벨 로우");
        expect(p).toContain("- 가슴: 9 / 6 / 0 / 3");
        expect(p).toContain("- 하체: 0 / 0 / 0 / 0");
        expect(p).toContain("- 바벨 벤치프레스 (정체 — 3회 이상 최고 기록 갱신 없음): 11-12 60kg×10 → 11-19 60kg×9");
        expect(p).toContain("- 풀업 (상승 — 최근 회차가 최고 기록): 11-19 맨몸×8");
        // 루틴 저장 블록 형식 안내
        expect(p).toContain("```routine");
        expect(p).toContain("muscleGroup(chest|back|shoulders|legs|arms|core)");
    });

    it("운동 필드가 없는 구버전 컨텍스트도 처리한다", () => {
        const p = buildSystemPrompt(trimContextForPrompt(BASE));
        expect(p).toContain("## 최근 운동 기록 (최신순, 완료 세트)\n기록 없음");
        expect(p).toContain("없음 (루틴 미등록)");
        expect(p).toContain("## 현재 루틴 구성\n없음");
        expect(p).toContain("## 종목별 추세 (회차별 최고 세트, 오래된→최신)\n기록 없음");
    });

    it("주간 볼륨·추세·루틴을 상한으로 자르고 알 수 없는 값을 버린다", () => {
        const L = PROMPT_CONTEXT_LIMITS;
        const trimmed = trimContextForPrompt({
            ...BASE,
            weeklyVolume: [
                { muscleGroup: "chest", weeklySets: [1.7, -3, 5000, 2, 9] },
                { muscleGroup: "chest", weeklySets: [1] },
                { muscleGroup: "neck" as never, weeklySets: [1] },
            ],
            exerciseTrends: Array.from({ length: 20 }, (_, i) => ({
                name: "가".repeat(100),
                status: i === 0 ? ("moon" as never) : ("steady" as const),
                points: Array.from({ length: 10 }, (_, j) => ({ date: `2026-11-${10 + j}`, weightKg: 60.1, reps: 10 })),
            })),
            routines: Array.from({ length: 10 }, () => ({
                name: "가".repeat(100),
                exercises: Array.from({ length: 20 }, () => "나".repeat(100)),
            })),
        });
        expect(trimmed.weeklyVolume).toEqual([{ muscleGroup: "chest", weeklySets: [1, 0, L.maxWeeklySets, 2] }]);
        expect(trimmed.exerciseTrends).toHaveLength(L.maxExerciseTrends);
        const points = trimmed.exerciseTrends?.[0]?.points;
        expect(points).toHaveLength(L.maxTrendPoints);
        // 최신 회차를 보존한다
        expect(points?.at(-1)?.date).toBe("2026-11-19");
        expect(points?.[0]?.weightKg).toBe(60);
        expect(trimmed.routines).toHaveLength(L.maxRoutines);
        expect(trimmed.routines?.[0]?.exercises).toHaveLength(L.maxRoutineExercisesInPrompt);
        expect(trimmed.routines?.[0]?.name.length).toBe(L.maxExerciseNameLength);
    });

    it("운동 배열·이름·세트를 상한으로 자르고 무게를 0.25kg 단위로 정리한다", () => {
        const L = PROMPT_CONTEXT_LIMITS;
        const trimmed = trimContextForPrompt({
            ...BASE,
            recentWorkouts: Array.from({ length: 10 }, () => ({
                date: "2026-11-18",
                exercises: Array.from({ length: 20 }, () => ({
                    name: "가".repeat(100),
                    sets: Array.from({ length: 20 }, () => ({ weightKg: 60.1234567, reps: 10 })),
                })),
            })),
            nextTargets: Array.from({ length: 30 }, () => ({
                name: "가".repeat(100),
                kind: "hold" as const,
                weightKg: 61.111111,
                sets: 3,
                repMin: 8,
                repMax: 12,
            })),
        });
        expect(trimmed.recentWorkouts).toHaveLength(L.maxRecentWorkouts);
        const ex = trimmed.recentWorkouts?.[0]?.exercises;
        expect(ex).toHaveLength(L.maxWorkoutExercises);
        expect(ex?.[0]?.name.length).toBe(L.maxExerciseNameLength);
        expect(ex?.[0]?.sets).toHaveLength(L.maxWorkoutSets);
        expect(ex?.[0]?.sets[0]?.weightKg).toBe(60);
        expect(trimmed.nextTargets).toHaveLength(L.maxNextTargets);
        expect(trimmed.nextTargets?.[0]?.weightKg).toBe(61);
    });
});
