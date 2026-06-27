import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import OnboardingPage from "./page";

describe("OnboardingPage", () => {
    it("renders placeholder text", () => {
        render(<OnboardingPage />);
        expect(screen.getByText("온보딩 — Phase 2에서 구현")).toBeInTheDocument();
    });

    it("renders onboarding icon", () => {
        render(<OnboardingPage />);
        expect(screen.getByText("🥗")).toBeInTheDocument();
    });

    it("does not render BottomNav", () => {
        render(<OnboardingPage />);
        expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    });
});
