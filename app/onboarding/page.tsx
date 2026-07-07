"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { InstallSection } from "@/components/install/InstallSection";
import { BODY_LIMITS, rangeErrorMessage } from "@/lib/ai/limits";
import { addBodyMetric } from "@/lib/db/bodyMetrics";
import type { Gender, Goal } from "@/lib/db/types";
import { saveUserProfile } from "@/lib/db/userProfile";
import styles from "./page.module.css";

const GOALS: { value: Goal; label: string }[] = [
    { value: "lose-weight", label: "체중 감량" },
    { value: "gain-weight", label: "체중 증량" },
    { value: "maintain-weight", label: "체중 유지" },
    { value: "lean-mass", label: "근육 증가" },
    { value: "health", label: "건강 유지" },
];

export default function OnboardingPage() {
    const router = useRouter();
    const [gender, setGender] = useState<Gender | null>(null);
    const [goals, setGoals] = useState<Goal[]>([]);
    const [height, setHeight] = useState("");
    const [weight, setWeight] = useState("");
    const [bodyFat, setBodyFat] = useState("");
    const [muscleMass, setMuscleMass] = useState("");
    const [saving, setSaving] = useState(false);

    const heightError = rangeErrorMessage(height, BODY_LIMITS.heightCm);
    const weightError = rangeErrorMessage(weight, BODY_LIMITS.weightKg);
    const bodyFatError = rangeErrorMessage(bodyFat, BODY_LIMITS.bodyFatPct);
    const muscleError = rangeErrorMessage(muscleMass, BODY_LIMITS.skeletalMuscleKg);
    const hasError = [heightError, weightError, bodyFatError, muscleError].some((e) => e !== "");
    // 키·몸무게는 필수, 체지방률·골격근량은 선택
    const requiredFilled =
        gender !== null && goals.length > 0 && height.trim() !== "" && weight.trim() !== "";

    function toggleGoal(goal: Goal) {
        setGoals((prev) => (prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]));
    }

    async function handleSave() {
        if (!gender || !requiredFilled || hasError) return;
        setSaving(true);
        try {
            await saveUserProfile({
                gender,
                goals,
                heightCm: Number(height),
                weightKg: Number(weight),
            });
            // 입력받은 신체 수치를 첫 지표 기록으로 남긴다 — 실패해도 온보딩은 계속
            await addBodyMetric({
                weight: Number(weight),
                ...(bodyFat.trim() ? { bodyFatPct: Number(bodyFat) } : {}),
                ...(muscleMass.trim() ? { skeletalMuscleMass: Number(muscleMass) } : {}),
            }).catch(() => undefined);
            router.push("/");
        } finally {
            setSaving(false);
        }
    }

    return (
        <main className={styles.main}>
            <div className={styles.header}>
                <h1 className={styles.title}>프로필 설정</h1>
                <p className={styles.subtitle}>맞춤 식단을 위해 정보를 입력해주세요</p>
            </div>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>성별</h2>
                <div className={styles.genderGroup}>
                    {(["male", "female"] as const).map((g) => (
                        <button
                            key={g}
                            type="button"
                            className={`${styles.chip} ${gender === g ? styles.selected : ""}`}
                            onClick={() => setGender(g)}
                        >
                            {g === "male" ? "남성" : "여성"}
                        </button>
                    ))}
                </div>
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>목표 (복수 선택)</h2>
                <div className={styles.goalGroup}>
                    {GOALS.map(({ value, label }) => (
                        <button
                            key={value}
                            type="button"
                            className={`${styles.chip} ${goals.includes(value) ? styles.selected : ""}`}
                            onClick={() => toggleGoal(value)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>신체 정보</h2>
                <div className={styles.fieldRow}>
                    <div className={styles.fieldGroup}>
                        <label className={styles.fieldLabel} htmlFor="onboarding-height">
                            키 (cm)
                            <input
                                id="onboarding-height"
                                type="number"
                                inputMode="decimal"
                                min={BODY_LIMITS.heightCm.min}
                                max={BODY_LIMITS.heightCm.max}
                                step="0.1"
                                className={styles.fieldInput}
                                value={height}
                                onChange={(e) => setHeight(e.target.value)}
                                placeholder="예: 175"
                                aria-invalid={heightError !== ""}
                            />
                        </label>
                        {heightError && <span className={styles.fieldError}>{heightError}</span>}
                    </div>
                    <div className={styles.fieldGroup}>
                        <label className={styles.fieldLabel} htmlFor="onboarding-weight">
                            몸무게 (kg)
                            <input
                                id="onboarding-weight"
                                type="number"
                                inputMode="decimal"
                                min={BODY_LIMITS.weightKg.min}
                                max={BODY_LIMITS.weightKg.max}
                                step="0.1"
                                className={styles.fieldInput}
                                value={weight}
                                onChange={(e) => setWeight(e.target.value)}
                                placeholder="예: 70"
                                aria-invalid={weightError !== ""}
                            />
                        </label>
                        {weightError && <span className={styles.fieldError}>{weightError}</span>}
                    </div>
                </div>
                <div className={styles.fieldRow}>
                    <div className={styles.fieldGroup}>
                        <label className={styles.fieldLabel} htmlFor="onboarding-body-fat">
                            체지방률 (%)
                            <input
                                id="onboarding-body-fat"
                                type="number"
                                inputMode="decimal"
                                min={BODY_LIMITS.bodyFatPct.min}
                                max={BODY_LIMITS.bodyFatPct.max}
                                step="0.1"
                                className={styles.fieldInput}
                                value={bodyFat}
                                onChange={(e) => setBodyFat(e.target.value)}
                                placeholder="선택"
                                aria-invalid={bodyFatError !== ""}
                            />
                        </label>
                        {bodyFatError && <span className={styles.fieldError}>{bodyFatError}</span>}
                    </div>
                    <div className={styles.fieldGroup}>
                        <label className={styles.fieldLabel} htmlFor="onboarding-muscle">
                            골격근량 (kg)
                            <input
                                id="onboarding-muscle"
                                type="number"
                                inputMode="decimal"
                                min={BODY_LIMITS.skeletalMuscleKg.min}
                                max={BODY_LIMITS.skeletalMuscleKg.max}
                                step="0.1"
                                className={styles.fieldInput}
                                value={muscleMass}
                                onChange={(e) => setMuscleMass(e.target.value)}
                                placeholder="선택"
                                aria-invalid={muscleError !== ""}
                            />
                        </label>
                        {muscleError && <span className={styles.fieldError}>{muscleError}</span>}
                    </div>
                </div>
                <p className={styles.fieldHint}>키·몸무게는 필수, 체지방률·골격근량은 선택이에요.</p>
            </section>

            <InstallSection
                title="앱으로 설치"
                description="홈 화면에 추가하면 앱처럼 빠르게 실행할 수 있어요. (나중에 설정 탭에서도 가능)"
            />

            <div className={styles.footer}>
                <button
                    type="button"
                    className={styles.saveBtn}
                    onClick={handleSave}
                    disabled={!requiredFilled || hasError || saving}
                >
                    {saving ? "저장 중..." : "시작하기"}
                </button>
            </div>
        </main>
    );
}
