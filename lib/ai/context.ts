import { uniq } from "@gugbab/utils";
import { BUILT_IN_EXERCISES, EQUIPMENTS, MUSCLE_GROUP_LABELS, MUSCLE_GROUPS } from "@/lib/training/catalog";
import { roundWeight } from "@/lib/training/limits";
import { formatSets } from "@/lib/training/progression";
import { floor1 } from "./limits";
import type {
    ExerciseTrendContext,
    MuscleVolumeContext,
    NextTargetContext,
    RoutineContext,
    TrendStatus,
    UserContext,
    WorkoutContext,
} from "./types";

/**
 * systemPrompt가 relay 상한(MAX_CUSTOM_PROMPT_CHARS, 20,000자)을 넘지 않도록
 * 컨텍스트 배열을 프롬프트 생성 전에 잘라내는 상한.
 * systemPrompt 초과 400은 history-budget 재시도로 복구되지 않는 유형이라 사전 방어가 유일한 수단.
 * zod 거부 대신 조용한 절삭 — 데이터가 커도 채팅 자체가 막히지 않게 한다.
 */
export const PROMPT_CONTEXT_LIMITS = {
    maxRecentMetrics: 62, // 약 두 달치
    maxIngredients: 120,
    // 50→30: 운동 요약 섹션(추세·루틴·주간 볼륨) 자리를 만들기 위해 줄임. 식재료명은 대개 10자 안팎
    maxIngredientNameLength: 30,
    maxMetricDateLength: 32,
    maxRecentMealSummaries: 10,
    maxSummaryLength: 500, // relay 요약 계약(300자 이내)의 여유 상한
    // 운동 — 최악 케이스에서도 20,000자 안에 들도록 작게 잡는다(context.test 최악 케이스 참고)
    maxRecentWorkouts: 3,
    maxWorkoutExercises: 6,
    maxWorkoutSets: 5,
    maxNextTargets: 8,
    // 저장 상한(30자)보다 짧게 — 종목명은 대개 10자 안팎이라 손실이 거의 없다
    maxExerciseNameLength: 20,
    // 운동 날짜는 YYYY-MM-DD(10자) — 지표 날짜 상한(32)보다 짧게 잡아 추세 섹션 길이를 줄인다
    maxWorkoutDateLength: 10,
    maxExerciseTrends: 6,
    maxTrendPoints: 4,
    maxRoutines: 4,
    maxRoutineExercisesInPrompt: 8,
    // 주간 세트 수 — 하루 수십 세트를 넘기 어렵다. 직렬화 길이를 고정하기 위한 상한
    maxWeeklySets: 999,
} as const;

function trimWorkouts(workouts: WorkoutContext[]): WorkoutContext[] {
    const L = PROMPT_CONTEXT_LIMITS;
    return workouts.slice(0, L.maxRecentWorkouts).map((w) => ({
        date: w.date.slice(0, L.maxWorkoutDateLength),
        ...(w.routineName ? { routineName: w.routineName.slice(0, L.maxExerciseNameLength) } : {}),
        exercises: w.exercises.slice(0, L.maxWorkoutExercises).map((e) => ({
            name: e.name.slice(0, L.maxExerciseNameLength),
            // 0.25kg 단위로 정리 — 긴 부동소수 직렬화가 길이 상한을 깨지 않게
            sets: e.sets.slice(0, L.maxWorkoutSets).map((s) => ({ weightKg: roundWeight(s.weightKg), reps: s.reps })),
        })),
    }));
}

function trimNextTargets(targets: NextTargetContext[]): NextTargetContext[] {
    const L = PROMPT_CONTEXT_LIMITS;
    return targets.slice(0, L.maxNextTargets).map((t) => ({
        ...t,
        name: t.name.slice(0, L.maxExerciseNameLength),
        ...(t.weightKg !== undefined ? { weightKg: roundWeight(t.weightKg) } : {}),
    }));
}

const TREND_STATUSES: readonly TrendStatus[] = ["rising", "steady", "plateau", "falling", "insufficient"];

function trimWeeklyVolume(volume: MuscleVolumeContext[]): MuscleVolumeContext[] {
    const L = PROMPT_CONTEXT_LIMITS;
    // 부위는 enum 6종 — 중복·알 수 없는 값을 버려 enum 종류 수를 자연 상한으로 만든다
    const seen = new Set<string>();
    return volume
        .filter((v) => MUSCLE_GROUPS.includes(v.muscleGroup) && !seen.has(v.muscleGroup) && seen.add(v.muscleGroup))
        .map((v) => ({
            muscleGroup: v.muscleGroup,
            weeklySets: v.weeklySets.slice(0, 4).map((n) => Math.min(L.maxWeeklySets, Math.max(0, Math.floor(n)))),
        }));
}

function trimExerciseTrends(trends: ExerciseTrendContext[]): ExerciseTrendContext[] {
    const L = PROMPT_CONTEXT_LIMITS;
    return trends
        .filter((t) => TREND_STATUSES.includes(t.status))
        .slice(0, L.maxExerciseTrends)
        .map((t) => ({
            name: t.name.slice(0, L.maxExerciseNameLength),
            status: t.status,
            // 오래된→최신 순이라 뒤쪽(최신)을 보존한다
            points: t.points.slice(-L.maxTrendPoints).map((p) => ({
                date: p.date.slice(0, L.maxWorkoutDateLength),
                weightKg: roundWeight(p.weightKg),
                reps: p.reps,
            })),
        }));
}

function trimRoutines(routines: RoutineContext[]): RoutineContext[] {
    const L = PROMPT_CONTEXT_LIMITS;
    return routines.slice(0, L.maxRoutines).map((r) => ({
        name: r.name.slice(0, L.maxExerciseNameLength),
        exercises: r.exercises.slice(0, L.maxRoutineExercisesInPrompt).map((e) => e.slice(0, L.maxExerciseNameLength)),
    }));
}

// 소수 1자리 버림 — 앱 입력 정규화(floor1)와 동일 기준.
// JS 숫자는 직렬화가 최대 24자까지 길어질 수 있어(예: 499.99999999999994)
// 프롬프트 길이 상한 보장을 깨뜨리므로, 정규화 이전 저장분도 여기서 정리한다

/** 프롬프트 생성 전 컨텍스트 배열·문자열·숫자 정밀도를 상한 내로 잘라낸다 */
export function trimContextForPrompt(ctx: UserContext): UserContext {
    const L = PROMPT_CONTEXT_LIMITS;
    return {
        ...ctx,
        // enum 값이지만 배열 개수는 무제한 — 중복 제거로 enum 종류 수(5)를 자연 상한으로 만든다
        goals: uniq(ctx.goals),
        recentMetrics: ctx.recentMetrics.slice(0, L.maxRecentMetrics).map((m) => ({
            ...m,
            date: m.date.slice(0, L.maxMetricDateLength),
            weight: floor1(m.weight),
            ...(m.bodyFatPct !== undefined ? { bodyFatPct: floor1(m.bodyFatPct) } : {}),
            ...(m.skeletalMuscleMass !== undefined ? { skeletalMuscleMass: floor1(m.skeletalMuscleMass) } : {}),
        })),
        // ingredients는 addedAt 오름차순(오래된 것 먼저)으로 오므로 뒤에서 잘라 최신 항목을 보존한다
        ingredients: ctx.ingredients
            .slice(-L.maxIngredients)
            .map((i) => ({ ...i, name: i.name.slice(0, L.maxIngredientNameLength) })),
        recentMealSummaries: ctx.recentMealSummaries
            .slice(0, L.maxRecentMealSummaries)
            .map((s) => s.slice(0, L.maxSummaryLength)),
        // 구버전 클라이언트는 운동 필드를 보내지 않는다 — 없으면 없는 그대로 둔다
        ...(ctx.recentWorkouts ? { recentWorkouts: trimWorkouts(ctx.recentWorkouts) } : {}),
        ...(ctx.nextTargets ? { nextTargets: trimNextTargets(ctx.nextTargets) } : {}),
        ...(ctx.weeklyVolume ? { weeklyVolume: trimWeeklyVolume(ctx.weeklyVolume) } : {}),
        ...(ctx.exerciseTrends ? { exerciseTrends: trimExerciseTrends(ctx.exerciseTrends) } : {}),
        ...(ctx.routines ? { routines: trimRoutines(ctx.routines) } : {}),
    };
}

const GOAL_LABELS: Record<string, string> = {
    "lose-weight": "체중 감량",
    "gain-weight": "체중 증량",
    "maintain-weight": "체중 유지",
    "lean-mass": "근육량 증가",
    health: "건강 관리",
};

const MEAL_PLAN_MODE_GUIDES: Record<string, string> = {
    "pantry-only": `- **반드시 보유 식재료 목록에 있는 재료만** 사용해 식단을 구성하세요. 목록에 없는 재료는 절대 포함하지 마세요 (소금·후추·식용유 등 기본 조미료만 예외).
- 보유 재료로 만들 수 없는 식단은 제안하지 마세요.`,
    free: `- 보유 식재료에 얽매이지 말고 목표에 가장 적합한 식단을 자유롭게 추천하세요.
- 새로 필요한 재료는 "구매 목록"으로 함께 정리해주세요.`,
};

const NEXT_TARGET_LABELS: Record<NextTargetContext["kind"], string> = {
    start: "첫 기록 — 하한을 겨우 채울 무게로 시작",
    increase: "증량",
    hold: "유지 — 반복 늘리기",
    deload: "디로드 — 하한 2회 연속 미달",
};

const BUILT_IN_EXERCISE_NAMES = BUILT_IN_EXERCISES.map((e) => e.name).join(", ");

function workoutsSection(workouts: WorkoutContext[]): string {
    if (workouts.length === 0) return "기록 없음";
    return workouts
        .map((w) => {
            const head = w.routineName ? `${w.date} ${w.routineName}` : w.date;
            const body = w.exercises
                .map((e) => `${e.name} ${formatSets(e.sets.map((s) => ({ ...s, done: true })))}`)
                .join(" / ");
            return `- ${head}: ${body}`;
        })
        .join("\n");
}

const TREND_LABELS: Record<TrendStatus, string> = {
    rising: "상승 — 최근 회차가 최고 기록",
    steady: "유지",
    plateau: "정체 — 3회 이상 최고 기록 갱신 없음",
    falling: "하락 — 최고 대비 10% 이상 낮음",
    insufficient: "기록 부족(3회 미만)",
};

function weeklyVolumeSection(volume: MuscleVolumeContext[]): string {
    if (volume.length === 0 || volume.every((v) => v.weeklySets.every((n) => n === 0))) return "기록 없음";
    return volume.map((v) => `- ${MUSCLE_GROUP_LABELS[v.muscleGroup]}: ${v.weeklySets.join(" / ")}`).join("\n");
}

function exerciseTrendsSection(trends: ExerciseTrendContext[]): string {
    if (trends.length === 0) return "기록 없음";
    return trends
        .map((t) => {
            const points = t.points
                .map((p) => `${p.date.slice(5)} ${p.weightKg === 0 ? "맨몸" : `${p.weightKg}kg`}×${p.reps}`)
                .join(" → ");
            return `- ${t.name} (${TREND_LABELS[t.status]}): ${points}`;
        })
        .join("\n");
}

function routinesSection(routines: RoutineContext[]): string {
    if (routines.length === 0) return "없음";
    return routines.map((r) => `- ${r.name}: ${r.exercises.join(", ")}`).join("\n");
}

function nextTargetsSection(targets: NextTargetContext[]): string {
    if (targets.length === 0) return "없음 (루틴 미등록)";
    return targets
        .map((t) => {
            const weight = t.weightKg === undefined ? "" : t.weightKg === 0 ? " 맨몸" : ` ${t.weightKg}kg`;
            return `- ${t.name}: ${t.sets}세트 ${t.repMin}~${t.repMax}회${weight} (${NEXT_TARGET_LABELS[t.kind]})`;
        })
        .join("\n");
}

export function buildSystemPrompt(ctx: UserContext): string {
    const gender = ctx.gender === "male" ? "남성" : "여성";
    const goals = ctx.goals.map((g) => GOAL_LABELS[g] ?? g).join(", ");

    const profileLines = [`- 성별: ${gender}`, `- 목표: ${goals}`];
    if (ctx.heightCm !== undefined) profileLines.push(`- 키: ${ctx.heightCm}cm`);
    // 지표 기록이 있으면 최신 지표의 체중을 신뢰 — 기본 몸무게는 기록이 없을 때만 사용
    if (ctx.weightKg !== undefined && ctx.recentMetrics.length === 0) {
        profileLines.push(`- 기본 몸무게: ${ctx.weightKg}kg`);
    }

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

    // 평면 나열 — 분류는 모델이 이미 알고 있어 그룹핑이 정보를 더하지 않는다
    const ingredientsSection =
        ctx.ingredients.length > 0 ? ctx.ingredients.map((i) => `- ${i.name}`).join("\n") : "등록된 식재료 없음";

    const mealHistorySection = ctx.recentMealSummaries.length > 0 ? ctx.recentMealSummaries.join("\n") : "없음";

    const mealPlanGuide = ctx.mealPlanMode
        ? MEAL_PLAN_MODE_GUIDES[ctx.mealPlanMode]
        : "- 사용자의 현재 식재료로 만들 수 있는 실제 식단을 제안하세요.";

    const workouts = ctx.recentWorkouts ?? [];
    const targets = ctx.nextTargets ?? [];
    const volume = ctx.weeklyVolume ?? [];
    const trends = ctx.exerciseTrends ?? [];
    const routines = ctx.routines ?? [];

    return `당신은 개인화된 식단·운동 코치입니다. 사용자의 신체 정보·보유 식재료·운동 기록을 바탕으로 현실적이고 실천 가능한 식단과 운동 루틴을 제안합니다.

## 사용자 프로필
${profileLines.join("\n")}

## 최근 신체 지표 (최신순)
${metricsSection}

## 보유 식재료
${ingredientsSection}

## 최근 식단 이력
${mealHistorySection}

## 최근 운동 기록 (최신순, 완료 세트)
${workoutsSection(workouts)}

## 다음 운동 권장 (앱의 더블 프로그레션 계산)
${nextTargetsSection(targets)}

## 현재 루틴 구성
${routinesSection(routines)}

## 부위별 주간 완료 세트 (최근 7일 / 2주 전 / 3주 전 / 4주 전)
${weeklyVolumeSection(volume)}

## 종목별 추세 (회차별 최고 세트, 오래된→최신)
${exerciseTrendsSection(trends)}

## 대화 지침
${mealPlanGuide}
- 신체 지표 변화 추이를 반영해 목표에 맞는 식단을 설계하세요.
- 구체적인 재료와 조리법을 포함하세요.
- **[필수] 식단을 추천할 때는 반드시** 각 음식마다 그람수(g)와 칼로리(kcal)를 표기하고, 마지막에 총 칼로리를 알려주세요. 예: "닭가슴살 샐러드 (닭가슴살 150g 165kcal, 방울토마토 100g 18kcal) ... 총 칼로리: 약 520kcal". 이 규칙은 식단 추천 응답에서 절대 생략하지 마세요.
- 이전 식단과 최대한 겹치지 않게 제안하세요.
- 질문은 한 번에 하나만.

## 운동 지침
- 다음 무게를 물으면 위 "다음 운동 권장"을 그대로 기준으로 삼고 지난 기록을 근거로 짧게 설명하세요. 다른 무게를 권하면 이유를 밝히세요. 기록에 없는 무게를 지어내지 마세요.
- 규칙: 목표 세트 모두 반복 상한 달성 시 증량(바벨 상체 2.5kg·하체 5kg·덤벨 1~2kg), 하한 2회 연속 미달 시 약 10% 감량, 그 외 같은 무게로 반복 늘리기.
- 루틴 설계 시 목표별로: 근력 3~6회(1RM 80% 이상)·2~3세트 이상, 근비대 8~12회·부위당 주 약 10세트, 근지구력 15회 이상. 부위별 주 2회 이상. 종목·세트·반복 범위·휴식을 제시하고, 운동 탭 "새 루틴"에서 그대로 만들 수 있게 가능하면 앱 기본 종목명(${BUILT_IN_EXERCISE_NAMES})을 쓰세요.
- 기록 기반 루틴 조정 시: 주간 세트가 적은 부위는 보강하고 많은 부위는 줄이세요. "정체" 종목은 반복 범위·세트를 바꾸거나 비슷한 종목으로 교체하고, "하락" 종목은 회복(수면·영양·디로드)을 먼저 점검하세요. 위 수치를 근거로 들어 설명하세요.
- 새 루틴이나 고친 루틴을 제안할 때는 설명 뒤에 루틴마다 아래 형식의 코드 블록을 하나씩 붙이세요. 앱이 "루틴 저장" 버튼으로 바꿔 보여줍니다. 기존 루틴을 고치면 같은 이름을 쓰세요. 종목명은 기본 종목명을 그대로 쓰고, 기본 종목에 없으면 muscleGroup(${MUSCLE_GROUPS.join("|")})과 equipment(${EQUIPMENTS.join("|")})를 함께 넣으세요. 이름 30자, 종목 15개, 세트 1~10, 반복 1~50 이내.
\`\`\`routine
{"name":"상체 A","exercises":[{"name":"바벨 벤치프레스","sets":3,"repMin":8,"repMax":12}]}
\`\`\`
- 운동하는 사용자의 단백질은 체중 1kg당 1.4~2.0g(감량 중엔 더 높게)을 기준으로 식단과 연결하세요.
- 통증·부상을 말하면 해당 운동을 멈추고 전문가 진료를 권하세요.

## 톤 규약
- 존댓말, 친근하고 실용적으로
- 이모지 0~1개
- 길이: 첫 응답 200~400자, 후속 응답 150~300자 (단, 식단 추천 시 그람수·칼로리 표기, 루틴 설계 시 종목·세트·반복 표기가 길이 제한보다 우선 — 생략하지 말 것)`;
}
