import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// 앱의 refresh token은 기기 보안 저장소(iOS 키체인·Android Keystore)에만 둔다.
// 웹은 httpOnly 쿠키로 받으므로 아무것도 저장하지 않는다
const KEY = "pugurin.refresh_token";
const web = () => Platform.OS === "web";

export async function loadRefreshToken(): Promise<string | undefined> {
  if (web()) return undefined;
  try {
    return (await SecureStore.getItemAsync(KEY)) ?? undefined;
  } catch {
    return undefined;
  }
}
export function saveRefreshToken(token: string | null) {
  if (web()) return Promise.resolve();
  return (
    token ? SecureStore.setItemAsync(KEY, token) : SecureStore.deleteItemAsync(KEY)
  ).catch(() => {});
}
