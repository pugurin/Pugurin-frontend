# 백엔드 요청: 로그인·회원가입 API

프론트는 로그인·회원가입·내 정보·탈퇴 화면을 앱 안 가짜 서버(`src/api/auth.ts`의 `SampleAuth`)로 먼저 만들었습니다(#137). 아래 API가 생기면 가짜 서버를 실제 호출로 바꿉니다. 기준은 API 명세 §8과 기능명세 F-AUTH-01~05이고, **명세와 다른 점은 ⚠️로 표시했습니다**.

## 1. 소셜 로그인 제공자 ⚠️

- 명세에는 `provider: kakao|naver`만 있습니다. **`google`을 추가해 주세요.** 화면의 버튼 순서는 네이버, 카카오, 구글입니다.
- 앱은 각 SDK가 준 토큰을 보내고, 웹은 리다이렉트로 받은 인가 코드를 보냅니다(명세와 같습니다).

## 2. 처음 로그인한 사람의 가입 흐름 ⚠️

명세는 `POST /auth/oauth/{provider}`에서 `agreements`를 같이 받고, 동의가 없으면 `VALIDATION_ERROR`를 줍니다. 그런데 이렇게 하면 두 가지가 막힙니다.

- 앱은 서버에 묻기 전에는 그 사람이 처음인지 알 수 없습니다. 그래서 가입한 사람에게도 동의 화면을 보여줘야 합니다.
- 웹 인가 코드는 한 번만 쓸 수 있습니다. 동의를 받은 뒤 같은 코드를 다시 보낼 수 없습니다.

그래서 두 단계로 나눠 주세요.

**① `POST /auth/oauth/{provider}`** (요청 본문은 명세와 같음)

```json
// 가입한 사람: 지금 명세와 같음
{ "data": { "is_new_user": false, "access_token": "jwt", "refresh_token": "opaque", "user": { } } }
// 처음인 사람: 토큰 대신 가입 토큰을 준다
{ "data": { "is_new_user": true, "signup_token": "opaque, 10분 유효, 1회용", "profile": { "nickname": "소셜 프로필 이름 또는 null" } } }
```

**② `POST /auth/signup`** (새로 추가)

```json
{
  "signup_token": "①에서 받은 값",
  "nickname": "부산사람",
  "agreements": { "terms": true, "privacy": true, "age14": true, "marketing": false }
}
```

- 응답은 ①의 가입한 사람 응답과 같습니다(웹은 refresh token을 쿠키로 줍니다).
- `terms`·`privacy`·`age14` 중 하나라도 false면 `400 VALIDATION_ERROR`, `field`에 그 항목 이름을 넣어 주세요.
- `signup_token`이 만료됐거나 이미 쓴 것이면 `401 UNAUTHORIZED`를 주세요. 앱은 로그인 화면으로 돌아갑니다.

## 3. 동의 항목 ⚠️

| 키 | 필수 | 화면 문구 |
|---|---|---|
| `age14` | 필수 | 만 14세 이상이에요 |
| `terms` | 필수 | 서비스 이용약관 동의 |
| `privacy` | 필수 | 개인정보 수집·이용 동의 |
| `marketing` | 선택 | 이벤트·혜택 알림 받기. `consents.marketing_push`와 `marketing_consented_at`에 저장 |

명세에는 `age14`가 없습니다. 만 14세 미만은 법정대리인 동의가 따로 필요해서 넣었습니다.

## 4. 닉네임 규칙

- 2~12자, 한글·영문·숫자만 받고 띄어쓰기·기호는 받지 않습니다. 앞뒤 공백은 지웁니다.
- 앱도 같은 규칙으로 먼저 막습니다. 서버도 같은 규칙으로 `VALIDATION_ERROR`를 주세요.
- 중복 허용 여부를 정해 주세요. 막는다면 `409 CONFLICT`로 주시면 앱이 "이미 쓰는 닉네임이에요"를 띄웁니다.

## 5. `GET /users/me` 응답 추가 ⚠️

명세 응답에 아래 두 필드를 넣어 주세요. 내 정보 화면에 "카카오 계정 · 2026.11.13 가입"으로 보여줍니다.

- `provider`: `naver|kakao|google`
- `created_at`: 이미 있음

## 6. 그대로 쓰는 것

- `POST /auth/refresh`: 앱은 refresh token을 기기 보안 저장소(SecureStore)에 두고, 웹은 httpOnly 쿠키로만 주고받습니다.
- `POST /auth/logout`
- `PATCH /users/me`: `nickname`
- `DELETE /users/me`: 탈퇴 안내 문구는 명세의 탈퇴 규칙을 그대로 옮겼습니다.

## 7. 토큰 저장 ⚠️

- **웹은 refresh token을 응답 본문에 넣지 말고 `HttpOnly; Secure; SameSite=Lax` 쿠키로만 주세요.** `localStorage`에 두면 XSS 한 번에 탈취됩니다.
- access token은 응답 본문으로 주시면 앱이 메모리에만 둡니다. 새로 열면 `POST /auth/refresh`로 다시 받습니다.
- 앱은 시작할 때 저장한 세션을 `POST /auth/refresh` → `GET /users/me`로 확인하고, `401`이면 세션을 지웁니다. 토큰이 만료·폐기됐으면 `401 UNAUTHORIZED`를 주세요.
- 로그아웃·탈퇴하면 그 refresh token을 서버에서 폐기하고 웹 쿠키도 지워 주세요.

## 8. OAuth 보안 ⚠️

웹 리다이렉트 로그인에서 CSRF와 open redirect를 막기 위해 아래를 지켜 주세요.

- **`state`**: 로그인 시작할 때 서버가 추측할 수 없는 1회용 값을 만들어 세션(또는 서명한 쿠키)에 묶고, 콜백에서 같은 값인지 확인한 뒤 바로 버립니다. 다르거나 없으면 `400`으로 끊습니다.
- **PKCE(S256)**: 인가 요청에 `code_challenge`를 넣고, 토큰 교환 때 `code_verifier`로 확인합니다. 구글·카카오·네이버 중 PKCE를 지원하는 곳은 모두 씁니다. 앱(SDK) 흐름도 SDK가 PKCE를 지원하면 켭니다.
- **`redirect_uri` 허용 목록**: 서버에 정확히 일치하는 주소만 등록합니다(운영 웹 주소, PR 미리보기 주소 형식, 앱 스킴). 요청에서 받은 주소를 그대로 쓰지 말고, 목록에 없으면 거절합니다. 각 제공자 콘솔에도 같은 목록만 등록합니다.
- 로그인 뒤 돌아갈 화면 경로를 받는다면 같은 출처의 상대 경로만 받습니다.
- 인가 코드와 토큰은 서버 로그에 남기지 않습니다.
