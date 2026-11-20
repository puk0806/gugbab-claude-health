"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import BottomNav from "@/components/layout/BottomNav";
import { addCustomExercise, getAllExercises } from "@/lib/db/exercises";
import { deleteRoutine, getRoutine, saveRoutine } from "@/lib/db/routines";
import type { Equipment, Exercise, MuscleGroup, RoutineExercise } from "@/lib/db/types";
import {
    BUILT_IN_EXERCISES,
    EQUIPMENT_LABELS,
    EQUIPMENTS,
    MUSCLE_GROUP_LABELS,
    MUSCLE_GROUPS,
} from "@/lib/training/catalog";
import { WORKOUT_LIMITS } from "@/lib/training/limits";
import styles from "../workout.module.css";

/** 목적별 반복 범위 — ACSM(2026) 저항 운동 권고의 근력·근비대·근지구력 구간 */
const REP_PRESETS = [
    { id: "strength", label: "근력 (3~6회)", repMin: 3, repMax: 6, sets: 3 },
    { id: "hypertrophy", label: "근비대 (8~12회)", repMin: 8, repMax: 12, sets: 3 },
    { id: "endurance", label: "근지구력 (15~20회)", repMin: 15, repMax: 20, sets: 2 },
] as const;

const DEFAULT_PRESET = REP_PRESETS[1];

interface DraftItem {
    exerciseId: string;
    sets: string;
    repMin: string;
    repMax: string;
}

function toDraft(e: RoutineExercise): DraftItem {
    return { exerciseId: e.exerciseId, sets: String(e.sets), repMin: String(e.repMin), repMax: String(e.repMax) };
}

function intIn(value: string, min: number, max: number): number | null {
    if (value.trim() === "") return null;
    const n = Number(value);
    return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

function itemError(item: DraftItem): string {
    const sets = intIn(item.sets, WORKOUT_LIMITS.sets.min, WORKOUT_LIMITS.sets.max);
    const R = WORKOUT_LIMITS.repRange;
    const repMin = intIn(item.repMin, R.min, R.max);
    const repMax = intIn(item.repMax, R.min, R.max);
    if (sets === null) return `세트는 ${WORKOUT_LIMITS.sets.min}~${WORKOUT_LIMITS.sets.max} 사이 정수로 입력해 주세요`;
    if (repMin === null || repMax === null) return `반복은 ${R.min}~${R.max} 사이 정수로 입력해 주세요`;
    if (repMin > repMax) return "반복 하한이 상한보다 클 수 없어요";
    return "";
}

export default function RoutineEditor() {
    const router = useRouter();
    const params = useSearchParams();
    const routineId = params.get("id") ?? undefined;

    const [exercises, setExercises] = useState<Exercise[]>([...BUILT_IN_EXERCISES]);
    const [name, setName] = useState("");
    const [items, setItems] = useState<DraftItem[]>([]);
    const [picker, setPicker] = useState("");
    const [loading, setLoading] = useState(Boolean(routineId));
    const [notFound, setNotFound] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState("");
    const [confirmDelete, setConfirmDelete] = useState(false);

    const [customName, setCustomName] = useState("");
    const [customGroup, setCustomGroup] = useState<MuscleGroup>("chest");
    const [customEquipment, setCustomEquipment] = useState<Equipment>("dumbbell");

    useEffect(() => {
        getAllExercises()
            .then(setExercises)
            .catch(() => undefined);
    }, []);

    useEffect(() => {
        if (!routineId) return;
        getRoutine(routineId)
            .then((r) => {
                if (!r) {
                    setNotFound(true);
                    return;
                }
                setName(r.name);
                setItems(r.exercises.map(toDraft));
            })
            .catch(() => setNotFound(true))
            .finally(() => setLoading(false));
    }, [routineId]);

    const exerciseById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
    const errors = items.map(itemError);
    const trimmedName = name.trim();
    const canSave = trimmedName.length > 0 && items.length > 0 && errors.every((e) => e === "") && !saving && !loading;
    const atMax = items.length >= WORKOUT_LIMITS.maxRoutineExercises;

    function addItem(exerciseId: string) {
        if (!exerciseId || atMax) return;
        setItems((prev) => [
            ...prev,
            {
                exerciseId,
                sets: String(DEFAULT_PRESET.sets),
                repMin: String(DEFAULT_PRESET.repMin),
                repMax: String(DEFAULT_PRESET.repMax),
            },
        ]);
        setPicker("");
    }

    function updateItem(idx: number, patch: Partial<DraftItem>) {
        setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
    }

    function moveItem(idx: number, delta: -1 | 1) {
        setItems((prev) => {
            const target = idx + delta;
            if (target < 0 || target >= prev.length) return prev;
            const next = [...prev];
            [next[idx], next[target]] = [next[target], next[idx]];
            return next;
        });
    }

    function applyPreset(presetId: string) {
        const preset = REP_PRESETS.find((p) => p.id === presetId);
        if (!preset) return;
        setItems((prev) =>
            prev.map((item) => ({
                ...item,
                sets: String(preset.sets),
                repMin: String(preset.repMin),
                repMax: String(preset.repMax),
            })),
        );
    }

    async function handleAddCustom() {
        const trimmed = customName.trim();
        if (!trimmed || atMax) return;
        try {
            const created = await addCustomExercise({
                name: trimmed,
                muscleGroup: customGroup,
                equipment: customEquipment,
            });
            setExercises((prev) => [...prev, created]);
            addItem(created.id);
            setCustomName("");
        } catch {
            setSaveError("종목을 추가하지 못했어요");
        }
    }

    async function handleSave() {
        if (!canSave) return;
        setSaving(true);
        setSaveError("");
        try {
            await saveRoutine({
                ...(routineId ? { id: routineId } : {}),
                name: trimmedName,
                exercises: items.map((i) => ({
                    exerciseId: i.exerciseId,
                    sets: Number(i.sets),
                    repMin: Number(i.repMin),
                    repMax: Number(i.repMax),
                })),
            });
            router.push("/workout");
        } catch {
            setSaveError("저장하지 못했어요. 다시 시도해 주세요");
            setSaving(false);
        }
    }

    async function handleDelete() {
        if (!routineId) return;
        if (!confirmDelete) {
            setConfirmDelete(true);
            return;
        }
        try {
            await deleteRoutine(routineId);
            router.push("/workout");
        } catch {
            setSaveError("삭제하지 못했어요");
        }
    }

    if (notFound) {
        return (
            <main className={styles.main}>
                <header className={styles.header}>
                    <Link href="/workout" className={styles.backLink} aria-label="운동으로 돌아가기">
                        ←
                    </Link>
                    <h1 className={styles.title}>루틴</h1>
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
                <h1 className={styles.title}>{routineId ? "루틴 편집" : "새 루틴"}</h1>
            </header>

            <section className={styles.section}>
                <label className={styles.label} htmlFor="routine-name">
                    루틴 이름
                    <input
                        id="routine-name"
                        className={styles.input}
                        placeholder="예: 상체 A"
                        maxLength={WORKOUT_LIMITS.nameLength}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                </label>
                <label className={styles.label} htmlFor="rep-preset">
                    목적별 반복 범위 (전체 적용)
                    <select
                        id="rep-preset"
                        className={styles.select}
                        value=""
                        onChange={(e) => applyPreset(e.target.value)}
                        disabled={items.length === 0}
                    >
                        <option value="">선택하면 모든 종목에 적용</option>
                        {REP_PRESETS.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.label}
                            </option>
                        ))}
                    </select>
                </label>
            </section>

            <section className={styles.section}>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>종목</h2>
                    <span className={styles.cardSub}>
                        {items.length}/{WORKOUT_LIMITS.maxRoutineExercises}
                    </span>
                </div>
                {items.length === 0 && <p className={styles.empty}>아래에서 종목을 추가해 주세요</p>}
                <ul className={styles.list}>
                    {items.map((item, idx) => {
                        const exercise = exerciseById.get(item.exerciseId);
                        const label = exercise?.name ?? "삭제된 종목";
                        return (
                            // biome-ignore lint/suspicious/noArrayIndexKey: 같은 종목을 두 번 넣을 수 있어 순서가 유일한 식별자
                            <li key={idx} className={styles.card}>
                                <div className={styles.cardHeader}>
                                    <h3 className={styles.cardTitle}>{label}</h3>
                                    <div>
                                        <button
                                            type="button"
                                            className={styles.iconBtn}
                                            onClick={() => moveItem(idx, -1)}
                                            disabled={idx === 0}
                                            aria-label={`${label} 위로`}
                                        >
                                            ↑
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.iconBtn}
                                            onClick={() => moveItem(idx, 1)}
                                            disabled={idx === items.length - 1}
                                            aria-label={`${label} 아래로`}
                                        >
                                            ↓
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.iconBtn}
                                            onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                                            aria-label={`${label} 빼기`}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                                <div className={styles.row}>
                                    <label className={styles.label}>
                                        세트
                                        <input
                                            className={styles.input}
                                            type="number"
                                            inputMode="numeric"
                                            min={WORKOUT_LIMITS.sets.min}
                                            max={WORKOUT_LIMITS.sets.max}
                                            value={item.sets}
                                            onChange={(e) => updateItem(idx, { sets: e.target.value })}
                                            aria-label={`${label} 세트 수`}
                                        />
                                    </label>
                                    <label className={styles.label}>
                                        반복 하한
                                        <input
                                            className={styles.input}
                                            type="number"
                                            inputMode="numeric"
                                            min={WORKOUT_LIMITS.repRange.min}
                                            max={WORKOUT_LIMITS.repRange.max}
                                            value={item.repMin}
                                            onChange={(e) => updateItem(idx, { repMin: e.target.value })}
                                            aria-label={`${label} 반복 하한`}
                                        />
                                    </label>
                                    <label className={styles.label}>
                                        반복 상한
                                        <input
                                            className={styles.input}
                                            type="number"
                                            inputMode="numeric"
                                            min={WORKOUT_LIMITS.repRange.min}
                                            max={WORKOUT_LIMITS.repRange.max}
                                            value={item.repMax}
                                            onChange={(e) => updateItem(idx, { repMax: e.target.value })}
                                            aria-label={`${label} 반복 상한`}
                                        />
                                    </label>
                                </div>
                                {errors[idx] && <span className={styles.fieldError}>{errors[idx]}</span>}
                            </li>
                        );
                    })}
                </ul>

                <label className={styles.label} htmlFor="exercise-picker">
                    종목 추가
                    <select
                        id="exercise-picker"
                        className={styles.select}
                        value={picker}
                        onChange={(e) => addItem(e.target.value)}
                        disabled={atMax}
                    >
                        <option value="">종목 선택</option>
                        {MUSCLE_GROUPS.map((group) => (
                            <optgroup key={group} label={MUSCLE_GROUP_LABELS[group]}>
                                {exercises
                                    .filter((e) => e.muscleGroup === group)
                                    .map((e) => (
                                        <option key={e.id} value={e.id}>
                                            {e.name}
                                        </option>
                                    ))}
                            </optgroup>
                        ))}
                    </select>
                </label>

                <div className={styles.card}>
                    <span className={styles.cardSub}>목록에 없는 종목 직접 추가</span>
                    <input
                        className={styles.input}
                        placeholder="종목 이름"
                        maxLength={WORKOUT_LIMITS.nameLength}
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        aria-label="새 종목 이름"
                    />
                    <div className={styles.row}>
                        <select
                            className={styles.select}
                            value={customGroup}
                            onChange={(e) => setCustomGroup(e.target.value as MuscleGroup)}
                            aria-label="새 종목 부위"
                        >
                            {MUSCLE_GROUPS.map((g) => (
                                <option key={g} value={g}>
                                    {MUSCLE_GROUP_LABELS[g]}
                                </option>
                            ))}
                        </select>
                        <select
                            className={styles.select}
                            value={customEquipment}
                            onChange={(e) => setCustomEquipment(e.target.value as Equipment)}
                            aria-label="새 종목 도구"
                        >
                            {EQUIPMENTS.map((eq) => (
                                <option key={eq} value={eq}>
                                    {EQUIPMENT_LABELS[eq]}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={handleAddCustom}
                        disabled={!customName.trim() || atMax}
                    >
                        종목 만들고 추가
                    </button>
                </div>
            </section>

            {saveError && (
                <p className={`${styles.fieldError} ${styles.inset}`} role="alert">
                    {saveError}
                </p>
            )}

            <div className={styles.stickyBar}>
                <button type="button" className={styles.primaryBtn} onClick={handleSave} disabled={!canSave}>
                    {saving ? "저장 중..." : "루틴 저장"}
                </button>
            </div>

            {routineId && (
                <section className={styles.section}>
                    <button type="button" className={styles.dangerBtn} onClick={handleDelete}>
                        {confirmDelete ? "한 번 더 누르면 삭제돼요" : "루틴 삭제"}
                    </button>
                    <p className={styles.hint}>루틴을 지워도 지난 운동 기록은 남아요</p>
                </section>
            )}

            <BottomNav active="workout" />
        </main>
    );
}
