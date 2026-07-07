// 클라이언트 전용 — SSR에서 호출하지 않는다. (gugbab-dream lib/speech.ts 인식 부분 포팅)

interface SpeechRecognitionResult {
    readonly isFinal: boolean;
    readonly [index: number]: { readonly transcript: string };
}

interface SpeechRecognitionResultList {
    readonly length: number;
    readonly [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
    readonly results: SpeechRecognitionResultList;
    /** 표준 속성이지만 일부 WebKit 구현이 누락 — 방어적으로 optional 취급 */
    readonly resultIndex?: number;
}

interface SpeechRecognitionErrorEvent extends Event {
    readonly error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onend: (() => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    start(): void;
    stop(): void;
    abort(): void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

export function isRecognitionSupported(): boolean {
    if (typeof window === "undefined") return false;
    return "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
}

export interface SpeechRecognizer {
    start(): void;
    stop(): void;
    abort(): void;
}

export type MicError = "not-allowed" | "no-speech" | "network" | "unknown";

export function createRecognizer(
    onResult: (text: string, isFinal: boolean) => void,
    onEnd: () => void,
    onError?: (type: MicError) => void,
): SpeechRecognizer {
    const w = window as unknown as Record<string, unknown>;
    const Ctor = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as SpeechRecognitionCtor | undefined;

    if (!Ctor) throw new Error("SpeechRecognition 미지원");

    const rec = new Ctor();
    rec.lang = "ko-KR";
    rec.continuous = false;
    rec.interimResults = true;

    // resultIndex 없는 비표준 구현용 진행 커서 — 이미 확정(final) 처리한 앞부분을 다시 재생하지 않기 위한 위치
    let nextUnprocessedIndex = 0;
    rec.onresult = (event) => {
        // 한 이벤트에 여러 결과가 배치될 수 있다(final + 새 interim) — resultIndex부터 전부 전달해 final 유실 방지.
        // resultIndex가 없으면 커서부터 순회: 누적 리스트의 이전 final 중복 재생과 배치 유실을 동시에 방지.
        // (리스트가 이벤트마다 초기화되는 구현도 있어 커서는 마지막 인덱스로 클램프)
        const start = event.resultIndex ?? Math.min(nextUnprocessedIndex, event.results.length - 1);
        for (let i = start; i < event.results.length; i++) {
            const result = event.results[i];
            onResult(result[0].transcript, result.isFinal);
        }
        let finals = 0;
        while (finals < event.results.length && event.results[finals].isFinal) finals++;
        nextUnprocessedIndex = finals;
    };
    rec.onend = onEnd;
    rec.onerror = (event) => {
        const errType = event.error;
        let type: MicError = "unknown";
        if (errType === "not-allowed" || errType === "permission-denied") type = "not-allowed";
        else if (errType === "no-speech") type = "no-speech";
        else if (errType === "network") type = "network";
        onError?.(type);
    };

    return {
        start: () => rec.start(),
        stop: () => rec.stop(),
        abort: () => rec.abort(),
    };
}
