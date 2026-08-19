// ── 跨路由共享的纯函数工具 ──────────────────────────────────────────────
// 从资产对象中剔除 content 字段，仅保留元数据（避免列表接口返回大正文）
export function assetMeta<T extends { content?: unknown }>(asset: T | null | undefined) {
  if (!asset) return asset;
  const { content: _content, ...meta } = asset;
  return meta;
}
