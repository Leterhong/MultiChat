'use strict';
// ── 每日自动快照：为每个项目在距上次自动快照 ≥24h 时创建一份，并只保留最近 N 份自动快照 ──
// 手动创建的项目快照永不参与清理。MULTICHAT_AUTO_SNAPSHOT=0 可整体关闭。
const ctx = require('../lib/context');
const controlPlane = require('../routes/control-plane');

const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 每 6 小时巡检一次，是否到期由 24h 阈值判断
const DUE_MS = 24 * 60 * 60 * 1000;
const KEEP = Math.max(1, Number(process.env.MULTICHAT_AUTO_SNAPSHOT_KEEP || 7));
const AUTO_TITLE_PREFIX = '自动快照 ';

function isAutomatic(row) { return row.automatic === true || String(row.title || '').startsWith(AUTO_TITLE_PREFIX); }

export function runAutoSnapshotSweep(nowMs = Date.now()) {
  if (process.env.MULTICHAT_AUTO_SNAPSHOT === '0') return { created: [], pruned: 0, disabled: true };
  const created = [];
  let pruned = 0;
  const projects = ctx.workspaceStore.projects();
  const rows = ctx.store.read('snapshots.json', []);
  for (const project of projects) {
    const autoRows = rows
      .filter(row => row.projectId === project.id && isAutomatic(row))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const newest = autoRows[0]?.createdAt ? Date.parse(autoRows[0].createdAt) : 0;
    if (Number.isFinite(newest) && nowMs - newest < DUE_MS) continue;
    try {
      const row = controlPlane.makeSnapshot(project.id, { title: AUTO_TITLE_PREFIX + new Date(nowMs).toISOString().slice(0, 10) }, true);
      created.push({ projectId: project.id, id: row.id, title: row.title });
    } catch { /* 单个项目失败（如超大文件）不阻断其他项目 */ }
  }
  if (created.length) {
    const all = ctx.store.read('snapshots.json', []);
    const keep = new Set();
    for (const project of ctx.workspaceStore.projects()) {
      all.filter(row => row.projectId === project.id && isAutomatic(row))
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, KEEP)
        .forEach(row => keep.add(row.id));
    }
    const next = all.filter(row => !isAutomatic(row) || keep.has(row.id));
    pruned = all.length - next.length;
    if (pruned > 0) ctx.store.write('snapshots.json', next);
  }
  return { created, pruned };
}

export function startAutoSnapshots() {
  if (process.env.MULTICHAT_AUTO_SNAPSHOT === '0') return;
  const boot = setTimeout(() => { try { runAutoSnapshotSweep(); } catch {} }, 2 * 60 * 1000);
  const timer = setInterval(() => { try { runAutoSnapshotSweep(); } catch {} }, SWEEP_INTERVAL_MS);
  boot.unref?.(); timer.unref?.();
}
