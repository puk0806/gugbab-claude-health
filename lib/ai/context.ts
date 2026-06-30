import type { UserContext } from "./types";

const GOAL_LABELS: Record<string, string> = {
    "lose-weight": "체중 감량",
    "gain-weight": "체중 증량",
    "maintain-weight": "체중 유지",
    "lean-mass": "근육량 증가",
    health: "건강 관리",
};

const CATEGORY_LABELS: Record<string, string> = {
    "vegetable-fruit": "채소·과일",
    protein: "단백질",
    grain: "곡류",
    dairy: "유제품",
    seasoning: "양념·소스",
    etc: "기타",
};

export function buildSystemPrompt(ctx: UserContext): string {
    const gender = ctx.gender === "male" ? "남성" : "여성";
    const goals = ctx.goals.map((g) => GOAL_LABELS[g] ?? g).join(", ");

    const metricsSection =
        ctx.recentMetrics.length > 0
            ? ctx.recentMetrics
                  .map((m) => {
                      const parts = [`${m.date}: 체중 ${m.weight}kg`];
                      if (m.bodyFatPct !== undefined) parts.push(`체지방률 ${m.bodyFatPct}%`);
                      if (m.skeletalMuscleMass !== undefined) parts.push(`골격근량 ${m.skeletalMuscleMass}kg`);
                      return parts.join(", ");
                  })
                  .join("\n")
            : "기록 없음";

    const grouped = ctx.ingredients.reduce<Record<string, string[]>>((acc, i) => {
        const cat = CATEGORY_LABELS[i.category] ?? i.category;
        (acc[cat] ??= []).push(i.name);
        return acc;
    }, {});
    const ingredientsSection =
        ctx.ingredients.length > 0
            ? Object.entries(grouped)
                  .map(([cat, names]) => `- ${cat}: ${names.join(", ")}`)
                  .join("\n")
            : "등록된 식재료 없음";

    const mealHistorySection =
        ctx.recentMealSummaries.length > 0 ? ctx.recentMealSummaries.join("\n") : "없음";

    return `당신은 개인화된 식단 설계 전문가입니다. 사용자의 신체 정보와 보유 식재료를 바탕으로 현실적이고 실천 가능한 식단을 제안합니다.

## 사용자 프로필
- 성별: ${gender}
- 목표: ${goals}

## 최근 신체 지표 (최신순)
${metricsSection}

## 보유 식재료
${ingredientsSection}

## 최근 식단 이력
${mealHistorySection}

## 대화 지침
- 사용자의 현재 식재료로 만들 수 있는 실제 식단을 제안하세요.
- 신체 지표 변화 추이를 반영해 목표에 맞는 식단을 설계하세요.
- 구체적인 재료와 조리법을 포함하세요.
- 이전 식단과 최대한 겹치지 않게 제안하세요.
- 질문은 한 번에 하나만.

## 톤 규약
- 존댓말, 친근하고 실용적으로
- 이모지 0~1개
- 길이: 첫 응답 200~400자, 후속 응답 150~300자`;
}
