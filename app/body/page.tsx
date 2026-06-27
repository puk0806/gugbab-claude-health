import BottomNav from "@/components/layout/BottomNav";
import styles from "../page.module.css";

export default function BodyPage() {
    return (
        <main className={styles.main}>
            <div className={styles.placeholder}>
                <span>📊</span>
                <p>신체 지표 — Phase 2에서 구현</p>
            </div>
            <BottomNav active="body" />
        </main>
    );
}
