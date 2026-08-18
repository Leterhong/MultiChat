'use strict';
// ── 跨路由共享的纯函数工具 ──────────────────────────────────────────────
// 从资产对象中剔除 content 字段，仅保留元数据（避免列表接口返回大正文）
function assetMeta(asset) {
  if (!asset) return asset;
  const { content: _content, ...meta } = asset;
  return meta;
}

module.exports = { assetMeta };
