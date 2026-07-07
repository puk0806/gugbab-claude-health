"use client";

import { useCallback, useState } from "react";
import { IosInstallGuide } from "./IosInstallGuide";
import styles from "./InstallButton.module.css";
import { useInstallPrompt, type UseInstallPromptResult } from "./useInstallPrompt";

interface InstallButtonProps {
    /** 부모(InstallSection)가 훅 상태를 공유할 때 주입 — 섹션·버튼의 설치 상태 불일치 방지 */
    install?: UseInstallPromptResult;
}

export function InstallButton({ install }: InstallButtonProps = {}) {
    const ownInstall = useInstallPrompt();
    const { mode, canInstall, promptInstall } = install ?? ownInstall;
    const [showGuide, setShowGuide] = useState(false);

    const handleClick = useCallback(async () => {
        if (mode === "native") {
            await promptInstall();
        } else if (mode === "ios-guide") {
            setShowGuide(true);
        }
    }, [mode, promptInstall]);

    const handleClose = useCallback(() => setShowGuide(false), []);

    if (!canInstall) return null;

    return (
        <>
            <button type="button" className={styles.button} onClick={handleClick} aria-label="앱 설치">
                홈 화면에 추가
            </button>
            {showGuide && <IosInstallGuide onClose={handleClose} />}
        </>
    );
}
