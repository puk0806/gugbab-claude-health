import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRecognizer, isRecognitionSupported } from "./speech";

const startMock = vi.fn();
const stopMock = vi.fn();
const abortMock = vi.fn();

interface RecognitionEventHandlers {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    onresult: ((event: { results: unknown; resultIndex: number }) => void) | null;
    onend: (() => void) | null;
    onerror: ((event: { error: string }) => void) | null;
}

let lastInstance: RecognitionEventHandlers | null = null;

class MockRecognition {
    lang = "";
    continuous = true;
    interimResults = false;
    onresult: ((event: { results: unknown; resultIndex: number }) => void) | null = null;
    onend: (() => void) | null = null;
    onerror: ((event: { error: string }) => void) | null = null;
    start = startMock;
    stop = stopMock;
    abort = abortMock;
    constructor() {
        lastInstance = this as unknown as RecognitionEventHandlers;
    }
}

// Web Speech API onresult 이벤트 모사 — results는 세션 누적 목록, resultIndex는 이번에 변경된 첫 인덱스
function makeEvent(entries: Array<[transcript: string, isFinal: boolean]>, resultIndex = 0) {
    const results: Record<number | string, unknown> = { length: entries.length };
    entries.forEach(([transcript, isFinal], i) => {
        results[i] = { isFinal, 0: { transcript } };
    });
    return { results, resultIndex };
}

describe("speech", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        lastInstance = null;
        Reflect.set(window, "SpeechRecognition", MockRecognition);
    });

    afterEach(() => {
        Reflect.deleteProperty(window, "SpeechRecognition");
    });

    it("SpeechRecognition 있으면 지원으로 판정", () => {
        expect(isRecognitionSupported()).toBe(true);
    });

    it("SpeechRecognition 없으면 미지원으로 판정", () => {
        Reflect.deleteProperty(window, "SpeechRecognition");
        expect(isRecognitionSupported()).toBe(false);
    });

    it("한국어·interim 설정으로 인스턴스를 만든다", () => {
        createRecognizer(vi.fn(), vi.fn());
        expect(lastInstance?.lang).toBe("ko-KR");
        expect(lastInstance?.continuous).toBe(false);
        expect(lastInstance?.interimResults).toBe(true);
    });

    it("최종/중간 결과를 isFinal 플래그와 함께 전달한다", () => {
        const onResult = vi.fn();
        createRecognizer(onResult, vi.fn());

        lastInstance?.onresult?.(makeEvent([["닭가슴살 먹었어", true]]));
        expect(onResult).toHaveBeenCalledWith("닭가슴살 먹었어", true);

        lastInstance?.onresult?.(makeEvent([["닭가", false]]));
        expect(onResult).toHaveBeenCalledWith("닭가", false);
    });

    it("한 이벤트에 배치된 여러 결과(final+interim)를 모두 전달한다", () => {
        const onResult = vi.fn();
        createRecognizer(onResult, vi.fn());

        lastInstance?.onresult?.(makeEvent([["닭가슴살 먹었어", true], ["그리고", false]]));
        expect(onResult).toHaveBeenNthCalledWith(1, "닭가슴살 먹었어", true);
        expect(onResult).toHaveBeenNthCalledWith(2, "그리고", false);
    });

    it("resultIndex 이전의 (이미 전달된) 결과는 다시 전달하지 않는다", () => {
        const onResult = vi.fn();
        createRecognizer(onResult, vi.fn());

        lastInstance?.onresult?.(makeEvent([["이미 처리됨", true], ["새 결과", false]], 1));
        expect(onResult).toHaveBeenCalledTimes(1);
        expect(onResult).toHaveBeenCalledWith("새 결과", false);
    });

    it("에러 유형을 MicError로 매핑한다", () => {
        const onError = vi.fn();
        createRecognizer(vi.fn(), vi.fn(), onError);

        lastInstance?.onerror?.({ error: "not-allowed" });
        expect(onError).toHaveBeenLastCalledWith("not-allowed");
        lastInstance?.onerror?.({ error: "no-speech" });
        expect(onError).toHaveBeenLastCalledWith("no-speech");
        lastInstance?.onerror?.({ error: "network" });
        expect(onError).toHaveBeenLastCalledWith("network");
        lastInstance?.onerror?.({ error: "audio-capture" });
        expect(onError).toHaveBeenLastCalledWith("unknown");
    });

    it("start/stop/abort를 위임한다", () => {
        const rec = createRecognizer(vi.fn(), vi.fn());
        rec.start();
        rec.stop();
        rec.abort();
        expect(startMock).toHaveBeenCalledTimes(1);
        expect(stopMock).toHaveBeenCalledTimes(1);
        expect(abortMock).toHaveBeenCalledTimes(1);
    });

    it("미지원 환경에서 createRecognizer는 예외를 던진다", () => {
        Reflect.deleteProperty(window, "SpeechRecognition");
        expect(() => createRecognizer(vi.fn(), vi.fn())).toThrow();
    });
});
