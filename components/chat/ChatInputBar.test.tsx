import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MicError } from "@/lib/speech";
import ChatInputBar from "./ChatInputBar";

interface RecognizerInstance {
    onResult: (text: string, isFinal: boolean) => void;
    onEnd: () => void;
    onError?: (type: MicError) => void;
}

const { createRecognizerMock, instances, spies, supportedRef } = vi.hoisted(() => ({
    createRecognizerMock: vi.fn(),
    // 호출마다 별도 인스턴스를 기록 — 재시작 레이스 테스트를 위해 식별 가능해야 한다
    instances: [] as Array<{
        onResult: (text: string, isFinal: boolean) => void;
        onEnd: () => void;
        onError?: (type: import("@/lib/speech").MicError) => void;
    }>,
    spies: { start: vi.fn(), stop: vi.fn(), abort: vi.fn() },
    supportedRef: { value: true },
}));

function lastInstance(): RecognizerInstance {
    const inst = instances[instances.length - 1];
    if (!inst) throw new Error("recognizer가 생성되지 않았습니다");
    return inst;
}

vi.mock("@/lib/speech", () => ({
    isRecognitionSupported: () => supportedRef.value,
    createRecognizer: createRecognizerMock,
}));

function baseProps() {
    return {
        value: "",
        onChange: vi.fn(),
        onSend: vi.fn(),
        disabled: false,
    };
}

describe("ChatInputBar", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        supportedRef.value = true;
        instances.length = 0;
        createRecognizerMock.mockImplementation(
            (
                onResult: (text: string, isFinal: boolean) => void,
                onEnd: () => void,
                onError?: (type: MicError) => void,
            ) => {
                instances.push({ onResult, onEnd, onError });
                // 매 호출 새 객체 반환 — 컴포넌트의 활성 인스턴스 식별과 동일 조건
                return { start: spies.start, stop: spies.stop, abort: spies.abort };
            },
        );
    });

    it("입력·전송이 동작한다", () => {
        const props = baseProps();
        render(<ChatInputBar {...props} value="샐러드" />);

        fireEvent.change(screen.getByPlaceholderText("식단을 요청해보세요..."), {
            target: { value: "샐러드 추천" },
        });
        expect(props.onChange).toHaveBeenCalledWith("샐러드 추천");

        fireEvent.click(screen.getByRole("button", { name: "전송" }));
        expect(props.onSend).toHaveBeenCalledTimes(1);
    });

    it("Enter 키로 전송한다", () => {
        const props = baseProps();
        render(<ChatInputBar {...props} value="안녕" />);
        fireEvent.keyDown(screen.getByPlaceholderText("식단을 요청해보세요..."), { key: "Enter" });
        expect(props.onSend).toHaveBeenCalledTimes(1);
    });

    it("sendBlocked면 전송 버튼이 비활성화된다", () => {
        render(<ChatInputBar {...baseProps()} value="안녕" sendBlocked />);
        expect(screen.getByRole("button", { name: "전송" })).toBeDisabled();
    });

    it("음성 인식 미지원이면 마이크 버튼을 숨긴다", () => {
        supportedRef.value = false;
        render(<ChatInputBar {...baseProps()} />);
        expect(screen.queryByRole("button", { name: "음성 입력" })).not.toBeInTheDocument();
    });

    it("마이크 탭 → 인식 시작, 다시 탭 → 중지", () => {
        render(<ChatInputBar {...baseProps()} />);
        const mic = screen.getByRole("button", { name: "음성 입력" });

        fireEvent.click(mic);
        expect(spies.start).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByRole("button", { name: "음성 입력 중지" }));
        expect(spies.stop).toHaveBeenCalledTimes(1);
    });

    it("중간 결과는 힌트로 표시하고 최종 결과는 입력에 추가한다", () => {
        const props = baseProps();
        render(<ChatInputBar {...props} value="오늘" />);
        fireEvent.click(screen.getByRole("button", { name: "음성 입력" }));

        act(() => lastInstance().onResult("닭가슴", false));
        expect(screen.getByText("닭가슴")).toBeInTheDocument();
        expect(props.onChange).not.toHaveBeenCalled();

        act(() => lastInstance().onResult("닭가슴살 먹었어", true));
        expect(props.onChange).toHaveBeenCalledWith("오늘 닭가슴살 먹었어");
    });

    it("권한 거부 시 에러 안내를 표시한다", () => {
        render(<ChatInputBar {...baseProps()} />);
        fireEvent.click(screen.getByRole("button", { name: "음성 입력" }));

        act(() => lastInstance().onError?.("not-allowed"));
        expect(screen.getByText(/마이크 권한이 필요합니다/)).toBeInTheDocument();
    });

    it("재시작 후 이전 인스턴스의 지연 콜백은 무시한다", () => {
        render(<ChatInputBar {...baseProps()} />);

        fireEvent.click(screen.getByRole("button", { name: "음성 입력" }));
        const first = lastInstance();
        fireEvent.click(screen.getByRole("button", { name: "음성 입력 중지" }));
        fireEvent.click(screen.getByRole("button", { name: "음성 입력" }));

        // 중지된 첫 인스턴스의 늦은 onEnd — 새 세션의 듣기 상태를 건드리면 안 됨
        act(() => first.onEnd());
        expect(screen.getByRole("button", { name: "음성 입력 중지" })).toBeInTheDocument();
    });

    it("스트리밍 시작(disabled) 시 진행 중이던 인식을 중단하고 늦은 결과를 무시한다", () => {
        const props = baseProps();
        const { rerender } = render(<ChatInputBar {...props} />);
        fireEvent.click(screen.getByRole("button", { name: "음성 입력" }));
        const inst = lastInstance();

        rerender(<ChatInputBar {...props} disabled />);
        expect(spies.abort).toHaveBeenCalled();

        act(() => inst.onResult("늦게 도착한 결과", true));
        expect(props.onChange).not.toHaveBeenCalled();
    });

    it("disabled(스트리밍 중)면 입력과 마이크가 모두 비활성화된다", () => {
        render(<ChatInputBar {...baseProps()} disabled />);
        expect(screen.getByPlaceholderText("식단을 요청해보세요...")).toBeDisabled();
        expect(screen.getByRole("button", { name: "음성 입력" })).toBeDisabled();
    });
});
