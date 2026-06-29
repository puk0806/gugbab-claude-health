"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import BottomNav from "@/components/layout/BottomNav";
import { getUserProfile } from "@/lib/db/userProfile";
import styles from "./page.module.css";

export default function ChatPage() {
    const router = useRouter();
    const [ready, setReady] = useState(false);

    useEffect(() => {
        getUserProfile()
            .then((profile) => {
                if (!profile) {
                    router.replace("/onboarding");
                } else {
                    setReady(true);
                }
            })
            .catch(() => {
                router.replace("/onboarding");
            });
    }, [router]);

    if (!ready) return null;

    return (
        <main className={styles.main}>
            <div className={styles.placeholder}>
                <span>🍽️</span>
                <p>식단 채팅 — Phase 3에서 구현</p>
            </div>
            <BottomNav active="chat" />
        </main>
    );
}
