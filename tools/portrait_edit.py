#!/usr/bin/env python3
"""按一句修改建议改已有立绘。只接收修改建议和原图，结果写到缓存，不进正式立绘库。

用法（在仓库根目录）:
  python tools/portrait_edit.py "把前腿的描边改细" cache/portraits/0030/<这次目录>/result.png
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

from PIL import Image

from ark_client import generate_image
from portrait_gen import save_result_image

ROOT = Path(__file__).resolve().parents[1]
EDIT_ROOT = ROOT / "cache" / "portraits" / "_edits"


def edit_size(source: Path) -> str:
    """原图像素落在模型允许范围内时，按原图尺寸出图。"""
    with Image.open(source) as image:
        width, height = image.size
    if width * height >= 921_600 and 1 / 16 <= width / height <= 16:
        return f"{width}x{height}"
    return "2K"


def edit_prompt(suggestion: str) -> str:
    return (
        "这是一次局部重绘。点名的部位按新造型重画，轮廓和表情都可以变。\n"
        "没点名的部位保持原图。宽高比与原图一致。\n"
        f"{suggestion.strip()}"
    )


def edit_portrait(suggestion: str, source: Path) -> Path:
    if not suggestion.strip():
        raise SystemExit("修改建议是空的。")
    if not source.is_file():
        raise SystemExit(f"找不到原图：{source}")
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    run_dir = EDIT_ROOT / stamp
    run_dir.mkdir(parents=True)
    prompt = edit_prompt(suggestion)
    size = edit_size(source)
    (run_dir / "suggestion.txt").write_text(suggestion.strip(), encoding="utf-8")
    (run_dir / "prompt.txt").write_text(prompt, encoding="utf-8")
    try:
        generated = generate_image(prompt, images=[str(source)], size=size)
    except RuntimeError as exc:
        if "size" not in str(exc).lower():
            raise
        generated = generate_image(prompt, images=[str(source)], size="2K")
    result = run_dir / "result.png"
    save_result_image(generated, result)
    report = {
        "suggestion": suggestion.strip(),
        "source": str(source),
        "prompt": prompt,
        "model": generated.get("model"),
        "result": "result.png",
        "library": None,
    }
    (run_dir / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"已写入缓存，尚未落库：{run_dir}")
    return run_dir


def main() -> None:
    parser = argparse.ArgumentParser(description="用修改建议和原图做一次局部修图，结果放缓存。")
    parser.add_argument("suggestion", help="修改建议")
    parser.add_argument("image", help="原图路径")
    args = parser.parse_args()
    edit_portrait(args.suggestion, Path(args.image))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
