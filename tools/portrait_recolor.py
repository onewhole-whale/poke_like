#!/usr/bin/env python3
"""重新上色。线稿留着。只改写明的部位，没写到的部位保持原图颜色。

用法（在仓库根目录）:
  python tools/portrait_recolor.py 原图.png --from cache/portraits/0030/<这次目录>/prompt.txt --lines 14-19
  python tools/portrait_recolor.py 原图.png --colors "配色：主体色1：炭黑色 #1a1a1a（头、耳、背）"
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
RECOLOR_ROOT = ROOT / "cache" / "portraits" / "_recolors"


def recolor_size(source: Path) -> str:
    """原图像素落在模型允许范围内时，按原图尺寸出图。"""
    with Image.open(source) as image:
        width, height = image.size
    if width * height >= 921_600 and 1 / 16 <= width / height <= 16:
        return f"{width}x{height}"
    return "2K"


def recolor_prompt(colors: str) -> str:
    return (
        "保持线稿。只改下面写明的部位的颜色，没写到的部位保持原图颜色。\n"
        f"{colors.strip()}\n"
    )


def read_colors(path: Path, lines: str) -> str:
    if not path.is_file():
        raise SystemExit(f"找不到配色文件：{path}")
    start_text, end_text = lines.split("-", 1)
    start, end = int(start_text), int(end_text)
    if start < 1 or end < start:
        raise SystemExit(f"行号范围不对：{lines}")
    content = path.read_text(encoding="utf-8").splitlines()
    if end > len(content):
        raise SystemExit(f"配色文件只有 {len(content)} 行：{path}")
    return "\n".join(content[start - 1 : end]).strip()


def recolor_portrait(source: Path, colors: str) -> Path:
    if not colors.strip():
        raise SystemExit("配色是空的。")
    if not source.is_file():
        raise SystemExit(f"找不到原图：{source}")
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    run_dir = RECOLOR_ROOT / stamp
    run_dir.mkdir(parents=True)
    prompt = recolor_prompt(colors)
    size = recolor_size(source)
    (run_dir / "colors.txt").write_text(colors.strip() + "\n", encoding="utf-8")
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
        "source": str(source),
        "colors": colors.strip(),
        "prompt": prompt,
        "model": generated.get("model"),
        "result": "result.png",
        "library": None,
    }
    (run_dir / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"已写入缓存，尚未落库：{run_dir}")
    return run_dir


def main() -> None:
    parser = argparse.ArgumentParser(description="保持线稿，只改写明部位的颜色。结果放缓存。")
    parser.add_argument("image", help="要重新上色的原图")
    parser.add_argument("--colors", default="", help="配色正文")
    parser.add_argument("--from", dest="color_file", help="从提示词文件读取配色")
    parser.add_argument("--lines", default="", help="配色行号，例如 14-19")
    args = parser.parse_args()
    if args.color_file:
        if not args.lines:
            raise SystemExit("用 --from 时要带 --lines，例如 --lines 14-19。")
        colors = read_colors(Path(args.color_file), args.lines)
    else:
        colors = args.colors
    recolor_portrait(Path(args.image), colors)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
