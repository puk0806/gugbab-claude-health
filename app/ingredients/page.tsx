import BottomNav from "@/components/layout/BottomNav";
import styles from "../page.module.css";

export default function IngredientsPage() {
    return (
        <main className={styles.main}>
            <div className={styles.placeholder}>
                <span>🥦</span>
                <p>식재료 관리 — Phase 2에서 구현</p>
            </div>
            <BottomNav active="ingredients" />
        </main>
    );
}
