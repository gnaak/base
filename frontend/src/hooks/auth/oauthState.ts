/**
 * OAuth `state` — 로그인 CSRF 를 막는다.
 *
 * state 가 없으면 공격자가 자기 계정으로 받은 code 를 `/kakao/login?code=…` 링크로 피해자에게 보내,
 * 피해자를 **공격자 계정으로 로그인**시킬 수 있다 (그 뒤 피해자가 입력하는 정보는 공격자 계정으로 간다).
 *
 * 로그인 버튼이 무작위 값을 만들어 sessionStorage 에 두고 인가 URL 의 state 로 보낸다.
 * 콜백은 돌아온 state 가 저장해 둔 값과 같을 때만 code 를 백엔드로 보낸다. 한 번 쓰면 지운다.
 * 로그인 뒤 돌아갈 경로(next)도 state 에 싣지 않고 여기 같이 둔다 — URL 로 조작할 수 없게.
 */

export type OAuthProvider = "google" | "kakao";

const STORAGE_KEY = "oauth_state";
const MAX_AGE_MS = 10 * 60 * 1000; // 인가 화면에서 10분 넘게 머무르면 다시 시작

interface SavedState {
  nonce: string;
  provider: OAuthProvider;
  next: string | null;
  createdAt: number;
}

/**
 * 같은 오리진의 경로만 허용한다. `//evil.com`·`/\evil.com` 은 브라우저가 다른 사이트로 해석한다.
 */
export const safeNext = (next: string | null | undefined): string | null => {
  if (!next || !next.startsWith("/")) return null;
  if (next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
};

const randomNonce = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

/** 로그인 버튼에서 부른다. 인가 URL 의 `state` 로 보낼 값을 돌려준다. */
export const beginOAuth = (provider: OAuthProvider, next?: string | null): string => {
  const saved: SavedState = { nonce: randomNonce(), provider, next: safeNext(next), createdAt: Date.now() };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  return saved.nonce;
};

export type ConsumeResult = { ok: true; next: string | null } | { ok: false };

/**
 * 콜백에서 부른다. 저장해 둔 state 와 같으면 ok. **결과와 상관없이 저장값을 지운다** (한 번만 쓸 수 있게).
 */
export const consumeOAuthState = (provider: OAuthProvider, returned: string | null): ConsumeResult => {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
  if (!raw || !returned) return { ok: false };

  let saved: SavedState;
  try {
    saved = JSON.parse(raw) as SavedState;
  } catch {
    return { ok: false };
  }

  const fresh = Date.now() - saved.createdAt <= MAX_AGE_MS;
  if (saved.provider !== provider || saved.nonce !== returned || !fresh) return { ok: false };
  return { ok: true, next: safeNext(saved.next) };
};
