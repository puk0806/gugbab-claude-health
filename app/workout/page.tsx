"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BottomNav from "@/components/layout/BottomNav";
import { getAllExercises } from "@/lib/db/exercises";
import { listRoutines } from "@/lib/db/routines";
import type { Exercise, Routine, WorkoutSession } from "@/lib/db/types";
import { deleteWorkoutSession, historyByExercise, listWorkoutSessions } from "@/lib/db/workouts";
import { BUILT_IN_EXERCISES } from "@/lib/training/catalog";
import { bestOneRepMax, formatSets, recommendationText, recommendNext } from "@/lib/training/progression";
import styles from "./workout.module.css";

const RECENT_SESSION_COUNT = 10;

export default function WorkoutPage() {
    const [routines, setRoutines] = useState<Routine[]>([]);
    const [sessions, setSessions] = useState<WorkoutSession[]>([]);
    const [exercises, setExercises] = useState<Exercise[]>([...BUILT_IN_EXERCISES]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            listRoutines().catch(() => []),
            listWorkoutSessions().catch(() => []),
            getAllExercises().catch(() => [...BUILT_IN_EXERCISES]),
        ])
            .then(([r, s, e]) => {
                setRoutines(r);
                setSessions(s);
                setExercises(e);
            })
            .finally(() => setLoading(false));
    }, []);

    const exerciseById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
    const history = useMemo(() => historyByExercise(sessions), [sessions]);

    async function handleDeleteSession(id: string) {
        try {
            await deleteWorkoutSession(id);
        } catch {
            return;
        }
        setSessions((prev) => prev.filter((s) => s.id !== id));
    }

    return (
        <main className={styles.main}>
            <header className={styles.header}>
                <h1 className={styles.title}>운동</h1>
            </header>

            <section className={styles.section}>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>내 루틴</h2>
                    <Link href="/workout/routine" className={styles.secondaryBtn}>
                        + 새 루틴
                    </Link>
                </div>
                {!loading && routines.length === 0 ? (
                    <p className={styles.empty}>
                        아직 루틴이 없어요. 루틴을 만들면 지난 기록으로 다음 무게를 알려 드려요
                    </p>
                ) : (
                    <ul className={styles.list}>
                        {routines.map((routine) => (
                            <li key={routine.id} className={styles.card}>
                                <div className={styles.cardHeader}>
                                    <h3 className={styles.cardTitle}>{routine.name}</h3>
                                    <span className={styles.cardSub}>{routine.exercises.length}종목</span>
                                </div>
                                {routine.exercises.map((item, idx) => {
                                    const exercise = exerciseById.get(item.exerciseId);
                                    const rec = recommendNext({
                                        incrementKg: exercise?.incrementKg ?? 0,
                                        sets: item.sets,
                                        repMin: item.repMin,
                                        repMax: item.repMax,
                                        history: history.get(item.exerciseId) ?? [],
                                    });
                                    return (
                                        // biome-ignore lint/suspicious/noArrayIndexKey: 같은 종목을 두 번 넣을 수 있어 순서가 식별자
                                        <div key={`${item.exerciseId}-${idx}`} className={styles.exerciseLine}>
                                            <span className={styles.exerciseName}>
                                                {exercise?.name ?? "삭제된 종목"}
                                            </span>
                                            <span className={styles.cardSub}>
                                                {item.sets}×{item.repMin}~{item.repMax}
                                            </span>
                                            <span className={styles.badge} data-kind={rec.kind}>
                                                {recommendationText(rec)}
                                            </span>
                                        </div>
                                    );
                                })}
                                <div className={styles.actions}>
                                    <Link
                                        href={`/workout/session?routine=${encodeURIComponent(routine.id)}`}
                                        className={`${styles.primaryBtn} ${styles.grow}`}
                                    >
                                        시작
                                    </Link>
                                    <Link
                                        href={`/workout/routine?id=${encodeURIComponent(routine.id)}`}
                                        className={styles.secondaryBtn}
                                    >
                                        편집
                                    </Link>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>최근 운동</h2>
                {!loading && sessions.length === 0 ? (
                    <p className={styles.empty}>운동 기록이 없습니다</p>
                ) : (
                    <ul className={styles.list}>
                        {sessions.slice(0, RECENT_SESSION_COUNT).map((s) => (
                            <li key={s.id} className={styles.card}>
                                <div className={styles.cardHeader}>
                                    <span className={styles.cardSub}>
                                        {s.date}
                                        {s.routineName ? ` · ${s.routineName}` : ""}
                                    </span>
                                    <button
                                        type="button"
                                        className={styles.iconBtn}
                                        onClick={() => handleDeleteSession(s.id)}
                                        aria-label={`${s.date} 운동 기록 삭제`}
                                    >
                                        🗑
                                    </button>
                                </div>
                                {s.entries.map((e, idx) => {
                                    const oneRm = bestOneRepMax(e.sets);
                                    return (
                                        // biome-ignore lint/suspicious/noArrayIndexKey: 한 세션에 같은 종목이 두 번 있을 수 있어 순서가 식별자
                                        <div key={`${e.exerciseId}-${idx}`} className={styles.exerciseLine}>
                                            <span className={styles.exerciseName}>{e.exerciseName}</span>
                                            <span>{formatSets(e.sets)}</span>
                                            {oneRm !== null && <span className={styles.cardSub}>1RM 약 {oneRm}kg</span>}
                                        </div>
                                    );
                                })}
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <BottomNav active="workout" />
        </main>
    );
}
