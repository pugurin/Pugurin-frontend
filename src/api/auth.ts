import { ApiError } from "./client";
import { loadStored, store } from "../state/storage";

// 로그인·회원가입(기능명세 F-AUTH-01~05). 네이버·카카오·구글 소셜 로그인만 있고 이메일 가입은 없다.
// 처음 로그인한 사람은 동의·닉네임을 받아 가입을 마친다.
// 백엔드 인증 API가 아직 없어 지금은 SampleAuth(앱 안 가짜 서버)만 쓴다.
// 요청할 API 모양은 docs/BACKEND_AUTH_REQUEST.md에 있다
export type Provider = "naver" | "kakao" | "google";
// 로그인 화면 버튼 순서
export const PROVIDERS: Provider[] = ["naver", "kakao", "google"];
// 소셜 로그인 버튼 색은 각 서비스 로그인 버튼 안내를 따른다
export const PROVIDER: Record<
  Provider,
  { name: string; letter: string; bg: string; ink: string; border?: string }
> = {
  naver: { name: "네이버", letter: "N", bg: "#03C75A", ink: "#FFFFFF" },
  kakao: { name: "카카오", letter: "K", bg: "#FEE500", ink: "#191919" },
  google: { name: "구글", letter: "G", bg: "#FFFFFF", ink: "#1F1F1F", border: "#747775" },
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
export type Session = { user: User; access_token: string; refresh_token: string };
// 가입 동의. terms·privacy·age14는 필수, marketing은 선택이다
export type Agreements = {
  terms: boolean;
  privacy: boolean;
  age14: boolean;
  marketing: boolean;
};
export const REQUIRED_AGREEMENTS = ["terms", "privacy", "age14"] as const;
// 소셜 로그인 결과. 가입한 사람이면 바로 세션, 처음이면 가입을 마칠 토큰과 소셜 프로필 닉네임
export type SignInResult =
  | { kind: "session"; session: Session }
  | { kind: "signup"; signup_token: string; provider: Provider; nickname: string | null };

export interface AuthApi {
  signIn(provider: Provider): Promise<SignInResult>;
  signUp(signupToken: string, nickname: string, agreements: Agreements): Promise<Session>;
  updateNickname(session: Session, nickname: string): Promise<User>;
  signOut(session: Session): Promise<void>;
  withdraw(session: Session): Promise<void>;
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

// 앱 안 가짜 인증 서버. 가입한 계정을 기기에 저장해서, 같은 소셜 계정으로 다시 로그인하면 바로 들어간다.
// 실제 소셜 계정에는 연결하지 않는다
type SampleAccount = { provider: Provider; user: User };
const ACCOUNTS_KEY = "sample_auth_accounts";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class SampleAuth implements AuthApi {
  constructor(private delay = 350) {}
  private accounts() {
    return loadStored<SampleAccount[]>(ACCOUNTS_KEY, []);
  }
  private save(list: SampleAccount[]) {
    return store(ACCOUNTS_KEY, list);
  }
  private session(user: User): Session {
    const stamp = Date.now().toString(36);
    return { user, access_token: `sample-access-${stamp}`, refresh_token: `sample-refresh-${stamp}` };
  }
  async signIn(provider: Provider): Promise<SignInResult> {
    await wait(this.delay);
    const found = (await this.accounts()).find((a) => a.provider === provider);
    if (found) return { kind: "session", session: this.session(found.user) };
    return {
      kind: "signup",
      signup_token: `sample-signup-${provider}-${Date.now().toString(36)}`,
      provider,
      nickname: `${PROVIDER[provider].name}이웃`,
    };
  }
  async signUp(signupToken: string, nickname: string, agreements: Agreements): Promise<Session> {
    await wait(this.delay);
    const provider = signupToken.split("-")[2] as Provider;
    if (!PROVIDERS.includes(provider))
      throw new ApiError("가입 시간이 지났어요. 다시 로그인해 주세요", "UNAUTHORIZED");
    if (REQUIRED_AGREEMENTS.some((k) => !agreements[k]))
      throw new ApiError("필수 항목에 동의해 주세요", "VALIDATION_ERROR");
    const error = nicknameError(nickname);
    if (error) throw new ApiError(error, "VALIDATION_ERROR");
    const user: User = {
      id: `sample-user-${provider}`,
      nickname: nickname.trim(),
      provider,
      role: "buyer",
      marketing_push: agreements.marketing,
      created_at: new Date().toISOString(),
    };
    const list = (await this.accounts()).filter((a) => a.provider !== provider);
    await this.save([...list, { provider, user }]);
    return this.session(user);
  }
  async updateNickname(session: Session, nickname: string): Promise<User> {
    await wait(this.delay);
    const error = nicknameError(nickname);
    if (error) throw new ApiError(error, "VALIDATION_ERROR");
    const user = { ...session.user, nickname: nickname.trim() };
    const list = await this.accounts();
    await this.save(list.map((a) => (a.provider === user.provider ? { ...a, user } : a)));
    return user;
  }
  async signOut(): Promise<void> {
    await wait(this.delay);
  }
  async withdraw(session: Session): Promise<void> {
    await wait(this.delay);
    const list = await this.accounts();
    await this.save(list.filter((a) => a.provider !== session.user.provider));
  }
}
