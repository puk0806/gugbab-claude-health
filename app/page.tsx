import BottomNav from "@/components/layout/BottomNav";
import styles from "./page.module.css";

export default function ChatPage() {
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
