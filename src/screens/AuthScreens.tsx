import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import {
  NICKNAME_MAX,
  PROVIDER,
  PROVIDER_NAMES,
  PROVIDERS,
  REQUIRED_AGREEMENTS,
  nicknameError,
  randomNickname,
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

// 체크 상자. 글자까지 눌러서 켜고 끈다
function Check({
  checked,
  onPress,
  label,
  tag,
  sub,
  bold = false,
  right,
}: {
  checked: boolean;
  onPress: () => void;
  label: string;
  // 필수·선택 표시
  tag?: "필수" | "선택";
  sub?: string;
  bold?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <View style={[s.between, { minHeight: 52 }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        // 웹(react-native-web)은 accessibilityState.checked를 aria-checked로 옮기지 않아 따로 준다
        aria-checked={checked}
        accessibilityLabel={tag ? `[${tag}] ${label}` : label}
        onPress={onPress}
        style={[
          s.row,
          { flex: 1, paddingVertical: 10, gap: 12, alignItems: "flex-start" },
        ]}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            borderWidth: checked ? 0 : 1.5,
            borderColor: C.disabled,
            backgroundColor: checked ? C.primary : C.surface,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {checked && <Icon name="check" size={16} color={C.surface} />}
        </View>
        <View style={{ flexShrink: 1, gap: 2 }}>
          <T bold={bold} size={bold ? 17 : 16}>
            {tag && (
              <T bold size={15} color={tag === "필수" ? C.greenInk : C.light}>
                {tag}{" "}
              </T>
            )}
            {label}
          </T>
          {sub && (
            <T size={13} color={C.light}>
              {sub}
            </T>
          )}
        </View>
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
      accessibilityLabel={p.label}
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
          {/* 로고는 왼쪽 끝, 글자는 가운데 */}
          <View style={{ position: "absolute", left: 18 }}>
            <ProviderLogo provider={provider} />
          </View>
          <T bold size={17} color={p.ink}>
            {p.label}
          </T>
        </>
      )}
    </Pressable>
  );
}

// 소셜 로그인 버튼 묶음. 로그인 화면과 로그인 안내 시트가 같이 쓴다.
// 실패하면 onError(제공자), 사용자가 취소했으면 아무 안내 없이 그대로 둔다(시안 A5).
// 진행 중에 화면을 닫았으면(로그인 없이 둘러보기 포함) 늦게 온 결과는 버린다
function useSignIn(
  auth: AuthApi,
  onSession: (session: Session) => void,
  onSignup: (r: Extract<SignInResult, { kind: "signup" }>) => void,
) {
  const [busy, setBusy] = useState<Provider | null>(null);
  const [failed, setFailed] = useState<{
    provider?: Provider;
    message?: string;
  } | null>(null);
  const open = useRef(true);
  useEffect(() => {
    open.current = true;
    return () => {
      open.current = false;
    };
  }, []);
  const start = (provider: Provider) => {
    setBusy(provider);
    setFailed(null);
    auth
      .signIn(provider)
      .then((r) => {
        if (!open.current) return;
        if (r.kind === "session") onSession(r.session);
        else onSignup(r);
      })
      .catch((e) => {
        if (!open.current || e?.code === "CANCELLED") return;
        // "준비 중" 같은 안내는 문구 그대로, 그 밖의 실패는 시안의 실패 안내로
        setFailed(
          e?.code === "SOURCE_UNAVAILABLE" || e?.code === "NOT_SUPPORTED"
            ? { message: e.message }
            : { provider },
        );
      })
      .finally(() => open.current && setBusy(null));
  };
  return { busy, failed, setFailed, start };
}

function ProviderButtons({
  busy,
  onStart,
}: {
  busy: Provider | null;
  onStart: (p: Provider) => void;
}) {
  return (
    <View style={{ gap: 12 }}>
      {PROVIDERS.map((p) => (
        <ProviderButton
          key={p}
          provider={p}
          busy={busy === p}
          disabled={busy !== null}
          onPress={() => onStart(p)}
        />
      ))}
    </View>
  );
}

// 로그인 실패 안내(시안 A5)
export function SignInFailed({
  provider,
  message,
}: {
  provider?: Provider;
  message?: string;
}) {
  return (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: "row",
        gap: 10,
        padding: 14,
        borderRadius: 12,
        backgroundColor: C.bg2,
      }}
    >
      <Icon name="info" size={20} color={C.brownInk} />
      <View style={{ flex: 1, gap: 4 }}>
        <T bold size={15}>
          {message ??
            `${provider ? `${PROVIDER[provider].name} ` : ""}로그인을 마치지 못했어요`}
        </T>
        {!message && (
          <T size={14} color={C.muted}>
            잠시 후 다시 시도해 주세요. 계속 안 되면 다른 계정으로 시작할 수
            있어요.
          </T>
        )}
      </View>
    </View>
  );
}

// 로그인(시안 A2). 카카오·네이버·구글 중 하나로 들어오고, 처음이면 onSignup으로 약관 동의에 넘긴다
export function LoginScreen({
  auth,
  onBack,
  onSession,
  onSignup,
  initialError,
}: {
  auth: AuthApi;
  onBack: () => void;
  onSession: (session: Session) => void;
  onSignup: (r: Extract<SignInResult, { kind: "signup" }>) => void;
  // 웹 리다이렉트 로그인이 돌아와서 실패했을 때
  initialError?: string;
}) {
  const { busy, failed, start } = useSignIn(auth, onSession, onSignup);
  // 웹 리다이렉트 실패 안내는 다시 시도하면 지운다
  const [retried, setRetried] = useState(false);
  const shown =
    failed ?? (initialError && !retried ? { message: initialError } : null);
  return (
    <View style={s.screen}>
      <View style={{ paddingHorizontal: 8, paddingTop: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="닫기"
          onPress={onBack}
          hitSlop={8}
          style={{ padding: 10, alignSelf: "flex-start" }}
        >
          <Icon name="close" color={C.muted} />
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: 24,
          paddingTop: 4,
          gap: 12,
          maxWidth: 480,
          width: "100%",
          alignSelf: "center",
        }}
      >
        {shown && <SignInFailed {...shown} />}
        <View
          style={{
            flex: 1,
            minHeight: 260,
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <Brand size={104} />
          <T size={30} bold color={C.brown} accessibilityRole="header">
            가지가지
          </T>
          <T color={C.muted}>부산 실거래가 · 토지 지도</T>
        </View>
        <ProviderButtons
          busy={busy}
          onStart={(p) => {
            setRetried(true);
            start(p);
          }}
        />
        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          style={{
            alignSelf: "center",
            paddingVertical: 12,
            paddingHorizontal: 16,
          }}
        >
          <T size={15} color={C.muted}>
            로그인 없이 둘러보기
          </T>
        </Pressable>
        <T size={13} color={C.light} style={{ textAlign: "center" }}>
          처음이면 다음 화면에서 약관을 확인하고 가입해요.{"\n"}이메일 가입은
          없어요.
        </T>
        {auth.source === "sample" && (
          <T size={13} color={C.light} style={{ textAlign: "center" }}>
            {SAMPLE_NOTICE}
          </T>
        )}
      </ScrollView>
    </View>
  );
}

// 로그인 안내 시트(시안 A1). 로그인이 필요한 동작(관심 등록·문의하기)을 누르면 지도 위에 띄운다
export function LoginSheet({
  auth,
  title,
  message,
  onClose,
  onSession,
  onSignup,
}: {
  auth: AuthApi;
  title: string;
  message: string;
  onClose: () => void;
  onSession: (session: Session) => void;
  onSignup: (r: Extract<SignInResult, { kind: "signup" }>) => void;
}) {
  const { busy, failed, start } = useSignIn(auth, onSession, onSignup);
  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        justifyContent: "flex-end",
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="닫기"
        onPress={onClose}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          backgroundColor: "rgba(17,17,16,0.35)",
        }}
      />
      <View
        accessibilityViewIsModal
        style={{
          backgroundColor: C.surface,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: 22,
          paddingTop: 10,
          gap: 12,
          width: "100%",
          maxWidth: 520,
          alignSelf: "center",
        }}
      >
        <View
          style={{
            alignSelf: "center",
            width: 40,
            height: 4,
            borderRadius: 2,
            backgroundColor: C.rule,
            marginBottom: 8,
          }}
        />
        <T size={21} bold accessibilityRole="header">
          {title}
        </T>
        <T color={C.muted} style={{ marginBottom: 6 }}>
          {message}
        </T>
        {failed && <SignInFailed {...failed} />}
        <ProviderButtons busy={busy} onStart={start} />
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={{
            alignSelf: "center",
            paddingVertical: 12,
            paddingHorizontal: 16,
          }}
        >
          <T size={15} color={C.muted}>
            나중에 할게요
          </T>
        </Pressable>
      </View>
    </View>
  );
}

const AGREEMENT_ROWS: {
  key: keyof Agreements;
  tag: "필수" | "선택";
  label: string;
  sub?: string;
  terms?: TermKind;
}[] = [
  { key: "terms", tag: "필수", label: "이용약관", terms: "서비스 이용약관" },
  {
    key: "privacy",
    tag: "필수",
    label: "개인정보 수집 · 이용",
    terms: "개인정보 처리방침",
  },
  // 시안에는 없지만 서버가 필수로 받는다(만 14세 미만은 법정대리인 동의가 필요)
  { key: "age14", tag: "필수", label: "만 14세 이상이에요" },
  {
    key: "location",
    tag: "선택",
    label: "위치기반 서비스 이용약관",
    sub: "지도에서 내 위치를 쓸 때 필요해요",
    terms: "위치기반서비스 이용약관",
  },
  {
    key: "marketing",
    tag: "선택",
    label: "광고성 알림 받기",
    sub: "밤 9시~아침 8시 알림은 따로 여쭤봐요",
  },
];
const NONE: Agreements = {
  terms: false,
  privacy: false,
  age14: false,
  marketing: false,
  location: false,
};

// 약관 동의 · 처음 가입(시안 A3). 처음 로그인한 사람만 온다. 닉네임은 자동으로 만들고 내 정보에서 바꾼다
export function SignupScreen({
  auth,
  signup,
  onBack,
  onSession,
  onExpired,
}: {
  auth: AuthApi;
  signup: Extract<SignInResult, { kind: "signup" }>;
  onBack: () => void;
  onSession: (session: Session) => void;
  // 가입 토큰(10분, 1회용)이 만료됐을 때. 로그인부터 다시 하게 한다
  onExpired?: () => void;
}) {
  const [nickname] = useState(() => randomNickname());
  const [agree, setAgree] = useState<Agreements>(NONE);
  const [viewing, setViewing] = useState<TermKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const all = AGREEMENT_ROWS.every((r) => agree[r.key]);
  const ready = REQUIRED_AGREEMENTS.every((k) => agree[k]);
  if (viewing)
    return <TermsScreen kind={viewing} onBack={() => setViewing(null)} />;
  const submit = () => {
    setBusy(true);
    setError("");
    auth
      .signUp(signup.signup_token, nickname, agree)
      .then(onSession)
      .catch((e) => {
        if (e?.code === "UNAUTHORIZED" && onExpired) return onExpired();
        setError(e?.message ?? "가입하지 못했어요. 다시 시도해 주세요");
      })
      .finally(() => setBusy(false));
  };
  return (
    <View style={s.screen}>
      <Header title="약관 동의" onBack={onBack} />
      <ScrollView
        contentContainerStyle={{
          padding: 22,
          paddingBottom: 24,
          maxWidth: 520,
          width: "100%",
          alignSelf: "center",
        }}
      >
        <T
          size={24}
          bold
          accessibilityRole="header"
          style={{ marginBottom: 18 }}
        >
          가지가지를 쓰려면{"\n"}동의가 필요해요
        </T>
        <View
          style={[
            s.card,
            { paddingVertical: 2, paddingHorizontal: 14, marginBottom: 10 },
          ]}
        >
          <Check
            bold
            label="모두 동의"
            checked={all}
            onPress={() =>
              setAgree(
                all
                  ? NONE
                  : {
                      terms: true,
                      privacy: true,
                      age14: true,
                      marketing: true,
                      location: true,
                    },
              )
            }
          />
        </View>
        {AGREEMENT_ROWS.map((r, i) => (
          <View
            key={r.key}
            style={{ borderTopWidth: i ? 1 : 0, borderColor: C.rule }}
          >
            <Check
              tag={r.tag}
              label={r.label}
              sub={r.sub}
              checked={!!agree[r.key]}
              onPress={() => setAgree((a) => ({ ...a, [r.key]: !a[r.key] }))}
              right={
                r.terms && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${r.terms} 보기`}
                    onPress={() => setViewing(r.terms!)}
                    style={[s.row, { gap: 0, padding: 8 }]}
                  >
                    <T size={14} color={C.light}>
                      보기
                    </T>
                    <Icon name="right" size={14} color={C.light} />
                  </Pressable>
                )
              }
            />
          </View>
        ))}
        {error !== "" && (
          <T
            color={C.brown}
            accessibilityRole="alert"
            style={{ marginTop: 12 }}
          >
            {error}
          </T>
        )}
      </ScrollView>
      <View
        style={{
          padding: 22,
          paddingTop: 8,
          maxWidth: 520,
          width: "100%",
          alignSelf: "center",
        }}
      >
        <Btn disabled={!ready || busy} onPress={submit} style={{ height: 54 }}>
          {busy ? "가입하는 중…" : "동의하고 시작하기"}
        </Btn>
      </View>
    </View>
  );
}

// 가입 완료(시안 A4). 자동으로 만든 닉네임을 알려 주고, 들어온 화면으로 돌아간다
export function SignupDoneScreen({
  user,
  onDone,
}: {
  user: User;
  onDone: () => void;
}) {
  return (
    <View style={s.screen}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: 22,
          paddingTop: 56,
          gap: 16,
          maxWidth: 520,
          width: "100%",
          alignSelf: "center",
        }}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: C.greenWash,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="check" size={28} color={C.primary} />
        </View>
        <T size={26} bold accessibilityRole="header">
          가입했어요
        </T>
        <View style={[s.card, { padding: 16, gap: 4 }]}>
          <T size={13} color={C.light}>
            내 닉네임
          </T>
          <T size={20} bold>
            {user.nickname}
          </T>
          <T size={14} color={C.muted}>
            매물 · 채팅에서 다른 사람에게 보이는 이름이에요. 더보기 › 내
            정보에서 바꿀 수 있어요.
          </T>
        </View>
      </ScrollView>
      <View
        style={{
          padding: 22,
          paddingTop: 8,
          maxWidth: 520,
          width: "100%",
          alignSelf: "center",
        }}
      >
        <Btn onPress={onDone} style={{ height: 54 }}>
          돌아가기
        </Btn>
      </View>
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
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: 40,
          maxWidth: 560,
          width: "100%",
          alignSelf: "center",
        }}
      >
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
              style={[
                s.input,
                { flex: 1, fontSize: 16, height: 48 },
                nameError ? { borderColor: C.brown } : null,
              ]}
            />
            <Btn
              small
              disabled={!changed || !!nameError || saving}
              onPress={save}
              style={{ height: 48 }}
            >
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
            이벤트·혜택 알림:{" "}
            {user.marketing_push ? "받기로 했어요" : "받지 않아요"}
          </T>
        </Section>
        {error !== "" && <T color={C.brown}>{error}</T>}
        <Btn
          secondary
          disabled={busy !== null}
          onPress={() => leave("logout")}
          style={{ marginTop: 12, height: 50 }}
        >
          {busy === "logout" ? "로그아웃하는 중…" : "로그아웃"}
        </Btn>
        {!leaving ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setLeaving(true)}
            style={{ alignSelf: "center", padding: 16, marginTop: 8 }}
          >
            <T
              size={15}
              color={C.light}
              style={{ textDecorationLine: "underline" }}
            >
              회원 탈퇴
            </T>
          </Pressable>
        ) : (
          <View
            style={[s.card, { marginTop: 20, gap: 10, borderColor: C.brown }]}
          >
            <T size={18} bold>
              정말 탈퇴할까요?
            </T>
            <T size={15} color={C.ink2}>
              · 닉네임과 소셜 계정 정보는 바로 지워져요{"\n"}· 관심 단지·학습
              기록은 계정에서 사라져요{"\n"}· 매물 문의 채팅에서는 "탈퇴한
              사용자"로 보여요{"\n"}· 같은 계정으로 다시 가입할 수 있지만 지금
              기록과 이어지지 않아요
            </T>
            <Check
              label="안내를 확인했어요"
              checked={understood}
              onPress={() => setUnderstood((v) => !v)}
            />
            <View style={s.row}>
              <Btn
                secondary
                onPress={() => {
                  setLeaving(false);
                  setUnderstood(false);
                }}
                style={{ flex: 1 }}
              >
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
          <T
            size={13}
            color={C.light}
            style={{ marginTop: 16, textAlign: "center" }}
          >
            {SAMPLE_NOTICE}
          </T>
        )}
      </ScrollView>
    </View>
  );
}
