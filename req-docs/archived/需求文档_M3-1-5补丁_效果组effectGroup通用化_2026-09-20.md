# 需求文档 M3-1-5 补丁 · 效果组（effectGroup）通用化改造

> 版本：v1.0 | 日期：2026-09-20 | 性质：5 补丁

---

## 一、需求背景

当前技能 effects 数组语义为"全部按顺序执行"。奇异礼物的随机分支需求催生了 randomBranch 效果类型，但这种"单个效果内部做分支"的方式不通用——以后每加一种随机逻辑就要加新效果类型。趁现在技能数量不多，统一改造为效果组（effectGroup）机制，支持多种执行模式。

---

## 二、效果组（effectGroup）规范

### 2.1 数据结构

技能的 effects 字段从"效果数组"升级为"效果组数组"。每个效果组对象结构：

```js
{
  type: 'effectGroup',
  mode: 'all',           // 执行模式，见下
  children: [            // 子效果列表
    { target: 'enemy', type: 'burn', layers: 2 }
  ]
}
```

### 2.2 三种执行模式

| mode | 行为 | 用途 |
|---|---|---|
| `all` | 组内所有子效果按顺序全部执行（默认） | 多条效果叠加，和现在行为一致 |
| `randomOne` | 按子效果的 prob 权重随机选一个执行 | 奇异礼物二选一、三选一 |
| `randomRoll` | 每个子效果独立掷骰（各按自己的 prob 判定） | "30%中毒+30%降攻"独立判定 |

### 2.3 randomOne / randomRoll 的子效果结构

```js
{
  type: 'effectGroup',
  mode: 'randomOne',
  children: [
    { prob: 50, effects: [{ target: 'enemy', type: 'energyFull' }] },
    { prob: 50, effects: [{ target: 'enemy', type: 'energyZero' }] }
  ]
}
```

- prob 为概率百分比（0~100），randomOne 模式下所有子组 prob 之和应为 100
- randomRoll 模式下每个子组独立按 prob 判定是否执行

### 2.4 兼容与迁移

- 单条 effects 的技能：自动包装成 `{ type:'effectGroup', mode:'all', children:[原效果] }`
- 多条 effects 的技能：自动包装成一个 all 组
- **旧的 randomBranch 效果类型废弃**，迁移到 effectGroup + randomOne

---

## 三、现有技能初始化模式

### 3.1 全部为 all 模式（和现在行为一致）

以下技能有多条子效果，全部初始化为 `mode: 'all'`：

| 技能 ID | 技能名 | 子效果数 | 说明 |
|---|---|---|---|
| f_fury | 怒火 | 3 | 自攻+10/速+3/防-5 |
| ic_snowview | 雪景 | 2 | 75%减伤+按冻结层数回血 |
| e_barrier | 壁垒 | 2 | 90%减伤+敌用攻击时冷却-1 |
| psy_ascetic | 苦修 | 2 | 自防+5/自特防+5 |
| light_mirror | 镜面防御 | 2 | 50%减伤+按携带属性额外减伤 |
| fight_stance | 架势 | 2 | 未受伤时自攻+8/自威力+8 |
| w_waterring | 水环 | 2 | 60%减伤+自能耗下降2层 |
| w_hotspring | 温泉 | 2 | 净化+自能耗下降1层 |
| p_acidpool | 酸液池 | 2 | 敌中毒层数→物防降+物攻降 |
| p_reverse | 反转感染 | 2 | 驱散增益+每1层→1层poison |
| p_numb | 麻木肢体 | 2 | 敌中毒层数→自特防升+物防升 |
| fight_counter | 寸止 | 2 | 0%减伤+敌用攻击时免伤+敌冷却+1 |
| steel_wall | 铁壁 | 2 | 80%减伤+克制变普通 |

### 3.2 奇异礼物：randomOne 模式

| 技能 ID | 技能名 | 模式 | 子组 |
|---|---|---|---|
| g_gift | 奇异礼物 | randomOne | 50% energyFull / 50% energyZero |

### 3.3 单条效果的技能

其余所有单条 effects 的技能，自动包装成 all 组，行为不变。

---

## 四、验收标准

1. 所有技能的 effects 数组结构升级为 effectGroup 格式，单条效果自动包装成 all 组。
2. 以上列出的多效果技能全部初始化为 all 模式，行为和改造前一致。
3. 奇异礼物改为 effectGroup + randomOne，50% 回满 / 50% 清零，不再使用旧的 randomBranch。
4. 战斗中触发技能效果时，all 组内所有子效果全部执行，randomOne 组只执行随机选中的一个。
5. 旧 randomBranch 效果类型代码移除，无残留引用。
