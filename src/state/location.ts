import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
// 회원가입이 아직 없어서, 위치 권한은 첫 실행 때 한 번 모달로 안내하고 받는다(#92)
// storage.ts는 expo-crypto를 불러와서, 지도 화면이 쓰는 이 파일은 AsyncStorage를 직접 쓴다
const ASKED_KEY = "pugurin.location_asked";
export type LocationStart = "locate" | "ask" | "none";
// 이미 허용했으면 바로 내 위치로, 안내한 적이 없으면 모달, 그 밖에는 기본 위치 그대로
export function locationStart(
  status: Location.PermissionStatus | "undetermined" | "granted" | "denied",
  asked: boolean,
): LocationStart {
  if (status === "granted") return "locate";
  return asked ? "none" : "ask";
}
export async function initialLocationStart(): Promise<LocationStart> {
  try {
    const [perm, asked] = await Promise.all([
      Location.getForegroundPermissionsAsync(),
      AsyncStorage.getItem(ASKED_KEY).then((v) => v === "true"),
    ]);
    return locationStart(perm.status, asked);
  } catch {
    return "none";
  }
}
export const markLocationAsked = () =>
  AsyncStorage.setItem(ASKED_KEY, "true").catch(() => {});
