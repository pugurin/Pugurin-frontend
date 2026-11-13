
import { ApiError } from "./client";
import { loadStored, store } from "../state/storage";
import {
  PROVIDER,
  PROVIDERS,
  REQUIRED_AGREEMENTS,
  nicknameError,
  type Agreements,
  type AuthApi,
  type Provider,
  type Session,
  type SignInResult,
  type StoredSession,
  type User,
} from "./authTypes";
export * from "./authTypes";

// 백엔드 인증 API가 아직 없어 지금은 SampleAuth(앱 안 가짜 서버)만 쓴다.
// 요청할 API 모양은 docs/BACKEND_AUTH_REQUEST.md에 있다
// 앱 안 가짜 인증 서버. 가입한 계정을 기기에 저장해서, 같은 소셜 계정으로 다시 로그인하면 바로 들어간다.
// 실제 소셜 계정에는 연결하지 않는다
type SampleAccount = { provider: Provider; user: User };
const ACCOUNTS_KEY = "sample_auth_accounts";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class SampleAuth implements AuthApi {
  readonly source = "sample" as const;
  constructor(private delay = 350) {}
  private accounts() {
    return loadStored<SampleAccount[]>(ACCOUNTS_KEY, []);
  }
  private save(list: SampleAccount[]) {
    return store(ACCOUNTS_KEY, list);
  }
  private session(user: User): Session {
    const stamp = Date.now().toString(36);
    return {
      source: this.source,
      user,
      access_token: `sample-access-${stamp}`,
      refresh_token: `sample-refresh-${stamp}`,
    };
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
  async restore(saved: StoredSession): Promise<Session> {
    await wait(this.delay);
    const found = (await this.accounts()).find((a) => a.user.id === saved.user.id);
    if (saved.source !== this.source || !found)
      throw new ApiError("다시 로그인해 주세요", "UNAUTHORIZED");
    return this.session(found.user);
  }
}

// 일반 저장소에 남길 모양으로 바꾼다. 토큰은 넣지 않는다
export function toStored(session: Session): StoredSession {
  return { source: session.source, user: session.user };
}
