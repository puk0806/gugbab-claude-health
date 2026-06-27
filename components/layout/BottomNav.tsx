"use client";

import Link from "next/link";
import styles from "./BottomNav.module.css";

type Tab = "chat" | "ingredients" | "body" | "settings";

interface BottomNavProps {
    active: Tab;
}

const TABS = [
    { id: "chat" as const, href: "/", icon: "🍽️", label: "식단" },
    { id: "ingredients" as const, href: "/ingredients", icon: "🥦", label: "식재료" },
    { id: "body" as const, href: "/body", icon: "📊", label: "지표" },
    { id: "settings" as const, href: "/settings", icon: "⚙️", label: "설정" },
] satisfies { id: Tab; href: string; icon: string; label: string }[];

export default function BottomNav({ active }: BottomNavProps) {
    return (
        <nav className={styles.nav}>
            {TABS.map((tab) => (
                <Link
                    key={tab.id}
                    href={tab.href}
                    className={`${styles.item} ${active === tab.id ? styles.active : ""}`}
                >
                    <span className={styles.icon}>{tab.icon}</span>
                    <span>{tab.label}</span>
                </Link>
            ))}
        </nav>
    );
}
