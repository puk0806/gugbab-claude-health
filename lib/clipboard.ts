/**
 * 텍스트를 클립보드에 복사한다.
 * 최신 브라우저는 navigator.clipboard, 미지원·비보안 컨텍스트는 execCommand로 폴백.
 * @returns 복사 성공 여부
 */
export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch {
        // 권한 거부·비보안 컨텍스트 등 — 아래 폴백으로 재시도
    }

    try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        // 화면 밖·읽기 방지 위치로 배치 (스크롤 점프 방지)
        textarea.style.position = "fixed";
        textarea.style.top = "-9999px";
        textarea.style.opacity = "0";
        textarea.setAttribute("readonly", "");
        document.body.appendChild(textarea);
        textarea.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(textarea);
        return ok;
    } catch {
        return false;
    }
}
