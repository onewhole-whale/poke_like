#!/usr/bin/env python3
"""风格重绘。后三张只提供画风，第一张的造型不改。

用法（在仓库根目录）:
  python tools/portrait_style.py 原图.png
  python tools/portrait_style.py 原图.png --ref a.png --ref b.png --ref c.png
"""

from __future__ import annotations

import argparse
import json
import random
import shutil
import sys
from datetime import datetime
from pathlib import Path

from PIL import Image

from ark_client import generate_image
from portrait_gen import save_result_image

ROOT = Path(__file__).resolve().parents[1]
STYLE_ROOT = ROOT / "cache" / "portraits" / "_styles"
ROCO_ROOT = ROOT / "assets" / "art" / "roco"


def style_size(source: Path) -> str:
    with Image.open(source) as image:
        width, height = image.size
    if width * height >= 921_600 and 1 / 16 <= width / height <= 16:
        return f"{width}x{height}"
    return "2K"


def style_prompt() -> str:
    return "用后三张图的风格对第一张图进行重绘。不要修改造型。\n"


def pick_refs(given: list[str]) -> list[Path]:
    if given:
        refs = [Path(item) for item in given]
        missing = [str(path) for path in refs if not path.is_file()]
        if missing:
            raise SystemExit("找不到画风参考：" + "、".join(missing))
        if len(refs) != 3:
            raise SystemExit("画风参考要三张。")
        return refs
    pool = sorted(ROCO_ROOT.glob("*.png"))
    if len(pool) < 3:
        raise SystemExit(f"洛克立绘不足三张：{ROCO_ROOT}")
    return random.sample(pool, 3)


def restyle(source: Path, given: list[str]) -> Path:
    if not source.is_file():
        raise SystemExit(f"找不到原图：{source}")
    refs = pick_refs(given)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    run_dir = STYLE_ROOT / stamp
    run_dir.mkdir(parents=True)
    images = [str(source)]
    for ref in refs:
        dest = run_dir / ref.name
        shutil.copy(ref, dest)
        images.append(str(dest))
    prompt = style_prompt()
    (run_dir / "prompt.txt").write_text(prompt, encoding="utf-8")
    size = style_size(source)
    try:
        generated = generate_image(prompt, images=images, size=size)
    except RuntimeError as exc:
        if "size" not in str(exc).lower():
            raise
        generated = generate_image(prompt, images=images, size="2K")
    save_result_image(generated, run_dir / "result.png")
    report = {
        "source": str(source),
        "style": [ref.name for ref in refs],
        "prompt": prompt,
        "model": generated.get("model"),
        "result": "result.png",
        "library": None,
    }
    (run_dir / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"已写入缓存，尚未落库：{run_dir}")
    print("画风：" + "、".join(ref.name for ref in refs))
    return run_dir


def main() -> None:
    parser = argparse.ArgumentParser(description="用三张洛克立绘的画风重绘第一张，不改造型。")
    parser.add_argument("image", help="要重绘的原图")
    parser.add_argument("--ref", action="append", default=[], help="画风参考，需正好三张。不传则从洛克立绘随机抽")
    args = parser.parse_args()
    restyle(Path(args.image), args.ref)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
