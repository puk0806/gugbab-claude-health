import { useEffect } from "react";
import type { Conversation } from "@/lib/db/types";
import styles from "./ConversationListSheet.module.css";

interface ConversationListSheetProps {
    conversations: Conversation[];
    activeId: string | null;
    onSelect: (conversation: Conversation) => void;
    onDelete: (id: string) => void;
    onClose: () => void;
}

export default function ConversationListSheet({
    conversations,
    activeId,
    onSelect,
    onDelete,
    onClose,
}: ConversationListSheetProps) {
    useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [onClose]);

    return (
        // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click-to-close (ESC 별도 처리)
        <div
            className={styles.backdrop}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
            role="dialog"
            aria-modal="true"
            aria-label="대화 목록"
        >
            <div className={styles.sheet}>
                <div className={styles.sheetTitle}>대화 목록</div>
                {conversations.length === 0 ? (
                    <p className={styles.empty}>대화가 없습니다</p>
                ) : (
                    <ul className={styles.list}>
                        {conversations.map((c) => (
                            <li
                                key={c.id}
                                className={c.id === activeId ? styles.rowActive : styles.row}
                            >
                                <button
                                    type="button"
                                    className={styles.rowMain}
                                    onClick={() => onSelect(c)}
                                >
                                    <span className={styles.rowTitle}>{c.title}</span>
                                    <span className={styles.rowDate}>{c.updatedAt.slice(0, 10)}</span>
                                </button>
                                <button
                                    type="button"
                                    className={styles.deleteBtn}
                                    onClick={() => onDelete(c.id)}
                                    aria-label={`${c.title} 삭제`}
                                >
                                    🗑
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
