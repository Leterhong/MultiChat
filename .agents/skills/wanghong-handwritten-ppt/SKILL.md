---
name: wanghong-handwritten-ppt
description: 将文章、讲稿或技术主题制作成王虹学术报告气质的 16:9 Notability 手写风 HTML 幻灯片，并逐页导出 PNG。触发词：王虹PPT风格、王虹手写PPT、Notability学术手写幻灯片、手写网页PPT、手写PPT、数学家手写报告风。
---

# 王虹学术手写风 HTML 幻灯片

把内容做成一套安静、工整、逻辑清楚、信息密度高的手写学术报告。视觉上接近 Notability 数字手写页，内容上强调一页一个问题和连续推导。

## 适用场景

- 技术文章转演示文稿
- 论文、模型、工具或产品的原理讲解
- 需要 16:9 HTML 幻灯片和逐页 PNG 的任务
- 希望保留手写温度，同时要求中文清楚可读的报告

## 先读材料

1. 读取用户提供的文章、讲稿、数据和参考图。
2. 需要复用完整视觉规范或提示词时，读取 `references/style-guide.md`。
3. 需要查看成品结构时，打开 `examples/deepseek-v4-flash/index.html`。
4. 需要快速开工时，从 `templates/deck.html` 复制一份新文件。

## 完成标准

- 固定 16:9，浏览器中无滚动条和内容溢出。
- 封面保持极简，下半页至少留出一半空白。
- 正文每页回答一个清楚的问题，整套报告形成连续逻辑链。
- 字号、颜色和手绘线条统一，中文投影可读。
- 重要数字和结论同时出现在正文，手写标注只承担视觉提示。
- 支持左右键、空格翻页和全屏。
- 每页都有简短讲稿备注。
- 输出 HTML、全部 PNG 和一张总览图，并实际打开检查。

## 工作流程

### 1. 整理故事线

先从原文提取：

- 报告要回答的总问题
- 观众需要先知道的背景
- 3 到 6 个核心判断
- 支撑判断的数据、对比、流程和例子
- 最后希望观众记住的一句话

把内容拆成 12 到 24 页。推荐顺序：封面 → 变化发生了什么 → 为什么重要 → 证据与推导 → 怎么做 → 陷阱 → 结论。

不要把文章段落直接塞进页面。每页只留 3 到 6 行关键文字，复杂信息转换成图、表、坐标轴或公式。

### 2. 选择页面类型

优先使用这些版式：

- 极简封面：单行标题、细横线、作者/场合/日期、大片留白
- 左文右图：三到五行解释配一个手绘示意图
- 流程页：三个框和箭头，最重要的一步用荧光色
- 坐标页：用两个轴解释成本、质量、速度或规模
- 对比页：两列、三列或一张紧凑表格
- 结论页：公式式收束，底部一条玫红结论框
- 结束页：一句感谢和署名，保持安静

### 3. 使用固定视觉语言

- 背景：淡暖白，接近干净的数字纸张
- 主文字：深蓝黑
- 蓝色：标题下划线、坐标轴、推导主线
- 玫红：结论、警告、推荐框
- 绿色：成立条件、确认项、推荐档
- 荧光黄：极少量关键词
- 珊瑚粉：例外、损失或剩余部分

字体固定使用 `HanziPen SC`，与 `assets/preview-cover.png` 里的字形保持一致。不设置其他中文字体候选。渲染环境缺少该字体时先安装，不得带着替代字形交付。

避免圆角卡片、阴影、渐变、装饰图标、商业模板、照片背景和大面积色块。

### 4. 使用 neat-annotations

项目已在 `assets/neat-annotations.css` 中本地保存。它用手写箭头把短注释指向目标词，支持八个方向、颜色和自定义颜色。

中文可以直接写入 `data-note`。同时在页面样式里覆盖：

```css
:root {
  --ann-font: "HanziPen SC";
  --ann-label-max-width: 220px;
}
```

使用示例：

```html
<span class="ann ann-n ann-green" data-note="甜点档">Q4_K_XL</span>
```

标注采用绝对定位。给箭头和文字预留空间，避免贴近页面边缘或相互遮挡。长中文结论仍写在正文中。

### 5. 制作 HTML

从 `templates/deck.html` 开始，保留这些本地资源：

```html
<link rel="stylesheet" href="../assets/base.css">
<link rel="stylesheet" href="../assets/animations.css">
<link rel="stylesheet" href="../assets/neat-annotations.css">
<link rel="stylesheet" href="../assets/template.css">
<script src="../assets/runtime.js"></script>
```

每页使用：

```html
<section class="slide" data-title="页面名称">
  <h2 class="slide-title">这一页回答的问题</h2>
  <!-- 页面内容 -->
  <aside class="notes">演讲时补充的一到三句话。</aside>
</section>
```

图表优先用 SVG 手绘。线条使用 `stroke-linecap="round"`，适当叠加轻微位移滤镜，让直线保留手画感。

### 6. 检查与导出

先检查结构：

```bash
python3 scripts/check_deck.py /absolute/path/to/index.html
```

再逐页导出：

```bash
scripts/render.sh \
  /absolute/path/to/index.html \
  all \
  /absolute/path/to/png-output \
  /absolute/path/to/Hanzipen.ttc
```

macOS 上可先在字体册下载“翩翩体-简”。脚本会把指定字体文件直接注入临时渲染页，并在导出前确认字体加载成功。缺少该字体或加载失败时停止导出。

实际查看所有 PNG。重点检查：

- 中文是否清楚
- 标注是否遮挡正文
- 表格是否过密
- 代码和公式是否超出边界
- 结论框是否压住内容
- 每页是否仍然只讲一个问题

发现问题后修改 HTML，再重新导出。交付前至少完成一次浏览器翻页测试和一次全页总览检查。

## 输出目录建议

```text
output/<主题>-handwritten-ppt/
  index.html
  style.css
  assets/
  png/
  contact-sheet.png
  prompts.md
```

## 随附内容

- `templates/deck.html`：可直接改写的基础模板
- `assets/template.css`：通用手写风样式
- `examples/deepseek-v4-flash/`：19 页完整示例
- `references/style-guide.md`：风格拆解、GPT Image 提示词和 HTML 提示词
- `scripts/check_deck.py`：结构检查
- `scripts/render.sh`：逐页 PNG 导出
