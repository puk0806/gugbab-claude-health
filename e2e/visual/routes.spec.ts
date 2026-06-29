/**
 * 라우트 시각 회귀 spec — Phase 2 핵심 UI.
 *
 * 라우트: /onboarding, /ingredients, /body, /settings, /
 *
 * 시드 전략: page.evaluate로 IndexedDB를 await 시드 후 이동.
 * addInitScript + 비동기 IDB는 useEffect와 경쟁 조건이 발생해 불안정.
 */
import { expect, type Page, test } from "@playwright/test";
import { SEED_BODY_METRICS, SEED_INGREDIENTS, SEED_PROFILE, type SeedData } from "./_fixtures/init-script";

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
    test("settings", async ({ page }) => {
        await seedAndGoto(page, "/settings", { userProfile: SEED_PROFILE });
        await expect(page.getByRole("heading", { name: "성별" })).toBeVisible();
        await expect(page).toHaveScreenshot("settings.png", { fullPage: true });
    });

    // chat (홈): 프로필 있음 → placeholder 표시
    test("chat", async ({ page }) => {
        await seedAndGoto(page, "/", { userProfile: SEED_PROFILE });
        await expect(page.getByText("식단 채팅 — Phase 3에서 구현")).toBeVisible();
        await expect(page).toHaveScreenshot("chat.png", { fullPage: true });
    });
});
