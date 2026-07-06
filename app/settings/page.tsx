"use client";

import { useEffect, useState } from "react";
import { InstallButton } from "@/components/install/InstallButton";
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

// 상한은 /api/chat 스키마와 동일하게 유지 — 저장은 되는데 채팅이 400 나는 함정 방지
function parsePositiveNumber(value: string, max: number): number | undefined {
    const n = Number(value);
    return value.trim() !== "" && Number.isFinite(n) && n > 0 && n <= max ? n : undefined;
}

export default function SettingsPage() {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [gender, setGender] = useState<Gender>("male");
    const [goals, setGoals] = useState<Goal[]>([]);
    const [height, setHeight] = useState("");
    const [weight, setWeight] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        getUserProfile()
            .then((p) => {
                if (p) {
                    setProfile(p);
                    setGender(p.gender);
                    setGoals(p.goals);
                    setHeight(p.heightCm !== undefined ? String(p.heightCm) : "");
                    setWeight(p.weightKg !== undefined ? String(p.weightKg) : "");
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
            const updated = await saveUserProfile({
                gender,
                goals,
                heightCm: parsePositiveNumber(height, 300),
                weightKg: parsePositiveNumber(weight, 500),
            });
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

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>신체 정보</h2>
                        <div className={styles.bodyFields}>
                            <label className={styles.fieldLabel} htmlFor="height-input">
                                키 (cm)
                                <input
                                    id="height-input"
                                    type="number"
                                    inputMode="decimal"
                                    min={0}
                                    className={styles.fieldInput}
                                    value={height}
                                    onChange={(e) => setHeight(e.target.value)}
                                    placeholder="예: 175"
                                />
                            </label>
                            <label className={styles.fieldLabel} htmlFor="weight-input">
                                몸무게 (kg)
                                <input
                                    id="weight-input"
                                    type="number"
                                    inputMode="decimal"
                                    min={0}
                                    className={styles.fieldInput}
                                    value={weight}
                                    onChange={(e) => setWeight(e.target.value)}
                                    placeholder="예: 70"
                                />
                            </label>
                        </div>
                        <p className={styles.fieldHint}>
                            신체 지표 기록이 없을 때 식단 추천의 기준으로 사용돼요.
                        </p>
                    </section>

                    <button
                        type="button"
                        className={styles.saveBtn}
                        onClick={handleSave}
                        disabled={goals.length === 0 || saving}
                    >
                        {saving ? "저장 중..." : "저장"}
                    </button>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>앱 설치</h2>
                        <p className={styles.installDesc}>홈 화면에 추가하면 앱처럼 빠르게 실행할 수 있어요.</p>
                        <InstallButton />
                    </section>
                </div>
            )}

            <BottomNav active="settings" />
        </main>
    );
}
