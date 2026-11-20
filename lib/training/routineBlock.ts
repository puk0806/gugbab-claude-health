import { z } from "zod";
import type { Equipment, Exercise, MuscleGroup, Routine } from "@/lib/db/types";
import { EQUIPMENTS, MUSCLE_GROUPS } from "./catalog";
import { normalizeTarget, WORKOUT_LIMITS } from "./limits";

/**
 * AI 답변 속 ```routine 코드 블록 — 대화에서 제안한 루틴을 앱에 바로 저장하기 위한 계약.
 * 형식 안내는 lib/ai/context.ts 운동 지침에 있다. 모델 출력이라 형식이 깨질 수 있어 관대하게 읽고 정규화한다.
 */

export interface RoutineDraftExercise {
    name: string;
    sets: number;
    repMin: number;
    repMax: number;
    muscleGroup?: MuscleGroup;
    equipment?: Equipment;
}

export interface RoutineDraft {
    name: string;
    exercises: RoutineDraftExercise[];
}

/** 한 답변에서 읽을 루틴 블록 수 상한 — 분할 루틴(최대 주 5~6일)을 담을 만큼 */
export const MAX_DRAFTS_PER_MESSAGE = 6;

const CLOSED_BLOCK = /```routine[^\n]*\n([\s\S]*?)```/g;
// 스트리밍 중 아직 닫히지 않은 블록 — JSON 조각이 화면에 비치지 않게 숨긴다
const OPEN_BLOCK = /```routine[\s\S]*$/;

const ExerciseSchema = z.object({
    name: z.string(),
    sets: z.number(),
    repMin: z.number(),
    repMax: z.number(),
    // 모르는 값은 버리고(종목 생성 불가로 처리) 나머지는 살린다
    muscleGroup: z
        .enum(MUSCLE_GROUPS as [MuscleGroup, ...MuscleGroup[]])
        .optional()
        .catch(undefined),
    equipment: z
        .enum(EQUIPMENTS as [Equipment, ...Equipment[]])
        .optional()
        .catch(undefined),
});

const DraftSchema = z.object({
    name: z.string(),
    exercises: z.array(z.unknown()),
});

function parseDraft(json: string): RoutineDraft | null {
    let raw: unknown;
    try {
        raw = JSON.parse(json);
    } catch {
        return null;
    }
    const parsed = DraftSchema.safeParse(raw);
    if (!parsed.success) return null;
    const name = parsed.data.name.trim().slice(0, WORKOUT_LIMITS.nameLength);
    if (!name) return null;
    const exercises = parsed.data.exercises
        .flatMap((item) => {
            const e = ExerciseSchema.safeParse(item);
            if (!e.success) return [];
            const exName = e.data.name.trim().slice(0, WORKOUT_LIMITS.nameLength);
            if (!exName) return [];
            return [
                {
                    name: exName,
                    ...normalizeTarget(e.data),
                    ...(e.data.muscleGroup ? { muscleGroup: e.data.muscleGroup } : {}),
                    ...(e.data.equipment ? { equipment: e.data.equipment } : {}),
                },
            ];
        })
        .slice(0, WORKOUT_LIMITS.maxRoutineExercises);
    if (exercises.length === 0) return null;
    return { name, exercises };
}

/** 답변에서 루틴 블록을 떼어 낸다 — 화면·복사용 본문과 저장 가능한 루틴 목록. 깨진 블록은 본문에서만 지운다 */
export function extractRoutineBlocks(content: string): { text: string; drafts: RoutineDraft[] } {
    const drafts: RoutineDraft[] = [];
    const text = content
        .replace(CLOSED_BLOCK, (_m, json: string) => {
            const draft = parseDraft(json);
            if (draft && drafts.length < MAX_DRAFTS_PER_MESSAGE) drafts.push(draft);
            return "";
        })
        .replace(OPEN_BLOCK, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    return { text, drafts };
}

/** 이름 비교용 — 공백·대소문자 차이는 같은 종목으로 본다("벤치 프레스"="벤치프레스") */
export function normalizeExerciseName(name: string): string {
    return name.replace(/\s+/g, "").toLowerCase();
}

export type ResolvedItem =
    | { kind: "matched"; draft: RoutineDraftExercise; exercise: Exercise }
    | { kind: "create"; draft: RoutineDraftExercise; muscleGroup: MuscleGroup; equipment: Equipment }
    | { kind: "skip"; draft: RoutineDraftExercise };

/** 제안 종목을 앱 종목에 연결 — 없는 종목은 부위·기구가 있으면 새로 만들고, 없으면 저장에서 뺀다 */
export function resolveDraft(draft: RoutineDraft, exercises: readonly Exercise[]): ResolvedItem[] {
    const byName = new Map<string, Exercise>();
    for (const e of exercises) {
        const key = normalizeExerciseName(e.name);
        if (!byName.has(key)) byName.set(key, e);
    }
    return draft.exercises.map((d) => {
        const exercise = byName.get(normalizeExerciseName(d.name));
        if (exercise) return { kind: "matched", draft: d, exercise };
        if (d.muscleGroup && d.equipment) {
            return { kind: "create", draft: d, muscleGroup: d.muscleGroup, equipment: d.equipment };
        }
        return { kind: "skip", draft: d };
    });
}

/** 같은 이름의 기존 루틴 — 있으면 "업데이트"로 저장한다(최근 수정 루틴 우선) */
export function findSameNameRoutine(draft: RoutineDraft, routines: readonly Routine[]): Routine | undefined {
    const key = draft.name.trim();
    return routines.find((r) => r.name.trim() === key);
}

/** 기존 루틴이 제안과 똑같은지 — 새로 만들 종목이 있으면 다르다 */
export function isSameAsRoutine(items: readonly ResolvedItem[], routine: Routine): boolean {
    const saved = items.filter((i) => i.kind !== "skip");
    if (saved.length !== routine.exercises.length) return false;
    return saved.every((item, idx) => {
        const r = routine.exercises[idx];
        return (
            item.kind === "matched" &&
            r !== undefined &&
            r.exerciseId === item.exercise.id &&
            r.sets === item.draft.sets &&
            r.repMin === item.draft.repMin &&
            r.repMax === item.draft.repMax
        );
    });
}
