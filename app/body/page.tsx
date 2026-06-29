"use client";

import { useEffect, useState } from "react";
import BottomNav from "@/components/layout/BottomNav";
import { addBodyMetric, getLatestBodyMetrics } from "@/lib/db/bodyMetrics";
import { getLocalDateString } from "@/lib/db/index";
import type { BodyMetric } from "@/lib/db/types";
import styles from "./page.module.css";

export default function BodyPage() {
    const [records, setRecords] = useState<BodyMetric[]>([]);
    const [loadingRecords, setLoadingRecords] = useState(true);
    const [weight, setWeight] = useState("");
    const [bodyFat, setBodyFat] = useState("");
    const [muscleMass, setMuscleMass] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        getLatestBodyMetrics(7)
            .then((fetched) => {
                setRecords((current) => {
                    const fetchedIds = new Set(fetched.map((r) => r.id));
                    const pendingAdds = current.filter((r) => !fetchedIds.has(r.id));
                    return [...fetched, ...pendingAdds].slice(-7);
                });
            })
            .finally(() => setLoadingRecords(false));
    }, []);

    async function handleSave() {
        const w = Number.parseFloat(weight);
        if (Number.isNaN(w) || w < 20 || w > 300) return;
        const bf = bodyFat ? Number.parseFloat(bodyFat) : undefined;
        const mm = muscleMass ? Number.parseFloat(muscleMass) : undefined;
        if (bf !== undefined && (Number.isNaN(bf) || bf < 1 || bf > 70)) return;
        if (mm !== undefined && (Number.isNaN(mm) || mm < 1 || mm > 100)) return;
        setSaving(true);
        try {
            const metric = await addBodyMetric({
                weight: w,
                ...(bf !== undefined ? { bodyFatPct: bf } : {}),
                ...(mm !== undefined ? { skeletalMuscleMass: mm } : {}),
            });
            setRecords((prev) => [...prev, metric].slice(-7));
            setWeight("");
            setBodyFat("");
            setMuscleMass("");
        } finally {
            setSaving(false);
        }
    }

    return (
        <main className={styles.main}>
            <header className={styles.header}>
                <h1 className={styles.title}>신체 지표</h1>
            </header>

            <section className={styles.formSection}>
                <h2 className={styles.sectionTitle}>오늘 기록 — {getLocalDateString()}</h2>
                <div className={styles.inputRow}>
                    <label className={styles.label} htmlFor="weight">
                        체중 (kg)
                        <input
                            id="weight"
                            className={styles.input}
                            type="number"
                            placeholder="예: 70"
                            min="20"
                            max="300"
                            step="0.1"
                            value={weight}
                            onChange={(e) => setWeight(e.target.value)}
                        />
                    </label>
                    <label className={styles.label} htmlFor="body-fat">
                        체지방률 (%)
                        <input
                            id="body-fat"
                            className={styles.input}
                            type="number"
                            placeholder="선택"
                            min="1"
                            max="70"
                            step="0.1"
                            value={bodyFat}
                            onChange={(e) => setBodyFat(e.target.value)}
                        />
                    </label>
                    <label className={styles.label} htmlFor="muscle-mass">
                        골격근량 (kg)
                        <input
                            id="muscle-mass"
                            className={styles.input}
                            type="number"
                            placeholder="선택"
                            min="1"
                            max="100"
                            step="0.1"
                            value={muscleMass}
                            onChange={(e) => setMuscleMass(e.target.value)}
                        />
                    </label>
                </div>
                <button type="button" className={styles.saveBtn} onClick={handleSave} disabled={!weight || saving}>
                    {saving ? "저장 중..." : "저장"}
                </button>
            </section>

            <section className={styles.recordsSection}>
                <h2 className={styles.sectionTitle}>최근 기록</h2>
                {!loadingRecords && records.length === 0 ? (
                    <p className={styles.empty}>기록이 없습니다</p>
                ) : (
                    <ul className={styles.recordList}>
                        {[...records].reverse().map((r) => (
                            <li key={r.id} className={styles.record}>
                                <span className={styles.recordDate}>{r.date}</span>
                                <span className={styles.recordWeight}>{r.weight} kg</span>
                                {r.bodyFatPct !== undefined && (
                                    <span className={styles.recordSub}>체지방 {r.bodyFatPct}%</span>
                                )}
                                {r.skeletalMuscleMass !== undefined && (
                                    <span className={styles.recordSub}>골격근 {r.skeletalMuscleMass} kg</span>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <BottomNav active="body" />
        </main>
    );
}
