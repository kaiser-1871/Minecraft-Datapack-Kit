# Minecraft Datapack Kit (dpkit) — 随时随地检查数据包：CI、脚本与 AI

**[English](README.md) | 简体中文**

[![CI](https://github.com/kaiser-1871/Minecraft-Datapack-Kit/actions/workflows/ci.yml/badge.svg)](https://github.com/kaiser-1871/Minecraft-Datapack-Kit/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/dpkit-mc)](https://www.npmjs.com/package/dpkit-mc)

> **⚠️ 测试状态**：作者本人仅在自己的 **Minecraft 26.2** 版本数据包上实际测试过 dpkit。
> 其他版本（1.14 ~ 最新）依赖上游引擎的逐版本数据，未经作者逐一实测——
> **欢迎大家在不同版本上测试并反馈问题！** 有问题请到
> [Issues](https://github.com/kaiser-1871/Minecraft-Datapack-Kit/issues) 提交。

**dpkit**（全称 **Minecraft Datapack Kit**，Minecraft 数据包工具包）可以检查**任意** Minecraft
数据包，覆盖上游数据提供方支持的所有游戏版本
（**1.14 至最新正式版/快照**），并且运行的是与
[Datapack Helper Plus (Spyglass)](https://marketplace.visualstudio.com/items?itemName=spgoding.datapack-language-server)
VS Code 扩展**完全相同的引擎**——该引擎已内置在本仓库中（见下文
[基于 Spyglass 构建](#基于-spyglass-构建datapack-helper-plus-引擎)），并通过一致性门禁
（parity gate，进程内引擎 vs LSP 逐文件诊断签名对比）验证两者结果一致。1.13 及更早版本
没有上游命令树/注册表数据，会被明确拒绝而不是用错误语法误检。与编辑器不同，dpkit
可以在**任何地方**运行：

- **CI 门禁**：`--strict` 加上 `0/1/2/4` 退出码，让检查变成 GitHub Actions 的发布闸门。
- **编辑器不显示的深度检查**：`$` 宏行注册表校验、逐版本实体 NBT 结构校验（按版本标注字段
  增删）、启发式"进游戏会静默失效"陷阱扫描（gotchas）、以及读取 `latest.log` 的游戏日志自检。
- **AI 的语法事实来源**：`--syntax` / `--registry` / `--complete` 离线回答"这个版本里到底
  什么才合法"，**MCP 服务器**把同样的能力暴露给 AI IDE 和编程智能体。
- **零配置、零依赖**：`npm i -g dpkit-mc` —— 发布的包自带一切（无运行时依赖、无需编辑器、
  无需游戏）；首次下载数据后即可离线使用。

> 本工具是**通用的**：检查哪个数据包/版本由参数 / 环境变量 / `.dpkit.json` 决定，绝不写死——
> 仓库本身不携带任何存档/数据包内容。

## 基于 Spyglass 构建（Datapack Helper Plus 引擎）

dpkit **不是从零写的解析器**——它运行的是
[Datapack Helper Plus](https://marketplace.visualstudio.com/items?itemName=spgoding.datapack-language-server)
VS Code 扩展背后的真实引擎，由 MIT 协议的 [SpyglassMC/Spyglass](https://github.com/SpyglassMC/Spyglass)
项目构建而来（即 [SpyglassMC/vscode-datapack](https://github.com/SpyglassMC/vscode-datapack)
的继任者）：

- **内置引擎、零外部依赖**：8 个 `@spyglassmc/*` 包（core / java-edition / json / locales /
  mcdoc / mcfunction / nbt / language-server）的构建产物已提交在 `vendor/spyglass/` 中，
  因此本仓库构建和检查数据包**不需要 Spyglass 源码检出、不需要网络**——来源、许可证和
  少量本地补丁清单见 [vendor/spyglass/VENDORED.md](vendor/spyglass/VENDORED.md)。
- **同一份逐版本数据**：命令树、注册表、方块状态和 `vanilla-mcdoc` NBT 结构全部来自编辑器
  使用的同一个 [Spyglass API](https://api.spyglassmc.com)，本地缓存——dpkit 的
  `--syntax` / `--registry` 回答与 VS Code 显示的内容完全一致。
- **一致性是可验证的，不是口头承诺**：`npm run parity` 逐文件对比进程内引擎与 LSP 的诊断
  （issue 签名相等），所以"同一引擎"是经过测试的性质，而非一句宣传。
- **超越编辑器**：在 Spyglass 引擎之上，dpkit 增加了编辑器从不显示的检查——`$` 宏行注册表
  校验、逐版本实体 NBT 结构校验、结构 NBT 解析、陷阱扫描和游戏日志自检
  （见[深度检查](#编辑器引擎不显示的深度检查)）。

Spyglass 版权归 © SPGoding 及贡献者所有（MIT）——衷心感谢团队开源了引擎及其逐版本数据管线。

## 安装

```bash
npm install -g dpkit-mc     # dpkit CLI（附带 dpkit-mcp MCP 服务器命令）
npx --yes dpkit-mc --help   # 或者不安装直接运行
```

源码检出方式：`node dpkit.mjs`（同一 CLI；先执行 `npm run build`）。

## 快速开始

```bash
dpkit-mc --datapack=你的数据包路径 --version=26.2   # 完整检查
dpkit-mc --datapack=你的数据包路径 --strict         # 有错误或警告即退出码 1（CI 友好）
```

> 下面示例用 `26.2` 只是因为它是写作时最新的正式版；任何版本参数都接受已缓存/可用的
> 版本 id（`1.20.4`、`1.21.11`、`latest release` 等）。

或者把默认值写进配置文件（见下），这样裸跑 `dpkit` 即可。

## 配置（.dpkit.json）

把默认的数据包/版本写进配置文件，就不必每次传参数。查找顺序：当前目录 `.dpkit.json` →
用户主目录 `.dpkit.json`；或 `--config=<路径>` / `DPKIT_CONFIG`。相对路径按配置文件所在
目录解析。字段：

| 字段 | 含义 |
|---|---|
| `datapack` | 数据包路径（绝对路径，或相对配置文件） |
| `version` | 游戏版本：`"auto"`（默认，读取 pack.mcmeta）/ `"latest release"` / `"1.21.4"` … |
| `ignore` | 额外忽略规则（子串或 `/正则/`，同 `--ignore`） |
| `minecraftRoot` | Minecraft 安装根目录（含 `versions/`、`logs/` 的目录），用于自动检测与日志自检 |
| `baselineFile` | `--delta` 基线文件（默认 `.dpkit-baseline.json`） |
| `gotchas` / `logcheck` | 关闭陷阱扫描 / 日志自检（两者默认开启） |
| `workspace` / `additionalDatapacks` | 只读的工作区数据包符号提供者 |
| `resourcePacks` | 只读的资源包符号提供者 |
| `cacheMiss` | 缺少逐版本数据时的行为：`download`（默认）/ `fallback` / `fail` |
| `falsePositives` | `false` 关闭全部规则；字符串数组启用其中一部分 |
| `checkWorkspace` | 对每个工作区数据包额外运行一次完整独立检查 |
| `plugins` | 插件模块路径数组（相对配置文件目录解析），如 `["./tools/my-plugin.mjs"]` |

取值优先级：**CLI 参数 > 环境变量 > 配置文件 > 内置默认**。环境变量：`DPKIT_DATAPACK`、
`DPKIT_VERSION`、`DPKIT_CONFIG`（CLI 与 MCP 都识别；空字符串视为未设置）。参考
`.dpkit.example.json`——复制为 `.dpkit.json` 并修改路径即可。

## 检查数据包

```bash
node dpkit.mjs                                   # 检查数据包（默认值来自 .dpkit.json）
node dpkit.mjs --version=auto                    # 让引擎从 pack.mcmeta 自动检测版本
node dpkit.mjs --datapack=D:\other-pack --version=1.21.4   # 检查其他数据包/版本
node dpkit.mjs --files=test/function/*.mcfunction      # 只检查部分文件（* 通配，相对 data/）
node dpkit.mjs --engine=inproc|lsp|pool          # 进程内（默认）/ 旧 LSP / 池化（跨调用复用）
node dpkit.mjs --mode=analyze                    # 仅 LSP 引擎：使用 spyglassmc/analyzeProject
node dpkit.mjs --json                            # 机器可读 JSON 输出（脚本/CI）
node dpkit.mjs --delta                           # 只重新报告自上次 --delta 以来变化的问题
node dpkit.mjs --no-ignore                       # 不过滤已知误报（含数据驱动的原版项）
node dpkit.mjs --ignore='/Unknown key ["“]X["”]/' # 额外忽略（子串或 /正则/）
node dpkit.mjs --verbose                         # 打印引擎自身的日志行
node dpkit.mjs --no-gotchas                      # 关闭已知陷阱扫描（启发式，默认开启）
node dpkit.mjs --no-macro                        # 关闭 $ 宏行注册表 ID 检查（默认开启）
node dpkit.mjs --no-entity-nbt                   # 关闭实体 NBT 结构检查（summon/data；默认开启）
node dpkit.mjs --strict                          # 警告也导致退出码 1（CI 友好）
node dpkit.mjs --no-log                          # 关闭游戏日志自检（默认开启）
node dpkit.mjs --check-command="damage @s 5 battle:true_dmg" --version=26.2   # 校验一条完整命令
node dpkit.mjs --macro="battle:archer/pierce_summon" --macro-args='{"yaw":0.0,"pitch":0.0}' --version=26.2  # 展开并校验宏函数
node dpkit.mjs --rules=cleanup-id-coverage,on-eat-completeness --suggestions   # 项目一致性规则（默认全关）
node dpkit.mjs --report=report.json             # 写报告文件（默认 dpkit_pvp_report.json；--no-write-report 关闭）
node dpkit.mjs --watch                           # 文件变化时重新检查（池化引擎；Ctrl-C 停止）
node dpkit.mjs --config=my.json                  # 指定配置文件
node dpkit.mjs --baseline=my-baseline.json       # 指定 --delta 基线文件
node dpkit.mjs --versions                        # 列出可用游戏版本 + 是否有更新版本
node dpkit.mjs --versions --uncached              # 列出命令数据尚未缓存的版本
node dpkit.mjs --cache-versions=1.19.4,1.20.4      # 预下载逐版本数据（批量预热）
node dpkit.mjs --check-updates                   # 内置的 Spyglass 引擎是否落后于 GitHub main？
node dpkit.mjs --help                            # 全部选项
```

`--json` 会在原有结构上增加 `engine`（`inproc`/`lsp`/`pool`）和 `schemaVersion`（当前为 `1`）。

退出码：`0` 无错误 · `1` 报告含错误或文件级引擎内部失败（`--strict` 时警告也算）·
`2` 环境/网络失败或 dpkit 自身崩溃（未捕获的内部异常）· `4` 用法/配置错误。
被自动过滤的已知误报不计入退出码。

### CI（GitHub Actions）

```yaml
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npx --yes dpkit-mc --datapack=pack --version=26.2 --strict   # 退出码 1 阻止合并
```

## 插件、初始化与测试助手（新）

> 设计灵感来自 [mcbeet/beet](https://github.com/mcbeet/beet)——Minecraft 数据包/资源包开发工具包。
> dpkit 借鉴了 Beet 的插件 / `Context` 管道、项目脚手架和测试优先的体验，同时保持自己作为检查器的定位。

### `dpkit init` 脚手架

```bash
node dpkit.mjs init                    # 在当前目录生成 .dpkit.json + GitHub Actions
node dpkit.mjs init --no-ci            # 只生成 .dpkit.json
node dpkit.mjs init --dir=my-pack --version=1.21.4 --force
```

### 插件系统

插件可以在检查前查看文件集合，在报告生成后追加/修改问题。支持从 API、`.dpkit.json`
的 `plugins` 字段或 `--plugin=<path>` 加载：

```js
// tools/my-plugin.mjs
export default {
  name: 'my-rule',
  afterCheck({ report }) {
    // 直接 push 时记得同步 summary；或使用 addIssue 帮助函数
    report.issues.push({ file: 'pack.mcmeta', line: 1, char: 0, severity: 'W', message: 'hello' });
    report.summary.warnings++;
  },
};
```

```bash
node dpkit.mjs --datapack=pack --plugin=./tools/my-plugin.mjs
```

### 测试助手（Node test / 任意断言库）

```js
import { assertDatapackClean, assertDatapackSnapshot } from 'dpkit-mc/testing';

test('pack is clean', async () => {
  await assertDatapackClean({ datapack: 'pack', version: '1.21.4' });
});

test('report matches golden snapshot', async () => {
  await assertDatapackSnapshot({ datapack: 'pack', version: '1.21.4' });
});
```

快照不匹配时可用 `DPKIT_UPDATE_SNAPSHOTS=1` 更新基线。

## 多包工作区与只读资源包（1.0 新增）

`--workspace=<目录或zip>[,<目录或zip>...]` / `--additional-datapacks=…` 让被检查的数据包
**看到**其他数据包声明的符号，**但不检查那些包**。解析优先级：**当前数据包 > 工作区数据包 >
原版**。每个解析到的符号都会在报告中列出：
`resolved from workspace datapack <路径> (symbol provider only, not checked)`。没有工作区时，
跨包缺失的函数/进度/谓词等会变成**范围提示**（不是错误/警告）：
`Cannot find function animated_java:* — pass --workspace=… if another pack declares it`。

`--check-workspace` 会对每个工作区数据包额外运行一次完整的独立检查（默认关闭；工作区包
在主报告中仍只是符号提供者）。

`--resource-pack=<目录或zip>` / `--resource-packs=…` 同样是**只读**提供者。dpkit 只读取
`assets/<ns>/sounds.json` 声音事件、`assets/<ns>/font/*.json` 字体 ID，以及（可选）
`assets/<ns>/lang/*.json` 翻译键。它绝不校验贴图/模型/方块状态/图集，不检查资源包的
pack_format，也从不把资源文件当作数据包文件。解析到的诊断标注为
`resolved from resource pack (auxiliary symbol only, not validated)`。

## 已知误报规则库

内置的、感知版本的规则默认开启，可用 `--no-false-positives` 关闭，或在 `.dpkit.json`
中配置（`falsePositives: false` 关闭全部，字符串数组启用一部分）：
`overlay-formats-single-int`、`text-opacity-negative-one`、`glow-color-override-negative-one`、
`interaction-response-byte`、`custom-model-data-predicate`、`macro-line-no-arguments`、
`max-format-unbounded`、`cross-pack-scope-hint`。它们在 `--ignore` 之前生效；
`--no-ignore` 显示原始诊断。

## 版本支持范围

逐版本数据提供方目前从 **1.14**（数据包版本 4）开始，一直到最新正式版/快照。
**1.13 及更早没有上游命令树/注册表数据**，dpkit 会显式报出 `no version data before 1.14`
错误，而不是用错误语法静默检查。可检查范围由 `--versions` 打印。

## 离线缓存策略与版本范围

固定的 `--version` 在没有本地命令数据时不再静默"不完整地检查"。
`--cache-miss=download`（默认）尝试按需下载，失败则退出码 2；
`--cache-miss=fallback` 用最近的可缓存版本检查，并在报告头部打印目标/实际/缓存来源/未检查
范围；`--cache-miss=fail` 不下载直接退出码 2。
`auto` 现在会读取完整的 `min_format`/`max_format` 范围，把 `max_format:9999999` 识别为
无上限，并且在声明的范围内存在与基础 `pack.pack_format` 匹配的正式版时优先选择它。
因此 `pack_format:94, min_format:88, max_format:9999999` 的数据包会自动检测为
**1.21.11**（dpv 94），而不是范围内最新的版本；固定 `--version=1.21.11` 会打印
`pack supports dpv 88..unbounded; target 1.21.11 (dpv 94) is inside range.`

## 编辑器引擎不显示的深度检查

dpkit 运行 DHP 引擎做语法/引用检查，然后叠加自己的后置扫描。这些能抓住
"编辑器里 0 错误，进游戏却静默损坏"这一类问题。

### $ 宏行注册表校验

引擎的解析器对 `$` 宏行**不做任何注册表校验**（它只把它们拆成字面量块 + `$(var)`
插值）——所以 `$execute run effect give @s minecraft:knockback` 在 26.2 中 0 错误通过
（knockback 已被移除），而同一行去掉 `$` 会报 `Cannot find mob_effect`。dpkit
独立校验宏行：

- 把 `$(...)` 之外的字面量 token 沿命令树走一遍，检查注册表参数槽位（如
  `effect give <target> <effect>`）是否匹配该版本的注册表值，不匹配时报 `[macro]`
  前缀的 Warning。
- 也会校验明显非法的字面量数字/范围/布尔/坐标（例如 `$effect give $(target)
  minecraft:speed banana` 现在会报 `'banana' is not a valid integer (1..1000000)`，
  标记为 `[macro] macro-syntax`）。没有安全保守校验器的解析器保持语法不检查，绝不误报。
- **保守原则**：含宏变量 / 自定义命名空间 / `#tag` / 树遍历脱节的位置标记为"未检查"，
  绝不警告；数据包声明的数据驱动注册表（damage_type/worldgen/biome/…）**只对声明它的
  命名空间**自动放行——`data/x/advancement/foo.json` 校验 `x:foo`，不校验 `minecraft:foo`。
- **覆盖透明**：报告新增 `coverage` 行（宏行数 · 已检查/未检查 · 自动过滤），含未检查
  位置的文件会标注 `⚠ N macro-line registry position(s) unchecked`——不再有虚假的
  "没查过却显示绿色"。
- `--no-macro` 关闭；`--ignore=/\[macro\]/` 只屏蔽宏警告。

### 结构 NBT 校验（`structure(s)/*.nbt`）

引擎会把结构文件登记为交叉引用，但没有二进制 NBT 解析器，所以损坏的结构文件以前会被
算作干净。dpkit 现在校验容器（raw / gzip / zlib）、NBT 线上格式（递归边界检查、不物化
负载）以及必需的顶层结构键（`DataVersion`、`size`、`blocks`、`entities`、`palette`）。
不可读/截断的 NBT 报 Error；缺键或尾部多余字节报 Warning。

### 实体 NBT 结构校验（summon / data merge）

引擎的 NBT 结构很宽松（对改名/删除的字段可能保持沉默），所以 dpkit 对照 **Spyglass 缓存的
`vanilla-mcdoc` 结构**检查实体 NBT——引擎自己也用这份数据校验，其中每个序列化字段都带
`#[since=]`/`#[until=]` 游戏版本注解。这能抓住引擎漏掉的静默失败类问题：

- **过期字段**：26.2 中 `summon … {HandItems:[…]}` → `[nbt] … field 'HandItems' was
  removed in 1.21.5`（它并入了 `equipment`），或者字段太新时报 `[nbt] … was added in X`。
- **NBT 内不存在的注册表 ID**：26.2 中 `DeathLootTable:"minecraft:empty"` →
  `[nbt] loot_table 'minecraft:empty' is not in the loot_table registry`。
- **`data merge entity @s {…}`** 会校验含注册表的字段（如 `DeathLootTable`），即使命令里
  没有实体类型。
- **保守原则**：未知实体类型 / 自定义命名空间 / 仅嵌套字段 / 宏行计为"未检查"，绝不警告。
  全局性的注册表字段（如 `DeathLootTable`）在自定义/未知实体类型上仍会校验，因为它们的
  含义与实体无关。
- 如果存在候选 `summon`/`data` 行但 `vanilla-mcdoc` 包尚未缓存，coverage 会报告
  `entity-NBT scan skipped (mcdoc schema not cached)` 而不是静默通过（首次联网检查会下载）。
  `--no-entity-nbt` 关闭；`--ignore=/\[nbt\]/` 只屏蔽这些警告。

### 已知陷阱扫描（启发式）与游戏日志自检

引擎的宽松结构对"未知键 / 嵌套错误"保持沉默，也完全不了解运行时行为——dpkit 内置一个
**通用**的启发式陷阱扫描器（内容级正则/结构遍历，不绑定任何数据包），能抓住
"dpkit 0 警告但进游戏静默失败"的模式，在报告末尾以 `== <版本> known-gotcha scan ==`
输出：

- **JSON 进度**：`damage.source_entity`/`damage.direct_entity` 直接放在 damage 层级
  （应放在 `damage.type.source_entity` 下）——游戏会**静默丢弃整个进度**。
- **JSON 进度**：多个条件（criteria）共用一个触发器 + `requirements` OR——**不会触发**；
  请把多来源监听拆成多个进度。
- **mcfunction**：`particle minecraft:item/block` 裸 ID——必须用映射语法
  （`{item:...}`/`{block_state:...}`），否则**整个函数无法加载**。
- **mcfunction**：`summon` 实体 NBT 用小写/snake_case 字段名——必须用 PascalCase，
  否则**被静默忽略**。
- **JSON 物品**：`data/minecraft/item/ender_eye.json` 添加 `minecraft:consumable`——
  ender_eye 保留硬编码的投掷行为，`consume_item` 永远不会触发；请改用
  `used_item`/`use_item` 跟踪投掷。

陷阱是启发式的，**不计入退出码**；`--no-gotchas` 关闭。消息会前缀实际生效的版本。

**游戏日志自检**（`--no-log` 关闭，完整检查时默认运行）：使用与 MCP `read_logs` 工具相同的
日志发现逻辑（官方 / Prism / TLauncher，含轮转的 `.log.gz`），按数据包自己的 `data/`
命名空间过滤，报告 ① 比日志更新的数据包文件（**你可能没有 /reload'ed**——错误/数量数据
已过期），② 最近的进度（advancement）数量，③ 疑似数据包加载错误行（包括
`Errors in currently selected datapacks prevented the world from loading` 摘要）。

### 诚实的覆盖报告 + 检查的是哪个包

- 报告头部打印**数据包来源**——`(from --datapack)` / `(from DPKIT_DATAPACK)` /
  `(from .dpkit.json)` / `(auto-detected)`——过期配置不可能静默指向错误的包。
- 指向**不存在**路径的配置/环境变量 `datapack` 会大声警告并回退到自动检测；主目录
  `.dpkit.json` 指向与自动检测结果不同的包时打印 `⚠` 不匹配提示（仍然检查配置的包——
  传 `--datapack=` 可覆盖）。
- 有位置未校验时（宏变量、未知实体等），摘要会加一行 `⚠ coverage gap: N position(s)
  not validated`——"0 错误 / 0 警告"不再等于"全都查过了"。
- **叠加层（overlay）文件按版本过滤**：`formats` 范围不含目标版本数据包版本的叠加层
  不属于本次检查；coverage 行报告跳过的文件数。目标 dpv 未知时保留所有叠加层（保守）。
- **不可读路径会大声报告**：存在但无法列出的 `data/` 目录，或无法读取的文本文件，会报
  `[check]` 警告并计入 `coverage.unreadableDirs` / `coverage.unreadableFiles`，而不是静默跳过。
- `--version=not-a-version` 打印 `⚠ version 'X' not recognized` 警告，而不是静默按最新
  快照检查。

### 已知误报（数据驱动的自动过滤）

`Cannot find attribute/mob_effect/… "minecraft:<valid-id>"`——"数据包未声明原版注册表"
这类误报——只有在该 ID **恰好**位于当前版本注册表值中时才自动过滤（按版本数据驱动：
1.21.1 的 `minecraft:generic.attack_speed` 合法并被过滤；从 1.21.2 起是真正的错误）。
`Cannot find tag/<reg> "minecraft:<vanilla-tag>"`（如 `#minecraft:is_projectile`）在
原版标签缓存存在时同理。被移除的 `minecraft:knockback` 和拼写错误仍然会报告。
`--no-ignore` 显示**所有原始诊断**——注意它也会关闭 `.dpkit.json` 里的 `ignore` 规则。

> **`--files` 路径提示**：通配符相对数据包的 `data/` 目录，**不带 `data/` 前缀**，
> 例如 `test/function/*.mcfunction`（不是 `data/test/...`）。

## 教 AI 写命令（--syntax / --registry / --complete）

除了检查，这个工具还是**逐版本语法老师**：它从目标版本的命令树打印命令的真实语法，
供人或 AI 在写之前/之后核对。语法数据来自 Spyglass 缓存的命令树（与 VS Code DHP 用的
同一份）——该版本唯一可信的语法来源。目标版本 = `--version=` 或配置里的 `version`。

```bash
node dpkit.mjs --syntax="execute on"             # 打印 on 的 8 个合法值 + 后续可链什么
node dpkit.mjs --syntax="damage"                 # 打印参数链 + 每个参数的含义
node dpkit.mjs --syntax="advancement grant" --depth=6   # 更深的命令可展开更多（默认 4）
node dpkit.mjs --syntax="execute.banana"         # 错误路径会报错并列出一层合法值（退出码 1）
node dpkit.mjs --registry=mob_effect             # 列出 mob_effect 注册表全部值（离线）
node dpkit.mjs --registry=?                      # 列出所有可用注册表 + 数量（26.2 有 182 个；按版本）
node dpkit.mjs --complete=test/function/x.mcfunction:1:24   # 光标处实时补全（1 起算 行:列）
node dpkit.mjs --complete-inline="effect give @s knock"     # 补全原始命令串（无需临时包）
node dpkit.mjs --dump-all                        # 生成完整参考 command-reference-<版本>.md
node dpkit.mjs --dump=ref.md --version=1.21.4    # 为其他版本生成参考
```

- `--syntax`/`--registry`/`--dump` 读取本地缓存（不需要引擎、不需要数据包）；版本数据未
  缓存时会按需下载（离线：干净的一行错误）。`--cache-versions=1.19.4,1.20.4` 批量预热。
- `--complete` 启动引擎并解析指定文件（`data/` 相对路径 + 行:列），返回该位置的合法值；
  `--complete-inline="<文本>"` 补全原始命令串的结尾（仍需要一个数据包作为项目上下文——
  `--datapack=` 或配置）。**已知限制**：`$` 宏行没有补全（引擎返回空）；普通行正常；
  大项目需要先等待文件解析完成。
- `--syntax` 的错误路径也会列出合法枚举（如 `Expected "attacker", …, "vehicle"`），
  可直接用作修复反馈。

## MCP 服务器（AI IDE 原生调用）

把 dpkit 的能力以 MCP 工具形式暴露出来，让任何 AI IDE / 编程智能体可以直接调用真实引擎
而不是靠猜语法：

```json
{
  "mcpServers": {
    "dpkit": { "command": "npx", "args": ["--yes", "dpkit-mcp"] }
  }
}
```

（把上面这段加到你的 MCP 客户端配置里，或项目的 `.mcp.json`。源码检出方式下，同一服务器
可用 `npm run mcp` 启动。）

工具：`check_datapack`、`check_command`、`check_macro`、`lint_rules`、`write_report`、
`diff_reports`、`query_syntax`、`complete_at`、`list_registry`、`list_versions`、
`scan_gotchas`、`read_logs`、`get_vanilla_data`、`get_block_states`。`check_datapack`
还会返回宏行校验结果和 `coverage`（见上）；`check_command` 校验一条完整命令；
`check_macro` 展开 `$` 宏行并逐条校验；`lint_rules` 运行项目一致性规则（默认全关）；
`write_report` / `diff_reports` 负责报告落盘与差异对比；`list_registry` 一次调用列出某注册表的合法值
（写 ID 之前先查，尤其是 `$` 宏行内部）；`read_logs` 追踪当前启动器的 latest.log
（官方 / Prism / TLauncher，含轮转的 `.log.gz`）用于诊断运行时问题；`get_vanilla_data` /
`get_block_states` 查询某个版本的原版游戏数据文件和方块状态属性（离线，来自共享缓存）。
`get_vanilla_data` 目前收录 57 个数据类别，包括 26.2 的注册表（`cat_variant`、
`trade_set`、`test_instance` …）和 26.3 的 worldgen 拆分（`worldgen/feature`、
`worldgen/carver`、`worldgen/material_rule` …）。默认数据包/版本来自 `.dpkit.json` 和
`$DPKIT_DATAPACK` / `$DPKIT_VERSION`；工具参数每次调用可覆盖。`.dpkit.json` 的
`minecraftRoot` 也供 `read_logs` 使用（`minecraftRoot=` 参数可覆盖）。

每个工具结果都是 JSON 信封：成功增加 `ok: true`（相关处还有 `count` / `total`），错误保持
旧版 `{ error, ok: false }` 结构并带 `isError: true`。大数组（诊断、注册表值、补全项、
文件键列表、方块 ID 列表）用 `total` + `truncated` + `hint` 截断（传 `search=` / `block=`
收窄）。`dpkit-workflow` 提示词（`prompts/list`）编码了"版本优先"工作流：先固定版本，
写命令前查 `query_syntax`，用 `list_registry` 核实 ID，再跑 `check_datapack` 清掉所有错误。
冒烟测试：`node tests/mcp-smoke.mjs`（在 `tests/fixtures/pack` 上运行，随处可复现）。

灵感与数据来源：MCP 新增功能（多启动器 `read_logs`、原版数据查询、方块状态查询、工作流
提示词、信封/截断约定）受 [MineCode MCP](https://github.com/AnCarsenat/minecode-mcp)
项目启发。底层数据来自 [misode/mcmeta](https://github.com/misode/mcmeta) 汇总和
[Spyglass API](https://api.spyglassmc.com)，抓取一次后按 dpkit 离线优先的设计本地缓存——
与 MineCode 不同，dpkit 查询时**不依赖**实时网络调用。

## 与 AI 智能体一起使用 dpkit

MCP 工具为**版本优先工作流**而设计——`dpkit-workflow` 提示词编码的正是同一流程。客户端
加载了提示词就自动获得；否则按同样的六步引导智能体：

1. **先固定版本。** 读取数据包的 `pack.mcmeta`，解析目标版本，并传给每次工具调用。
   小心 `min_format`/`max_format` 使自动检测偏移——必要时显式固定 `--version=`。
2. **写命令前先查语法。** `query_syntax(path, version)` 返回真实的逐版本语法——绝不让
   智能体凭记忆猜子命令或枚举（例如 `execute on` 的 8 个合法值）。
3. **写 ID 前先核实。** `list_registry(registry, version, search=)` 确认 ID 在该版本存在
   （例如 26.2 的 `mob_effect` 没有 `knockback`）。在 `$` 宏行内尤其关键——引擎不校验
   那里的 ID。
4. **每轮编辑后重新检查。** `check_datapack(datapack, version)` → 把所有错误修到摘要干净；
   然后 `scan_gotchas` 查静默失败模式（进度 damage 嵌套、粒子映射语法、summon NBT 大小写）。
5. **用 `read_logs` 诊断运行时问题。** 追踪当前启动器的 `latest.log`（官方 / Prism /
   TLauncher，含轮转的 `.log.gz`）——静态检查永远看不到的加载错误都在这里。
6. **把原版数据当参考。** `get_vanilla_data(category, search=)` 查原版文件（战利品表、
   配方、worldgen），`get_block_states(block=)` 查方块状态属性——两者都离线来自共享缓存。

**读结果。** 每个工具返回 JSON 信封：成功 `ok: true`（加 `count`/`total`），失败
`{ error, ok: false }` + `isError: true`。大数组用 `total`/`truncated`/`hint` 截断——
渐进查询（`search=`/`block=`），不要一次要全量列表。离线且版本未缓存时返回干净的结构化
错误而不是崩溃：联网跑一次缓存数据，之后全部离线可用。

**已知智能体陷阱。** 忘记 `version` 参数（回退到配置）；指望 `$` 宏行有补全
（`complete_at` 返回空——先在普通行补全）；任何版本相关的内容都别信记忆，要查
`query_syntax`/`list_registry`。

## 类型化 API（脚本/工具直接调用）

CLI 和 MCP 都调用同一个类型化 API（`dist/api.d.ts`）：

```ts
import { checkDatapack, querySyntax, completeAt } from 'dpkit-mc';   // npm 包名导入
const r = await checkDatapack({ datapack, version: '26.2' });      // → CheckReport
querySyntax('execute on', '26.2');                                 // 同步、离线
await completeAt({ datapack, version, rel, line, column });        // → 补全项
```

## 增量报告（--delta）

`--delta` 仍然做**完整检查**——交叉引用需要完整项目上下文；跳过未变化文件会误报
undeclaredSymbol——但会隐藏自上次运行以来未变化文件的诊断，突出显示**新增 / 变化 / 已解决**
的问题：

```text
baseline : 54 error / 718 warning
current  : 54 error / 718 warning
new      :  0 error /   0 warning
resolved :  0 error /   0 warning
== x.mcfunction ==  ✓ resolved (previously 2 issue(s))        ← 上次运行后修好了 2 个问题
```

`--json` 在 `report.delta.baseline/current/new/resolved` 下携带同样的四个计数器。

基线存放在 `.dpkit-baseline.json`（仓库根目录，已被 git 忽略），按 `数据包@@版本` 区分，
不同数据包/版本互不覆盖；`--baseline=` 可换文件。某数据包第一次跑 `--delta` 视为全部新增。
旧版单条目文件会被读取并迁移，当前文件带 `formatVersion` 字段保证前后兼容。

## 构建与测试

```bash
npm run build          # tsc --emitDeclarationOnly + esbuild 打包 → dist/（自包含、零运行时依赖）
npm test               # 回归测试（单元 + fixture 集成 + CLI + MCP）
npm run test:versions  # 1.14→26.2 版本矩阵（DPKIT_TEST_VERSIONS 可覆盖）
npm run parity         # 进程内 vs LSP 逐文件 issueSig 对比（版本默认最新正式版）
npm run test:all       # npm test + 多版本矩阵 + parity（完整门禁）
npm run bench          # 性能基线（引擎 / 完整检查 / 后置扫描）
npm run mcp            # 从仓库启动 MCP 服务器
```

多版本防线：`tests/multi-version.spec.mjs` 对 `DPKIT_TEST_VERSIONS`（默认
`1.14,1.15.2,1.16.5,1.18.2,1.19.4,1.20.4,1.21.4,1.21.11,26.2`）检查引擎、宏扫描和实体 NBT
扫描。命令数据未缓存的版本会跳过；CI 或本地可用
`node dpkit.mjs --cache-versions=1.14,1.15.2,1.16.5,1.18.2,1.19.4,1.20.4,1.21.4,1.21.11,26.2`
预热（预下载这些版本引擎需要的命令、注册表、方块状态和原版数据/资源归档）。Parity 使用
`DPKIT_PARITY_VERSION`（默认 `latest release`），引擎门禁不钉死在单个版本上。

源码在 `src/`：`cli.ts`（入口）/ `api.ts`（类型化 API + 报告组装）/ `engine/inproc.ts`
（进程内引擎）/ `lsp-legacy.ts`（LSP 回退）/ `mcp.ts`（MCP 服务器）/ `config.ts`（配置）/
若干纯逻辑模块。内置的 `@spyglassmc/*` 引擎在构建时打进 `dist/`
（`scripts/build-bundle.mjs`）；`npm run vendor -- --spyglass=<路径>` 从源码检出刷新。
`tests/fixtures/pack` 是自包含的 fixture 数据包（命名空间 `test`）；集成/parity/冒烟测试
都在它上面跑，不需要真实存档。

## 版本更新（保持跟进）

**新版本怎么支持：** 命令树、注册表、方块状态和 NBT 结构（vanilla-mcdoc）都是 Spyglass
提供的**数据**。每次引擎运行都会带 `if-none-match`（ETag）做条件请求——服务器发布新数据后，
**下一次联网运行会自动拉取并识别**，无需清缓存或改代码。

```bash
node dpkit.mjs --versions                    # 查看版本、最新正式版、哪些已缓存
node dpkit.mjs --version=1.21.4              # 切换到新版本（首次使用会下载）
node dpkit.mjs --version="latest release"    # 始终跟随最新正式版
node dpkit.mjs --version="latest snapshot"   # 始终跟随最新快照
```

**过期版本提示：** 普通检查结束时会自动检测——如果被检查的版本落后于最新正式版，会建议
`switch to: node dpkit.mjs --version="…"`。检查比最新正式版还新的快照时不显示。

**注意事项：**
- `.zip` 数据包受 `check_datapack`/CLI/MCP 检查支持（解压到临时目录）；`--watch` 和
  `--complete` 仍需要目录。
- 新数据需要**联网**；离线回退到最近一次缓存的数据（可能过期）。
- 带 `min_format`/`max_format` 的数据包会把 `--version=auto` 偏向更新的版本——**请固定版本**。
- 如果固定的版本不在（可能过期的）缓存版本列表里，dpkit 打印 `⚠ version 'X' not
  recognized` 警告，引擎回退到最新快照——不要忽略它；检查前用 `--versions` 确认版本在列。
- 只有全新的参数类型 / 命令格式大改才需要重新内置引擎：
  `npm run vendor -- --spyglass=<更新的检出>` 然后 `npm install`（引擎构建已内置在本仓库
  `vendor/spyglass/`，日常使用不需要 Spyglass 检出）。普通的新命令/子命令/注册表值/NBT
  字段不需要。
- 引擎新鲜度：`node dpkit.mjs --check-updates` 对比内置构建记录与 Spyglass 的 GitHub
  `main`，告诉你何时该重新内置。

## 注意事项

- **版本**：默认 = `--version=` / `DPKIT_VERSION` / 配置 `version` / 内置 `auto`
  （`src/config.ts` 中的 `DEFAULT_VERSION`）。`auto` 读取包的 `pack.mcmeta`；当包同时有
  `min_format`/`max_format` **和**基础 `pack_format` 时，如果该基础 dpv 在声明范围内，优先
  选择匹配它的正式版。只有范围没有基础 `pack_format` 的包仍解析为范围内最新的正式版——
  那不是预期目标时请固定 `--version=`。离线语法/陷阱扫描（`--syntax`/`--dump`/非补全的纯
  文件扫描）默认用本地缓存中最新正式版。
- **游戏数据**：首次运行从 `api.spyglassmc.com` 下载目标版本的命令树/注册表/原版数据并缓存
  （`%LOCALAPPDATA%\spyglassmc-nodejs\Cache`）；之后离线可用。
- **已知引擎坑**：客户端能力必须包含
  `workspace.didChangeWatchedFiles.dynamicRegistration`，否则引擎不会跟踪数据包自己的文件，
  函数/计分板/标签交叉引用全部误报 undeclaredSymbol。
- **已知误报**：`Unknown key "LastHurtMob"`（游戏内合法，但 Spyglass 的 mcdoc 实体 NBT
  结构里没有）会被自动过滤：不计数，在报告末尾单独列在
  `== ignored (known false positives, not counted) ==` 下。用 `--no-ignore` 看原始诊断。
  注意引擎用弯引号 `" "` 渲染键名，所以优先用 `/正则/` 形式忽略，例如
  `/Unknown key ["“]LastHurtMob["”]/`。

## 贡献与社区

- [CONTRIBUTING.md](CONTRIBUTING.md) — 开发环境、构建/测试命令、提交规范与 Spyglass 内置流程。
- [SECURITY.md](SECURITY.md) — 如何报告安全问题（先私密报告）。
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — Contributor Covenant 2.1。
- 反馈与问题：欢迎到 [Issues](https://github.com/kaiser-1871/Minecraft-Datapack-Kit/issues) 提交！

## 许可证

[MIT](LICENSE) — Copyright (c) 2026 dpkit contributors.

本项目构建于 **MIT 协议的 [Spyglass](https://github.com/SpyglassMC/Spyglass) 引擎**
（© SPGoding 及贡献者）之上，并打包了第三方代码（内置的 Spyglass 引擎和
`@zip.js/zip.js`），其许可证全文见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
