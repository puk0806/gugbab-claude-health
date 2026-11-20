import { normalizeExerciseName, type RoutineDraft, resolveDraft } from "@/lib/training/routineBlock";
import { addCustomExercise, getAllExercises } from "./exercises";
import { saveRoutine } from "./routines";
import type { Exercise, Routine, RoutineExercise } from "./types";

/**
 * 대화에서 제안된 루틴을 저장 — 없는 종목(부위·기구가 있는 것)은 사용자 종목으로 만들고,
 * 만들 수 없는 종목은 빼고 저장한다. id를 주면 그 루틴을 덮어쓴다(같은 이름 업데이트).
 * 저장 시점에 종목 목록을 다시 읽어, 화면을 띄운 뒤 추가된 종목과 중복으로 만들지 않는다.
 */
export async function saveRoutineDraft(
    draft: RoutineDraft,
    options: { id?: string } = {},
): Promise<{ routine: Routine; skipped: string[]; created: string[] }> {
    const exercises = await getAllExercises();
    const items = resolveDraft(draft, exercises);
    // 같은 제안 안에서 새 종목이 두 번 나오면 한 번만 만든다
    const createdByName = new Map<string, Exercise>();
    const routineExercises: RoutineExercise[] = [];
    const skipped: string[] = [];
    for (const item of items) {
        const target = { sets: item.draft.sets, repMin: item.draft.repMin, repMax: item.draft.repMax };
        if (item.kind === "matched") {
            routineExercises.push({ exerciseId: item.exercise.id, ...target });
        } else if (item.kind === "create") {
            const key = normalizeExerciseName(item.draft.name);
            let exercise = createdByName.get(key);
            if (!exercise) {
                exercise = await addCustomExercise({
                    name: item.draft.name,
                    muscleGroup: item.muscleGroup,
                    equipment: item.equipment,
                });
                createdByName.set(key, exercise);
            }
            routineExercises.push({ exerciseId: exercise.id, ...target });
        } else {
            skipped.push(item.draft.name);
        }
    }
    if (routineExercises.length === 0) throw new Error("앱에 있는 종목이 없어 저장할 수 없어요");
    const routine = await saveRoutine({
        ...(options.id ? { id: options.id } : {}),
        name: draft.name,
        exercises: routineExercises,
    });
    return { routine, skipped, created: [...createdByName.values()].map((e) => e.name) };
}
