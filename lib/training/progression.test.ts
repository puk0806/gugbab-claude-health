import { describe, expect, it } from "vitest";
import type { WorkoutSet } from "@/lib/db/types";
import {
    bestOneRepMax,
    completedSets,
    estimateOneRepMax,
    formatSets,
    type ProgressionInput,
    recommendationText,
    recommendNext,
} from "./progression";

const s = (weightKg: number, reps: number, done = true): WorkoutSet => ({ weightKg, reps, done });

function input(history: ProgressionInput["history"], overrides: Partial<ProgressionInput> = {}): ProgressionInput {
    return { incrementKg: 2.5, sets: 3, repMin: 8, repMax: 12, history, ...overrides };
}

describe("recommendNext — 더블 프로그레션", () => {
    it("기록이 없으면 start", () => {
        const rec = recommendNext(input([]));
        expect(rec.kind).toBe("start");
        expect(rec.weightKg).toBeUndefined();
    });

    it("목표 세트 모두 상한 달성 → 증량 단위만큼 올린다", () => {
        const rec = recommendNext(input([{ date: "d1", sets: [s(60, 12), s(60, 12), s(60, 12)] }]));
        expect(rec).toMatchObject({ kind: "increase", weightKg: 62.5, lastWeightKg: 60 });
    });

    it("하체 바벨(5kg 단위) 증량", () => {
        const rec = recommendNext(
            input([{ date: "d1", sets: [s(100, 12), s(100, 12), s(100, 12)] }], { incrementKg: 5 }),
        );
        expect(rec.weightKg).toBe(105);
    });

    it("범위 안이면 같은 무게 유지", () => {
        const rec = recommendNext(input([{ date: "d1", sets: [s(60, 12), s(60, 10), s(60, 9)] }]));
        expect(rec).toMatchObject({ kind: "hold", weightKg: 60 });
    });

    it("세트 수가 목표보다 적으면 상한을 채웠어도 유지", () => {
        const rec = recommendNext(input([{ date: "d1", sets: [s(60, 12), s(60, 12)] }]));
        expect(rec.kind).toBe("hold");
    });

    it("하한 미달 1회는 유지", () => {
        const rec = recommendNext(
            input([
                { date: "d2", sets: [s(60, 7), s(60, 6), s(60, 6)] },
                { date: "d1", sets: [s(60, 9), s(60, 8), s(60, 8)] },
            ]),
        );
        expect(rec.kind).toBe("hold");
    });

    it("하한 2회 연속 미달 → 약 10% 디로드(증량 단위로 반올림)", () => {
        const rec = recommendNext(
            input([
                { date: "d2", sets: [s(60, 7), s(60, 6), s(60, 6)] },
                { date: "d1", sets: [s(60, 7), s(60, 7), s(60, 6)] },
            ]),
        );
        expect(rec).toMatchObject({ kind: "deload", weightKg: 55, lastWeightKg: 60 });
    });

    it("직전 회차가 더 가벼운 무게였으면 디로드하지 않는다(이미 내린 뒤)", () => {
        const rec = recommendNext(
            input([
                { date: "d2", sets: [s(60, 7), s(60, 6), s(60, 6)] },
                { date: "d1", sets: [s(55, 7), s(55, 6), s(55, 6)] },
            ]),
        );
        expect(rec.kind).toBe("hold");
    });

    it("디로드 결과가 같은 무게로 반올림되면 한 단계 내린다", () => {
        // 10kg × 0.9 = 9 → 10kg 단위 반올림 시 10 → 0으로 내려가야 함
        const rec = recommendNext(
            input(
                [
                    { date: "d2", sets: [s(10, 5), s(10, 5), s(10, 5)] },
                    { date: "d1", sets: [s(10, 5), s(10, 5), s(10, 5)] },
                ],
                { incrementKg: 10 },
            ),
        );
        expect(rec.weightKg).toBe(0);
    });

    it("워밍업(가벼운 세트)은 판정에서 빠진다", () => {
        const rec = recommendNext(input([{ date: "d1", sets: [s(20, 5), s(40, 5), s(60, 12), s(60, 12), s(60, 12)] }]));
        expect(rec).toMatchObject({ kind: "increase", weightKg: 62.5 });
    });

    it("맨몸 운동(증량 0)은 무게 대신 반복을 늘리라고 안내", () => {
        const rec = recommendNext(input([{ date: "d1", sets: [s(0, 12), s(0, 12), s(0, 12)] }], { incrementKg: 0 }));
        expect(rec.kind).toBe("increase");
        expect(rec.weightKg).toBe(0);
        expect(rec.reason).toContain("반복 범위");
    });

    it("맨몸 운동이 하한 2회 연속 미달이면 무게 대신 범위·보조를 안내(음수 무게 없음)", () => {
        const rec = recommendNext(
            input(
                [
                    { date: "d2", sets: [s(0, 3), s(0, 3), s(0, 2)] },
                    { date: "d1", sets: [s(0, 4), s(0, 3), s(0, 3)] },
                ],
                { incrementKg: 0, repMin: 5, repMax: 8 },
            ),
        );
        expect(rec).toMatchObject({ kind: "deload", weightKg: 0 });
        expect(rec.reason).toContain("보조 밴드");
    });

    it("가장 최근 기록에 완료 세트가 없으면 그 이전 기록을 쓴다", () => {
        const rec = recommendNext(
            input([
                { date: "d2", sets: [s(70, 12, false)] },
                { date: "d1", sets: [s(60, 12), s(60, 12), s(60, 12)] },
            ]),
        );
        expect(rec.weightKg).toBe(62.5);
    });

    it("증량해도 상한 500kg을 넘지 않는다", () => {
        const rec = recommendNext(
            input([{ date: "d1", sets: [s(500, 12), s(500, 12), s(500, 12)] }], { incrementKg: 5 }),
        );
        expect(rec.weightKg).toBe(500);
    });

    describe("이상·악성 입력", () => {
        it("NaN·음수·Infinity·범위 밖 무게, 0회·소수·음수 반복은 무시한다", () => {
            const rec = recommendNext(
                input([
                    {
                        date: "d1",
                        sets: [
                            s(Number.NaN, 12),
                            s(-50, 12),
                            s(Number.POSITIVE_INFINITY, 12),
                            s(9999, 12),
                            s(60, 0),
                            s(60, 8.5),
                            s(60, -3),
                            s(60, 1e9),
                        ],
                    },
                ]),
            );
            expect(rec.kind).toBe("start");
        });

        it("목표 값이 깨져 있어도(NaN·음수·하한>상한) 정규화해 계산한다", () => {
            const rec = recommendNext(
                input([{ date: "d1", sets: [s(60, 12), s(60, 12), s(60, 12)] }], {
                    sets: Number.NaN,
                    repMin: 15,
                    repMax: 3,
                }),
            );
            // sets→3, repMin 15, repMax→15 로 정규화 — 12회는 하한 미달 1회이므로 유지
            expect(rec.kind).toBe("hold");
            expect(Number.isFinite(rec.weightKg)).toBe(true);
        });

        it("증량 단위가 NaN·음수면 0으로 취급(무게 증가 없음)", () => {
            for (const incrementKg of [Number.NaN, -5]) {
                const rec = recommendNext(
                    input([{ date: "d1", sets: [s(60, 12), s(60, 12), s(60, 12)] }], { incrementKg }),
                );
                expect(rec.weightKg).toBe(60);
            }
        });

        it("초대형 이력(1만 회차)도 처리한다", () => {
            const history = Array.from({ length: 10_000 }, (_, i) => ({
                date: `d${i}`,
                sets: [s(60, 10), s(60, 10), s(60, 10)],
            }));
            expect(recommendNext(input(history)).kind).toBe("hold");
        });
    });
});

describe("estimateOneRepMax (Epley)", () => {
    it("62.5kg × 10회 ≈ 83.3kg", () => {
        expect(estimateOneRepMax(62.5, 10)).toBe(83.3);
    });

    it("1회면 그 무게 그대로", () => {
        expect(estimateOneRepMax(100, 1)).toBe(100);
    });

    it("10회 초과·0회·소수 반복은 계산하지 않는다", () => {
        expect(estimateOneRepMax(60, 11)).toBeNull();
        expect(estimateOneRepMax(60, 0)).toBeNull();
        expect(estimateOneRepMax(60, 2.5)).toBeNull();
    });

    it("0kg·음수·NaN·범위 밖 무게는 null", () => {
        expect(estimateOneRepMax(0, 5)).toBeNull();
        expect(estimateOneRepMax(-10, 5)).toBeNull();
        expect(estimateOneRepMax(Number.NaN, 5)).toBeNull();
        expect(estimateOneRepMax(1e9, 5)).toBeNull();
    });

    it("bestOneRepMax는 완료된 10회 이하 세트 중 최댓값", () => {
        expect(bestOneRepMax([s(60, 12), s(70, 5), s(80, 3, false)])).toBe(81.6);
        expect(bestOneRepMax([s(60, 15)])).toBeNull();
        expect(bestOneRepMax([])).toBeNull();
    });
});

describe("formatSets / completedSets / recommendationText", () => {
    it("무게가 같으면 반복만 이어 적는다", () => {
        expect(formatSets([s(60, 12), s(60, 12), s(62.5, 10)])).toBe("60kg×12, 12, 62.5kg×10");
    });

    it("완료 세트가 없으면 안내 문구", () => {
        expect(formatSets([s(60, 12, false)])).toBe("완료 세트 없음");
    });

    it("completedSets는 미완료·이상값을 제거한다", () => {
        expect(completedSets([s(60, 12), s(60, 12, false), s(Number.NaN, 5)])).toHaveLength(1);
    });

    it("배지 문구", () => {
        expect(recommendationText({ kind: "start", reason: "" })).toBe("첫 기록");
        expect(recommendationText({ kind: "increase", weightKg: 62.5, reason: "" })).toBe("다음 62.5kg ↑");
        expect(recommendationText({ kind: "deload", weightKg: 55, reason: "" })).toBe("다음 55kg ↓");
        expect(recommendationText({ kind: "hold", weightKg: 60, reason: "" })).toBe("다음 60kg");
        expect(recommendationText({ kind: "hold", weightKg: 0, reason: "" })).toBe("맨몸 · 반복 늘리기");
        expect(recommendationText({ kind: "increase", weightKg: 0, reason: "" })).toBe("맨몸 · 반복 ↑");
        expect(recommendationText({ kind: "deload", weightKg: 0, reason: "" })).toBe("맨몸 · 반복 ↓");
    });
});
