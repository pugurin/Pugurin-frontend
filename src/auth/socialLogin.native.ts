import { ApiError } from "../api/client";
import type { SocialLogin } from "../api/apiAuth";

// 앱 소셜 로그인: 카카오 SDK가 준 access token을 서버에 보낸다(서버가 우리 앱에 발급된 토큰인지 확인한다).
// 카카오 SDK는 네이티브 모듈이라 개발 빌드(npx expo run:ios|android)에서만 동작한다. Expo Go에서는 안내 문구를 띄운다
export const socialLogin: SocialLogin = {
  async start(provider) {
    if (provider !== "kakao") throw new ApiError("이 로그인은 준비 중이에요", "NOT_SUPPORTED");
    if (!process.env.EXPO_PUBLIC_KAKAO_NATIVE_KEY)
      throw new ApiError("카카오 로그인 설정(네이티브 앱 키)이 없어요", "NOT_SUPPORTED");
    let kakao: typeof import("@react-native-seoul/kakao-login");
    try {
      kakao = require("@react-native-seoul/kakao-login");
    } catch {
      throw new ApiError("카카오 로그인은 개발 빌드에서만 쓸 수 있어요", "NOT_SUPPORTED");
    }
    try {
      // 카카오톡이 있으면 카카오톡으로, 없으면 카카오계정 웹 로그인으로 들어간다
      return (await kakao.login()).accessToken;
    } catch (e: any) {
      const cancelled = /cancel/i.test(`${e?.code ?? ""} ${e?.message ?? ""}`);
      throw new ApiError(
        cancelled ? "로그인을 취소했어요" : "카카오 로그인을 마치지 못했어요. 다시 시도해 주세요",
        cancelled ? "CANCELLED" : "SOCIAL_ERROR",
      );
    }
  },
};
