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

- `POST /auth/refresh`: 앱은 refresh token을 기기에 저장하고, 웹은 쿠키를 씁니다.
- `POST /auth/logout`
- `PATCH /users/me`: `nickname`
- `DELETE /users/me`: 탈퇴 안내 문구는 명세의 탈퇴 규칙을 그대로 옮겼습니다.
