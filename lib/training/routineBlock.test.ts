import { describe, expect, it } from "vitest";
import type { Exercise, Routine } from "@/lib/db/types";
import { BUILT_IN_EXERCISES } from "./catalog";
import {
    extractRoutineBlocks,
    findSameNameRoutine,
    isSameAsRoutine,
    MAX_DRAFTS_PER_MESSAGE,
    resolveDraft,
} from "./routineBlock";

const block = (json: string) => `\`\`\`routine\n${json}\n\`\`\``;
const UPPER = '{"name":"상체 A","exercises":[{"name":"바벨 벤치프레스","sets":3,"repMin":8,"repMax":12}]}';

describe("extractRoutineBlocks", () => {
    it("루틴 블록을 본문에서 떼고 루틴으로 읽는다", () => {
        const { text, drafts } = extractRoutineBlocks(`상체 루틴이에요.\n\n${block(UPPER)}\n\n화이팅!`);
        expect(text).toBe("상체 루틴이에요.\n\n화이팅!");
        expect(drafts).toEqual([
            { name: "상체 A", exercises: [{ name: "바벨 벤치프레스", sets: 3, repMin: 8, repMax: 12 }] },
        ]);
    });

    it("블록이 여러 개면 모두 읽는다(분할 루틴)", () => {
        const lower = '{"name":"하체","exercises":[{"name":"바벨 백스쿼트","sets":4,"repMin":6,"repMax":8}]}';
        const { drafts } = extractRoutineBlocks(`${block(UPPER)}\n${block(lower)}`);
        expect(drafts.map((d) => d.name)).toEqual(["상체 A", "하체"]);
    });

    it("루틴 블록이 없으면 본문 그대로", () => {
        const content = "오늘은 쉬세요.\n```js\nconst a = 1\n```";
        expect(extractRoutineBlocks(content)).toEqual({ text: content, drafts: [] });
    });

    it("스트리밍 중 닫히지 않은 블록은 숨긴다", () => {
        const { text, drafts } = extractRoutineBlocks('루틴이에요.\n```routine\n{"name":"상');
        expect(text).toBe("루틴이에요.");
        expect(drafts).toEqual([]);
    });

    it("깨진 JSON·빈 이름·종목 없음은 버린다(본문에서는 지운다)", () => {
        for (const json of [
            "{not json",
            '{"name":"","exercises":[{"name":"풀업","sets":3,"repMin":5,"repMax":8}]}',
            '{"name":"A","exercises":[]}',
            '{"name":"A","exercises":[{"name":"","sets":3,"repMin":5,"repMax":8}]}',
            '{"name":"A","exercises":"풀업"}',
            "[]",
        ]) {
            const { text, drafts } = extractRoutineBlocks(`앞\n${block(json)}`);
            expect(drafts).toEqual([]);
            expect(text).toBe("앞");
        }
    });

    it("범위 밖 목표·긴 이름·많은 종목을 정규화한다", () => {
        const json = JSON.stringify({
            name: "가".repeat(100),
            exercises: Array.from({ length: 30 }, () => ({ name: "나".repeat(100), sets: 99, repMin: 20, repMax: 3 })),
        });
        const [draft] = extractRoutineBlocks(block(json)).drafts;
        expect(draft?.name).toHaveLength(30);
        expect(draft?.exercises).toHaveLength(15);
        expect(draft?.exercises[0]).toEqual({ name: "나".repeat(30), sets: 10, repMin: 20, repMax: 20 });
    });

    it("모르는 부위·기구 값은 버리고 종목은 살린다", () => {
        const json =
            '{"name":"A","exercises":[{"name":"x","sets":3,"repMin":8,"repMax":12,"muscleGroup":"neck","equipment":"kettlebell"}]}';
        expect(extractRoutineBlocks(block(json)).drafts[0]?.exercises[0]).toEqual({
            name: "x",
            sets: 3,
            repMin: 8,
            repMax: 12,
        });
    });

    it(`한 답변에서 최대 ${MAX_DRAFTS_PER_MESSAGE}개까지만 읽는다`, () => {
        const content = Array.from({ length: 10 }, () => block(UPPER)).join("\n");
        expect(extractRoutineBlocks(content).drafts).toHaveLength(MAX_DRAFTS_PER_MESSAGE);
    });
});

describe("resolveDraft", () => {
    const custom: Exercise = {
        id: "c1",
        name: "힙 쓰러스트",
        muscleGroup: "legs",
        equipment: "barbell",
        incrementKg: 5,
        builtIn: false,
    };
    const all = [...BUILT_IN_EXERCISES, custom];

    it("공백·대소문자 차이를 무시하고 기존 종목에 연결한다", () => {
        const items = resolveDraft(
            {
                name: "A",
                exercises: [
                    { name: "바벨벤치 프레스", sets: 3, repMin: 8, repMax: 12 },
                    { name: "힙쓰러스트", sets: 3, repMin: 8, repMax: 12 },
                ],
            },
            all,
        );
        expect(items.map((i) => (i.kind === "matched" ? i.exercise.id : i.kind))).toEqual(["bi-bench-press", "c1"]);
    });

    it("없는 종목은 부위·기구가 있으면 생성, 없으면 제외", () => {
        const items = resolveDraft(
            {
                name: "A",
                exercises: [
                    {
                        name: "케이블 플라이",
                        sets: 3,
                        repMin: 12,
                        repMax: 15,
                        muscleGroup: "chest",
                        equipment: "cable",
                    },
                    { name: "무언가", sets: 3, repMin: 8, repMax: 12 },
                ],
            },
            all,
        );
        expect(items.map((i) => i.kind)).toEqual(["create", "skip"]);
    });
});

describe("findSameNameRoutine / isSameAsRoutine", () => {
    const routine: Routine = {
        id: "r1",
        name: "상체 A",
        exercises: [{ exerciseId: "bi-bench-press", sets: 3, repMin: 8, repMax: 12 }],
        createdAt: "",
        updatedAt: "",
    };
    const [draft] = extractRoutineBlocks(block(UPPER)).drafts;

    it("같은 이름 루틴을 찾고, 구성이 같으면 동일로 본다", () => {
        if (!draft) throw new Error("draft");
        expect(findSameNameRoutine(draft, [routine])).toBe(routine);
        expect(isSameAsRoutine(resolveDraft(draft, BUILT_IN_EXERCISES), routine)).toBe(true);
    });

    it("세트·반복·종목이 다르면 동일이 아니다", () => {
        if (!draft) throw new Error("draft");
        const items = resolveDraft(draft, BUILT_IN_EXERCISES);
        expect(isSameAsRoutine(items, { ...routine, exercises: [{ ...routine.exercises[0], sets: 4 } as never] })).toBe(
            false,
        );
        expect(isSameAsRoutine(items, { ...routine, exercises: [] })).toBe(false);
        expect(findSameNameRoutine({ ...draft, name: "하체" }, [routine])).toBeUndefined();
    });
});
