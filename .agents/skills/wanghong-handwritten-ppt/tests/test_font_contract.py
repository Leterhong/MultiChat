#!/usr/bin/env python3
from __future__ import annotations

import unittest
from pathlib import Path


SKILL_DIR = Path(__file__).resolve().parents[1]
TARGET_FAMILY = "HanziPen SC"


class PreviewFontContractTests(unittest.TestCase):
    def test_template_uses_one_exact_family(self) -> None:
        css = (SKILL_DIR / "assets" / "template.css").read_text(encoding="utf-8")
        self.assertIn(f'--hand: "{TARGET_FAMILY}";', css)
        self.assertIn("--font-sans: var(--hand);", css)
        self.assertIn("--font-display: var(--hand);", css)
        self.assertIn("--font-mono: var(--hand);", css)
        self.assertIn("--font-serif: var(--hand);", css)

    def test_demo_and_reusable_css_share_the_same_family(self) -> None:
        paths = (
            SKILL_DIR / "assets" / "deepseek-example.css",
            SKILL_DIR / "examples" / "deepseek-v4-flash" / "style.css",
        )
        for path in paths:
            with self.subTest(path=path):
                css = path.read_text(encoding="utf-8")
                self.assertIn(f'--hand-font: "{TARGET_FAMILY}";', css)
                self.assertIn("--font-mono: var(--hand-font);", css)
                self.assertIn("--font-serif: var(--hand-font);", css)

    def test_shared_assets_use_the_same_family(self) -> None:
        base = (SKILL_DIR / "assets" / "base.css").read_text(encoding="utf-8")
        annotations = (SKILL_DIR / "assets" / "neat-annotations.css").read_text(
            encoding="utf-8"
        )
        runtime = (SKILL_DIR / "assets" / "runtime.js").read_text(
            encoding="utf-8"
        )
        self.assertIn(f"--font-sans: '{TARGET_FAMILY}';", base)
        self.assertIn(f"--font-serif: '{TARGET_FAMILY}';", base)
        self.assertIn(f"--font-mono: '{TARGET_FAMILY}';", base)
        self.assertIn(f"--ann-font: '{TARGET_FAMILY}';", annotations)
        self.assertIn(f'font-family: "{TARGET_FAMILY}";', runtime)

    def test_instructions_use_preview_as_the_glyph_reference(self) -> None:
        skill = (SKILL_DIR / "SKILL.md").read_text(encoding="utf-8")
        guide = (SKILL_DIR / "references" / "style-guide.md").read_text(
            encoding="utf-8"
        )
        self.assertIn("assets/preview-cover.png", skill)
        self.assertIn("assets/preview-cover.png", guide)
        self.assertIn("不设置其他中文字体候选", skill)

    def test_static_renderer_injects_and_checks_the_font_file(self) -> None:
        preparer = (SKILL_DIR / "scripts" / "prepare_render_html.py").read_text(
            encoding="utf-8"
        )
        renderer = (SKILL_DIR / "scripts" / "render.sh").read_text(encoding="utf-8")
        self.assertIn("@font-face", preparer)
        self.assertIn('DEMO_FONT_POSTSCRIPT = "HanziPenSC-W3"', preparer)
        self.assertIn("validate_font_file(font)", preparer)
        self.assertIn("dataset.wanghongFontReady", preparer)
        self.assertIn("prepare_render_html.py", renderer)
        self.assertIn("--dump-dom", renderer)
        self.assertIn('data-wanghong-font-ready="yes"', renderer)
        self.assertIn("com_apple_MobileAsset_Font8", renderer)
        self.assertIn("re.findall", renderer)


if __name__ == "__main__":
    unittest.main()
