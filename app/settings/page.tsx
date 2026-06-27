import BottomNav from "@/components/layout/BottomNav";
import styles from "../page.module.css";

export default function SettingsPage() {
    return (
        <main className={styles.main}>
            <div className={styles.placeholder}>
                <span>⚙️</span>
                <p>설정 — Phase 2에서 구현</p>
            </div>
            <BottomNav active="settings" />
        </main>
    );
}
