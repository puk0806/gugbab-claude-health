// 신체 정보 허용 범위 — 설정 UI와 /api/chat zod 스키마가 반드시 이 상수를 공유한다.
// (UI는 저장되는데 API가 거부하는 정합성 함정 방지)
export const BODY_LIMITS = {
    heightCm: { min: 50, max: 300 },
    weightKg: { min: 10, max: 500 },
} as const;

export interface NumberRange {
    min: number;
    max: number;
}

export function isInRange(value: number, range: NumberRange): boolean {
    return Number.isFinite(value) && value >= range.min && value <= range.max;
}
