import type { MealPlanMode } from "@/lib/ai/types";
import styles from "./MealPlanModeBanner.module.css";

interface MealPlanModeBannerProps {
    onSelect: (mode: MealPlanMode) => void;
}

export default function MealPlanModeBanner({ onSelect }: MealPlanModeBannerProps) {
    return (
        <div className={styles.banner}>
            <p className={styles.bannerText}>등록된 식재료가 부족해요. 어떻게 추천해드릴까요?</p>
            <div className={styles.chips}>
                <button type="button" className={styles.chip} onClick={() => onSelect("pantry-only")}>
                    보유 재료로만
                </button>
                <button type="button" className={styles.chip} onClick={() => onSelect("free")}>
                    자유롭게 추천
                </button>
            </div>
        </div>
    );
}
