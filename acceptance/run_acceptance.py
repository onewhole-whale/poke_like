# 按仍未归档的需求文档验收当前原型。
# 用法：在仓库根目录执行  python acceptance/run_acceptance.py
# 游戏规则还在 index.html 里。本脚本只负责对照验收标准，不把规则再写一份。

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PROBE = ROOT / "probe.js"


def run_probe():
    proc = subprocess.run(
        ["node", str(PROBE)],
        cwd=str(ROOT.parent),
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    if proc.returncode != 0 or not proc.stdout.strip():
        sys.stderr.write(proc.stderr or "")
        raise SystemExit("探针没有跑起来。\n" + (proc.stderr or proc.stdout or ""))
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError as e:
        raise SystemExit("探针输出不是 JSON：%s\n%s" % (e, proc.stdout[:500]))


def check(results, doc, item, ok, detail):
    results.append({"doc": doc, "item": item, "ok": bool(ok), "detail": detail})


def main():
    data = run_probe()
    results = []

    dmg_doc = "开发计划 · 伤害公式（v1.11 宝可梦式，随机取上沿）"
    dmg = data.get("damage") or {}
    if dmg.get("error"):
        check(results, dmg_doc, "公式可调用", False, dmg["error"])
    else:
        check(results, dmg_doc, "100攻/30级/50防/60威力 = 35", dmg.get("base") == 35, "得到 %s" % dmg.get("base"))
        check(results, dmg_doc, "火克草为 2 倍（70）", dmg.get("crushed") == 70, "得到 %s" % dmg.get("crushed"))
        check(results, dmg_doc, "火打水为抵抗（约 18）", dmg.get("resisted") == 18, "得到 %s" % dmg.get("resisted"))
        check(results, dmg_doc, "伤害保底至少 1", (dmg.get("floor") or 0) >= 1, "得到 %s" % dmg.get("floor"))

    exp_doc = "设计手册 · 经验 = max(5, 等级 × 基础经验 × 模板系数)"
    exp = data.get("exp") or {}
    if exp.get("error"):
        check(results, exp_doc, "经验可结算", False, exp["error"])
    else:
        check(results, exp_doc, "10级普通怪、普通模板 = 100", exp.get("normal") == 100, "得到 %s" % exp.get("normal"))
        check(results, exp_doc, "同怪精英模板 ×2 = 200", exp.get("eliteTemplate") == 200, "得到 %s" % exp.get("eliteTemplate"))
        check(results, exp_doc, "传说基础 40、首领模板 ×3 = 1200", exp.get("legendBoss") == 1200, "得到 %s" % exp.get("legendBoss"))

    map_doc = "补丁 · 变体地块侵蚀；M3-1-6 三张地图都要能生成"
    maps = data.get("maps") or {}
    if maps.get("error"):
        check(results, map_doc, "地图生成", False, maps["error"])
    else:
        for mid, title in (
            ("gentlebreeze", "微风平原"),
            ("stillswamp", "静水沼泽"),
            ("smokevolcano", "冒烟火山"),
        ):
            m = maps.get(mid) or {}
            check(
                results, map_doc,
                "%s 生成满格、不崩溃" % title,
                m.get("ok") and m.get("empty") == 0 and m.get("size") == 7,
                m.get("error") or "size=%s empty=%s" % (m.get("size"), m.get("empty")),
            )
        hop = maps.get("stillswampHop") or {}
        check(
            results, map_doc,
            "毒瘴沼泽能跳过非同类地块，40 局里至少 1 局分成两块",
            (hop.get("multi") or 0) >= 1 and not hop.get("error"),
            "40 局里多块 %s 次%s" % (hop.get("multi"), ("；" + hop["error"]) if hop.get("error") else ""),
        )

    mat_doc = "M3-2 补丁 b · 验收 11 击杀品质解锁"
    up = data.get("upMat") or {}
    if up.get("error"):
        check(results, mat_doc, "品质升级函数", False, up["error"])
    else:
        check(results, mat_doc, "普通模板不升档", up.get("normalQ") == "normal", "得到 %s" % up.get("normal"))
        check(results, mat_doc, "精英模板 +1 档（优秀）", up.get("eliteQ") == "good", "得到 %s %s" % (up.get("elite"), up.get("eliteQ")))
        check(results, mat_doc, "首领模板 +2 档（精良）", up.get("bossQ") == "fine", "得到 %s %s" % (up.get("boss"), up.get("bossQ")))
    kill = data.get("killUpgrade") or {}
    if kill.get("error"):
        check(results, kill and mat_doc, "真实击杀掉落", False, kill["error"])
    else:
        check(
            results, mat_doc,
            "烬烬狼精英击杀的掉落里出现更高一档素材",
            (kill.get("upgraded") or 0) > 0,
            "基础 %s 条，实际升档 %s 条" % (len(kill.get("baseIds") or []), kill.get("upgraded")),
        )

    name_doc = "设计手册 · 名字禁用字：圣、神、魔"
    names = data.get("names") or {}
    if names.get("error"):
        check(results, name_doc, "名字扫描", False, names["error"])
    else:
        bad = names.get("bad") or []
        shown = "、".join("%s（%s）" % (x["name"], x["where"]) for x in bad[:12])
        if len(bad) > 12:
            shown += " 等 %s 处" % len(bad)
        check(results, name_doc, "物种、素材、技能、副本怪的名字都不含禁用字", len(bad) == 0, shown or "扫描 %s 个名字" % names.get("checked"))

    bdoc = "M3-2 补丁 b · 验收标准"
    b = data.get("battle") or {}
    if b.get("error"):
        check(results, bdoc, "战斗场景可搭起来", False, b["error"])
    else:
        card = b.get("fullRoundCard") or {}
        text = card.get("text") or ""
        check(results, bdoc, "1 我方出招后名片上有技能名", bool(text) and "炎" in text or "拳" in text or "掌" in text or len(text) > 0 and card.get("cls", "").find("left") >= 0, "名片=%r" % text)
        check(results, bdoc, "1 我方名片带克制标记，并且在技能名右侧", ("→" in text) and text.rstrip().endswith("→") or text.endswith("→↑") or text.endswith("→↓") or text.endswith("→"), "名片=%r" % text)
        dmg_nodes = b.get("fullRoundDmg") or []
        check(results, bdoc, "5 我方这回合的伤害数字出现在场地上", len(dmg_nodes) > 0, "飘字 %s" % dmg_nodes)
        check(results, bdoc, "5 治疗数字使用绿色 heal 样式", (b.get("fullRoundHeal") or 0) > 0 or any("heal" in (n.get("cls") or "") for n in dmg_nodes), "带 heal 的节点 %s" % b.get("fullRoundHeal"))
        check(results, bdoc, "5 命中时攻击方前冲、受击方闪红", b.get("lunge") and b.get("hit"), "前冲 %s，受击 %s" % (b.get("lunge"), b.get("hit")))
        check(results, bdoc, "5 按属性生成粒子（10 到 20 粒）", 10 <= (b.get("fullRoundParticles") or 0) <= 20, "粒子 %s 粒" % b.get("fullRoundParticles"))
        check(results, bdoc, "2 我方血条 hover 有当前/上限", len(b.get("hpTitles") or []) >= 1, "title %s" % b.get("hpTitles"))
        check(results, bdoc, "2 敌方血条 hover 没有数值", not b.get("enemyHpHasTitle"), "敌方有 title：%s" % b.get("enemyHpHasTitle"))
        check(results, bdoc, "4 左右展示板都有血量数字", len(b.get("sideHp") or []) >= 2 and all("/" in x for x in b.get("sideHp") or []), "展示板 %s" % b.get("sideHp"))
        last = (b.get("logDataLast") or "")[:12]
        check(results, bdoc, "3 战斗日志最新一条在最上面", bool(last) and last[:8] in (b.get("logDomFirst") or ""), "数据最后=%r 界面第一条=%r" % (b.get("logDataLast"), b.get("logDomFirst")))
        check(results, bdoc, "10 背包空的时候有空态", b.get("bagEmpty") is True, "空态 %s" % b.get("bagEmpty"))
        check(results, bdoc, "10 背包有镐时列出真实道具", b.get("bagHasPick") is True, "有镐 %s" % b.get("bagHasPick"))
        flee = b.get("flee") or {}
        check(
            results, bdoc,
            "9 普通战斗逃跑：退回上一格，事件格仍未 resolved，战斗结束",
            flee.get("phase") == "move" and flee.get("battle") is None and flee.get("px") == 2 and flee.get("py") == 3 and flee.get("resolved") is False,
            "阶段 %s 坐标 %s,%s resolved=%s %s" % (flee.get("phase"), flee.get("px"), flee.get("py"), flee.get("resolved"), flee.get("error") or ""),
        )
        spent_ok = b.get("wildSpent") == b.get("dungeonSpent") == (b.get("skillEnergy") or 0) + (b.get("energyUp") or 0)
        check(
            results, bdoc,
            "7 野外和副本能耗都等于技能能耗 + energyUp",
            spent_ok,
            "技能能耗 %s，energyUp %s，野外扣 %s，副本扣 %s" % (b.get("skillEnergy"), b.get("energyUp"), b.get("wildSpent"), b.get("dungeonSpent")),
        )
        labels = b.get("dungeonEnergy") or []
        check(results, bdoc, "8 副本敌方能量按上限 10 显示，不是写死 /20", b.get("beastEnergyMax") == 10 and any(str(x).endswith("/10") for x in labels), "上限 %s 文案 %s" % (b.get("beastEnergyMax"), labels))
        check(results, bdoc, "6 副本战斗用 bt- 新布局，不再出现 bp- 旧布局", b.get("dungeonBt") is True and b.get("dungeonBp") is False, "bt=%s bp=%s" % (b.get("dungeonBt"), b.get("dungeonBp")))

        ecard = b.get("enemyCard") or {}
        etext = ecard.get("text") or ""
        check(results, bdoc, "1 敌方出招名片在技能名左侧，并且是左向标记", etext.startswith("←"), "名片=%r 类=%s" % (etext, ecard.get("cls")))
        check(
            results, bdoc,
            "1 敌方克制按「妖兽打玩家」计算（水打火应是克制，不是水打水的抵抗）",
            "↑" in etext and b.get("typeWaterVsFire") == 2,
            "名片=%r 水打火=%s 水打水=%s" % (etext, b.get("typeWaterVsFire"), b.get("typeWaterVsWater")),
        )

        lead = b.get("beastLead") or {}
        adoc = "M3-2 补丁 a · 验收标准"
        check(results, adoc, "1 妖兽出战带至少 1 张本属性直接攻击", (lead.get("skillCount") or 0) >= 1 and lead.get("isBeast") is True, "技能 %s 属性 %s" % (lead.get("skillCount"), lead.get("elems")))
        check(results, adoc, "1 技能栏另有回能卡", b.get("beastHasRegen") is True, "回能 %s" % b.get("beastHasRegen"))
        check(results, adoc, "拍板 5 妖兽不显示占容", b.get("beastShowsCap") is False, "出现占容 %s" % b.get("beastShowsCap"))
        check(results, adoc, "15 捕捉失败不点亮图鉴", b.get("dexAfterFail") is False, "失败后点亮 %s" % b.get("dexAfterFail"))
        check(results, adoc, "15 捕捉成功点亮图鉴", b.get("dexAfterCatch") is True, "成功后点亮 %s %s" % (b.get("dexAfterCatch"), b.get("catchError") or ""))

        st = b.get("eventStat") or {}
        check(results, bdoc, "12 事件链攻击判定跟着出战面板变", st.get("after") == (st.get("before") or 0) + (st.get("delta") or 0), "之前 %s 之后 %s" % (st.get("before"), st.get("after")))

    failed = [r for r in results if not r["ok"]]
    passed = [r for r in results if r["ok"]]
    print("验收 %s 条，通过 %s，失败 %s" % (len(results), len(passed), len(failed)))
    print()
    current = None
    for r in results:
        if r["doc"] != current:
            current = r["doc"]
            print(current)
        mark = "通过" if r["ok"] else "失败"
        print("  [%s] %s" % (mark, r["item"]))
        if not r["ok"]:
            print("         %s" % r["detail"])
    print()
    if failed:
        print("失败 %s 条。这些是按需求条文对当前原型跑出来的，不是旧测试脚本里已经放宽的断言。" % len(failed))
        return 1
    print("这一轮对照的条文都过了。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
