import { Suspense } from "react";
import WorkoutLogger from "./WorkoutLogger";

// useSearchParams는 Suspense 경계가 필요 — 페이지는 정적으로 남겨 오프라인(PWA)에서도 열리게 한다
export default function WorkoutSessionPage() {
    return (
        <Suspense>
            <WorkoutLogger />
        </Suspense>
    );
}
