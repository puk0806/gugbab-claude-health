/**
 * 라우트 시각 회귀 spec — Phase 2 핵심 UI.
 *
 * 라우트: /onboarding, /ingredients, /body, /settings, /, /workout, /workout/session
 *
 * 시드 전략: page.evaluate로 IndexedDB를 await 시드 후 이동.
 * addInitScript + 비동기 IDB는 useEffect와 경쟁 조건이 발생해 불안정.
 */
import { expect, type Page, test } from "@playwright/test";
import {
    SEED_BODY_METRICS,
    SEED_INGREDIENTS,
    SEED_MEAL_HISTORY,
    SEED_PROFILE,
    SEED_WORKOUT,
    type SeedData,
    type WorkoutSeed,
} from "./_fixtures/init-script";

/**
 * /onboarding으로 먼저 이동해 same-origin context를 확보한 뒤,
 * page.evaluate로 gugbab-health IndexedDB를 완전히 시드하고(Promise 완료 보장),
 * 그런 다음 목표 URL로 이동한다.
 */
async function seedAndGoto(page: Page, url: string, data: SeedData): Promise<void> {
    await page.goto("/onboarding");
    await page.evaluate(
        (d) => {
            return new Promise<void>((resolve, reject) => {
                const DB_NAME = "gugbab-health";
                const delReq = indexedDB.deleteDatabase(DB_NAME);
                delReq.onsuccess = () => {
                    const openReq = indexedDB.open(DB_NAME, 1);
                    openReq.onupgradeneeded = () => {
                        const db = openReq.result;
                        if (!db.objectStoreNames.contains("userProfile"))
                            db.createObjectStore("userProfile", { keyPath: "id" });
                        if (!db.objectStoreNames.contains("ingredients")) {
                            const s = db.createObjectStore("ingredients", { keyPath: "id" });
                            s.createIndex("byCategory", "category");
                            s.createIndex("byAddedAt", "addedAt");
                        }
                        if (!db.objectStoreNames.contains("bodyMetrics")) {
                            const s = db.createObjectStore("bodyMetrics", { keyPath: "id" });
                            s.createIndex("byDate", "date");
                        }
                        if (!db.objectStoreNames.contains("mealHistory")) {
                            const s = db.createObjectStore("mealHistory", { keyPath: "id" });
                            s.createIndex("byDate", "date");
                        }
                    };
                    openReq.onsuccess = () => {
                        const db = openReq.result;
                        const storeNames: string[] = [];
                        if (d.userProfile) storeNames.push("userProfile");
                        if (d.ingredients?.length) storeNames.push("ingredients");
                        if (d.bodyMetrics?.length) storeNames.push("bodyMetrics");
                        if (d.mealHistory?.length) storeNames.push("mealHistory");
                        if (storeNames.length === 0) {
                            db.close();
                            resolve();
                            return;
                        }
                        const tx = db.transaction(storeNames, "readwrite");
                        if (d.userProfile) tx.objectStore("userProfile").put(d.userProfile);
                        if (d.ingredients?.length) {
                            const s = tx.objectStore("ingredients");
                            for (const item of d.ingredients) s.put(item);
                        }
                        if (d.bodyMetrics?.length) {
                            const s = tx.objectStore("bodyMetrics");
                            for (const item of d.bodyMetrics) s.put(item);
                        }
                        if (d.mealHistory?.length) {
                            const s = tx.objectStore("mealHistory");
                            for (const item of d.mealHistory) s.put(item);
                        }
                        tx.oncomplete = () => {
                            db.close();
                            resolve();
                        };
                        tx.onerror = () => reject(tx.error);
                    };
                    openReq.onerror = () => reject(openReq.error);
                };
                delReq.onerror = () => reject(delReq.error);
            });
        },
        data as Parameters<typeof page.evaluate>[1],
    );
    await page.goto(url);
}

/**
 * 운동 스토어는 앱이 DB를 v4로 올릴 때 생긴다 — 먼저 /workout을 열어 업그레이드시킨 뒤
 * 버전 지정 없이 열어 시드하고 목표 URL로 이동한다.
 */
async function seedWorkoutAndGoto(page: Page, url: string, data: WorkoutSeed): Promise<void> {
    await seedAndGoto(page, "/workout", { userProfile: SEED_PROFILE });
    await expect(page.getByText(/아직 루틴이 없어요/)).toBeVisible();
    await page.evaluate(
        (d) =>
            new Promise<void>((resolve, reject) => {
                const openReq = indexedDB.open("gugbab-health");
                openReq.onsuccess = () => {
                    const db = openReq.result;
                    const tx = db.transaction(["routines", "workoutSessions"], "readwrite");
                    for (const r of d.routines) tx.objectStore("routines").put(r);
                    for (const s of d.workoutSessions) tx.objectStore("workoutSessions").put(s);
                    tx.oncomplete = () => {
                        db.close();
                        resolve();
                    };
                    tx.onerror = () => reject(tx.error);
                };
                openReq.onerror = () => reject(openReq.error);
            }),
        data,
    );
    await page.goto(url);
}

test.describe("routes — visual regression", () => {
    // onboarding: DB 읽기 없음 — 바로 이동
    test("onboarding", async ({ page }) => {
        await page.goto("/onboarding");
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page).toHaveScreenshot("onboarding.png", { fullPage: true });
    });

    // ingredients: 프로필 있음, 식재료 없음
    test("ingredients-empty", async ({ page }) => {
        await seedAndGoto(page, "/ingredients", { userProfile: SEED_PROFILE });
        await expect(page.getByText("등록된 식재료가 없습니다")).toBeVisible();
        await expect(page).toHaveScreenshot("ingredients-empty.png", { fullPage: true });
    });

    // ingredients: 프로필 + 식재료 3개
    test("ingredients-with-items", async ({ page }) => {
        await seedAndGoto(page, "/ingredients", {
            userProfile: SEED_PROFILE,
            ingredients: SEED_INGREDIENTS,
        });
        await expect(page.getByText("닭가슴살")).toBeVisible();
        await expect(page).toHaveScreenshot("ingredients-with-items.png", { fullPage: true });
    });

    // body: 프로필 있음, 기록 없음
    test("body-empty", async ({ page }) => {
        await seedAndGoto(page, "/body", { userProfile: SEED_PROFILE });
        await expect(page.getByText("기록이 없습니다")).toBeVisible();
        await expect(page).toHaveScreenshot("body-empty.png", { fullPage: true });
    });

    // body: 프로필 + 신체 기록 3개
    test("body-with-records", async ({ page }) => {
        await seedAndGoto(page, "/body", {
            userProfile: SEED_PROFILE,
            bodyMetrics: SEED_BODY_METRICS,
        });
        await expect(page.getByText("75 kg")).toBeVisible();
        await expect(page).toHaveScreenshot("body-with-records.png", { fullPage: true });
    });

    // settings: 프로필 있음
    // "앱 설치" 섹션은 브라우저의 beforeinstallprompt 발생 시점에 따라 보였다 안 보였다 한다 —
    // 이벤트를 직접 발생시켜 섹션이 항상 그려진 상태로 고정한다
    test("settings", async ({ page }) => {
        await seedAndGoto(page, "/settings", { userProfile: SEED_PROFILE });
        await expect(page.getByRole("heading", { name: "성별" })).toBeVisible();
        await page.evaluate(() => {
            const e = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
                prompt: () => Promise.resolve(),
                userChoice: Promise.resolve({ outcome: "dismissed", platform: "" }),
            });
            window.dispatchEvent(e);
        });
        await expect(page.getByRole("button", { name: "앱 설치" })).toBeVisible();
        await expect(page).toHaveScreenshot("settings.png", { fullPage: true });
    });

    // chat (홈): 프로필 있음 → 빈 채팅 화면
    test("chat-empty", async ({ page }) => {
        await seedAndGoto(page, "/", { userProfile: SEED_PROFILE });
        await expect(page.getByText("안녕하세요! 오늘 어떤 식단이나 운동이 궁금하세요?")).toBeVisible();
        await expect(page).toHaveScreenshot("chat-empty.png", { fullPage: true });
    });

    // chat (홈): 오늘 대화 이력 있음 → 메시지 복원
    test("chat-with-messages", async ({ page }) => {
        await seedAndGoto(page, "/", {
            userProfile: SEED_PROFILE,
            ingredients: SEED_INGREDIENTS,
            bodyMetrics: SEED_BODY_METRICS,
            mealHistory: SEED_MEAL_HISTORY,
        });
        await expect(page.getByText("닭가슴살이랑 계란 있는데 저녁 식단 추천해줘")).toBeVisible();
        await expect(page).toHaveScreenshot("chat-with-messages.png", { fullPage: true });
    });

    // workout: 프로필만 — 빈 루틴·빈 기록
    test("workout-empty", async ({ page }) => {
        await seedAndGoto(page, "/workout", { userProfile: SEED_PROFILE });
        await expect(page.getByText("운동 기록이 없습니다")).toBeVisible();
        await expect(page).toHaveScreenshot("workout-empty.png", { fullPage: true });
    });

    // workout: 루틴 1개 + 지난 기록 → 다음 무게 배지
    test("workout-with-routine", async ({ page }) => {
        await seedWorkoutAndGoto(page, "/workout", SEED_WORKOUT);
        await expect(page.getByText("다음 62.5kg ↑")).toBeVisible();
        await expect(page).toHaveScreenshot("workout-with-routine.png", { fullPage: true });
    });

    // workout session: 권장 무게가 미리 채워진 세트 기록 화면
    test("workout-session", async ({ page }) => {
        await seedWorkoutAndGoto(page, "/workout/session?routine=routine-upper-a", SEED_WORKOUT);
        await expect(page.getByLabel("바벨 벤치프레스 1세트 무게")).toHaveValue("62.5");
        await expect(page).toHaveScreenshot("workout-session.png", { fullPage: true });
    });
});
