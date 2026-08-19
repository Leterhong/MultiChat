// 统一 API 客户端：相对 apiBase 发起 fetch，统一错误解析。
// 依赖 state（读取 apiBase），单向依赖，无循环。
import { state } from './state';

export async function api(path: any, opts: any = {}) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
  const res = await fetch(state.apiBase + path, { ...opts, headers });
  const ct = res.headers.get('content-type') || '';
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j?.error?.message || j?.message || msg;
    } catch {}
    const e = new Error(msg);
    (e as any).status = res.status;
    throw e;
  }
  if (ct.includes('application/json')) return res.json();
  return res;
}
