import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [react()],
    css: {
        modules: {
            generateScopedName: (name: string) => name,
        },
    },
    test: {
        environment: "happy-dom",
        globals: true,
        setupFiles: ["./vitest.setup.ts"],
        exclude: ["**/node_modules/**", "**/e2e/**"],
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "."),
        },
    },
});
