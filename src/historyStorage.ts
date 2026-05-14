import { get, set } from "idb-keyval";
import type { AspectRatioId } from "./cropUtils";
import type { BackgroundId } from "./backgrounds";

const HISTORY_KEY = "kotofon.history.v1";

export type HistoryItem = {
  id: string;
  createdAt: string;
  resultDataUrl: string;
  aspectRatio: AspectRatioId;
  backgroundId: BackgroundId;
  backgroundName: string;
  pinned: boolean;
};

export async function getHistoryItems(): Promise<HistoryItem[]> {
  return ((await get(HISTORY_KEY)) as HistoryItem[] | undefined) ?? [];
}

export async function saveHistoryItem(item: Omit<HistoryItem, "id" | "createdAt" | "pinned">): Promise<HistoryItem> {
  const existing = await getHistoryItems();
  const saved: HistoryItem = {
    ...item,
    id: createHistoryId(),
    createdAt: new Date().toISOString(),
    pinned: false
  };
  await set(HISTORY_KEY, trimHistory([saved, ...existing]));
  return saved;
}

export async function pinHistoryItem(id: string): Promise<HistoryItem[]> {
  const items = await getHistoryItems();
  const next = items.map((item) => (item.id === id ? { ...item, pinned: true } : item));
  await set(HISTORY_KEY, trimHistory(next));
  return next;
}

export async function removeHistoryItem(id: string): Promise<HistoryItem[]> {
  const next = (await getHistoryItems()).filter((item) => item.id !== id);
  await set(HISTORY_KEY, trimHistory(next));
  return next;
}

export async function clearHistoryItems(): Promise<HistoryItem[]> {
  const pinned = (await getHistoryItems()).filter((item) => item.pinned);
  await set(HISTORY_KEY, pinned);
  return pinned;
}

function trimHistory(items: HistoryItem[]): HistoryItem[] {
  const pinned = items.filter((item) => item.pinned);
  const regular = items.filter((item) => !item.pinned).slice(0, 10);
  return [...pinned, ...regular].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function createHistoryId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const randomValues = typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function"
    ? crypto.getRandomValues(new Uint32Array(4))
    : new Uint32Array([
        Math.floor(Math.random() * 0xffffffff),
        Math.floor(Math.random() * 0xffffffff),
        Math.floor(Math.random() * 0xffffffff),
        Math.floor(Math.random() * 0xffffffff)
      ]);

  return [
    Date.now().toString(36),
    ...Array.from(randomValues, (value) => value.toString(36))
  ].join("-");
}
