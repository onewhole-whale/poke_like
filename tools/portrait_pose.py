#!/usr/bin/env python3
"""改姿势。造型、配色留着，只改身体姿势。姿势可以是一句话，也可以是一张参考图。

用法（在仓库根目录）:
  python tools/portrait_pose.py 原图.png --text "侧身站立，一只前爪抬起"
  python tools/portrait_pose.py 原图.png --ref 姿势图.png
  python tools/portrait_pose.py 原图.png --ref 姿势图.png --text "身体压低向前扑"
"""

from __future__ import annotations

import argparse
import json
import shutil
from datetime import datetime
from pathlib import Path

from PIL import Image

from ark_client import generate_image
from portrait_gen import save_result_image

ROOT = Path(__file__).resolve().parents[1]
POSE_ROOT = ROOT / "cache" / "portraits" / "_poses"


def pose_size(source: Path) -> str:
    with Image.open(source) as image:
        width, height = image.size
    if width * height >= 921_600 and 1 / 16 <= width / height <= 16:
        return f"{width}x{height}"
    return "2K"


def pose_prompt(text: str, has_ref: bool) -> str:
    if has_ref:
        lines = [
            "第一张是要改姿势的角色。造型、配色、材质、配件都留着。",
            "第二张只提供身体姿势。不要画成第二张里的生物，不要用它的颜色、花纹和配件。",
            "把第一张改成第二张的姿势。",
        ]
    else:
        lines = [
            "这是一次改姿势。造型、配色、材质、配件都留着，只改身体姿势。",
        ]
    if text.strip():
        lines.append(f"姿势：{text.strip()}。")
    lines.append("纯白背景。")
    return "\n".join(lines) + "\n"


def change_pose(source: Path, text: str, ref: Path | None) -> Path:
    if not source.is_file():
        raise SystemExit(f"找不到原图：{source}")
    if ref is not None and not ref.is_file():
        raise SystemExit(f"找不到姿势参考：{ref}")
    if ref is None and not text.strip():
        raise SystemExit("要提供 --text 或 --ref。")
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    run_dir = POSE_ROOT / stamp
    run_dir.mkdir(parents=True)
    prompt = pose_prompt(text, ref is not None)
    images = [str(source)]
    copied = None
    if ref is not None:
        copied = run_dir / f"pose{ref.suffix.lower()}"
        shutil.copy(ref, copied)
        images.append(str(copied))
    (run_dir / "prompt.txt").write_text(prompt, encoding="utf-8")
    size = pose_size(source)
    try:
        generated = generate_image(prompt, images=images, size=size)
    except RuntimeError as exc:
        if "size" not in str(exc).lower():
            raise
        generated = generate_image(prompt, images=images, size="2K")
    result = run_dir / "result.png"
    save_result_image(generated, result)
    report = {
        "source": str(source),
        "text": text.strip(),
        "poseRef": None if copied is None else copied.name,
        "poseSource": None if ref is None else str(ref),
        "prompt": prompt,
        "model": generated.get("model"),
        "result": "result.png",
        "library": None,
    }
    (run_dir / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"已写入缓存，尚未落库：{run_dir}")
    return run_dir


def main() -> None:
    parser = argparse.ArgumentParser(description="保留造型，只改姿势。结果放缓存。")
    parser.add_argument("image", help="要改姿势的原图")
    parser.add_argument("--text", default="", help="姿势的文字描述")
    parser.add_argument("--ref", help="姿势参考图，只取身体姿势")
    args = parser.parse_args()
    change_pose(Path(args.image), args.text, Path(args.ref) if args.ref else None)


if __name__ == "__main__":
    main()
