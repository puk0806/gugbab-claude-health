import type { DBSchema, IDBPDatabase } from "idb";
import { openDB } from "idb";
import type { BodyMetric, Ingredient, MealHistory, UserProfile } from "./types";

interface HealthDB extends DBSchema {
    userProfile: {
        key: string;
        value: UserProfile;
    };
    ingredients: {
        key: string;
        value: Ingredient;
        indexes: { byCategory: string; byAddedAt: string };
    };
    bodyMetrics: {
        key: string;
        value: BodyMetric;
        indexes: { byDate: string };
    };
    mealHistory: {
        key: string;
        value: MealHistory;
        indexes: { byDate: string };
    };
}

export function getLocalDateString(date = new Date()): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const DB_NAME = "gugbab-health";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<HealthDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<HealthDB>> {
    if (!dbPromise) {
        dbPromise = openDB<HealthDB>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains("userProfile")) {
                    db.createObjectStore("userProfile", { keyPath: "id" });
                }

                if (!db.objectStoreNames.contains("ingredients")) {
                    const ingredientStore = db.createObjectStore("ingredients", {
                        keyPath: "id",
                    });
                    ingredientStore.createIndex("byCategory", "category");
                    ingredientStore.createIndex("byAddedAt", "addedAt");
                }

                if (!db.objectStoreNames.contains("bodyMetrics")) {
                    const metricStore = db.createObjectStore("bodyMetrics", {
                        keyPath: "id",
                    });
                    metricStore.createIndex("byDate", "date");
                }

                if (!db.objectStoreNames.contains("mealHistory")) {
                    const historyStore = db.createObjectStore("mealHistory", {
                        keyPath: "id",
                    });
                    historyStore.createIndex("byDate", "date");
                }
            },
        }).catch((err: unknown) => {
            dbPromise = null;
            throw err;
        });
    }
    return dbPromise;
}
