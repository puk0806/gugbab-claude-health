import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RootLayout from "./layout";

describe("RootLayout", () => {
    it("renders children", () => {
        render(<RootLayout>test content</RootLayout>);
        expect(screen.getByText("test content")).toBeInTheDocument();
    });

    it("sets document lang to ko", () => {
        // React 18/19 renders <html> by updating document.documentElement directly
        render(<RootLayout>child</RootLayout>);
        expect(document.documentElement).toHaveAttribute("lang", "ko");
    });
});
