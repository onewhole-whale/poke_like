# 炼妖壶 · 灵兽养成

单页可玩原型。当前代码版本 **v1.20.9**（2026-09-22）。之后的拆分和 M3-2 封档都没有另升版本号。

玩法已经闭环：炼化出灵兽，野外走格子，副本用素材构建连战，挂机修炼，进化和图鉴收集。**M3-2 战斗演出已于 2026-10-08 封档。** 下一版是 **M3-3 精灵立绘**，需求文档还没写。

## 怎么跑

浏览器直接打开仓库根目录的 `index.html`。

顶栏是工作台。最右边的「图鉴编辑」用来改技能和炼化规则。概率开关默认是演示模式。

按需求条文验收：

```bash
python acceptance/run_acceptance.py
```

旧的版本测试在仓库根目录执行，例如：

```bash
node tests/damage_accept_test.js
node tests/wild_test.js
node tests/a6_test.js
```

`tests/_load.js`、页面里的 `<script src>`、`acceptance/probe.js` 都读 `src/modules.txt`，顺序必须一致。

## 代码落在哪

| 路径 | 内容 |
|---|---|
| `index.html` | 页面骨架。样式在 `css/app.css` |
| `data/*.js` | 物种、素材、技能、地形、事件、地图。全局 `var`，三端都能读 |
| `src/sim/` | 规则。不读写 DOM。迁到 Python 或 Unity 时带走这一层 |
| `src/view/` | 浏览器画面 |
| `src/app/boot.js` | 按钮绑定和启动 |
| `src/modules.txt` | 唯一的加载顺序 |

`src/sim` 里对 `toast` 和 `render*` 的调用是画面钩子。换平台时改成那边的通知，不要把 DOM 写回规则层。

精灵 `JL_<属性>_<品质>_<4位>`，素材 `SC_<属性>_<品质>_<6位>`，道具 `DJ_<属性>_<6位>`。名字禁用：圣、神、魔。

## 先读哪几份

| 用途 | 文件 |
|---|---|
| 进度和版本索引 | `req-docs/DEVELOPMENT_PLAN.md` |
| 这次拆分的边界 | `req-docs/后续工作_代码模块化.md` |
| 为什么这样设计 | `req-docs/设计框架与理念手册_2026-09-20.md` |
| 技能代价标尺 | `SKILL_DESIGN_FRAMEWORK.md` |
| 远期想法，不进当前版本 | `req-docs/灵感记事本.md` |

文案在 `content-docs/` 和 `data/*.js` 里各有一份。抽离文案要等单独的文案工具，不要在立绘版本里顺手做。
