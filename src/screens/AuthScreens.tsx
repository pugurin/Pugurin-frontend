import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from "react-native";
import {
  NICKNAME_MAX,
  PROVIDER,
  PROVIDER_NAMES,
  PROVIDERS,
  REQUIRED_AGREEMENTS,
  nicknameError,
  type Agreements,
  type AuthApi,
  type Provider,
  type Session,
  type SignInResult,
  type User,
} from "../api/authTypes";
import { Avatar } from "../components/Avatar";
import { Brand } from "../components/Brand";
import { ProviderLogo } from "../components/ProviderLogo";
import { Btn, Header, Icon, Section, T, s } from "../components/ui";
import { C } from "../theme/tokens";
import { TermsScreen, type TermKind } from "./MoreScreen";
import { kstDateKey } from "../glossary/today";

const SAMPLE_NOTICE = `지금은 화면 확인용 샘플 로그인이에요. 실제 ${PROVIDER_NAMES} 계정에는 연결되지 않아요`;

// 동그란 체크 상자. 글자까지 눌러서 켜고 끈다
function Check({
  checked,
  onPress,
  label,
  bold = false,
  right,
}: {
  checked: boolean;
  onPress: () => void;
  label: string;
  bold?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <View style={[s.between, { minHeight: 48 }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        // 웹(react-native-web)은 accessibilityState.checked를 aria-checked로 옮기지 않아 따로 준다
        aria-checked={checked}
        accessibilityLabel={label}
        onPress={onPress}
        style={[s.row, { flex: 1, paddingVertical: 10, gap: 12 }]}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            borderWidth: checked ? 0 : 1.5,
            borderColor: C.rule,
            backgroundColor: checked ? C.primary : C.surface,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {checked && <Icon name="check" size={16} color={C.surface} />}
        </View>
        <T bold={bold} size={bold ? 17 : 16} style={{ flexShrink: 1 }}>
          {label}
        </T>
      </Pressable>
      {right}
    </View>
  );
}

function ProviderButton({
  provider,
  busy,
  disabled,
  onPress,
}: {
  provider: Provider;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const p = PROVIDER[provider];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${p.name}로 시작하기`}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        {
          height: 54,
          backgroundColor: p.bg,
          borderWidth: p.border ? 1 : 0,
          borderColor: p.border,
          opacity: disabled && !busy ? 0.5 : pressed ? 0.8 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={p.ink} />
      ) : (
        <>
          <ProviderLogo provider={provider} />
          <T bold size={17} color={p.ink}>
            {p.name}로 시작하기
          </T>
        </>
      )}
    </Pressable>
  );
}

// 로그인. 네이버·카카오·구글 중 하나로 들어오고, 처음이면 onSignup으로 가입 화면에 넘긴다
export function LoginScreen({
  auth,
  onBack,
  onSession,
  onSignup,
}: {
  auth: AuthApi;
  onBack: () => void;
  onSession: (session: Session) => void;
  onSignup: (r: Extract<SignInResult, { kind: "signup" }>) => void;
}) {
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState("");
  const start = (provider: Provider) => {
    setBusy(provider);
    setError("");
    auth
      .signIn(provider)
      .then((r) => (r.kind === "session" ? onSession(r.session) : onSignup(r)))
      .catch((e) => setError(e?.message ?? "로그인하지 못했어요. 다시 시도해 주세요"))
      .finally(() => setBusy(null));
  };
  return (
    <View style={s.screen}>
      <Header title="로그인 · 회원가입" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 24, gap: 14, maxWidth: 480, width: "100%", alignSelf: "center" }}>
        <View style={{ alignItems: "center", gap: 14, paddingVertical: 28 }}>
          <Brand size={64} />
          <T size={25} bold style={{ textAlign: "center" }} accessibilityRole="header">
            가지가지 시작하기
          </T>
          <T color={C.muted} style={{ textAlign: "center" }}>
            {PROVIDER_NAMES} 계정으로 바로 시작해요.{"\n"}처음이면 가입도 함께 돼요
          </T>
        </View>
        {PROVIDERS.map((p) => (
          <ProviderButton
            key={p}
            provider={p}
            busy={busy === p}
            disabled={busy !== null}
            onPress={() => start(p)}
          />
        ))}
        {error !== "" && (
          <T color={C.brown} accessibilityRole="alert">
            {error}
          </T>
        )}
        <T size={14} color={C.muted} style={{ textAlign: "center", marginTop: 6 }}>
          이메일·비밀번호 가입은 없어요
        </T>
        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          style={{ alignSelf: "center", paddingVertical: 12, paddingHorizontal: 16 }}
        >
          <T size={15} color={C.muted} style={{ textDecorationLine: "underline" }}>
            로그인 없이 둘러보기
          </T>
        </Pressable>
        <View style={[s.card, { backgroundColor: C.bg2, gap: 4 }]}>
          <T size={14} color={C.muted}>
            지도·검색·용어사전은 로그인하지 않아도 쓸 수 있어요.
          </T>
          {auth.source === "sample" && (
            <T size={13} color={C.light}>
              {SAMPLE_NOTICE}
            </T>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const AGREEMENT_ROWS: { key: keyof Agreements; label: string; terms?: TermKind }[] = [
  { key: "age14", label: "[필수] 만 14세 이상이에요" },
  { key: "terms", label: "[필수] 서비스 이용약관 동의", terms: "서비스 이용약관" },
  { key: "privacy", label: "[필수] 개인정보 수집·이용 동의", terms: "개인정보 처리방침" },
  { key: "marketing", label: "[선택] 이벤트·혜택 알림 받기" },
];
const NONE: Agreements = { terms: false, privacy: false, age14: false, marketing: false };

// 회원가입. 처음 로그인한 사람만 온다. 닉네임과 동의를 받아 가입을 마친다
export function SignupScreen({
  auth,
  signup,
  onBack,
  onSession,
}: {
  auth: AuthApi;
  signup: Extract<SignInResult, { kind: "signup" }>;
  onBack: () => void;
  onSession: (session: Session) => void;
}) {
  const [nickname, setNickname] = useState(signup.nickname ?? "");
  const [agree, setAgree] = useState<Agreements>(NONE);
  const [viewing, setViewing] = useState<TermKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const nameError = nicknameError(nickname);
  const all = AGREEMENT_ROWS.every((r) => agree[r.key]);
  const ready = !nameError && REQUIRED_AGREEMENTS.every((k) => agree[k]);
  if (viewing) return <TermsScreen kind={viewing} onBack={() => setViewing(null)} />;
  const submit = () => {
    setBusy(true);
    setError("");
    auth
      .signUp(signup.signup_token, nickname, agree)
      .then(onSession)
      .catch((e) => setError(e?.message ?? "가입하지 못했어요. 다시 시도해 주세요"))
      .finally(() => setBusy(false));
  };
  return (
    <View style={s.screen}>
      <Header title="회원가입" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 40, maxWidth: 520, width: "100%", alignSelf: "center" }}>
        <T size={24} bold accessibilityRole="header">
          반가워요!{"\n"}가입을 마무리할게요
        </T>
        <T color={C.muted} style={{ marginTop: 6 }}>
          {PROVIDER[signup.provider].name} 계정으로 처음 오셨어요
        </T>
        <Section title="닉네임">
          <TextInput
            value={nickname}
            onChangeText={setNickname}
            maxLength={NICKNAME_MAX}
            accessibilityLabel="닉네임"
            placeholder="2~12자, 한글·영문·숫자"
            style={[s.input, { fontSize: 17, height: 50 }, nickname !== "" && nameError ? { borderColor: C.brown } : null]}
          />
          <T size={14} color={nickname !== "" && nameError ? C.brown : C.muted}>
            {nickname !== "" && nameError ? nameError : "매물 문의 채팅에서 상대에게 보이는 이름이에요"}
          </T>
        </Section>
        <Section title="약관 동의">
          <View style={[s.card, { paddingVertical: 4 }]}>
            <Check
              bold
              label="모두 동의해요"
              checked={all}
              onPress={() =>
                setAgree(all ? NONE : { terms: true, privacy: true, age14: true, marketing: true })
              }
            />
            <View style={{ height: 1, backgroundColor: C.rule }} />
            {AGREEMENT_ROWS.map((r) => (
              <Check
                key={r.key}
                label={r.label}
                checked={agree[r.key]}
                onPress={() => setAgree((a) => ({ ...a, [r.key]: !a[r.key] }))}
                right={
                  r.terms && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${r.terms} 보기`}
                      onPress={() => setViewing(r.terms!)}
                      style={{ padding: 8 }}
                    >
                      <T size={14} color={C.muted} style={{ textDecorationLine: "underline" }}>
                        보기
                      </T>
                    </Pressable>
                  )
                }
              />
            ))}
          </View>
          <T size={13} color={C.light}>
            선택 항목은 동의하지 않아도 가입할 수 있어요
          </T>
        </Section>
        {error !== "" && <T color={C.brown}>{error}</T>}
        <Btn disabled={!ready || busy} onPress={submit} style={{ height: 54, marginTop: 8 }}>
          {busy ? "가입하는 중…" : "가입하고 시작하기"}
        </Btn>
      </ScrollView>
    </View>
  );
}

// 내 정보. 닉네임 수정, 로그아웃, 회원 탈퇴
export function AccountScreen({
  auth,
  session,
  onBack,
  onUser,
  onSignedOut,
  notify,
}: {
  auth: AuthApi;
  session: Session;
  onBack: () => void;
  onUser: (user: User) => void;
  // 로그아웃·탈퇴를 마치면 부른다. withdrawn이면 탈퇴다
  onSignedOut: (withdrawn: boolean) => void;
  notify: (s: string) => void;
}) {
  const user = session.user;
  const [nickname, setNickname] = useState(user.nickname);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<"logout" | "withdraw" | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [error, setError] = useState("");
  const changed = nickname.trim() !== user.nickname;
  const nameError = changed ? nicknameError(nickname) : null;
  // 가입일은 한국 시간 날짜로 보여 준다
  const joined = kstDateKey(new Date(user.created_at)).replaceAll("-", ".");
  const save = () => {
    setSaving(true);
    setError("");
    auth
      .updateNickname(session, nickname)
      .then((u) => {
        onUser(u);
        setNickname(u.nickname);
        notify("닉네임을 바꿨어요");
      })
      .catch((e) => setError(e?.message ?? "닉네임을 바꾸지 못했어요"))
      .finally(() => setSaving(false));
  };
  const leave = (kind: "logout" | "withdraw") => {
    setBusy(kind);
    setError("");
    (kind === "logout" ? auth.signOut(session) : auth.withdraw(session))
      .then(() => onSignedOut(kind === "withdraw"))
      .catch((e) => {
        setError(e?.message ?? "잠시 후 다시 시도해 주세요");
        setBusy(null);
      });
  };
  return (
    <View style={s.screen}>
      <Header title="내 정보" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, maxWidth: 560, width: "100%", alignSelf: "center" }}>
        <View style={[s.row, { gap: 14, paddingVertical: 8 }]}>
          <Avatar name={user.nickname} size={56} />
          <View style={{ flex: 1 }}>
            <T size={21} bold>
              {user.nickname}
            </T>
            <T size={14} color={C.muted}>
              {PROVIDER[user.provider].name} 계정 · {joined} 가입
            </T>
          </View>
        </View>
        <Section title="닉네임 바꾸기">
          <View style={s.row}>
            <TextInput
              value={nickname}
              onChangeText={setNickname}
              maxLength={NICKNAME_MAX}
              accessibilityLabel="새 닉네임"
              style={[s.input, { flex: 1, fontSize: 16, height: 48 }, nameError ? { borderColor: C.brown } : null]}
            />
            <Btn small disabled={!changed || !!nameError || saving} onPress={save} style={{ height: 48 }}>
              {saving ? "저장 중…" : "저장"}
            </Btn>
          </View>
          {nameError && (
            <T size={14} color={C.brown}>
              {nameError}
            </T>
          )}
        </Section>
        <Section title="알림 동의">
          <T color={C.muted}>
            이벤트·혜택 알림: {user.marketing_push ? "받기로 했어요" : "받지 않아요"}
          </T>
        </Section>
        {error !== "" && <T color={C.brown}>{error}</T>}
        <Btn secondary disabled={busy !== null} onPress={() => leave("logout")} style={{ marginTop: 12, height: 50 }}>
          {busy === "logout" ? "로그아웃하는 중…" : "로그아웃"}
        </Btn>
        {!leaving ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setLeaving(true)}
            style={{ alignSelf: "center", padding: 16, marginTop: 8 }}
          >
            <T size={15} color={C.light} style={{ textDecorationLine: "underline" }}>
              회원 탈퇴
            </T>
          </Pressable>
        ) : (
          <View style={[s.card, { marginTop: 20, gap: 10, borderColor: C.brown }]}>
            <T size={18} bold>
              정말 탈퇴할까요?
            </T>
            <T size={15} color={C.ink2}>
              · 닉네임과 소셜 계정 정보는 바로 지워져요{"\n"}· 관심 단지·학습 기록은 계정에서 사라져요{"\n"}
              · 매물 문의 채팅에서는 "탈퇴한 사용자"로 보여요{"\n"}· 같은 계정으로 다시 가입할 수 있지만 지금
              기록과 이어지지 않아요
            </T>
            <Check
              label="안내를 확인했어요"
              checked={understood}
              onPress={() => setUnderstood((v) => !v)}
            />
            <View style={s.row}>
              <Btn secondary onPress={() => { setLeaving(false); setUnderstood(false); }} style={{ flex: 1 }}>
                그만두기
              </Btn>
              <Btn
                disabled={!understood || busy !== null}
                onPress={() => leave("withdraw")}
                style={{ flex: 1, backgroundColor: C.brown }}
              >
                {busy === "withdraw" ? "탈퇴하는 중…" : "탈퇴하기"}
              </Btn>
            </View>
          </View>
        )}
        {auth.source === "sample" && (
          <T size={13} color={C.light} style={{ marginTop: 16, textAlign: "center" }}>
            {SAMPLE_NOTICE}
          </T>
        )}
      </ScrollView>
    </View>
  );
}
