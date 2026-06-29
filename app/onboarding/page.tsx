"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
    const [saving, setSaving] = useState(false);

    function toggleGoal(goal: Goal) {
        setGoals((prev) => (prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]));
    }

    async function handleSave() {
        if (!gender || goals.length === 0) return;
        setSaving(true);
        try {
            await saveUserProfile({ gender, goals });
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

            <div className={styles.footer}>
                <button
                    type="button"
                    className={styles.saveBtn}
                    onClick={handleSave}
                    disabled={gender === null || goals.length === 0 || saving}
                >
                    {saving ? "저장 중..." : "시작하기"}
                </button>
            </div>
        </main>
    );
}
