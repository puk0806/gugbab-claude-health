"use client";

import { InstallButton } from "./InstallButton";
import styles from "./InstallSection.module.css";
import { useInstallPrompt } from "./useInstallPrompt";

interface InstallSectionProps {
    title: string;
    description: string;
}

/** 앱 설치 안내 섹션 — 설치 불가(이미 설치됨·미지원 브라우저)면 통째로 숨겨 죽은 CTA를 방지 */
export function InstallSection({ title, description }: InstallSectionProps) {
    // 훅 상태를 섹션이 단독 소유하고 버튼에 주입 — 프롬프트 소진 시 섹션·버튼이 함께 사라진다
    const install = useInstallPrompt();
    if (!install.canInstall) return null;

    return (
        <section className={styles.section}>
            <h2 className={styles.title}>{title}</h2>
            <p className={styles.desc}>{description}</p>
            <InstallButton install={install} />
        </section>
    );
}
