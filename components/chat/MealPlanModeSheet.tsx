import { useEffect, useRef } from "react";
import type { MealPlanMode } from "@/lib/ai/types";
import styles from "./MealPlanModeSheet.module.css";

interface MealPlanModeSheetProps {
    onSelect: (mode: MealPlanMode) => void;
    /** 식단이 아닌 질문(운동 등)으로 넘어가기 — 이 방에서 방식 선택을 미룬다 */
    onSkip?: () => void;
}

/**
 * 식재료 부족 시 추천 방식 선택 시트 — 선택(또는 건너뛰기) 전에는 닫을 수 없다 (ESC·백드롭 닫기 없음).
 * 운동만 물어보려는 사용자가 식단 방식을 강제로 고르지 않도록 건너뛰기를 둔다.
 */
export default function MealPlanModeSheet({ onSelect, onSkip }: MealPlanModeSheetProps) {
    const sheetRef = useRef<HTMLDivElement>(null);

    function buttons(): HTMLButtonElement[] {
        return Array.from(sheetRef.current?.querySelectorAll("button") ?? []);
    }

    // 강제 선택 다이얼로그 — 뒤 화면 조작을 막기 위해 포커스를 시트 안으로 가둔다
    useEffect(() => {
        sheetRef.current?.querySelector("button")?.focus();
    }, []);

    function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
        if (e.key !== "Tab") return;
        e.preventDefault();
        const list = buttons();
        if (list.length === 0) return;
        const idx = list.indexOf(document.activeElement as HTMLButtonElement);
        const next = e.shiftKey ? (idx <= 0 ? list.length - 1 : idx - 1) : idx === list.length - 1 ? 0 : idx + 1;
        list[next]?.focus();
    }

    return (
        <div
            className={styles.sheetBackdrop}
            role="dialog"
            aria-modal="true"
            aria-label="추천 방식 선택"
            onKeyDown={handleKeyDown}
        >
            <div className={styles.sheet} ref={sheetRef}>
                <p className={styles.sheetTitle}>추천 방식을 선택해주세요</p>
                <p className={styles.sheetText}>등록된 식재료가 부족해요. 어떻게 추천해드릴까요?</p>
                <div className={styles.chips}>
                    <button type="button" className={styles.chip} onClick={() => onSelect("pantry-only")}>
                        보유 재료로만
                    </button>
                    <button type="button" className={styles.chip} onClick={() => onSelect("free")}>
                        자유롭게 추천
                    </button>
                </div>
                {onSkip && (
                    <button type="button" className={styles.skipBtn} onClick={onSkip}>
                        식단 말고 운동만 물어볼게요
                    </button>
                )}
            </div>
        </div>
    );
}
