// 统一 API 客户端：相对 apiBase 发起 fetch，统一错误解析。
// 依赖 state（读取 apiBase），单向依赖，无循环。
import { state } from './state';

const LEGACY_SERVER_TOKEN_KEY = 'multichat_server_token';
const SERVER_TOKEN_PREFIX = 'multichat_server_token:';

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
    return legacy;
  }
  return '';
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

export async function api(path: any, opts: any = {}) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, serverAuthHeaders(), opts.headers || {});
  const res = await fetch(state.apiBase + path, { ...opts, headers });
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
