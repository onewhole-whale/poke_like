#!/usr/bin/env python3
"""立绘工具：问设计、评审、生图。

结果只写到 cache/portraits/。确认能用之后再执行 accept，才会复制进 assets/portraits/。

用法（在仓库根目录）:
  python tools/portrait_gen.py fetch-roco
  python tools/portrait_gen.py 0030
  python tools/portrait_gen.py accept cache/portraits/0030/<这次目录>
"""

from __future__ import annotations

import argparse
import html
import json
import random
import re
import shutil
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path

import requests
from PIL import Image

from ark_client import chat, generate_image, load_config

ROOT = Path(__file__).resolve().parents[1]
BRIEF_PATH = ROOT / "精灵绘图临时摘录.txt"
SPECIES_PATH = ROOT / "data" / "species.js"
CACHE_ROOT = ROOT / "cache" / "portraits"
LIBRARY = ROOT / "assets" / "portraits"
ART_ROOT = ROOT / "assets" / "art"
ROCO_LIB = ART_ROOT / "roco"

ROUNDS = 5
PER_ROUND = 3


class SearchMiss(RuntimeError):
    def __init__(self, message: str, log: list):
        super().__init__(message)
        self.log = log
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def load_briefs() -> dict[str, dict]:
    text = BRIEF_PATH.read_text(encoding="utf-8")
    found = {}
    for block in re.split(r"\n\s*\n", text.strip()):
        item = {}
        for line in block.splitlines():
            if "：" not in line:
                continue
            key, value = line.split("：", 1)
            item[key.strip()] = value.strip()
        name = item.get("名称")
        if name:
            found[name] = item
    return found


def species_id_for(name: str) -> str | None:
    if not SPECIES_PATH.is_file():
        return None
    text = SPECIES_PATH.read_text(encoding="utf-8")
    match = re.search(r"id:'([^']+)',name:'" + re.escape(name) + "'", text)
    return match.group(1) if match else None


def species_number(species_id: str | None) -> str | None:
    if not species_id or "_" not in species_id:
        return None
    return species_id.rsplit("_", 1)[-1]


def resolve_brief(token: str) -> tuple[str, dict, str]:
    """名称或物种编号都能定位。缓存目录只用四位编号，例如 0030。"""
    briefs = load_briefs()
    name = token if token in briefs else None
    if name is None and token.isdigit():
        wanted = token.lstrip("0") or "0"
        for candidate in briefs:
            number = species_number(species_id_for(candidate))
            if number and (number.lstrip("0") or "0") == wanted:
                name = candidate
                break
    if name is None:
        raise SystemExit(f"摘录里没有「{token}」。可以用名称，或物种编号，例如 0030。")
    number = species_number(species_id_for(name))
    if not number:
        raise SystemExit(f"「{name}」对不上物种编号，缓存目录没法用数字命名。")
    return name, briefs[name], number


def search_image_urls(query: str, limit: int = 40) -> list[str]:
    """按网页图片搜索的结果顺序取地址。脚本不看图，只按顺序往下拿。"""
    response = requests.get(
        "https://www.bing.com/images/search",
        params={"q": query, "form": "HDRSC2", "first": "1", "count": str(limit)},
        headers={"User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9"},
        timeout=20,
    )
    response.raise_for_status()
    urls = re.findall(r'murl&quot;:&quot;(.*?)&quot;', response.text)
    if not urls:
        urls = re.findall(r'"murl":"(.*?)"', response.text)
    cleaned = []
    seen = set()
    for raw in urls:
        url = html.unescape(raw).replace("\\u0026", "&").replace("\\/", "/")
        if not url.startswith("http") or url in seen:
            continue
        seen.add(url)
        cleaned.append(url)
        if len(cleaned) >= limit:
            break
    return cleaned


def download_image(url: str, dest: Path) -> bool:
    try:
        response = requests.get(url, headers={"User-Agent": UA}, timeout=20)
        response.raise_for_status()
        if len(response.content) < 8000:
            return False
        dest.write_bytes(response.content)
        with Image.open(dest) as image:
            image.convert("RGB").save(dest.with_suffix(".jpg"), quality=90)
        if dest.suffix.lower() != ".jpg" and dest.exists():
            dest.unlink()
        jpg = dest.with_suffix(".jpg")
        return jpg.is_file() and jpg.stat().st_size > 8000
    except Exception:
        if dest.exists():
            dest.unlink()
        jpg = dest.with_suffix(".jpg")
        if jpg.exists() and jpg.stat().st_size < 8000:
            jpg.unlink()
        return False


def _api_keys(cfg: dict) -> list[str]:
    raw = cfg.get("apiKeys")
    keys = [str(item).strip() for item in raw if str(item).strip()] if isinstance(raw, list) else []
    primary = str(cfg.get("apiKey") or "").strip()
    if primary and primary not in keys:
        keys.insert(0, primary)
    return keys


def _response_text(payload: dict) -> str:
    chunks = []

    def walk(node):
        if isinstance(node, dict):
            if node.get("type") in {"output_text", "text"} and isinstance(node.get("text"), str):
                chunks.append(node["text"])
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    walk(payload.get("output") or payload)
    return "\n".join(chunks).strip()


def see_image(path: Path, question: str) -> str:
    """把本地图片交给可看图的模型。"""
    cfg = load_config()
    model_id = cfg.get("visionModelId") or "doubao-seed-2-1-lite-260915"
    base = str(cfg.get("baseUrl") or "https://ark.cn-beijing.volces.com/api/v3").rstrip("/")
    with Image.open(path) as image:
        image = image.convert("RGB")
        image.thumbnail((1024, 1024))
        thumb = path.with_name(path.stem + ".vision.jpg")
        image.save(thumb, quality=85)
    import base64

    encoded = base64.b64encode(thumb.read_bytes()).decode("ascii")
    body = {
        "model": model_id,
        "input": [
            {
                "role": "user",
                "content": [
                    {"type": "input_image", "image_url": f"data:image/jpeg;base64,{encoded}"},
                    {"type": "input_text", "text": question},
                ],
            }
        ],
    }
    last_error = None
    for key in _api_keys(cfg):
        try:
            response = requests.post(
                base + "/responses",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json=body,
                timeout=120,
            )
            if response.status_code >= 400:
                last_error = RuntimeError(f"{response.status_code} {response.text[:400]}")
                continue
            return _response_text(response.json()) or response.text[:500]
        except Exception as exc:  # noqa: BLE001
            last_error = exc
    raise RuntimeError(f"读图接口调用失败：{last_error}")


def parse_verdict(text: str) -> tuple[bool, str]:
    match = re.search(r"\{.*\}", text, re.S)
    if not match:
        return False, text[:180]
    try:
        data = json.loads(match.group(0))
    except json.JSONDecodeError:
        return False, text[:180]
    flag = data.get("match")
    if isinstance(flag, str):
        flag = flag.strip().lower() in {"true", "yes", "是", "符合"}
    reason = str(data.get("reason") or "").strip()
    return bool(flag), reason


ROCO_COUNT = 3
ROCO_WIKI = "https://wiki.biligame.com/nrc/%E7%B2%BE%E7%81%B5%E5%9B%BE%E9%89%B4"


def judge_question(brief: dict, purpose: str, subject: str | None = None) -> str:
    header = (
        "你在筛选游戏立绘的参考图。只根据这张图本身判断，不要猜测下载失败或文件名。\n"
        f"用途：{purpose}\n"
        '只输出 JSON：{"match": true或false, "reason": "一句话"}\n'
    )
    target = subject or brief.get("设计原型", "")
    return header + (
        f"设计原型：{target}\n"
        "这张图的用途是提供设计原型。\n"
        "符合的标准只有三条：形态完整，特征明确，便于理解。\n"
        "能认出是这个原型，身体结构看得全，特征清楚，就符合。\n"
        "看不出原型、身体残缺、特征模糊、被水印或大字挡住，算不符合。"
    )


def reference_roles() -> str:
    """生图时说明参考图。只有设计原型一张。次要元素用文字描述。"""
    return (
        "参考图只有一张，用来认识设计原型长什么样。画面按提示词的部位、姿态和配色来设计。\n"
        "不要把这张图原样画进画面，不要把次要元素画成旁边的物件。\n"
    )


def roco_filename(number: str, name: str) -> str:
    cleaned = re.sub(r'[\\/:*?"<>|]', "_", name).strip()
    return f"{number}_{cleaned}.png"


def catalog_entries() -> list[dict]:
    """图鉴卡片上的 1024 立绘，和单只页面「精灵外观」是同一张图。"""
    response = requests.get(
        ROCO_WIKI,
        headers={
            "User-Agent": UA,
            "Accept": "text/html",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Referer": "https://wiki.biligame.com/nrc/",
        },
        timeout=40,
    )
    response.raise_for_status()
    rows = []
    for chunk in response.text.split('class="npc-card"')[1:]:
        number = re.search(r'data-number="(\d+)"', chunk)
        title = re.search(r'<a href="(/nrc/[^"]+)" title="([^"]+)"', chunk)
        src = re.search(r'npc-art-normal"><img[^>]+src="([^"]+)"', chunk)
        if not (number and title and src):
            continue
        rows.append({
            "number": number.group(1),
            "name": title.group(2),
            "page": "https://wiki.biligame.com" + title.group(1),
            "url": src.group(1).split("?")[0],
        })
    return rows


def _save_roco_file(row: dict) -> dict:
    dest = ROCO_LIB / roco_filename(row["number"], row["name"])
    record = {**row, "file": dest.name}
    if dest.is_file() and dest.stat().st_size > 8000:
        record["status"] = "已有"
        return record
    try:
        response = requests.get(row["url"], headers={"User-Agent": UA}, timeout=30)
        response.raise_for_status()
        if len(response.content) < 8000:
            record["status"] = "文件过小"
            return record
        dest.write_bytes(response.content)
        record["status"] = "已下载"
    except Exception as exc:  # noqa: BLE001
        record["status"] = f"失败：{exc}"
    return record


def fetch_roco_library() -> None:
    """把精灵图鉴里每只的精灵外观立绘存到 assets/art/roco。"""
    ROCO_LIB.mkdir(parents=True, exist_ok=True)
    rows = catalog_entries()
    if not rows:
        raise SystemExit("精灵图鉴页没有取到立绘。")
    print(f"图鉴 {len(rows)} 张，写入 {ROCO_LIB}", flush=True)
    records = []
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = [pool.submit(_save_roco_file, row) for row in rows]
        for done, future in enumerate(as_completed(futures), start=1):
            records.append(future.result())
            if done % 50 == 0 or done == len(futures):
                print(f"  {done}/{len(futures)}", flush=True)
    records.sort(key=lambda item: (item["number"], item["name"]))
    (ROCO_LIB / "index.json").write_text(
        json.dumps(records, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    failed = [item for item in records if item["status"].startswith("失败") or item["status"] == "文件过小"]
    print(f"完成 {len(records) - len(failed)} 张，失败 {len(failed)} 张。", flush=True)
    if failed:
        raise SystemExit("有立绘没下下来，看 assets/art/roco/index.json。")


def pick_roco_arts(folder: Path, count: int = ROCO_COUNT) -> tuple[list[Path], list]:
    """从本地洛克立绘里随机抽几张。"""
    pool = sorted(ROCO_LIB.glob("*.png"))
    if len(pool) < count:
        raise SearchMiss(f"本地洛克立绘只有 {len(pool)} 张，先运行 fetch-roco。", [])
    folder.mkdir(parents=True, exist_ok=True)
    chosen = random.sample(pool, count)
    saved = []
    log = []
    for src in chosen:
        dest = folder / src.name
        shutil.copy(src, dest)
        saved.append(dest)
        log.append({
            "file": str(dest.relative_to(folder.parent)),
            "source": str(src.relative_to(ROOT)).replace("\\", "/"),
            "match": True,
            "reason": "本地立绘随机抽取",
        })
        print(f"  立绘 {src.name}", flush=True)
    return saved, log


def pick_reference(
    brief: dict,
    query: str,
    purpose: str,
    folder: Path,
    rounds: int,
    subject: str | None = None,
    urls: list[str] | None = None,
) -> tuple[Path, list]:
    if urls is None:
        urls = search_image_urls(query)
    if not urls:
        raise SearchMiss(f"搜索没有结果，关键词需要调整：{query}", [])
    cursor = 0
    log = []
    question = judge_question(brief, purpose, subject)
    for round_index in range(1, rounds + 1):
        saved = []
        round_dir = folder / f"round{round_index}"
        round_dir.mkdir(parents=True, exist_ok=True)
        while len(saved) < PER_ROUND and cursor < len(urls):
            url = urls[cursor]
            cursor += 1
            dest = round_dir / f"{len(saved) + 1}.img"
            if download_image(url, dest):
                path = dest.with_suffix(".jpg")
                saved.append({"path": path, "url": url})
        if not saved:
            break
        for item in saved:
            answer = see_image(item["path"], question)
            matched, reason = parse_verdict(answer)
            record = {
                "round": round_index,
                "url": item["url"],
                "file": str(item["path"].relative_to(folder.parent)),
                "match": matched,
                "reason": reason,
            }
            log.append(record)
            print(f"  第{round_index}轮 {item['path'].name} {'符合' if matched else '不符合'}：{reason}")
            if matched:
                return item["path"], log
    raise SearchMiss(f"搜了{rounds}轮仍没有符合的参考图。搜索关键词需要调整：{query}", log)


def palette(path: Path) -> dict:
    with Image.open(path) as image:
        small = image.convert("RGB").resize((96, 96))
    quantized = small.quantize(colors=5, method=Image.Quantize.MEDIANCUT).convert("RGB")
    counts = quantized.getcolors(96 * 96) or []
    colors = []
    for count, rgb in counts:
        red, green, blue = rgb
        colors.append(
            {
                "hex": f"#{red:02X}{green:02X}{blue:02X}",
                "count": count,
                "lum": 0.299 * red + 0.587 * green + 0.114 * blue,
                "sat": max(rgb) - min(rgb),
            }
        )
    if not colors:
        return {}
    bright = max(colors, key=lambda item: item["lum"])
    dark = min(colors, key=lambda item: item["lum"])
    rest = [item for item in colors if item["hex"] not in {bright["hex"], dark["hex"]}]
    accent = max(rest or colors, key=lambda item: item["sat"])
    return {
        "亮部": bright["hex"],
        "暗部": dark["hex"],
        "特征色": accent["hex"],
    }


def build_prompt(brief: dict, colors: dict) -> str:
    swatches = "，".join(f"{name} {value}" for name, value in colors.items())
    appearance = brief.get("外貌描述", "")
    return (
        f"竖版游戏立绘，一只{brief.get('属性', '')}属性的{brief.get('设计原型', '')}，"
        "全身可见，侧面或四分之三侧，纯色背景。\n"
        f"外貌：{appearance}\n"
        f"参考色：{swatches}。\n"
        "赛璐璐平涂，黑色轮廓线，硬边阴影。不要照片，不要文字和水印。"
    )


def save_result_image(result: dict, dest: Path) -> None:
    if result.get("image_base64"):
        import base64

        dest.write_bytes(base64.b64decode(result["image_base64"]))
        return
    url = result.get("image_url")
    if not url:
        raise RuntimeError("生图接口没有返回图片。")
    last_error = None
    for _ in range(3):
        try:
            response = requests.get(url, timeout=60)
            response.raise_for_status()
            dest.write_bytes(response.content)
            return
        except requests.RequestException as exc:
            last_error = exc
    raise RuntimeError(f"生成图下载失败：{last_error}")


def _load_json(text: str) -> dict:
    match = re.search(r"\{.*\}", text, re.S)
    if not match:
        raise RuntimeError(f"文字模型没有返回 JSON：{text[:300]}")
    return json.loads(match.group(0))


ADD_TRIES = 3
IMAGE_TRIES = 5
DESIGNER = (
    "你是宝可梦设计师。只输出 JSON。"
    "要做的是这个形象自己的记忆点，让人叫出它的名字，而不是认出设计原型是什么动物。"
    "皮卡丘不会被说成黄色老鼠。"
)
REVIEWER = (
    "你是品味很高的宝可梦造型评审。只判断当前设计是不是过于简单、十分无聊。"
    "不要提出改法，不要重写部位。只输出 JSON。"
    "标准是形象本身的独特性：让人记住这个角色，而不是认出它的设计原型。"
    "一个部位换成器物、其余仍是现实生物，不算有记忆点。"
)
ADD_VAGUE = ("没有固定", "自造", "碎屑", "概念", "光效", "天气", "说不清", "不确定", "能量", "抽象")
ADD_HARD = ("火花塞",)


def _design_question(brief: dict, rejected: list[str]) -> str:
    banned = ""
    if rejected:
        banned = "上一轮这些词没通过反问，不要再用：" + "、".join(rejected) + "。\n"
    return (
        "根据这份精灵设定完成立绘设计问答。只输出一个 JSON 对象，不要解释。\n"
        f"名称：{brief.get('名称', '')}\n"
        f"设计原型：{brief.get('设计原型', '')}\n"
        f"属性：{brief.get('属性', '')}\n"
        f"外貌描述：{brief.get('外貌描述', '')}\n"
        f"生态描述：{brief.get('生态描述', '')}\n"
        f"{banned}"
        "要回传这些键：\n"
        "formLine：一句话形态描述，给后续生图用。\n"
        "add：一个次要设计元素，只要一个短词。从设定和属性做超常联想，完全不必是设计原型。"
        "必须是形象明确、一眼一个轮廓的物件，别人一搜这个词就能看到这种外形。"
        "例如水龟可以联到镜子，水狐可以联到水母。不要自造词，不要碎屑、光效、天气、抽象概念。\n"
        "不能选本身就很难画、要靠很多零件才认得出的东西。火花塞就是这种：螺纹、陶瓷、电极、接线端堆在一起，"
        "生图为了把它认出来就不会做融合。这类不要给 add，也不要放进 addOptions。\n"
        "addOptions：另外 10 个可行的次要设计元素，和 add 同时给出。要发散，不能是 add 的同一种东西换个说法。"
        "电属性不要只给避雷针、金属杆、高塔这一类。可以远到插头、雷龙，只要仍和属性或气质有关。"
        "这 10 个也必须是一眼一个轮廓的东西，不要火花塞这类复杂零件。\n"
        "colors：自己设计色号，不从参考图取。主体色撑大面，特征色只做点缀，主色之间要有差异，并有冷暖对比。"
        "where 只写这份设定里真有的大面。没有出现的部位不要写。不要写边缘、残留、痕迹、伤口、细碎部位。"
        "留在地面、空气里的现象不要做成身上的颜色。部位定稿后，配色会按定稿外观重写。"
        "normal 是进化链上游，颜色可以浅一点。键为 主体色1、主体色2、特征色1、特征色2、眼睛色。"
        "每项含 name、hex、where。眼睛色再加 mood。\n"
        "pose：一瞬间的定格姿态，不要标本站姿。不要写圆胖、圆润、短粗。姿态里不要出现旁边的道具。\n"
        "material：不同部位的材质差异，写质地对比，例如毛和甲、软和硬。\n"
        "气质：从生态描述提炼的一句话。"
    )


def challenge_add(add_name: str) -> tuple[bool, dict]:
    """让出词的模型反问自己：这个词到底是不是一件说得清的东西。"""
    user = (
        f"次要设计元素候选：「{add_name}」。\n"
        "反问你自己：你真的知道这是什么东西吗？\n"
        "通过的条件：它是生活里或常见设计里叫得出名字的物件，一眼一个轮廓，别人一搜这个词就能看到这种外形。"
        "刀片、磁铁、箭头、镜子、水母、灯笼、铃铛、插头都要通过。外形有两三种常见样子也通过，例如条形磁铁和马蹄形磁铁。\n"
        "不通过：自造词、属性加碎屑、光效、天气、抽象概念、没有固定外形的东西。"
        "也不通过零件堆在一起才认得出的复杂机械。火花塞就是这种，螺纹、陶瓷、电极、接线端堆在一起，"
        "生图为了把它认出来就不会做融合。刀片、磁铁、箭头不是这种，不要因为「有好几种样子」判不通过。\n"
        "只输出 JSON："
        '{"known": true或false, "what": "它是什么", "shape": "外形是什么样"}'
        "\n不通过时 known 为 false，what 和 shape 留空。"
    )
    data = _load_json(chat(user, system=DESIGNER))
    known = data.get("known")
    if isinstance(known, str):
        known = known.strip().lower() in {"true", "yes", "是", "通过"}
    what = str(data.get("what") or "").strip()
    shape = str(data.get("shape") or "").strip()
    spoken = what + shape
    vague = any(word in spoken for word in ADD_VAGUE)
    ok = bool(known) and len(what) >= 2 and len(shape) >= 4 and not vague
    return ok, {"known": bool(known), "what": what, "shape": shape}


PART_KEYS = ("头部", "躯干", "四肢", "尾巴")


def fused_part_keys(parts: dict, add_name: str) -> list[str]:
    return [
        key for key in PART_KEYS
        if add_name and add_name in str((parts or {}).get(key) or "")
    ]


FUSION_MODES = ("完全融合", "附属部件", "部分融合")
FUSION_LINES = {
    "完全融合": "这个部位的轮廓换成次要元素的造型，原部位的自然外形不再保留。",
    "附属部件": "这个部位保留原型外形，另加一件长在该部位上的附属部件，例如环、飘带、服饰、尖刺、云纹。附属部件长在身上，不放在旁边。",
    "部分融合": "这个部位保留原型的自然造型，外部材质换成次要元素的材质。",
}


def normalize_fusion(data: dict) -> dict:
    raw = data.get("fusion") if isinstance(data.get("fusion"), dict) else {}
    return {
        "part": str(raw.get("part") or "").strip(),
        "mode": str(raw.get("mode") or "").strip(),
    }


def fusion_ok(parts: dict, add_name: str, fusion: dict) -> bool:
    part = fusion.get("part") or ""
    mode = fusion.get("mode") or ""
    return part in PART_KEYS and mode in FUSION_MODES and fused_part_keys(parts, add_name) == [part]


def ask_parts(brief: dict, design: dict) -> dict:
    """第5步：只选一个部位，并选一种融合方式。"""
    add_name = str(design.get("add") or "").strip()
    prototype = brief.get("设计原型", "")
    check = design.get("addCheck") or {}
    retry_note = ""
    for _ in range(ADD_TRIES):
        user = (
            "第5步：只选一个部位，用一种方式和次要设计元素融合。只输出一个 JSON 对象。\n"
            f"主要设计元素：{prototype}\n"
            f"次要设计元素：{add_name}\n"
            f"它是什么：{check.get('what', '')}\n"
            f"它的外形：{check.get('shape', '')}\n"
            f"一句话形态：{design.get('formLine', '')}\n"
            f"{retry_note}"
            "三种方式里选一个：\n"
            f"完全融合：{FUSION_LINES['完全融合']}\n"
            f"附属部件：{FUSION_LINES['附属部件']}\n"
            f"部分融合：{FUSION_LINES['部分融合']}\n"
            "不要把次要元素画成站在旁边的物件。不要写圆胖、圆润、短粗、质感、保持。\n"
            "fusion：对象，part 是 头部、躯干、四肢、尾巴 之一，mode 是 完全融合、附属部件、部分融合 之一。\n"
            "parts：对象，键为 头部、躯干、四肢、尾巴。\n"
            f"只有 fusion.part 那一条出现「{add_name}」，并按所选方式写这个部位。另外三个部位不要出现「{add_name}」。\n"
            "不要因为设定里提到了某个部位，就把融合放在那个部位。头部、躯干、四肢、尾巴都要考虑。\n"
            "partsList：合成之后仍能认出的核心部件。\n"
            "material：这些部位现在的质地对比，和部位是同一套造型。不要写成还没改过的普通皮毛。\n"
            "没融合的部位也要有这个角色自己的记忆点，不要写成一只现实生物的耳、脸、爪和身子。别人不该先认出设计原型。"
        )
        data = _load_json(chat(user, system=DESIGNER))
        parts = data.get("parts") if isinstance(data.get("parts"), dict) else {}
        fusion = normalize_fusion(data)
        material = plain_text(data.get("material")).strip()
        if fusion_ok(parts, add_name, fusion) and material:
            print(f"  第5步：{fusion['part']}，{fusion['mode']}。", flush=True)
            return {"parts": parts, "partsList": data.get("partsList") or [], "fusion": fusion, "material": material}
        landed = fused_part_keys(parts, add_name)
        print(f"  第5步融合不合格：{fusion.get('mode') or '无方式'}，部位 {('、'.join(landed) or '无')}。", flush=True)
        retry_note = (
            f"上一轮不合格。只能有一个部位出现「{add_name}」，fusion.part 必须是这个部位，"
            "fusion.mode 必须是 完全融合、附属部件、部分融合 之一。material 要写这套部位的质地。\n"
        )
    raise SystemExit(f"第5步连问{ADD_TRIES}次，仍没选定一个部位和一种融合方式。")


def _as_bool(value, truthy: set[str]) -> bool:
    if isinstance(value, str):
        return value.strip().lower() in truthy
    return bool(value)


def save_reviews(run_dir: Path | None, design: dict) -> None:
    """把评审和设计方的来回写进这次目录。"""
    if run_dir is None:
        return
    turns = design.get("reviews") or []
    (run_dir / "review.json").write_text(
        json.dumps(turns, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    chunks = []
    for index, turn in enumerate(turns, 1):
        chunks.append(
            f"第{index}轮 {turn.get('role', '')}\n"
            f"问：\n{turn.get('prompt', '')}\n"
            f"答：\n{turn.get('reply', '')}\n"
        )
    (run_dir / "review.txt").write_text("\n".join(chunks), encoding="utf-8")


def judge_boring(brief: dict, design: dict, run_dir: Path | None = None) -> tuple[bool, str]:
    """评审方只判断，不改设计。"""
    add_name = str(design.get("add") or "").strip()
    prototype = brief.get("设计原型", "")
    fusion = design.get("fusion") or {}
    parts = design.get("parts") or {}
    body = "\n".join(f"{key}：{parts.get(key, '')}" for key in PART_KEYS)
    culture = str((design.get("culture") or {}).get("name") or "").strip()
    user = (
        "判断这份造型是不是过于简单、十分无聊。只输出 JSON，不要改设计。\n"
        f"设计原型是{prototype}，次要元素是「{add_name}」，"
        f"融合部位是{fusion.get('part', '')}，方式是{fusion.get('mode', '')}。\n"
        + (f"已引入的文化原型：{culture}。\n" if culture else "")
        + f"部位：\n{body}\n"
        f"材质：{plain_text(design.get('material'))}\n"
        "过于简单、十分无聊：别人看了会说出设计原型，例如「这是一只猫」，而不是叫出这个角色的名字。"
        "头、躯干、四肢仍是现实生物的耳、脸、爪、身子，只换了毛色或把一个部位换成器物，例如尾巴换成避雷针，boring 为 true。"
        "材质把造型写回普通皮毛，或和部位不是同一套，boring 为 true。"
        "皮卡丘不会被说成黄色老鼠。只是一只猫加一根避雷针尾巴，仍然是猫。\n"
        "描述画不出来，boring 也是 true。不能靠「对应」「位置是」把一件东西的零件安到还在的生物部位上。"
        "整个脑袋是火花塞，唯一能画的写法是头颅完全是一个火花塞，做成玩具诡异风。"
        "写不成这种确定的外形，这份描述没法落地。\n"
        "不算无聊：这个形象本身就有记忆点，而且读完能画出一个确定的外形。职业或文化带来的造型长在身上，让人先记住这个角色。\n"
        "why 要写详细：逐个部位说明它现在是什么，再说明设计感够不够、这段描述能不能画出来。"
        "不要用一句话打发。\n"
        '{"boring": true或false, "why": "详细理由"}'
    )
    reply = chat(user, system=REVIEWER)
    data = _load_json(reply)
    boring = _as_bool(data.get("boring"), {"true", "yes", "是", "无聊", "过于简单"})
    why = str(data.get("why") or "").strip()
    design.setdefault("reviews", []).append({
        "role": "评审",
        "prompt": user,
        "reply": reply,
        "boring": boring,
        "why": why,
    })
    save_reviews(run_dir, design)
    return boring, why


def coerce_parts(raw) -> dict:
    """把设计方写出的部位收成四个键。tail 记到尾巴上。"""
    if not isinstance(raw, dict):
        return {}
    parts = {}
    for key, value in raw.items():
        name = str(key).strip()
        if name.lower() == "tail":
            name = "尾巴"
        if name in PART_KEYS:
            text = str(value or "").strip()
            if text:
                parts[name] = text
    return parts


def answer_review(brief: dict, design: dict, why: str, run_dir: Path | None = None) -> dict:
    """打回后先完全重写。写出的新稿留下，下一轮评审看这版。"""
    add_name = str(design.get("add") or "").strip()
    prototype = brief.get("设计原型", "")
    fusion = design.get("fusion") or {}
    parts = design.get("parts") or {}
    body = "\n".join(f"{key}：{parts.get(key, '')}" for key in PART_KEYS)
    user = (
        "评审把这份造型打回了。引入新的次要设计原型之前，先把现有设计完全重写。只输出一个 JSON。\n"
        f"名称：{brief.get('名称', '')}\n"
        f"设计原型：{prototype}\n"
        f"属性：{brief.get('属性', '')}\n"
        f"外貌描述：{brief.get('外貌描述', '')}\n"
        f"生态描述：{brief.get('生态描述', '')}\n"
        f"次要元素仍是：{add_name}。\n"
        f"上一次的融合部位是{fusion.get('part', '')}，方式是{fusion.get('mode', '')}。这次不作数。\n"
        f"上一次的部位，只作废稿，不要沿用句子：\n{body}\n"
        f"上一次的材质，不要沿用：{plain_text(design.get('material'))}\n"
        f"评审意见：{why or '过于简单，十分无聊'}。\n"
        "needNew 为 false：还用现在这个次要元素，做引入新原型之前的这次重写。"
        "重新从头部、躯干、四肢、尾巴里选定一个融合部位，重新选定一种融合方式，"
        "四个部位的造型描述和材质全部重写。上一次的部位、句子和材质都不保留。\n"
        "needNew 为 true：只有现有原型和这个次要元素上已经没有值得重写的造型，才引入一个新的设计原型。\n"
        "新原型从职业或文化符号里找。从设定的气质往外延伸，要发散。"
        "不准从设定原文里扣字眼，不准把外貌或生态里出现的名词直接拿来当原型。\n"
        "例如水狐的设定是露水、潮汐和渔歌，原文没有「贵族」。"
        "往被传唱、站在浪上的仪态延伸，可以落到贵族，于是用贵族服饰做记忆点，领圈和褶皱长在身上。\n"
        "新原型要是看得见的服饰、器物或身份符号，长在一个部位上，不放在旁边。\n"
        "目标是这个形象自己的记忆点，让人叫出角色，而不是认出设计原型。不要写成现实生物加一件器物。\n"
        "描述必须能画出来。不要写「对应」「位置是」。"
        "整个部位就是一件东西时，写成这个部位完全是那件东西。"
        "例如整个脑袋是火花塞：头颅完全是一个火花塞，做成玩具诡异风。\n"
        f"fusion.part 是这次新选的部位，只能是头部、躯干、四肢、尾巴之一。"
        "fusion.mode 是完全融合、附属部件、部分融合之一。"
        f"只有这个新部位的句子出现「{add_name}」。新原型如果要写，写在某一个部位上，用它自己的名字。\n"
        "键：needNew（true或false）、culture（新原型短词，不引入就留空）、"
        "cultureWhat（它是什么、长什么样）、parts（头部、躯干、四肢、尾巴）、fusion（part、mode）、material（质地对比）。"
    )
    reply = chat(user, system=DESIGNER)
    design.setdefault("reviews", []).append({
        "role": "设计",
        "prompt": user,
        "reply": reply,
    })
    save_reviews(run_dir, design)
    data = _load_json(reply)
    need_new = _as_bool(data.get("needNew"), {"true", "yes", "是"})
    culture = str(data.get("culture") or "").strip()
    culture_what = str(data.get("cultureWhat") or "").strip()
    written = coerce_parts(data.get("parts"))
    if not any(written.get(key) for key in PART_KEYS):
        raise RuntimeError("设计方没有写出新的部位。")
    new_parts = dict(parts)
    new_parts.update(written)
    new_fusion = normalize_fusion(data)
    landed = fused_part_keys(new_parts, add_name)
    if len(landed) == 1:
        new_fusion["part"] = landed[0]
    if new_fusion["mode"] not in FUSION_MODES:
        part_text = str(new_parts.get(new_fusion.get("part") or "") or "")
        if "材质" in part_text and "轮廓" not in part_text:
            new_fusion["mode"] = "部分融合"
        elif any(word in part_text for word in ("环", "飘带", "服饰", "尖刺", "云纹")) and "轮廓换成" not in part_text:
            new_fusion["mode"] = "附属部件"
        else:
            new_fusion["mode"] = "完全融合"
    if need_new and culture and culture not in "".join(str(new_parts.get(key) or "") for key in PART_KEYS):
        print(f"  新原型「{culture}」还没写进部位，评审看的是这版新稿。", flush=True)
    design["parts"] = new_parts
    design["fusion"] = new_fusion
    material = plain_text(data.get("material")).strip()
    if material:
        design["material"] = material
    if need_new:
        design["culture"] = {"name": culture, "what": culture_what}
        print(f"  设计方引入文化原型：{culture}。{culture_what}", flush=True)
    else:
        print(f"  设计方重写造型：{new_fusion['part']}，{new_fusion['mode']}。", flush=True)
    return design


def review_plain_parts(brief: dict, design: dict, run_dir: Path | None = None) -> dict:
    """评审打回后重写。下一轮评审看新稿，不把旧稿再评一遍。"""
    boring, why = judge_boring(brief, design, run_dir)
    for _ in range(ADD_TRIES):
        if not boring:
            print(f"  评审通过：{why or '不算过于简单'}。", flush=True)
            return design
        print(f"  评审打回：{why or '过于简单，十分无聊'}。", flush=True)
        try:
            design = answer_review(brief, design, why, run_dir)
        except RuntimeError as exc:
            print(f"  设计方这轮没写出新稿：{exc}", flush=True)
            continue
        boring, why = judge_boring(brief, design, run_dir)
    if not boring:
        print(f"  评审通过：{why or '不算过于简单'}。", flush=True)
        return design
    raise SystemExit(f"评审连打回3次，造型仍然过于简单。{why}")


def add_options_of(data: dict, add_name: str) -> list[str]:
    raw = data.get("addOptions") if isinstance(data.get("addOptions"), list) else []
    options = []
    for item in raw:
        word = str(item).strip()
        if word and word != add_name and word not in options and not any(banned in word for banned in ADD_HARD):
            options.append(word)
    return options[:10]


def fill_add_options(brief: dict, design: dict, options: list[str]) -> list[str]:
    """选定的次要原型之外，补满 10 个别的可行选择。"""
    add_name = str(design.get("add") or "").strip()
    have = list(options)
    if len(have) >= 10:
        return have[:10]
    user = (
        f"次要设计元素已经选定「{add_name}」。再给 {10 - len(have)} 个别的可行选择，和它同时成立。只输出 JSON。\n"
        f"名称：{brief.get('名称', '')}\n"
        f"设计原型：{brief.get('设计原型', '')}\n"
        f"属性：{brief.get('属性', '')}\n"
        f"外貌描述：{brief.get('外貌描述', '')}\n"
        f"生态描述：{brief.get('生态描述', '')}\n"
        f"已经有的：{'、'.join(have) or '无'}。不要重复，也不要再给「{add_name}」的同一种东西。\n"
        "要发散，仍和属性或气质有关。电属性可以远到插头、雷龙。\n"
        "每个都要一眼一个轮廓。不要火花塞这类要靠很多零件才认得出、本身就很难画的东西。\n"
        '{"addOptions": ["短词"]}'
    )
    data = _load_json(chat(user, system=DESIGNER))
    for word in add_options_of(data, add_name):
        if word not in have:
            have.append(word)
        if len(have) >= 10:
            break
    return have


def review_add_spread(brief: dict, design: dict, options: list[str], run_dir: Path | None) -> tuple[bool, str]:
    """评审这次次要原型的联想是否又发散、又有关联。"""
    add_name = str(design.get("add") or "").strip()
    user = (
        "评估这次次要设计原型的联想。只输出 JSON，不要改选。\n"
        f"名称：{brief.get('名称', '')}\n"
        f"设计原型：{brief.get('设计原型', '')}\n"
        f"属性：{brief.get('属性', '')}\n"
        f"外貌描述：{brief.get('外貌描述', '')}\n"
        f"生态描述：{brief.get('生态描述', '')}\n"
        f"选定：{add_name}\n"
        f"另外10个：{'、'.join(options)}\n"
        "要同时发散和保有关联。\n"
        "不通过：选定的和这 10 个挤在同一种东西上。电属性如果全是避雷针、避雷塔、引雷针这种金属杆，说明只能想到这一个，联想太差。\n"
        "也不通过：选定的或这 10 个里有本身就很难画、要靠很多零件才认得出的东西。火花塞就是这种，不要出现。\n"
        "通过：离设定的字面远，但仍和属性或气质有关。例如电可以联到插头，也可以联到雷龙。避雷针本身可以留下，但这 10 个里要有离它很远的选择。\n"
        "why 要写详细：这 10 个里哪些太近，哪些够远，选定的那个为什么留或为什么该换。\n"
        '{"pass": true或false, "why": "详细理由"}'
    )
    reply = chat(user, system=REVIEWER)
    data = _load_json(reply)
    passed = _as_bool(data.get("pass"), {"true", "yes", "是", "通过"})
    why = str(data.get("why") or "").strip()
    design.setdefault("reviews", []).append({
        "role": "次要原型评审",
        "prompt": user,
        "reply": reply,
        "pass": passed,
        "why": why,
        "add": add_name,
        "addOptions": options,
    })
    save_reviews(run_dir, design)
    return passed, why


def ask_design(brief: dict, run_dir: Path | None = None) -> dict:
    """第1步之后，以及第3到第6步，都向文字模型要。次要元素要过反问，第5步再做形态融合。"""
    rejected = []
    last_check = {}
    for _ in range(ADD_TRIES):
        design = _load_json(chat(_design_question(brief, rejected), system=DESIGNER))
        add_name = str(design.get("add") or "").strip()
        if not add_name:
            print("  次要设计元素是空的，重问。", flush=True)
            continue
        print(f"  次要设计元素：{add_name}，反问中…", flush=True)
        if any(banned in add_name for banned in ADD_HARD):
            print(f"  反问没过：「{add_name}」本身就很难画，不能做次要原型。", flush=True)
            rejected.append(add_name)
            continue
        ok, last_check = challenge_add(add_name)
        design["addCheck"] = last_check
        if ok:
            print(f"  反问通过：{last_check['what']}。外形：{last_check['shape']}", flush=True)
            options = fill_add_options(brief, design, add_options_of(design, add_name))
            design["addOptions"] = options
            print("  另外10个：" + "、".join(options), flush=True)
            passed, why = review_add_spread(brief, design, options, run_dir)
            if not passed:
                print(f"  次要原型评审打回：{why or '联想太窄'}。", flush=True)
                rejected.append(add_name)
                continue
            print(f"  次要原型评审通过：{why or '又发散又有关联'}。", flush=True)
            design.update(ask_parts(brief, design))
            return review_plain_parts(brief, design, run_dir)
        print(
            f"  反问没过：说不清「{add_name}」。"
            f"known={last_check.get('known')} what={last_check.get('what') or '空'} shape={last_check.get('shape') or '空'}",
            flush=True,
        )
        rejected.append(add_name)
    detail = last_check.get("what") or last_check.get("shape") or "没有说清"
    raise SystemExit(f"次要设计元素连问{ADD_TRIES}次仍说不清。最后一次：{detail}")


def plain_text(value) -> str:
    if isinstance(value, dict):
        return "；".join(f"{key}是{item}" for key, item in value.items())
    if isinstance(value, list):
        return "、".join(str(item) for item in value)
    return str(value or "")


def color_phrase(item: dict) -> str:
    name = str(item.get("name") or "").strip()
    hex_code = str(item.get("hex") or "").strip()
    where = str(item.get("where") or "").strip()
    mood = str(item.get("mood") or "").strip()
    if mood:
        return f"{name} {hex_code}，{mood}感。"
    return f"{name} {hex_code}（{where}）；"


SHAPE_WEAK = ("圆胖", "圆润短粗", "质感", "基础轮廓", "基础比例", "贴合原描述", "保持", "保留猫", "保留原型")


def shape_hits(parts: dict, pose: str) -> list[str]:
    blob = pose + "".join(str((parts or {}).get(key) or "") for key in PART_KEYS)
    return [word for word in SHAPE_WEAK if word in blob]


def revise_shape(brief: dict, design: dict, draft: str) -> dict:
    """只重写姿态。部位和材质已经一起评审过。"""
    note = ""
    for _ in range(ADD_TRIES):
        user = (
            "部位、材质和融合方式已经定下来，不要改。只重写姿态，让它和这些部位一致。只输出一个 JSON。\n"
            "姿态里不要出现这些词，否定句里也不要复述：圆胖、圆润短粗、质感、保持、基础轮廓、基础比例。\n"
            "留在地面或空气里的痕迹不要画在身上。\n"
            "不要出现旁边的道具，也不要把次要元素画成站在旁边的物件。\n"
            "键只有 pose。\n"
            f"{note}\n"
            "已经定下的提示词：\n"
            f"{draft}"
        )
        data = _load_json(chat(user, system=DESIGNER))
        pose = str(data.get("pose") or "").strip()
        hits = shape_hits({}, pose)
        if pose and not hits:
            design["pose"] = pose
            fusion = design.get("fusion") or {}
            print(f"  姿态已写下：{fusion.get('part', '')}，{fusion.get('mode', '')}。部位和材质未改。", flush=True)
            return design
        print(f"  姿态没写好：{'、'.join(hits) or '姿态是空的'}。", flush=True)
        note = "上一轮姿态不合格。部位和材质保持原样，只重写 pose。\n"
    raise SystemExit("姿态连问3次，仍没写下。")


COLOR_FINE = ("边缘", "残留", "焦痕", "焦", "烧", "痕迹", "伤口", "细碎")


def color_hits(colors: dict) -> list[str]:
    blob = json.dumps(colors, ensure_ascii=False)
    return [word for word in COLOR_FINE if word in blob]


COLOR_KEYS = ("主体色1", "主体色2", "特征色1", "特征色2", "眼睛色")
ABSENT_BODY = ("鼻", "耳", "脸", "嘴", "吻", "胡须", "眉")


def color_where_text(colors: dict) -> str:
    return "\n".join(plain_text((colors or {}).get(key) or {}) for key in COLOR_KEYS)


def color_off_appearance(design: dict) -> list[str]:
    """配色只能写已经定稿的外观里真有的构造。换成器物的部位要写这件器物的颜色。"""
    parts = design.get("parts") or {}
    appearance = "\n".join(str(parts.get(key) or "") for key in PART_KEYS)
    where = color_where_text(design.get("colors") or {})
    hits = [word for word in ABSENT_BODY if word in where and word not in appearance]
    fusion = design.get("fusion") if isinstance(design.get("fusion"), dict) else {}
    add_name = str(design.get("add") or "").strip()
    part = str(fusion.get("part") or "").strip()
    if str(fusion.get("mode") or "").strip() == "完全融合" and part == "头部" and "头" in where:
        hits.append("头")
    if add_name and add_name in appearance and add_name not in where:
        hits.append(f"没有{add_name}的颜色")
    return hits


def review_colors(design: dict, run_dir: Path | None) -> tuple[bool, str]:
    """配色评审：对着定稿外观上色，安排不能过繁，也不能过简。"""
    parts = design.get("parts") or {}
    where = "\n".join(
        f"{key}：{plain_text((design.get('colors') or {}).get(key) or {})}"
        for key in COLOR_KEYS
    )
    body = "\n".join(f"{key}：{parts.get(key, '')}" for key in PART_KEYS)
    user = (
        "评审这份配色。不要改色，不要重写部位。只输出 JSON。\n"
        "配色必须对着下面的部位来。只给这些句子里真的出现的构造上色。\n"
        f"部位：\n{body}\n"
        f"材质：{plain_text(design.get('material', ''))}\n"
        f"配色：\n{where}\n"
        "三件事都要过。\n"
        "对着外观：where 里的部位必须是上面写过的构造。外观里没有的不要写，例如头部已经换成刀片，就不要写头、鼻尖、耳朵。"
        "被换成器物的部位，要写出这件器物本身是什么颜色。头部是刀片，配色里就要有刀片的颜色。\n"
        "覆盖：部位句子里看得见的大面都要落到某一条颜色上。眼睛或瞳孔有眼睛色就算盖住。\n"
        "安排：配色要让人记住这个角色。过于繁复不通过，例如颜色过多、只点在细碎处、大面被拆碎。"
        "过于简单不通过，例如全身一个颜色、没有主次、看不出这个角色自己的配色。\n"
        "边缘、残留、痕迹、伤口、焦、烧不算合格的配色。\n"
        "why 要写详细：哪些构造盖住了，有没有写进外观里没有的部位，器物有没有自己的颜色，安排为什么合适或为什么过繁、过简。\n"
        '{"pass": true或false, "why": "详细理由"}'
    )
    reply = chat(user, system=REVIEWER)
    data = _load_json(reply)
    passed = _as_bool(data.get("pass"), {"true", "yes", "是", "通过"})
    why = str(data.get("why") or "").strip()
    design.setdefault("reviews", []).append({
        "role": "配色评审",
        "prompt": user,
        "reply": reply,
        "pass": passed,
        "why": why,
    })
    save_reviews(run_dir, design)
    return passed, why


def revise_colors(brief: dict, design: dict, run_dir: Path | None = None) -> dict:
    """配色评审不通过就重写，不把没通过的配色拿去生图。"""
    note = ""
    for _ in range(ADD_TRIES):
        hits = color_hits(design.get("colors") or {})
        off = color_off_appearance(design)
        if hits or off:
            passed = False
            why = "配色脱离了外观：" + "、".join(hits + off)
        else:
            passed, why = review_colors(design, run_dir)
        if passed:
            print(f"  配色评审通过：{why or '覆盖住了，安排也合适'}。", flush=True)
            return design
        print(f"  配色评审打回：{why or '过繁或过简'}。", flush=True)
        parts = design.get("parts") or {}
        body = "\n".join(f"{key}：{parts.get(key, '')}" for key in PART_KEYS)
        user = (
            "配色要按已经定稿的外观重写。请只重写配色。只输出一个 JSON。\n"
            "对着下面的部位上色。where 只写这些句子里真的出现的构造，没有出现的部位不要写。\n"
            "被换成器物的部位，写这件器物本身的颜色。头部是刀片，就要写刀片是什么颜色，不要写头、鼻尖、耳朵。\n"
            f"部位：\n{body}\n"
            f"材质：{plain_text(design.get('material', ''))}\n"
            "主体色撑大面，特征色做这个角色自己的点缀，不要全身一个颜色，也不要拆成细碎色块。\n"
            "不要写边缘、残留、痕迹、伤口、细碎部位，也不要写焦、烧。留在地面或空气里的现象不要做成身体颜色。\n"
            "键为 colors。里面是 主体色1、主体色2、特征色1、特征色2、眼睛色，每项含 name、hex、where。眼睛色再加 mood。\n"
            f"评审意见：{why}\n"
            f"{note}\n"
            "待修改的提示词：\n"
            f"{assemble_prompt(brief, design)}"
        )
        data = _load_json(chat(user, system=DESIGNER))
        colors = data.get("colors") if isinstance(data.get("colors"), dict) else {}
        if not (colors.get("主体色1") and colors.get("眼睛色")):
            note = "上一轮颜色不完整。主体色1和眼睛色都要有，每个大面都要落到某一条 where。\n"
            continue
        design["colors"] = colors
        note = ""
    raise SystemExit("配色评审连打回3次，仍过繁、过简，或大面没有颜色。")


def appearance_block(design: dict) -> str:
    """有白描就用白描。整理之前仍用分部位的设计稿。"""
    outline = str(design.get("outline") or "").strip()
    if outline:
        return f"外观：{outline}\n"
    parts = design.get("parts") or {}
    return (
        "部位：\n"
        f"头部：{parts.get('头部', '')}；\n"
        f"躯干：{parts.get('躯干', '')}；\n"
        f"四肢：{parts.get('四肢', '')}；\n"
        f"尾巴：{parts.get('尾巴', '')}；\n"
        f"姿态：{design.get('pose', '')}。\n"
    )


def assemble_prompt(brief: dict, design: dict) -> str:
    colors = design.get("colors") or {}
    return (
        f"{brief.get('名称', '')}，{brief.get('属性', '')}属性{brief.get('设计原型', '')}型精灵。\n"
        f"{appearance_block(design)}"
        "构图：整个精灵完整展示在画面中央，上下左右留边，不要裁切。纯白背景。\n\n"
        "配色：\n"
        f"主体色1：{color_phrase(colors.get('主体色1') or {})}\n"
        f"主体色2：{color_phrase(colors.get('主体色2') or {})}\n"
        f"特征色1：{color_phrase(colors.get('特征色1') or {})}\n"
        f"特征色2：{color_phrase(colors.get('特征色2') or {})}\n"
        f"眼睛色：{color_phrase(colors.get('眼睛色') or {})}\n"
        f"材质对比：{plain_text(design.get('material', ''))}。\n"
        "赛璐璐画风。\n"
        "构图要求纯白背景。"
    )


def review_match(design: dict, prompt: str, image_path: Path, run_dir: Path | None) -> tuple[bool, str]:
    """第一环节：成图对不对得上设定稿。只写不符合的地方。"""
    question = (
        "你在对照这张成图和下面的设定稿。只根据画面里实际画出来的东西判断，"
        "不要把设定稿当成已经画出来的事实。不要分析原因，不要改提示词。只输出 JSON。\n"
        f"设定稿：\n{prompt}\n"
        "match 为 true：画面和设定稿是同一件东西。gaps 留空。\n"
        "match 为 false：画面和设定稿不是同一件东西。\n"
        "gaps 只写不符合的地方：设定稿要的是什么，画面里实际是什么。\n"
        '{"match": true或false, "gaps": "不符合的地方"}'
    )
    reply = see_image(image_path, question)
    try:
        data = _load_json(reply)
    except RuntimeError:
        data = {}
    matched = _as_bool(data.get("match"), {"true", "yes", "是", "符合"})
    gaps = "" if matched else (str(data.get("gaps") or "").strip() or reply[:300])
    design.setdefault("reviews", []).append({
        "role": "生图对照",
        "prompt": question,
        "reply": reply,
        "match": matched,
        "gaps": gaps,
    })
    save_reviews(run_dir, design)
    return matched, gaps


def review_cause(design: dict, prompt: str, image_path: Path, gaps: str, run_dir: Path | None) -> tuple[str, str]:
    """第二环节：为什么没按设定画。看描述没写清，还是设计本身难落地。"""
    question = (
        "成图没有按设定稿来。分析原因。不要改提示词。不要把不符合的地方再写一遍，第一步已经写过了。只输出 JSON。\n"
        f"设定稿：\n{prompt}\n"
        f"不符合的地方只作参考，不要复述：\n{gaps}\n"
        "kind 为 描述：设定里某处没有写成能画的外形。指出是哪一句，它让人能读成两种东西，或只写了零件对应、没有一个确定的轮廓。\n"
        "kind 为 设计：这个设计本身很难落地。按现在的想法，画的人不知道该画成什么样。"
        "整个脑袋是火花塞就属于这种：不写成头颅完全是一个火花塞、玩具诡异风，就画不出来。\n"
        "kind 为 成图：描述已经是一个确定的外形，不会读成两种东西，是成图没有照这个外形画。\n"
        "cause 只写这个原因，不要逐条重复画面和设定稿的差异。\n"
        '{"kind": "描述或设计或成图", "cause": "原因"}'
    )
    reply = see_image(image_path, question)
    try:
        data = _load_json(reply)
    except RuntimeError:
        data = {}
    kind = str(data.get("kind") or "").strip()
    if kind not in {"描述", "设计", "成图"}:
        kind = "描述"
    cause = str(data.get("cause") or "").strip() or reply[:300]
    design.setdefault("reviews", []).append({
        "role": "生图原因",
        "prompt": question,
        "reply": reply,
        "kind": kind,
        "cause": cause,
    })
    save_reviews(run_dir, design)
    return kind, cause


def revise_sent_prompt(design: dict, prompt: str, gaps: str, cause: str, run_dir: Path | None) -> str:
    """提示词不便于理解或不好生成时，按原因改一版，下一轮发这版。"""
    user = (
        "生图没有按设定稿来。按原因把提示词改成能画的外形。只输出改后的完整提示词，不要解释。\n"
        "原因如果是描述没写清，就把那几句写成一个确定的轮廓。\n"
        "原因如果是设计很难落地，就改成唯一能画出来的说法。"
        "整个部位就是一件东西时，写成这个部位完全是那件东西。"
        "例如整个脑袋是火花塞：头颅完全是一个火花塞，做成玩具诡异风。不要写耳位对应、吻部对应。\n"
        "没有被点出问题的造型留着。\n"
        f"不符合的地方：{gaps}\n"
        f"原因：{cause}\n"
        f"当前提示词：\n{prompt}"
    )
    reply = chat(user, system=DESIGNER).strip()
    reply = re.sub(r"^```(?:\w+)?\s*", "", reply)
    reply = re.sub(r"\s*```$", "", reply).strip()
    design.setdefault("reviews", []).append({
        "role": "提示词修改",
        "prompt": user,
        "reply": reply,
    })
    save_reviews(run_dir, design)
    return reply


def consolidate_outline(design: dict, run_dir: Path | None) -> dict:
    """生图前把分部位的造型收成一段白描。旧的部位句子留在设计记录里，不再写进提示词。"""
    parts = design.get("parts") or {}
    body = "\n".join(f"{key}：{parts.get(key, '')}" for key in PART_KEYS)
    user = (
        "把已经定下的造型收成一段白描外观。只输出一个 JSON。\n"
        "白描写画完之后看得见的样子，一段连续的外形，不要分头部、躯干、四肢、尾巴来标题。\n"
        "不要写设计过程，不要写原本、替换、演化、融合、对应。\n"
        "整个部位就是一件东西时，写成这个部位完全是那件东西。"
        "例如整个脑袋是火花塞：头颅完全是一个火花塞，做成玩具诡异风。\n"
        "已经定下的造型都要留在这段话里。不要改回一只普通的设计原型，也不要另加旁边的物件。\n"
        "姿态写进这段外观里。不写配色，颜色后面另列。\n"
        '键只有 outline。\n'
        f"造型：\n{body}\n"
        f"姿态：{design.get('pose', '')}"
    )
    reply = chat(user, system=DESIGNER)
    design.setdefault("reviews", []).append({"role": "外形整理", "prompt": user, "reply": reply})
    save_reviews(run_dir, design)
    data = _load_json(reply)
    outline = str(data.get("outline") or "").strip()
    if not outline:
        raise SystemExit("外形整理没有写出外观。")
    design["outline"] = outline
    print("  外观已收成白描。", flush=True)
    return design


def finish_manuscript(brief: dict, design: dict, run_dir: Path | None) -> dict:
    """完稿后整体看一遍。打回就重写外观，下一轮看新稿。"""
    for index in range(ADD_TRIES):
        prompt = assemble_prompt(brief, design)
        user = (
            "这是完稿。整体看一遍，不要改稿。只输出 JSON。\n"
            f"{prompt}\n"
            "三件事都要过。\n"
            "特点：整体形象有记忆点，让人叫出这个角色，而不是只认出设计原型。"
            "第一句里的设计原型用来保住原型元素，不能因此把造型评回一只现实生物。\n"
            "配色：颜色搭配合理，不过繁，也不过简。配色只写外观里出现的构造。"
            "被换成器物的部位要有这件器物的颜色。外观里没有的头、鼻尖、耳朵不要出现在配色里。\n"
            "一致：外观、材质、配色之间没有互相矛盾。\n"
            "能画：外观必须是一个确定的外形。用「对应」把零件安到还在的生物部位上，画不出来，不通过。"
            "整个脑袋是火花塞，要通过的写法是头颅完全是一个火花塞，做成玩具诡异风。\n"
            "why 要写详细，点出哪里没特点、哪里配色不合适、哪里前后矛盾。\n"
            '{"pass": true或false, "why": "详细理由"}'
        )
        reply = chat(user, system=REVIEWER)
        data = _load_json(reply)
        passed = _as_bool(data.get("pass"), {"true", "yes", "是", "通过"})
        why = str(data.get("why") or "").strip()
        design.setdefault("reviews", []).append({
            "role": "完稿评审",
            "prompt": user,
            "reply": reply,
            "pass": passed,
            "why": why,
        })
        save_reviews(run_dir, design)
        if passed:
            print(f"  完稿评审通过：{why or '有特点，配色合理，前后一致'}。", flush=True)
            return design
        print(f"  完稿评审打回：{why or '有矛盾'}。", flush=True)
        if index == ADD_TRIES - 1:
            break
        fix = (
            "完稿评审没通过。只改它点出的问题。只输出一个 JSON。\n"
            "外观整段重写，仍是一段白描，不要再拆成头部、躯干、四肢、尾巴。\n"
            "已经有的记忆点留着。第一句里的设计原型用来保住原型元素，不要把造型改回一只现实生物。\n"
            "键可以有 outline、material、colors。没改的键不要输出。\n"
            "outline 是改后的整段外观。写了就必须是完整的新外观，不要沿用旧句子。\n"
            f"评审意见：{why}\n"
            f"完稿：\n{prompt}"
        )
        fixed = _load_json(chat(fix, system=DESIGNER))
        design.setdefault("reviews", []).append({
            "role": "完稿修改",
            "prompt": fix,
            "reply": json.dumps(fixed, ensure_ascii=False),
        })
        save_reviews(run_dir, design)
        outline = str(fixed.get("outline") or "").strip()
        if not outline:
            raise SystemExit("完稿打回后没有写出新的外观。")
        design["outline"] = outline
        material = plain_text(fixed.get("material")).strip()
        if material:
            design["material"] = material
        colors = fixed.get("colors") if isinstance(fixed.get("colors"), dict) else {}
        if colors.get("主体色1") and colors.get("眼睛色") and not color_hits(colors):
            previous = design.get("colors")
            design["colors"] = colors
            off = color_off_appearance(design)
            if off:
                design["colors"] = previous
                print(f"  完稿改写的配色脱离外观：{'、'.join(off)}。这版颜色不采用。", flush=True)
        print("  外观已按完稿意见重写，下一轮看这版。", flush=True)
    raise SystemExit("完稿评审连打回3次，形象、配色或前后矛盾还在。")


def image_prompt(base: str, negative: str) -> str:
    """提示词没问题时，下一轮带上一次怎么做不行。"""
    if not negative.strip():
        return base
    return (
        f"{base.rstrip()}\n\n"
        "上一次成图不符合设定稿的地方：\n"
        f"{negative.strip()}\n"
    )


def generate_portrait(token: str, form_query: str | None, rounds: int) -> Path:
    name, brief, number = resolve_brief(token)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    run_dir = CACHE_ROOT / number / stamp
    run_dir.mkdir(parents=True)
    print("询问设计…", flush=True)
    design = ask_design(brief, run_dir)
    add_name = str(design.get("add") or "").strip()
    if not add_name:
        raise SystemExit("文字模型没有给出次要设计元素。")
    draft = assemble_prompt(brief, design)
    (run_dir / "prompt.draft.txt").write_text(draft, encoding="utf-8")
    print("修订造型…", flush=True)
    design = revise_shape(brief, design, draft)
    print("配色评审…", flush=True)
    design = revise_colors(brief, design, run_dir)
    print("外形整理…", flush=True)
    design = consolidate_outline(design, run_dir)
    print("完稿评审…", flush=True)
    design = finish_manuscript(brief, design, run_dir)
    (run_dir / "design.json").write_text(json.dumps(design, ensure_ascii=False, indent=2), encoding="utf-8")
    prompt = assemble_prompt(brief, design)
    (run_dir / "prompt.txt").write_text(prompt, encoding="utf-8")
    negative = ""
    steps: list[dict] = []
    generated = {}
    matched = False
    why = ""
    for attempt in range(1, IMAGE_TRIES + 1):
        sent = image_prompt(prompt, negative)
        (run_dir / f"prompt.image-{attempt}.txt").write_text(sent, encoding="utf-8")
        (run_dir / "prompt.image.txt").write_text(sent, encoding="utf-8")
        print(f"生图中…第{attempt}次", flush=True)
        try:
            generated = generate_image(sent, size="1366x2048")
        except RuntimeError as exc:
            if "size" not in str(exc).lower():
                raise
            generated = generate_image(sent, size="2K")
        attempt_image = run_dir / f"result-{attempt}.png"
        save_result_image(generated, attempt_image)
        shutil.copyfile(attempt_image, run_dir / "result.png")
        print("生图对照…", flush=True)
        matched, gaps = review_match(design, prompt, attempt_image, run_dir)
        if matched:
            print(f"生图评审通过：{gaps or '画面和设定稿对得上'}。", flush=True)
            why = gaps
            break
        print(f"生图不符合设定稿：{gaps}", flush=True)
        print("分析原因…", flush=True)
        kind, cause = review_cause(design, prompt, attempt_image, gaps, run_dir)
        note = f"不符合设定稿：\n{gaps}\n原因：\n{cause}\n"
        (run_dir / f"result-{attempt}.txt").write_text(note, encoding="utf-8")
        why = gaps
        if kind == "成图":
            negative = gaps
            print("  描述已经是确定外形，是成图没照着画。下一轮带上不符合的地方。", flush=True)
            steps.append({"kind": kind, "gaps": gaps, "cause": cause})
            continue
        negative = ""
        revised = revise_sent_prompt(design, prompt, gaps, cause, run_dir)
        if revised and revised != prompt:
            prompt = revised
            (run_dir / "prompt.txt").write_text(prompt, encoding="utf-8")
            print(f"  原因是{kind}。已把提示词改成能画的外形，下一轮发改后的稿。", flush=True)
        else:
            print(f"  原因是{kind}。改写没有得到新稿，下一轮仍用这一份。", flush=True)
        steps.append({
            "kind": kind,
            "gaps": gaps,
            "cause": cause,
            "revised": bool(revised and revised != prompt),
        })
    report = {
        "name": name,
        "number": number,
        "speciesId": species_id_for(name),
        "brief": brief,
        "design": design,
        "addQuery": add_name,
        "prompt": prompt,
        "model": generated.get("model"),
        "references": [],
        "result": "result.png",
        "library": None,
        "imageReview": {"match": matched, "why": why, "tries": attempt, "steps": steps},
    }
    (run_dir / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    (run_dir / "design.json").write_text(json.dumps(design, ensure_ascii=False, indent=2), encoding="utf-8")
    if not matched:
        raise SystemExit(f"生图评审连打回{IMAGE_TRIES}次，成图仍和定稿对不上。流程有问题。{why}")
    print(f"已写入缓存，尚未落库：{run_dir}", flush=True)
    return run_dir


def accept(run_dir: Path) -> Path:
    report_path = run_dir / "report.json"
    result = run_dir / "result.png"
    if not report_path.is_file() or not result.is_file():
        raise SystemExit("这个缓存目录里没有 report.json 或 result.png。")
    report = json.loads(report_path.read_text(encoding="utf-8"))
    species_id = report.get("speciesId")
    if not species_id:
        raise SystemExit("摘录名称对不上物种 id，没有落库。")
    number = species_id.rsplit("_", 1)[-1]
    LIBRARY.mkdir(parents=True, exist_ok=True)
    dest = LIBRARY / f"{number}_{species_id}.png"
    shutil.copy(result, dest)
    report["library"] = str(dest.relative_to(ROOT)).replace("\\", "/")
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"已落库：{dest}")
    return dest


def main() -> None:
    parser = argparse.ArgumentParser(description="按设计摘录搜索参考图并生成立绘，先放缓存。")
    parser.add_argument("name", help="物种编号（如 0030）、精灵名称，或 accept")
    parser.add_argument("cache_dir", nargs="?", help="accept 时要落库的缓存目录")
    parser.add_argument("--form-query", help="形态参考的搜索关键词，默认只用设计原型")
    parser.add_argument("--rounds", type=int, default=ROUNDS, help="每一类参考最多搜索几轮，默认 5")
    args = parser.parse_args()
    if args.name == "fetch-roco":
        fetch_roco_library()
        return
    if args.name == "accept":
        if not args.cache_dir:
            raise SystemExit("用法: python tools/portrait_gen.py accept <缓存目录>")
        accept(Path(args.cache_dir))
        return
    generate_portrait(args.name, args.form_query, args.rounds)


if __name__ == "__main__":
    main()
