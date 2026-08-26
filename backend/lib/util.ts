// ── 跨路由共享的纯函数工具 ──────────────────────────────────────────────
// 从资产对象中剔除 content 字段，仅保留元数据（避免列表接口返回大正文）
export function assetMeta<T extends { content?: unknown }>(asset: T | null | undefined) {
  if (!asset) return asset;
  const { content: _content, ...meta } = asset;
  return meta;
}

export async function readResponseText(response: Response, maxBytes = 2_000_000): Promise<string> {
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > maxBytes) throw new Error(`response exceeds ${maxBytes} bytes`);
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0, output = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) { await reader.cancel(); throw new Error(`response exceeds ${maxBytes} bytes`); }
    output += decoder.decode(value, { stream: true });
  }
  return output + decoder.decode();
}

export async function readResponseJson(response: Response, maxBytes = 2_000_000) {
  const text = await readResponseText(response, maxBytes);
  return JSON.parse(text);
}
