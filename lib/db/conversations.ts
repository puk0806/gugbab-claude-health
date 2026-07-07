import { ulid } from "ulid";
import { deriveConversationTitle, getDB } from "./index";
import type { ChatMessage, Conversation, MealPlanMode } from "./types";

/** 최근 수정순(내림차순) 대화방 목록 */
export async function listConversations(): Promise<Conversation[]> {
    const db = await getDB();
    const all = await db.getAllFromIndex("conversations", "byUpdatedAt");
    return all.reverse();
}

export async function getConversation(id: string): Promise<Conversation | undefined> {
    const db = await getDB();
    return db.get("conversations", id);
}

export async function getLatestConversation(): Promise<Conversation | undefined> {
    const list = await listConversations();
    return list[0];
}

/** 대화방 upsert — id가 없으면 새 방 생성, 있으면 메시지·모드 갱신 */
export async function saveConversation(data: {
    id?: string | null;
    messages: ChatMessage[];
    mealPlanMode?: MealPlanMode | null;
}): Promise<Conversation> {
    const db = await getDB();
    const now = new Date().toISOString();
    const existing = data.id ? await db.get("conversations", data.id) : undefined;

    const conversation: Conversation = existing
        ? {
              ...existing,
              messages: data.messages,
              title: deriveConversationTitle(data.messages),
              ...(data.mealPlanMode ? { mealPlanMode: data.mealPlanMode } : {}),
              updatedAt: now,
          }
        : {
              id: ulid(),
              title: deriveConversationTitle(data.messages),
              messages: data.messages,
              ...(data.mealPlanMode ? { mealPlanMode: data.mealPlanMode } : {}),
              createdAt: now,
              updatedAt: now,
          };

    await db.put("conversations", conversation);
    return conversation;
}

export async function deleteConversation(id: string): Promise<void> {
    const db = await getDB();
    await db.delete("conversations", id);
}
