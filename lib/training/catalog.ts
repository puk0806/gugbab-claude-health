import type { Equipment, Exercise, MuscleGroup } from "@/lib/db/types";

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
    chest: "가슴",
    back: "등",
    shoulders: "어깨",
    legs: "하체",
    arms: "팔",
    core: "코어",
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
    barbell: "바벨",
    dumbbell: "덤벨",
    machine: "머신",
    cable: "케이블",
    bodyweight: "맨몸",
};

export const MUSCLE_GROUPS = Object.keys(MUSCLE_GROUP_LABELS) as MuscleGroup[];
export const EQUIPMENTS = Object.keys(EQUIPMENT_LABELS) as Equipment[];

/**
 * 증량 단위 기본값 — 반복 범위 상한을 모든 세트에서 채웠을 때 다음 회차에 더할 무게.
 * 바벨 하체는 큰 근육군이라 5kg, 바벨 상체 2.5kg(원판 1.25kg×2), 덤벨은 한 손 2kg 단위 보편,
 * 머신 스택 5kg, 케이블 2.5kg, 맨몸은 무게 대신 반복을 늘린다(0).
 */
export function defaultIncrementKg(equipment: Equipment, muscleGroup: MuscleGroup): number {
    switch (equipment) {
        case "barbell":
            return muscleGroup === "legs" ? 5 : 2.5;
        case "dumbbell":
            return 2;
        case "machine":
            return 5;
        case "cable":
            return 2.5;
        case "bodyweight":
            return 0;
    }
}

function builtIn(
    id: string,
    name: string,
    muscleGroup: MuscleGroup,
    equipment: Equipment,
    incrementKg = defaultIncrementKg(equipment, muscleGroup),
): Exercise {
    return { id, name, muscleGroup, equipment, incrementKg, builtIn: true };
}

/** 기본 종목 — id는 고정 문자열(기록과 루틴이 참조하므로 바꾸지 않는다) */
export const BUILT_IN_EXERCISES: readonly Exercise[] = [
    builtIn("bi-bench-press", "바벨 벤치프레스", "chest", "barbell"),
    builtIn("bi-incline-db-press", "인클라인 덤벨 프레스", "chest", "dumbbell"),
    builtIn("bi-push-up", "푸시업", "chest", "bodyweight"),
    builtIn("bi-barbell-row", "바벨 로우", "back", "barbell"),
    builtIn("bi-lat-pulldown", "랫풀다운", "back", "cable", 5),
    builtIn("bi-seated-cable-row", "시티드 케이블 로우", "back", "cable", 5),
    builtIn("bi-pull-up", "풀업", "back", "bodyweight"),
    builtIn("bi-overhead-press", "오버헤드 프레스", "shoulders", "barbell"),
    builtIn("bi-lateral-raise", "덤벨 사이드 레터럴 레이즈", "shoulders", "dumbbell", 1),
    builtIn("bi-back-squat", "바벨 백스쿼트", "legs", "barbell"),
    builtIn("bi-deadlift", "컨벤셔널 데드리프트", "legs", "barbell"),
    builtIn("bi-romanian-deadlift", "루마니안 데드리프트", "legs", "barbell"),
    builtIn("bi-leg-press", "레그프레스", "legs", "machine", 10),
    builtIn("bi-db-curl", "덤벨 컬", "arms", "dumbbell", 1),
    builtIn("bi-cable-pushdown", "케이블 푸시다운", "arms", "cable"),
    builtIn("bi-hanging-leg-raise", "행잉 레그레이즈", "core", "bodyweight"),
];
