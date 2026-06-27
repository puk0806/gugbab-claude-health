import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
    testDir: "./e2e/visual",
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: 1,
    reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],

    use: {
        baseURL: BASE_URL,
        actionTimeout: 10_000,
        navigationTimeout: 30_000,
        trace: "retain-on-failure",
    },

    expect: {
        toHaveScreenshot: {
            maxDiffPixelRatio: 0.01,
            threshold: 0.2,
            animations: "disabled",
        },
    },

    snapshotPathTemplate: "{testDir}/__screenshots__/{testFileName}/{arg}{ext}",

    projects: [
        {
            name: "chromium-desktop",
            use: {
                ...devices["Desktop Chrome"],
                viewport: { width: 390, height: 844 },
            },
        },
    ],

    webServer: {
        command: "pnpm dev",
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        stdout: "ignore",
        stderr: "pipe",
    },
});
