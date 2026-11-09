#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""用 Python 标准库生成 MultiChat 桌面图标（不依赖 Pillow）。

图案照 frontend/src/components/BrandMark.tsx 与 frontend/dist/icon.svg：
  - 品牌蓝 #3b6cf6
  - 两条半径 11 的圆弧（上弧 ∩、下弧 ∪），描边宽 3.1、圆头线帽
  - 中心实心圆核 (18, 18) r=4.3
  - viewBox 36x36，透明背景

产物写入 desktop/src-tauri/icons/：
  32x32.png、128x128.png、128x128@2x.png（即 256x256）
  icon.ico  —— ICO 容器内嵌 16/32/48/256 的 PNG
  icon.icns —— ICNS 容器，PNG 条目 16/32/64/128/256/512

用法：
  python  desktop/scripts/gen_icons.py      # Windows / 已把 Python 命名为 python 的系统
  python3 desktop/scripts/gen_icons.py      # macOS / Linux
"""

from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path

# ── 品牌几何（36x36 viewBox 坐标系，y 轴向下，与 SVG 一致） ──────────
BRAND_RGB = (0x3B, 0x6C, 0xF6)
R = 11.0                          # 圆弧半径
HALF_W = 3.1 / 2.0                # 描边半宽
CORE_R = 4.3                      # 中心圆核半径
CORE_C = (18.0, 18.0)

# 由 SVG 路径 "M7.5 15.5 a11 11 0 0 1 21 0" 推得圆心 / 角度范围。
CHORD_HALF = 21.0 / 2.0
H = math.sqrt(R * R - CHORD_HALF * CHORD_HALF)  # 圆心到弦的距离 ≈ 3.279

UP_C = (18.0, 15.5 + H)                          # 上弧圆心（位于弦下方）
UP_A0 = math.atan2(15.5 - UP_C[1], 7.5 - 18.0)  # 起点 (7.5, 15.5) 的极角 ≈ -2.84
UP_A1 = math.atan2(15.5 - UP_C[1], 28.5 - 18.0) # 终点 (28.5, 15.5) 的极角 ≈ -0.30
UP_P0 = (7.5, 15.5)
UP_P1 = (28.5, 15.5)

DN_C = (18.0, 20.5 - H)                          # 下弧圆心（位于弦上方）
DN_A0 = math.atan2(20.5 - DN_C[1], 28.5 - 18.0) # 起点 (28.5, 20.5) 的极角 ≈ 0.30
DN_A1 = math.atan2(20.5 - DN_C[1], 7.5 - 18.0)  # 终点 (7.5, 20.5) 的极角 ≈ 2.84
DN_P0 = (28.5, 20.5)
DN_P1 = (7.5, 20.5)


def _arc_distance(x, y, cx, cy, a0, a1, p0, p1):
    """点到「描边圆弧」的有向距离（减 HALF_W 后，<=0 即在笔画内）。"""
    dx, dy = x - cx, y - cy
    ang = math.atan2(dy, dx)
    if a0 <= ang <= a1:
        # 极角落在弧上：距离 = 到圆周的径向距离（圆头线帽由端点距离补充）
        d = abs(math.hypot(dx, dy) - R)
    else:
        d = min(
            math.hypot(x - p0[0], y - p0[1]),
            math.hypot(x - p1[0], y - p1[1]),
        )
    return d - HALF_W


def _signed_distance(x, y):
    """到整个图案边界的有向距离（负=内部）；取三部分最小值即并集。"""
    # 图案大致落在 [6, 30] x [6, 30]，远离的像素直接给大正数，省算力。
    if x < 4.0 or x > 32.0 or y < 4.0 or y > 32.0:
        return 1e9
    d_up = _arc_distance(x, y, UP_C[0], UP_C[1], UP_A0, UP_A1, UP_P0, UP_P1)
    d_dn = _arc_distance(x, y, DN_C[0], DN_C[1], DN_A0, DN_A1, DN_P0, DN_P1)
    d_core = math.hypot(x - CORE_C[0], y - CORE_C[1]) - CORE_R
    return min(d_up, d_dn, d_core)


def render_rgba(size):
    """把 36 单位的图案光栅化为 size×size 的 RGBA 字节流（线性抗锯齿）。"""
    pw = 36.0 / size   # 一个像素在 36 单位坐标系里的宽度
    half = pw / 2.0
    r, g, b = BRAND_RGB
    out = bytearray()
    for py in range(size):
        y = (py + 0.5) * pw
        for px in range(size):
            x = (px + 0.5) * pw
            d = _signed_distance(x, y)
            cov = (half - d) / pw  # 距离 ±half 内做线性过渡
            if cov <= 0.0:
                a = 0
            elif cov >= 1.0:
                a = 255
            else:
                a = int(cov * 255 + 0.5)
            out += bytes((r, g, b, a))
    return bytes(out)


# ── PNG 编码（仅用 struct / zlib） ──────────────────────────────────
def _png_chunk(tag, data):
    crc = zlib.crc32(tag + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)


def make_png(size):
    pixels = render_rgba(size)
    stride = size * 4
    raw = bytearray()
    for y in range(size):
        raw.append(0)  # filter type: None
        raw += pixels[y * stride : (y + 1) * stride]
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)  # 8bit RGBA
    return (
        b"\x89PNG\r\n\x1a\n"
        + _png_chunk(b"IHDR", ihdr)
        + _png_chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + _png_chunk(b"IEND", b"")
    )


# ── ICO 容器（内嵌 PNG） ───────────────────────────────────────────
def make_ico(sizes, pngs):
    """sizes: 尺寸列表；pngs: {尺寸: PNG 字节}。"""
    header = struct.pack("<HHH", 0, 1, len(sizes))  # reserved, type=1(icon), count
    offset = 6 + 16 * len(sizes)
    entries = bytearray()
    blobs = bytearray()
    for s in sizes:
        data = pngs[s]
        # ICO 目录项里 0 表示 256
        w = 0 if s >= 256 else s
        h = 0 if s >= 256 else s
        # B B B B H H I I = width,height,colorCount,reserved,planes,bitCount,size,offset
        entries += struct.pack("<BBBBHHII", w, h, 0, 0, 1, 32, len(data), offset)
        blobs += data
        offset += len(data)
    return header + bytes(entries) + bytes(blobs)


# ── ICNS 容器（PNG 条目，现代 macOS 支持 PNG 编码的 icp*/ic0* 类型） ──
ICNS_TYPES = [
    (b"icp4", 16),
    (b"icp5", 32),
    (b"icp6", 64),
    (b"ic07", 128),
    (b"ic08", 256),
    (b"ic09", 512),
]


def make_icns(pngs):
    body = bytearray()
    for tag, size in ICNS_TYPES:
        data = pngs[size]
        body += tag + struct.pack(">I", 8 + len(data)) + data
    return b"icns" + struct.pack(">I", 8 + len(body)) + bytes(body)


def main():
    here = Path(__file__).resolve().parent
    out_dir = here.parent / "src-tauri" / "icons"
    out_dir.mkdir(parents=True, exist_ok=True)
    print(f"输出目录：{out_dir}")

    # ICO / ICNS / 独立 PNG 需要的全部尺寸
    all_sizes = sorted({16, 32, 48, 64, 128, 256, 512})
    pngs = {}
    for s in all_sizes:
        pngs[s] = make_png(s)
        print(f"  渲染 {s}x{s} → {len(pngs[s])} 字节 PNG")

    for name, s in {
        "32x32.png": 32,
        "128x128.png": 128,
        "128x128@2x.png": 256,
    }.items():
        (out_dir / name).write_bytes(pngs[s])
        print(f"  写出 {name}")

    ico = make_ico([16, 32, 48, 256], pngs)
    (out_dir / "icon.ico").write_bytes(ico)
    print(f"  写出 icon.ico（{len([16, 32, 48, 256])} 个尺寸，{len(ico)} 字节）")

    icns = make_icns(pngs)
    (out_dir / "icon.icns").write_bytes(icns)
    print(f"  写出 icon.icns（{len(ICNS_TYPES)} 个尺寸，{len(icns)} 字节）")

    print("完成。")


if __name__ == "__main__":
    main()
