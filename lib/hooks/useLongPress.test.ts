import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLongPress } from "./useLongPress";

function pointerEvent(x: number, y: number) {
    return { clientX: x, clientY: y } as React.PointerEvent;
}

describe("useLongPress", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it("지연 시간만큼 누르고 있으면 onLongPress를 좌표와 함께 호출한다", () => {
        const { result } = renderHook(() => useLongPress(500));
        const onLongPress = vi.fn();
        const handlers = result.current(onLongPress);

        act(() => {
            handlers.onPointerDown(pointerEvent(30, 40));
        });
        expect(onLongPress).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(500);
        });
        expect(onLongPress).toHaveBeenCalledWith({ x: 30, y: 40 });
    });

    it("지연 전에 손을 떼면 호출하지 않는다", () => {
        const { result } = renderHook(() => useLongPress(500));
        const onLongPress = vi.fn();
        const handlers = result.current(onLongPress);

        act(() => {
            handlers.onPointerDown(pointerEvent(0, 0));
            vi.advanceTimersByTime(300);
            handlers.onPointerUp();
            vi.advanceTimersByTime(300);
        });

        expect(onLongPress).not.toHaveBeenCalled();
    });

    it("허용 범위를 넘게 움직이면(스크롤) 취소한다", () => {
        const { result } = renderHook(() => useLongPress(500, 10));
        const onLongPress = vi.fn();
        const handlers = result.current(onLongPress);

        act(() => {
            handlers.onPointerDown(pointerEvent(0, 0));
            handlers.onPointerMove(pointerEvent(0, 40));
            vi.advanceTimersByTime(500);
        });

        expect(onLongPress).not.toHaveBeenCalled();
    });

    it("우클릭(contextmenu)은 기본 메뉴를 막고 즉시 onLongPress를 호출한다", () => {
        const { result } = renderHook(() => useLongPress(500));
        const onLongPress = vi.fn();
        const handlers = result.current(onLongPress);
        const preventDefault = vi.fn();

        act(() => {
            handlers.onPointerDown(pointerEvent(12, 20));
            handlers.onContextMenu({ preventDefault, clientX: 12, clientY: 20 } as unknown as React.MouseEvent);
        });

        expect(preventDefault).toHaveBeenCalled();
        expect(onLongPress).toHaveBeenCalledWith({ x: 12, y: 20 });
    });

    it("롱프레스가 이미 발동했으면 contextmenu가 중복 호출하지 않는다", () => {
        const { result } = renderHook(() => useLongPress(500));
        const onLongPress = vi.fn();
        const handlers = result.current(onLongPress);

        act(() => {
            handlers.onPointerDown(pointerEvent(5, 5));
            vi.advanceTimersByTime(500);
            handlers.onContextMenu({ preventDefault: vi.fn(), clientX: 5, clientY: 5 } as unknown as React.MouseEvent);
        });

        expect(onLongPress).toHaveBeenCalledTimes(1);
    });
});
