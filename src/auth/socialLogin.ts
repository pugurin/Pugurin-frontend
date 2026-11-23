import { ApiError } from "../api/client";
import type { SocialLogin } from "../api/apiAuth";

// 웹은 SDK 대신 리다이렉트 로그인(src/auth/webOAuth.ts)을 쓴다. 앱은 socialLogin.native.ts(카카오 SDK)
export const socialLogin: SocialLogin = {
  start: () =>
    Promise.reject(
      new ApiError("웹은 리다이렉트 로그인을 써요", "SOURCE_UNAVAILABLE"),
    ),
};
