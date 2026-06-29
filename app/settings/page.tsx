"use client";

import { useEffect, useState } from "react";
import BottomNav from "@/components/layout/BottomNav";
import type { Gender, Goal, UserProfile } from "@/lib/db/types";
import { getUserProfile, saveUserProfile } from "@/lib/db/userProfile";
import styles from "./page.module.css";

const GOAL_LABELS: Record<Goal, string> = {
    "lose-weight": "체중 감량",
    "gain-weight": "체중 증량",
    "maintain-weight": "체중 유지",
    "lean-mass": "근육 증가",
    health: "건강 유지",
};

const GOALS = Object.entries(GOAL_LABELS) as [Goal, string][];

export default function SettingsPage() {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [gender, setGender] = useState<Gender>("male");
    const [goals, setGoals] = useState<Goal[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        getUserProfile()
            .then((p) => {
                if (p) {
                    setProfile(p);
                    setGender(p.gender);
                    setGoals(p.goals);
                }
                setLoading(false);
            })
            .catch(() => {
                setLoading(false);
            });
    }, []);

    function toggleGoal(goal: Goal) {
        setGoals((prev) => (prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]));
    }

    async function handleSave() {
        if (goals.length === 0) return;
        setSaving(true);
        try {
            const updated = await saveUserProfile({ gender, goals });
            setProfile(updated);
        } finally {
            setSaving(false);
        }
    }

    return (
        <main className={styles.main}>
            <header className={styles.header}>
                <h1 className={styles.title}>설정</h1>
            </header>

            {loading ? (
                <p className={styles.loading}>불러오는 중...</p>
            ) : profile === null ? (
                <p className={styles.empty}>프로필이 없습니다. 온보딩을 완료해주세요.</p>
            ) : (
                <div className={styles.form}>
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>성별</h2>
                        <div className={styles.chipGroup}>
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
                        <h2 className={styles.sectionTitle}>목표</h2>
                        <div className={styles.chipGroup}>
                            {GOALS.map(([value, label]) => (
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

                    <button
                        type="button"
                        className={styles.saveBtn}
                        onClick={handleSave}
                        disabled={goals.length === 0 || saving}
                    >
                        {saving ? "저장 중..." : "저장"}
                    </button>
                </div>
            )}

            <BottomNav active="settings" />
        </main>
    );
}
