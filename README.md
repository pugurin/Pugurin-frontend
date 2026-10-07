# 퍼그린 앱

Expo + React Native + TypeScript로 만든 iOS/Android 앱이다. 와이어프레임 v2 1차 화면을 구현하며 **6번 토지 요약·상세(S07)는 제외**한다. 지도는 카카오맵 JavaScript SDK를 네이티브 WebView에서 사용한다.

## 실행

```sh
npm ci
cp .env.example .env.local
npm start
```

iOS 시뮬레이터 API 주소는 localhost:8000, Android 에뮬레이터는 10.0.2.2:8000이다. 실제 휴대폰은 EXPO_PUBLIC_API_URL에 접근 가능한 HTTPS 백엔드의 /api/v1 주소를 입력한다. 기존 EXPO_PUBLIC_API_BASE 서버 주소도 지원한다.

웹 미리보기는 별도 터미널에서 `npm run api:dev`와 `npm run web`을 실행한다. 개발 중계는 같은 PC의 백엔드만 사용하고 127.0.0.1:8001에 바인딩한다. 배포 서버에서 사용하지 않는다.

카카오 개발자 콘솔의 JavaScript 키를 EXPO_PUBLIC_KAKAO_JS_KEY에, 등록한 웹 도메인을 EXPO_PUBLIC_KAKAO_MAP_ORIGIN에 입력한다. REST/admin 키를 넣지 않는다. 앱에서 쓰는 JavaScript 키는 노출되므로 콘솔에서 도메인 제한을 설정한다. 키가 없으면 화면에 **샘플 지도**임을 표시한다. 이는 API 데이터 모드와 별개이며 실지도 검증은 아직 수행하지 않았다.

## 구현 범위

지도·거래유형·필터·기간·레이어·면적 단위, 검색·최근 검색어, 지역 시트, 단지 3단계 시트·거래 이력, 거래 목록 화면, 용어 목록·검색·팝업·상세·예시 그림, 더보기·기준일·약관 진입점을 제공한다.

백엔드 메인에 없는 지역 거래목록·통계·분석은 API 준비 상태를 표시한다. 백엔드를 추가 구현하거나 프론트에서 통계를 계산하지 않는다. 샘플 데이터는 더보기에서 명시적으로 선택할 때만 사용하며 API 오류를 자동 대체하지 않는다. 2차 로그인·관심·채팅, 광고 SDK 및 실제 약관 원문은 준비 상태다. 단지 면적 칩은 면적 정보를 보여주며 API가 면적 필터를 제공하지 않아 거래이력에는 모든 면적이 나온다.

`spikes/vworld-map`은 이전 검증용 코드다. 본 앱은 root의 App.tsx에서 시작하며 VWorld·MapLibre를 의존하거나 사용하지 않는다.

## 검증

```sh
npm test
npm run typecheck
npm run build:web
npm run verify:api
npm run verify:ui
npx expo export --platform ios --platform android
```

UI 검증에는 로컬 8081 미리보기와 8001 개발 중계가 필요하다. Playwright Chromium이 설치되어 있어야 하고 필요시 PUGURIN_CHROMIUM_PATH를 지정한다. 현재 검증은 브라우저의 모바일 크기와 네이티브 JS 번들 기준이며 iOS/Android 실기기 설치 및 카카오 실지도 검증은 별도다.

상세 API 연결 상태와 실제 응답 검증 결과는 [API 연결 문서](docs/API_INTEGRATION.md)를 참고한다.
