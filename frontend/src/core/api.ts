// 统一 API 客户端：相对 apiBase 发起 fetch，统一错误解析。
// 依赖 state（读取 apiBase），单向依赖，无循环。
import { state } from './state';

const LEGACY_SERVER_TOKEN_KEY = 'multichat_server_token';
const SERVER_TOKEN_PREFIX = 'multichat_server_token:';
// 自动令牌只存活于当前标签页会话，不写 localStorage，降低同源脚本长期读取风险。
// 按目标 API origin 分键，避免把 A 服务的令牌发给 B 服务。
const SESSION_TOKEN_KEY = 'multichat_session_token';

function apiOrigin() {
  try {
    return new URL(state.apiBase || location.origin, location.href).origin;
  } catch {
    return location.origin;
  }
}

export function serverTokenStorageKey() {
  return SERVER_TOKEN_PREFIX + apiOrigin();
}

function sessionTokenKey() {
  return `${SESSION_TOKEN_KEY}:${apiOrigin()}`;
}

function readSessionToken() {
  try {
    return sessionStorage.getItem(sessionTokenKey()) || '';
  } catch {
    return '';
  }
}

// 引导端点固定打本机回环（?api= 已由 state.ts 白名单限制），
// 绝不把令牌请求发往外部域名。
function sessionEndpoint() {
  const raw = String(state.apiBase || '').trim();
  if (!raw) return '/api/session';
  try {
    const url = new URL(raw, location.href);
    if (!['127.0.0.1', 'localhost', '[::1]', '::1'].includes(url.hostname)) return '/api/session';
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}/api/session`;
  } catch {
    return '/api/session';
  }
}

export function getServerToken() {
  const key = serverTokenStorageKey();
  const scoped = localStorage.getItem(key);
  if (scoped !== null) return scoped;

  // 旧版令牌只允许迁移给承载当前页面的同源服务，避免 ?api=… 把令牌
  // 自动发送到另一个本地端口或第三方地址。
  if (apiOrigin() === location.origin) {
    const legacy = localStorage.getItem(LEGACY_SERVER_TOKEN_KEY) || '';
    if (legacy) {
      localStorage.setItem(key, legacy);
      localStorage.removeItem(LEGACY_SERVER_TOKEN_KEY);
    }
    if (legacy) return legacy;
    return readSessionToken();
  }
  // ?api= 只允许本机回环地址，按目标源分键的自动令牌不会外发到第三方。
  return readSessionToken();
}

export function setServerToken(value: string) {
  const key = serverTokenStorageKey();
  const token = value.trim();
  if (token) localStorage.setItem(key, token);
  else localStorage.removeItem(key);
}

export function serverAuthHeaders() {
  const token = getServerToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

let sessionBootstrap: Promise<string> | null = null;

/**
 * 领取服务端自动生成的访问令牌。请求固定打当前页面同源（相对路径），
 * 不受 ?api= 覆盖影响；后端还会再校验 Host、Origin 与 Sec-Fetch-Site。
 */
export async function bootstrapServerSession(): Promise<string> {
  if (sessionBootstrap) return sessionBootstrap;
  sessionBootstrap = (async () => {
    try {
      const res = await fetch(sessionEndpoint(), { credentials: 'same-origin', cache: 'no-store' });
      if (!res.ok) return '';
      const data = await res.json();
      const token = typeof data?.token === 'string' && data.mode === 'auto' ? data.token : '';
      if (token) sessionStorage.setItem(sessionTokenKey(), token);
      return token;
    } catch {
      return '';
    } finally {
      sessionBootstrap = null;
    }
  })();
  return sessionBootstrap;
}

export async function api(path: any, opts: any = {}) {
  const send = () => {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, serverAuthHeaders(), opts.headers || {});
    return fetch(state.apiBase + path, { ...opts, headers });
  };
  let res = await send();
  // 服务重启后自动令牌会变化：401 时重新引导一次再重试，避免整页刷新。
  if (res.status === 401 && !opts._mcRetried) {
    await bootstrapServerSession();
    res = await send();
  }
  const ct = res.headers.get('content-type') || '';
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    let code;
    let requestId;
    try {
      const j = await res.json();
      msg = typeof j?.error === 'string' ? j.error : (j?.error?.message || j?.message || msg);
      code = j?.code;
      requestId = j?.requestId;
    } catch {}
    const e = new Error(msg);
    (e as any).status = res.status;
    (e as any).code = code;
    (e as any).requestId = requestId;
    throw e;
  }
  if (ct.includes('application/json')) return res.json();
  return res;
}
