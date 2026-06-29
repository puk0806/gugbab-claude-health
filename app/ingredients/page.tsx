"use client";

import { useEffect, useState } from "react";
import BottomNav from "@/components/layout/BottomNav";
import { addIngredient, deleteIngredient, getAllIngredients } from "@/lib/db/ingredients";
import type { Ingredient, IngredientCategory } from "@/lib/db/types";
import styles from "./page.module.css";

const CATEGORIES: { value: IngredientCategory; label: string }[] = [
    { value: "vegetable-fruit", label: "채소·과일" },
    { value: "protein", label: "단백질" },
    { value: "grain", label: "곡류" },
    { value: "dairy", label: "유제품" },
    { value: "seasoning", label: "양념·소스" },
    { value: "etc", label: "기타" },
];

function categoryLabel(category: IngredientCategory): string {
    return CATEGORIES.find((c) => c.value === category)?.label ?? category;
}

export default function IngredientsPage() {
    const [items, setItems] = useState<Ingredient[]>([]);
    const [loadingItems, setLoadingItems] = useState(true);
    const [name, setName] = useState("");
    const [category, setCategory] = useState<IngredientCategory>("vegetable-fruit");
    const [adding, setAdding] = useState(false);

    useEffect(() => {
        getAllIngredients()
            .then((fetched) => {
                setItems((current) => {
                    const fetchedIds = new Set(fetched.map((i) => i.id));
                    const pendingAdds = current.filter((i) => !fetchedIds.has(i.id));
                    return [...fetched, ...pendingAdds];
                });
            })
            .finally(() => setLoadingItems(false));
    }, []);

    async function handleAdd() {
        const trimmed = name.trim();
        if (!trimmed) return;
        setAdding(true);
        try {
            const item = await addIngredient(trimmed, category);
            setItems((prev) => [...prev, item]);
            setName("");
        } finally {
            setAdding(false);
        }
    }

    async function handleDelete(id: string) {
        await deleteIngredient(id);
        setItems((prev) => prev.filter((i) => i.id !== id));
    }

    return (
        <main className={styles.main}>
            <header className={styles.header}>
                <h1 className={styles.title}>식재료</h1>
            </header>

            <form
                className={styles.addForm}
                onSubmit={(e) => {
                    e.preventDefault();
                    handleAdd();
                }}
            >
                <input
                    className={styles.input}
                    type="text"
                    placeholder="식재료 이름"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    aria-label="식재료 이름"
                />
                <select
                    className={styles.select}
                    value={category}
                    onChange={(e) => setCategory(e.target.value as IngredientCategory)}
                    aria-label="카테고리"
                >
                    {CATEGORIES.map(({ value, label }) => (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    ))}
                </select>
                <button type="submit" className={styles.addBtn} disabled={!name.trim() || adding}>
                    추가
                </button>
            </form>

            {!loadingItems && items.length === 0 ? (
                <p className={styles.empty}>등록된 식재료가 없습니다</p>
            ) : (
                <ul className={styles.list}>
                    {items.map((item) => (
                        <li key={item.id} className={styles.item}>
                            <div>
                                <span className={styles.itemName}>{item.name}</span>
                                <span className={styles.badge}>{categoryLabel(item.category)}</span>
                            </div>
                            <button
                                type="button"
                                className={styles.deleteBtn}
                                onClick={() => handleDelete(item.id)}
                                aria-label={`${item.name} 삭제`}
                            >
                                ×
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <BottomNav active="ingredients" />
        </main>
    );
}
