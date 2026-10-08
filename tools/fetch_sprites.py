#!/usr/bin/env python3
"""
精灵立绘爬虫 - 从 52poke（宝可梦百科）和 biligame（洛克王国世界）wiki 拉取官方立绘

用法（在仓库根目录执行）:
  python tools/fetch_sprites.py poke 妙蛙种子 [--out ./sprites]
  python tools/fetch_sprites.py nrc 迪莫 [--out ./sprites]
  python tools/fetch_sprites.py poke 妙蛙种子 --all  # 拉取该页面所有图片

依赖: pip install requests
"""

import argparse
import os
import re
import sys
import time
from urllib.parse import quote, unquote

try:
    import requests
except ImportError:
    print("需要 requests 库: pip install requests")
    sys.exit(1)


# ──────────────────────────── 52poke 神奇宝贝百科 ────────────────────────────

POKE_API = "https://wiki.52poke.com/api.php"
POKE_CDN = "https://media.52poke.com/wiki"

# 常见立绘关键词过滤（官方绘图、梦特性立绘等）
POKE_SPRITE_KEYWORDS = [
    "official", "officialart", "游戏图片", "立绘", "官方绘图",
]


def poke_search_image(pokemon_name: str) -> list[dict]:
    """根据宝可梦中文名，返回页面中所有候选立绘信息"""
    # 1. 获取页面所有图片
    params = {
        "action": "query",
        "titles": pokemon_name,
        "prop": "images",
        "format": "json",
        "imlimit": "200",
    }
    r = requests.get(POKE_API, params=params, timeout=15)
    r.raise_for_status()
    data = r.json()

    pages = data.get("query", {}).get("pages", {})
    all_images = []
    for page in pages.values():
        all_images = [img["title"] for img in page.get("images", [])]

    # 2. 筛选可能是立绘的图片（编号+英文名.png 这种格式通常是官方立绘）
    # 52poke 官方绘图命名规律: 001Bulbasaur.png, 001Bulbasaur Dream.png
    sprite_candidates = []
    for img_title in all_images:
        # 匹配 File:数字英文名.png 格式
        m = re.match(r"File:(\d{4})([A-Za-z]+)\.png$", img_title)
        if m:
            sprite_candidates.append({
                "title": img_title,
                "pokemon_id": m.group(1),
                "english_name": m.group(2),
                "type": "official",
            })
            continue
        # 匹配 Dream 立绘
        m = re.match(r"File:(\d{4})([A-Za-z]+) Dream\.png$", img_title)
        if m:
            sprite_candidates.append({
                "title": img_title,
                "pokemon_id": m.group(1),
                "english_name": m.group(2),
                "type": "dream",
            })

    if not sprite_candidates:
        # fallback: 取所有 png 且名字里包含宝可梦英文名的
        # 先从页面数据里找英文名
        eng_name = _poke_get_english_name(pokemon_name)
        if eng_name:
            for img_title in all_images:
                if eng_name.lower() in img_title.lower() and img_title.lower().endswith(".png"):
                    sprite_candidates.append({
                        "title": img_title,
                        "pokemon_id": "",
                        "english_name": eng_name,
                        "type": "unknown",
                    })

    # 3. 获取每张图的实际 URL
    results = []
    for cand in sprite_candidates[:10]:  # 限制最多取10张
        info = _poke_get_image_url(cand["title"])
        if info:
            cand["url"] = info["url"]
            cand["size"] = info.get("size", 0)
            results.append(cand)
        time.sleep(0.2)  # 礼貌延迟

    return results


def _poke_get_english_name(chinese_name: str) -> str | None:
    """从页面提取宝可梦英文名"""
    params = {
        "action": "parse",
        "page": chinese_name,
        "prop": "wikitext",
        "format": "json",
    }
    try:
        r = requests.get(POKE_API, params=params, timeout=10)
        data = r.json()
        wikitext = data.get("parse", {}).get("wikitext", {}).get("*", "")
        # 匹配 英文：xxx 或 {{英文名|xxx}}
        m = re.search(r"英文[︰:]\s*([A-Za-z]+)", wikitext)
        if m:
            return m.group(1)
    except Exception:
        pass
    return None


def _poke_get_image_url(file_title: str) -> dict | None:
    """通过 File: 标题获取图片实际 URL"""
    params = {
        "action": "query",
        "titles": file_title,
        "prop": "imageinfo",
        "iiprop": "url|size",
        "format": "json",
    }
    try:
        r = requests.get(POKE_API, params=params, timeout=10)
        data = r.json()
        pages = data.get("query", {}).get("pages", {})
        for page in pages.values():
            if "imageinfo" in page:
                return page["imageinfo"][0]
    except Exception:
        pass
    return None


# ──────────────────────────── biligame 洛克王国世界 ────────────────────────────

NRC_API = "https://wiki.biligame.com/nrc/api.php"
NRC_CDN = "https://patchwiki.biligame.com/images/nrc"


def nrc_search_image(monster_name: str) -> list[dict]:
    """根据精灵中文名，返回页面中所有候选立绘"""
    # 1. 获取页面所有图片
    params = {
        "action": "query",
        "titles": monster_name,
        "prop": "images",
        "format": "json",
        "imlimit": "200",
    }
    r = requests.get(NRC_API, params=params, timeout=15)
    r.raise_for_status()
    data = r.json()

    pages = data.get("query", {}).get("pages", {})
    all_images = []
    for page in pages.values():
        all_images = [img["title"] for img in page.get("images", [])]

    # 2. 筛选可能是立绘的图片
    # 洛克王国wiki的立绘通常文件名包含精灵名或"立绘""外观"等关键词
    # 也可能是纯hash名，需要靠尺寸判断（立绘通常较大）
    candidates = []
    for img_title in all_images:
        # 排除明显是UI/特效/技能图的
        skip_keywords = ["blood", "skill", "icon", "btn", "bg", "base",
                         "button", "frame", "icon_", "buff", "debuff"]
        lower_title = img_title.lower()
        if any(kw in lower_title for kw in skip_keywords):
            continue
        if not img_title.lower().endswith((".png", ".jpg", ".jpeg")):
            continue
        candidates.append({"title": img_title})

    # 3. 获取图片信息，按尺寸排序（立绘通常是大图）
    results = []
    for cand in candidates[:20]:  # 先取20个候选看尺寸
        info = _nrc_get_image_url(cand["title"])
        if info:
            cand["url"] = info["url"]
            cand["width"] = info.get("width", 0)
            cand["height"] = info.get("height", 0)
            cand["size"] = info.get("size", 0)
            results.append(cand)
        time.sleep(0.15)

    # 按尺寸从大到小排序，大图更可能是立绘
    results.sort(key=lambda x: x.get("size", 0), reverse=True)
    return results[:10]  # 返回前10张最大的


def _nrc_get_image_url(file_title: str) -> dict | None:
    """通过文件标题获取图片实际 URL"""
    params = {
        "action": "query",
        "titles": file_title,
        "prop": "imageinfo",
        "iiprop": "url|size",
        "format": "json",
    }
    try:
        r = requests.get(NRC_API, params=params, timeout=10)
        data = r.json()
        pages = data.get("query", {}).get("pages", {})
        for page in pages.values():
            if "imageinfo" in page:
                return page["imageinfo"][0]
    except Exception:
        pass
    return None


# ──────────────────────────── 下载工具 ────────────────────────────

def download_image(url: str, save_path: str, referer: str = "") -> bool:
    """下载图片到本地"""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SpriteFetcher/1.0",
    }
    if referer:
        headers["Referer"] = referer

    try:
        r = requests.get(url, headers=headers, timeout=30, stream=True)
        r.raise_for_status()
        with open(save_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)
        return True
    except Exception as e:
        print(f"  下载失败: {e}")
        return False


def safe_filename(name: str) -> str:
    """生成安全的文件名"""
    return re.sub(r'[\\/:*?"<>|]', "_", name)


# ──────────────────────────── 主流程 ────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="从wiki拉取精灵立绘")
    parser.add_argument("wiki", choices=["poke", "nrc"], help="wiki来源: poke=宝可梦, nrc=洛克王国世界")
    parser.add_argument("name", help="精灵名称（中文）")
    parser.add_argument("--out", default="./sprites", help="输出目录（默认 ./sprites）")
    parser.add_argument("--all", action="store_true", help="拉取页面所有图片（默认只取候选立绘）")
    parser.add_argument("--top", type=int, default=5, help="最多下载前N张候选（默认5）")
    args = parser.parse_args()

    out_dir = os.path.join(args.out, safe_filename(args.name))
    os.makedirs(out_dir, exist_ok=True)

    print(f"[*] 正在查询 {args.wiki} wiki: {args.name} ...")

    if args.wiki == "poke":
        candidates = poke_search_image(args.name)
        referer = "https://wiki.52poke.com/"
    else:
        candidates = nrc_search_image(args.name)
        referer = "https://wiki.biligame.com/nrc/"

    if not candidates:
        print("[!] 未找到候选图片，试试其他关键词")
        sys.exit(1)

    print(f"[*] 找到 {len(candidates)} 张候选:")
    for i, c in enumerate(candidates[:args.top]):
        size_kb = c.get("size", 0) / 1024
        print(f"  [{i+1}] {c.get('title', '?')}  ({size_kb:.0f}KB)")

    # 下载
    downloaded = 0
    for i, cand in enumerate(candidates[:args.top]):
        url = cand["url"]
        ext = ".png"
        if ".jpg" in url.lower() or ".jpeg" in url.lower():
            ext = ".jpg"

        filename = f"{args.name}_{i+1:02d}{ext}"
        save_path = os.path.join(out_dir, filename)

        print(f"[*] 下载 [{i+1}] -> {save_path}")
        if download_image(url, save_path, referer):
            downloaded += 1
        time.sleep(0.3)

    print(f"\n[完成] 共下载 {downloaded} 张到: {out_dir}")


if __name__ == "__main__":
    main()
#（注：内容由AI生成）
