"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import BottomNav from "@/components/layout/BottomNav";
import { getAllExercises } from "@/lib/db/exercises";
import { getRoutine } from "@/lib/db/routines";
import type { Exercise, Routine } from "@/lib/db/types";
import { addWorkoutSession, historyByExercise, listWorkoutSessions } from "@/lib/db/workouts";
import { BUILT_IN_EXERCISES } from "@/lib/training/catalog";
import { isValidReps, isValidWeight, WORKOUT_LIMITS } from "@/lib/training/limits";
import {
    type ExerciseHistoryItem,
    formatSets,
    type Recommendation,
    recommendationText,
    recommendNext,
} from "@/lib/training/progression";
import styles from "../workout.module.css";
import { clearDraft, type DraftEntry, type DraftSet, loadDraft, saveDraft } from "./draft";

function parseWeight(v: string): number | null {
    if (v.trim() === "") return null;
    const n = Number(v);
    return isValidWeight(n) ? n : null;
}

function parseReps(v: string): number | null {
    if (v.trim() === "") return null;
    const n = Number(v);
    return isValidReps(n) && n > 0 ? n : null;
}

function isSetValid(s: DraftSet): boolean {
    return parseWeight(s.weight) !== null && parseReps(s.reps) !== null;
}

function emptySet(weight: string): DraftSet {
    return { weight, reps: "", done: false };
}

/** 저장된 임시 입력이 지금 루틴과 같은 종목 순서일 때만 이어서 쓴다 */
function draftMatches(draft: DraftEntry[], routine: Routine): boolean {
    return (
        draft.length === routine.exercises.length &&
        draft.every((d, i) => d.exerciseId === routine.exercises[i]?.exerciseId)
    );
}

export default function WorkoutLogger() {
    const router = useRouter();
    const params = useSearchParams();
    const routineId = params.get("routine") ?? "";

    const [routine, setRoutine] = useState<Routine | null>(null);
    const [exercises, setExercises] = useState<Exercise[]>([...BUILT_IN_EXERCISES]);
    const [history, setHistory] = useState<Map<string, ExerciseHistoryItem[]>>(new Map());
    const [entries, setEntries] = useState<DraftEntry[]>([]);
    const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState("");
    const restored = useRef(false);

    useEffect(() => {
        if (!routineId) {
            setStatus("missing");
            return;
        }
        Promise.all([
            getRoutine(routineId),
            getAllExercises().catch(() => [...BUILT_IN_EXERCISES]),
            listWorkoutSessions().catch(() => []),
        ])
            .then(([r, ex, sessions]) => {
                if (!r) {
                    setStatus("missing");
                    return;
                }
                const hist = historyByExercise(sessions);
                const byId = new Map(ex.map((e) => [e.id, e]));
                setRoutine(r);
                setExercises(ex);
                setHistory(hist);
                const draft = loadDraft(r.id);
                if (draft && draftMatches(draft, r)) {
                    setEntries(draft);
                } else {
                    setEntries(
                        r.exercises.map((item) => {
                            const rec = recommendNext({
                                incrementKg: byId.get(item.exerciseId)?.incrementKg ?? 0,
                                sets: item.sets,
                                repMin: item.repMin,
                                repMax: item.repMax,
                                history: hist.get(item.exerciseId) ?? [],
                            });
                            const weight = rec.weightKg !== undefined ? String(rec.weightKg) : "";
                            return {
                                exerciseId: item.exerciseId,
                                sets: Array.from({ length: item.sets }, () => emptySet(weight)),
                            };
                        }),
                    );
                }
                restored.current = true;
                setStatus("ready");
            })
            .catch(() => setStatus("missing"));
    }, [routineId]);

    useEffect(() => {
        if (restored.current && routine) saveDraft(routine.id, entries);
    }, [entries, routine]);

    const exerciseById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);

    const recommendations: Recommendation[] = useMemo(
        () =>
            routine?.exercises.map((item) =>
                recommendNext({
                    incrementKg: exerciseById.get(item.exerciseId)?.incrementKg ?? 0,
                    sets: item.sets,
                    repMin: item.repMin,
                    repMax: item.repMax,
                    history: history.get(item.exerciseId) ?? [],
                }),
            ) ?? [],
        [routine, exerciseById, history],
    );

    const doneCount = entries.reduce((n, e) => n + e.sets.filter((s) => s.done && isSetValid(s)).length, 0);

    function updateSet(entryIdx: number, setIdx: number, patch: Partial<DraftSet>) {
        setEntries((prev) =>
            prev.map((entry, i) => {
                if (i !== entryIdx) return entry;
                return {
                    ...entry,
                    sets: entry.sets.map((s, j) => {
                        if (j !== setIdx) return s;
                        const next = { ...s, ...patch };
                        // 값을 고쳐 유효하지 않게 되면 완료 표시를 푼다 — 잘못된 값이 완료로 저장되지 않게
                        return next.done && !isSetValid(next) ? { ...next, done: false } : next;
                    }),
                };
            }),
        );
    }

    function addSet(entryIdx: number) {
        setEntries((prev) =>
            prev.map((entry, i) => {
                if (i !== entryIdx || entry.sets.length >= WORKOUT_LIMITS.sets.max) return entry;
                const lastWeight = entry.sets.at(-1)?.weight ?? "";
                return { ...entry, sets: [...entry.sets, emptySet(lastWeight)] };
            }),
        );
    }

    function removeSet(entryIdx: number) {
        setEntries((prev) =>
            prev.map((entry, i) =>
                i === entryIdx && entry.sets.length > 1 ? { ...entry, sets: entry.sets.slice(0, -1) } : entry,
            ),
        );
    }

    async function handleFinish() {
        if (!routine || doneCount === 0 || saving) return;
        setSaving(true);
        setSaveError("");
        try {
            await addWorkoutSession({
                routineId: routine.id,
                routineName: routine.name,
                entries: entries.map((entry, i) => {
                    const item = routine.exercises[i];
                    return {
                        exerciseId: entry.exerciseId,
                        exerciseName: exerciseById.get(entry.exerciseId)?.name ?? "삭제된 종목",
                        targetSets: item?.sets ?? entry.sets.length,
                        repMin: item?.repMin ?? 1,
                        repMax: item?.repMax ?? 1,
                        sets: entry.sets.map((s) => ({
                            weightKg: parseWeight(s.weight) ?? Number.NaN,
                            reps: parseReps(s.reps) ?? 0,
                            done: s.done,
                        })),
                    };
                }),
            });
            clearDraft(routine.id);
            restored.current = false;
            router.push("/workout");
        } catch {
            setSaveError("저장하지 못했어요. 다시 시도해 주세요");
            setSaving(false);
        }
    }

    if (status === "missing") {
        return (
            <main className={styles.main}>
                <header className={styles.header}>
                    <Link href="/workout" className={styles.backLink} aria-label="운동으로 돌아가기">
                        ←
                    </Link>
                    <h1 className={styles.title}>운동 기록</h1>
                </header>
                <section className={styles.section}>
                    <p className={styles.empty}>루틴을 찾을 수 없어요</p>
                </section>
                <BottomNav active="workout" />
            </main>
        );
    }

    return (
        <main className={styles.main}>
            <header className={styles.header}>
                <Link href="/workout" className={styles.backLink} aria-label="운동으로 돌아가기">
                    ←
                </Link>
                <h1 className={styles.title}>{routine?.name ?? "운동 기록"}</h1>
            </header>

            {status === "ready" && routine && (
                <p className={`${styles.hint} ${styles.inset}`}>
                    권장 무게를 미리 채워 두었어요. 한 세트를 마치면 반복 수를 적고 완료를 눌러 주세요
                </p>
            )}

            {routine?.exercises.map((item, entryIdx) => {
                const entry = entries[entryIdx];
                if (!entry) return null;
                const exercise = exerciseById.get(item.exerciseId);
                const label = exercise?.name ?? "삭제된 종목";
                const rec = recommendations[entryIdx];
                const last = history.get(item.exerciseId)?.[0];
                return (
                    // biome-ignore lint/suspicious/noArrayIndexKey: 같은 종목이 루틴에 두 번 들어갈 수 있어 순서가 식별자
                    <section key={entryIdx} className={styles.section} aria-label={label}>
                        <div className={styles.sectionHeader}>
                            <h2 className={styles.sectionTitle}>{label}</h2>
                            <span className={styles.cardSub}>
                                {item.sets}×{item.repMin}~{item.repMax}회
                            </span>
                        </div>
                        {rec && (
                            <div className={styles.exerciseLine}>
                                <span className={styles.badge} data-kind={rec.kind}>
                                    {recommendationText(rec)}
                                </span>
                                <span className={styles.cardSub}>{rec.reason}</span>
                            </div>
                        )}
                        {last && (
                            <span className={styles.cardSub}>
                                지난번({last.date}) {formatSets(last.sets)}
                            </span>
                        )}
                        <div className={styles.setTable}>
                            <div className={`${styles.setRow} ${styles.setHead}`}>
                                <span className={styles.setIndex}>세트</span>
                                <span>무게(kg)</span>
                                <span>반복</span>
                                <span />
                            </div>
                            {entry.sets.map((s, setIdx) => {
                                const valid = isSetValid(s);
                                const n = setIdx + 1;
                                return (
                                    // biome-ignore lint/suspicious/noArrayIndexKey: 세트는 순번 자체가 식별자
                                    <div key={setIdx} className={styles.setRow}>
                                        <span className={styles.setIndex}>{n}</span>
                                        <input
                                            className={styles.input}
                                            type="number"
                                            inputMode="decimal"
                                            min={WORKOUT_LIMITS.weightKg.min}
                                            max={WORKOUT_LIMITS.weightKg.max}
                                            step="0.25"
                                            placeholder="kg"
                                            value={s.weight}
                                            onChange={(e) => updateSet(entryIdx, setIdx, { weight: e.target.value })}
                                            aria-label={`${label} ${n}세트 무게`}
                                            aria-invalid={s.weight !== "" && parseWeight(s.weight) === null}
                                        />
                                        <input
                                            className={styles.input}
                                            type="number"
                                            inputMode="numeric"
                                            min={1}
                                            max={WORKOUT_LIMITS.reps.max}
                                            placeholder={`${item.repMin}~${item.repMax}`}
                                            value={s.reps}
                                            onChange={(e) => updateSet(entryIdx, setIdx, { reps: e.target.value })}
                                            aria-label={`${label} ${n}세트 반복`}
                                            aria-invalid={s.reps !== "" && parseReps(s.reps) === null}
                                        />
                                        <button
                                            type="button"
                                            className={styles.doneBtn}
                                            aria-pressed={s.done}
                                            aria-label={`${label} ${n}세트 완료`}
                                            disabled={!valid && !s.done}
                                            onClick={() => updateSet(entryIdx, setIdx, { done: !s.done })}
                                        >
                                            {s.done ? "완료" : "체크"}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                        <div className={styles.actions}>
                            <button
                                type="button"
                                className={styles.secondaryBtn}
                                onClick={() => addSet(entryIdx)}
                                disabled={entry.sets.length >= WORKOUT_LIMITS.sets.max}
                            >
                                + 세트
                            </button>
                            <button
                                type="button"
                                className={styles.secondaryBtn}
                                onClick={() => removeSet(entryIdx)}
                                disabled={entry.sets.length <= 1}
                            >
                                − 세트
                            </button>
                        </div>
                    </section>
                );
            })}

            {saveError && (
                <p className={`${styles.fieldError} ${styles.inset}`} role="alert">
                    {saveError}
                </p>
            )}

            {status === "ready" && (
                <div className={styles.stickyBar}>
                    <button
                        type="button"
                        className={styles.primaryBtn}
                        onClick={handleFinish}
                        disabled={doneCount === 0 || saving}
                    >
                        {saving ? "저장 중..." : `운동 완료 (${doneCount}세트)`}
                    </button>
                </div>
            )}

            <BottomNav active="workout" />
        </main>
    );
}
