import Link from "next/link";
import { useState } from "react";
import { saveRoutineDraft } from "@/lib/db/routineDraft";
import type { Exercise, Routine } from "@/lib/db/types";
import { findSameNameRoutine, isSameAsRoutine, type RoutineDraft, resolveDraft } from "@/lib/training/routineBlock";
import styles from "./RoutineSuggestion.module.css";

interface RoutineSuggestionProps {
    draft: RoutineDraft;
    exercises: readonly Exercise[];
    routines: readonly Routine[];
    /** 저장 후 대화 컨텍스트·루틴 목록을 다시 읽게 한다 */
    onSaved: () => void;
}

type SaveState =
    | { kind: "idle" }
    | { kind: "saving" }
    | { kind: "saved"; skipped: string[] }
    | { kind: "error"; message: string };

/**
 * 대화 답변 속 루틴 제안 카드 — 운동 탭에 다시 입력하지 않고 바로 저장한다.
 * 같은 이름 루틴이 있으면 업데이트(덮어쓰기)와 새로 저장을 고르게 하고, 구성이 같으면 저장됨으로 보인다.
 */
export default function RoutineSuggestion({ draft, exercises, routines, onSaved }: RoutineSuggestionProps) {
    const [state, setState] = useState<SaveState>({ kind: "idle" });
    const items = resolveDraft(draft, exercises);
    const existing = findSameNameRoutine(draft, routines);
    const alreadySaved = existing !== undefined && isSameAsRoutine(items, existing);
    const savable = items.some((i) => i.kind !== "skip");

    async function save(id?: string) {
        setState({ kind: "saving" });
        try {
            const result = await saveRoutineDraft(draft, id ? { id } : {});
            setState({ kind: "saved", skipped: result.skipped });
            onSaved();
        } catch (e) {
            setState({ kind: "error", message: e instanceof Error ? e.message : "저장하지 못했어요" });
        }
    }

    const saved = state.kind === "saved" || (alreadySaved && state.kind === "idle");

    return (
        <section className={styles.card} aria-label={`루틴 제안: ${draft.name}`}>
            <p className={styles.title}>
                <span className={styles.badge}>루틴 제안</span> {draft.name}
            </p>
            <ul className={styles.list}>
                {items.map((item, idx) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: 같은 종목이 두 번 나올 수 있고 목록은 고정이다
                    <li key={idx} className={item.kind === "skip" ? styles.skipped : undefined}>
                        <span>{item.kind === "matched" ? item.exercise.name : item.draft.name}</span>
                        <span className={styles.target}>
                            {item.draft.sets}세트 {item.draft.repMin}~{item.draft.repMax}회
                        </span>
                        {item.kind === "create" && <span className={styles.tag}>새 종목</span>}
                        {item.kind === "skip" && <span className={styles.tag}>앱에 없어 제외</span>}
                    </li>
                ))}
            </ul>

            {saved ? (
                <p className={styles.done} role="status">
                    ✓ 저장됨
                    {state.kind === "saved" && state.skipped.length > 0 && ` (제외 ${state.skipped.length}개)`} ·{" "}
                    <Link href="/workout">운동 탭에서 보기</Link>
                </p>
            ) : !savable ? (
                <p className={styles.note}>앱에 있는 종목이 없어 저장할 수 없어요</p>
            ) : (
                <div className={styles.actions}>
                    {existing ? (
                        <>
                            <button
                                type="button"
                                className={styles.primary}
                                disabled={state.kind === "saving"}
                                onClick={() => save(existing.id)}
                            >
                                기존 루틴 수정
                            </button>
                            <button
                                type="button"
                                className={styles.secondary}
                                disabled={state.kind === "saving"}
                                onClick={() => save()}
                            >
                                새로 저장
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            className={styles.primary}
                            disabled={state.kind === "saving"}
                            onClick={() => save()}
                        >
                            루틴으로 저장
                        </button>
                    )}
                </div>
            )}
            {state.kind === "error" && (
                <p className={styles.error} role="alert">
                    {state.message}
                </p>
            )}
        </section>
    );
}
