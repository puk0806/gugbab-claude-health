import { useCallback, useRef } from "react";

export interface LongPressPoint {
    x: number;
    y: number;
}

export interface LongPressHandlers {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
    onContextMenu: (e: React.MouseEvent) => void;
}

/**
 * 롱프레스(꾹 누르기) 감지 훅.
 *
 * 반환된 `bind(onLongPress)`를 각 요소에 전개(spread)해 붙인다.
 * 하나의 타이머를 공유하므로 `.map()` 안에서 요소마다 호출해도 안전하다
 * (한 번에 하나의 포인터 상호작용만 발생).
 *
 * @param delayMs 발동까지 눌러야 하는 시간(ms)
 * @param moveTolerance 이 픽셀 이상 움직이면 스크롤로 간주해 취소
 */
export function useLongPress(delayMs = 500, moveTolerance = 10) {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const startRef = useRef<LongPressPoint | null>(null);
    const firedRef = useRef(false);

    const clear = useCallback(() => {
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        startRef.current = null;
    }, []);

    const bind = useCallback(
        (onLongPress: (point: LongPressPoint) => void): LongPressHandlers => ({
            onPointerDown: (e) => {
                firedRef.current = false;
                const point = { x: e.clientX, y: e.clientY };
                startRef.current = point;
                timerRef.current = setTimeout(() => {
                    firedRef.current = true;
                    clear();
                    onLongPress(point);
                }, delayMs);
            },
            onPointerMove: (e) => {
                const start = startRef.current;
                if (!start) return;
                const dx = Math.abs(e.clientX - start.x);
                const dy = Math.abs(e.clientY - start.y);
                if (dx > moveTolerance || dy > moveTolerance) clear();
            },
            onPointerUp: clear,
            onPointerCancel: clear,
            onContextMenu: (e) => {
                // 데스크톱 우클릭·모바일 롱프레스가 띄우는 기본 메뉴 억제
                e.preventDefault();
                if (firedRef.current) return;
                firedRef.current = true;
                clear();
                onLongPress({ x: e.clientX, y: e.clientY });
            },
        }),
        [clear, delayMs, moveTolerance],
    );

    return bind;
}
