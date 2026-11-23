// 로그인·회원가입(기능명세 F-AUTH-01~05)의 상수·타입·닉네임 규칙.
// 저장소(AsyncStorage·expo-crypto)를 불러오지 않아 화면과 테스트가 가볍게 가져다 쓸 수 있다
export type Provider = "naver" | "kakao" | "google";
// 로그인 화면 버튼 순서
export const PROVIDERS: Provider[] = ["kakao", "naver", "google"];
// 소셜 로그인 버튼 색은 각 서비스 로그인 버튼 안내를 따른다
export const PROVIDER: Record<
  Provider,
  { name: string; label: string; bg: string; ink: string; border?: string }
> = {
  naver: { name: "네이버", label: "네이버로 시작하기", bg: "#03C75A", ink: "#FFFFFF" },
  // 카카오 가이드: 글자는 검정 85%
  kakao: { name: "카카오", label: "카카오로 시작하기", bg: "#FEE500", ink: "rgba(0,0,0,0.85)" },
  // 구글 가이드: 버튼 문구는 "Google로 계속하기"
  google: { name: "구글", label: "Google로 계속하기", bg: "#FFFFFF", ink: "#1F1F1F", border: "#747775" },
};
// 소셜 계정 이름 나열(안내 문구용)
export const PROVIDER_NAMES = PROVIDERS.map((p) => PROVIDER[p].name).join("·");

export type User = {
  id: string;
  nickname: string;
  provider: Provider;
  role: "buyer" | "admin";
  marketing_push: boolean;
  created_at: string;
};
// 인증을 맡은 곳. 샘플 세션이 나중에 실제 서버 세션으로 되살아나지 않게 세션마다 남긴다
export type AuthSource = "sample" | "api";
// access token은 메모리에만 둔다
export type Session = {
  source: AuthSource;
  user: User;
  access_token: string;
  refresh_token: string;
};
// 기기 일반 저장소에 남기는 세션. 토큰은 넣지 않는다.
// 앱의 refresh token은 보안 저장소(state/secureToken)에 따로 두고, 웹은 httpOnly 쿠키로 받는다
export type StoredSession = { source: AuthSource; user: User };
// 가입 동의. terms·privacy·age14는 필수, marketing은 선택이다
export type Agreements = {
  terms: boolean;
  privacy: boolean;
  age14: boolean;
  marketing: boolean;
  // 위치기반 서비스 이용약관(선택). 서버는 아직 저장하지 않는다
  location?: boolean;
};
export const REQUIRED_AGREEMENTS = ["terms", "privacy", "age14"] as const;
// 소셜 로그인 결과. 가입한 사람이면 바로 세션, 처음이면 가입을 마칠 토큰과 소셜 프로필 닉네임
export type SignInResult =
  | { kind: "session"; session: Session }
  | { kind: "signup"; signup_token: string; provider: Provider; nickname: string | null };

export interface AuthApi {
  readonly source: AuthSource;
  signIn(provider: Provider): Promise<SignInResult>;
  signUp(signupToken: string, nickname: string, agreements: Agreements): Promise<Session>;
  updateNickname(session: Session, nickname: string): Promise<User>;
  signOut(session: Session): Promise<void>;
  withdraw(session: Session): Promise<void>;
  // 저장한 세션을 서버에 확인하고 새 세션으로 바꾼다(refresh 후 /users/me).
  // 계정이 없거나 토큰이 만료됐으면 UNAUTHORIZED를 던진다
  restore(saved: StoredSession, refreshToken?: string): Promise<Session>;
  // 리다이렉트 로그인(웹 실제 서버): 소셜 로그인에서 돌아왔으면 로그인을 마친다. 아니면 null
  completeSignIn?(): Promise<SignInResult | null>;
  // 데이터 API(관심 목록)에 붙일 최신 access token과 만료됐을 때의 갱신. 실제 서버 인증만 있다
  accessToken?(): string | undefined;
  refreshAccess?(): Promise<string>;
}

export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 12;
// 닉네임 규칙. 맞으면 null, 아니면 안내 문구
export function nicknameError(v: string): string | null {
  const name = v.trim();
  if (name.length < NICKNAME_MIN || name.length > NICKNAME_MAX)
    return `닉네임은 ${NICKNAME_MIN}~${NICKNAME_MAX}자로 정해 주세요`;
  if (!/^[가-힣a-zA-Z0-9]+$/.test(name))
    return "한글·영문·숫자만 쓸 수 있어요(띄어쓰기·기호 없이)";
  return null;
}

// 가입할 때 자동으로 만드는 닉네임(시안 A4). 소셜 프로필 이름은 실명일 수 있어 쓰지 않는다.
// 닉네임 규칙(띄어쓰기 없이 12자 이하)에 맞게 "부산 단어 + 숫자 4자리"로 만든다. 더보기 › 내 정보에서 바꾼다
const NICKNAME_WORDS = [
  "부산갈매기",
  "해운대파도",
  "광안리별빛",
  "동백섬산책",
  "영도다리",
  "금정산바람",
  "감천마을",
  "자갈치시장",
];
export function randomNickname(rand: () => number = Math.random) {
  const word = NICKNAME_WORDS[Math.floor(rand() * NICKNAME_WORDS.length)];
  return `${word}${String(1000 + Math.floor(rand() * 9000))}`;
}
