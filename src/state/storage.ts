import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import type { SearchResult } from "../api/types";
export async function deviceId() {
  let id = await AsyncStorage.getItem("pugurin.device_id");
  if (!id) {
    id = Crypto.randomUUID();
    await AsyncStorage.setItem("pugurin.device_id", id);
  }
  return id;
}
export async function loadStored<T>(key: string, fallback: T): Promise<T> {
  try {
    const value = await AsyncStorage.getItem(`pugurin.${key}`);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}
export const store = (key: string, value: unknown) =>
  AsyncStorage.setItem(`pugurin.${key}`, JSON.stringify(value)).catch(() => {});
export type Recent = { label: string; result: SearchResult };
export const remember = (list: Recent[], result: SearchResult): Recent[] =>
  [
    { label: result.name ?? result.address ?? "", result },
    ...list.filter((r) => r.label !== (result.name ?? result.address)),
  ].slice(0, 10);
