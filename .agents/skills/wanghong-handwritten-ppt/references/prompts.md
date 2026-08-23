# 王虹学术手写 PPT：GPT Image 与 HTML 完整提示词

这套提示词用于复刻一种 16:9 的 Notability 学术报告手写页：暖白纸面、细而工整的深蓝手写字、克制的荧光标记、手绘箭头与图表，以及非常清楚的逻辑链。

## 统一风格提示词

```text
Use case: productivity-visual
Asset type: exact 16:9 technical presentation slide

Create one handwritten Chinese technical presentation slide on a flat warm off-white Notability-style digital note page. The slide should feel like a mathematician's carefully prepared conference lecture notes: calm, precise, information-dense, logically ordered, and genuinely handwritten.

Use authentic fine dark-navy digital handwriting, slightly irregular baselines, natural pen-pressure variation, thin hand-drawn boxes, arrows, axes, tables and diagrams. Keep generous outer margins. Use vivid cobalt blue only for derivation lines and axes, magenta-red for conclusions or recommendation boxes, fluorescent yellow for one short priority phrase, fluorescent green for a confirmed structure or recommended option, and coral pink for an exception or loss.

The page must be a clean flat slide, with no stage, projector, camera perspective, paper edge or photo texture. Avoid commercial presentation design: no rounded cards, no gradient, no shadow, no glossy icon, no decorative background, no brand logo, no footer, no page number, no watermark.

Render every Chinese character, Latin word and number exactly as supplied. Use small neat handwriting and thin strokes. Keep bright highlights narrow and imperfect, like a real highlighter. One slide answers one question. Preserve large empty areas where the logic does not need content.
```

## 第 1 页：封面

```text
Create an exact 16:9 handwritten Chinese presentation cover on a flat warm off-white Notability page.

Place one single-line title near the upper third in fine dark-navy handwriting. Draw one thin vivid magenta-red hand-drawn underline directly beneath it. Put the author, occasion and date as three small centered handwritten lines with generous vertical spacing. Keep the entire lower half almost empty.

Text, verbatim:
"DeepSeek-V4-Flash：极限量化与本地部署"
"AI学习的老章"
"AI 技术分享"
"August 2, 2026"

Constraints: exact text; one-line title; huge whitespace; no subtitle; no icon; no logo; no border; no shadow; no gradient; no typed font; no watermark; no extra text.
```

## 第 2 页：正式版开源

```text
Create an exact 16:9 handwritten Chinese technical slide in the same warm off-white Notability academic style.

Title at top left with a thin cobalt-blue underline:
"DeepSeek-V4-Flash 正式版开源"

Write one small sentence under the title:
"模型结构、参数规模保持不变"

In the center, draw a three-step horizontal process with thin hand-drawn boxes and cobalt arrows:
"Preview" → "重新后训练" → "正式版"

Highlight "重新后训练" with one narrow fluorescent-yellow marker stroke. Highlight "正式版" with fluorescent green. Under the middle box, write three short stacked notes:
"回答问题"
"调用工具"
"完成任务"

Near the bottom, draw one thin magenta-red conclusion box containing:
"多项基准超过 V4-Pro Preview"

Keep the slide quiet and sparse. Use fine dark-navy handwriting, thin hand-drawn arrows, no extra decoration and no extra text.
```

## 第 3 页：成本—智能斩杀线

```text
Create an exact 16:9 handwritten Chinese technical slide in a clean Notability academic lecture style.

Title at top left with a thin cobalt-blue underline:
"理想模型，应该站在左上角"

On the left, write three lines:
"横轴：完成一次任务的成本"
"纵轴：模型的智能得分"
"越往左越便宜，越往上越聪明"

Highlight the word "成本" with coral pink and the phrase "智能得分" with fluorescent green.

On the right, draw a hand-drawn scatter chart. The horizontal axis points right and is labeled "任务成本". The vertical axis points up and is labeled "智能得分". Place a magenta dot near the upper-left and label it "DeepSeek-V4-Flash". Add a small curved magenta arrow pointing toward this dot and write "DeepSeek 斩杀线". Place one blue dot around the middle-right labeled "模型 A" and one green dot near the lower-right labeled "模型 B".

At the bottom left, add a thin magenta conclusion box:
"左上角 = 低成本 + 高能力"

Use thin dark-navy handwriting and simple hand-drawn geometry. No extra text, no commercial chart styling, no grid background.
```

## 第 4 页：本地部署门槛

```text
Create an exact 16:9 handwritten Chinese technical slide in a warm off-white Notability academic style.

Title at top left with a thin cobalt-blue underline:
"本地部署门槛，终于降下来了"

Across the upper-middle, place three large handwritten facts with small labels underneath:
"304B" / "参数规模"
"原生 8-bit" / "官方精度"
"167GB" / "模型文件"

Highlight "原生 8-bit" with fluorescent green and "167GB" with fluorescent yellow. Keep "304B" plain dark navy.

On the right, draw a simple hand-drawn rounded boundary labeled "本地". Inside it, draw a tiny server tower. Add "CPU →" on the left, "↔ SSD" on the right, and a two-way arrow to "内存 (RAM)" below.

Under the three facts, write:
"企业最关心：能力、成本、数据"

Near the bottom center, draw one thin magenta conclusion box:
"本地可控"

Use fine dark-navy handwriting, thin cobalt lines and very large whitespace. No icon set, no cards, no shadow, no extra text.
```

## 从文章继续生成后续页面

```text
Continue the same exact 16:9 handwritten Notability academic slide system for every remaining page.

For each page:
1. Answer one clear question.
2. Use 3 to 6 short handwritten lines, or one diagram/table plus a short explanation.
3. Put the causal chain in visible reading order from left to right or top to bottom.
4. Use only one main diagram type: flow, coordinate chart, comparison table, memory scale, architecture sketch, command block or summary formula.
5. Use yellow and green highlights only on short phrases. Use one magenta conclusion box at most.
6. Preserve the same handwriting scale, line weight, warm off-white background, outer margins and color meanings.
7. Render all supplied text verbatim and add no new claims.

Constraints: no commercial template, no large decorative title, no gradients, no shadows, no icons, no photos, no page number, no watermark, no extra text.
```

## HTML 完整实现提示词

```text
请把提供的中文文章制作成一套完整的 16:9 HTML 幻灯片，视觉参考 Notability 制作的数学学术报告手写页。

内容组织：
- 先提炼一个总问题、3 到 6 个核心判断，以及支撑判断的数据、流程、例子和陷阱。
- 拆成 12 到 24 页，每页只回答一个问题。
- 推荐结构：封面 → 变化发生了什么 → 为什么重要 → 证据与推导 → 怎么做 → 选择与陷阱 → 总结 → 结束。
- 每页只保留投影需要的关键词，其余解释写入隐藏的演讲备注。

视觉系统：
1. 画布固定 1920×1080 和 16:9，背景使用淡暖白。没有页眉、页脚、页码、品牌装饰和卡片阴影。
2. 中文、英文与数字固定使用 HanziPen SC，字形必须与 `assets/preview-cover.png` 一致。
3. 主文字用深蓝色。蓝色用于推导线和坐标轴，玫红用于结论框和推荐项，绿色用于已确认结构，荧光黄用于极少量关键词，珊瑚粉用于例外或剩余部分。
4. 框、线、箭头和坐标轴保留轻微手画抖动。关键词高亮只覆盖文字本身。
5. 禁止圆角卡片、渐变、阴影、照片背景、装饰图标、粗大数字墙和统一商业网格。

封面：
- 单行标题位于画面上方约三分之一。
- 标题下方画一条细玫红横线。
- 作者、场合和日期分三行居中。
- 下半页保持大面积留白。

正文：
- 优先使用左文右图、流程、坐标轴、对比表、公式总结。
- 标题比正文大一档，正文保持小而清楚。
- 结论使用 2px 到 3px 的玫红细框。
- SVG 图表线条使用圆头，并加入极轻微位移滤镜。

使用 neat-annotations：
- 本地引入 neat-annotations.css。
- 中文可以直接写入 data-note，例如 data-note="甜点档"。
- 将 --ann-font 固定为 HanziPen SC，--ann-label-max-width 设置为 180px 到 240px。
- 标注采用绝对定位，因此在目标内容四周预留空间。
- 重要信息同时写在正文中，标注只做视觉提示。

交互与导出：
- 支持左右键、空格翻页和全屏。
- 每页写一段隐藏讲稿备注。
- 逐页导出为 1920×1080 PNG。
- 用浏览器检查全部页面的中文、溢出、遮挡、翻页和 16:9 比例。
- 生成一张全部页面的总览图，人工检查整套风格是否统一。
```
