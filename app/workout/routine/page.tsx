import { Suspense } from "react";
import RoutineEditor from "./RoutineEditor";

// useSearchParams는 Suspense 경계가 필요 — 페이지는 정적으로 남겨 오프라인(PWA)에서도 열리게 한다
export default function RoutinePage() {
    return (
        <Suspense>
            <RoutineEditor />
        </Suspense>
    );
}
