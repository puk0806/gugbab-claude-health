import type { Metadata, Viewport } from "next";
import "@gugbab/tokens/radix.css";
import "@gugbab/styled-radix/styles.css";
import "./globals.css";

export const metadata: Metadata = {
    title: "gugbab-health",
    description: "식재료 + 신체 지표 기반 AI 개인화 식단 PWA",
    manifest: "/manifest.json",
    appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: "건강식단",
    },
    icons: {
        icon: [
            { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
            { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
        apple: "/apple-touch-icon.png",
    },
};

export const viewport: Viewport = {
    themeColor: "#22c55e",
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="ko">
            <body>{children}</body>
        </html>
    );
}
