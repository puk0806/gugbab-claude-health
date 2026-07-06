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
    readonly resultIndex: number;
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

    rec.onresult = (event) => {
        // 한 이벤트에 여러 결과가 배치될 수 있다(final + 새 interim) — resultIndex부터 전부 전달해 final 유실 방지
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            onResult(result[0].transcript, result.isFinal);
        }
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
