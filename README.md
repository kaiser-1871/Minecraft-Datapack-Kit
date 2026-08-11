# dpkit — DHP 引擎命令行工具:查错 + 教 AI 写命令

用 **Datapack Helper Plus (Spyglass)** 的同一个引擎检查 `pvp` 数据包，产出和 VS Code 里 DHP
完全一致的诊断（格式 / 命令语法 / 引用 / 版本识别）。引擎默认**进程内**直接驱动
`@spyglassmc/core`（不再 spawn 子进程 + 手搓 LSP 协议）；旧的 LSP 子进程路径保留为
`--engine=lsp`，供对拍回归。另提供 **MCP server**，把查错/语法/补全暴露给 AI IDE 原生调用。

代码为 TypeScript，源码在 `src/`，编译到 `dist/`（根 `dpkit.mjs` 是 shim，`node dpkit.mjs` 用法不变）。

工具在存档根目录 `丽格乔娅史诗/dpkit/`（`datapacks/` 外面，游戏不加载、不影响数据包）。

## 使用

```bash
node dpkit.mjs                                   # 检查 pvp 数据包（默认按 26.2 检查）
node dpkit.mjs --version=auto                    # 让引擎从 pack.mcmeta 自动识别版本
node dpkit.mjs --datapack=D:\其他包              # 检查别的数据包
node dpkit.mjs --files=battle/function/snowman/*.mcfunction   # 只看部分文件（*通配，相对 data/）
node dpkit.mjs --engine=inproc|lsp               # 进程内引擎(默认) / 旧 LSP 子进程
node dpkit.mjs --mode=analyze                    # LSP 引擎专用: 用 spyglassmc/analyzeProject
node dpkit.mjs --json                            # 输出机器可读 JSON（接脚本/CI）
node dpkit.mjs --delta                           # 只重报相对上次有变化的问题（发现新增问题）
node dpkit.mjs --no-ignore                       # 不自动过滤已知误报
node dpkit.mjs --ignore='Unknown key "X"'        # 额外忽略模式（子串或 /正则/，可多个、逗号分隔）
node dpkit.mjs --verbose                         # 打印引擎自己的日志
node dpkit.mjs --no-gotchas                      # 关闭 26.2 已知坑扫描(heuristic,默认开)
node dpkit.mjs --no-log                          # 关闭游戏日志自检(默认开)
node dpkit.mjs --versions                        # 列出可用游戏版本,提示是否有新版
node dpkit.mjs --help                            # 全部选项说明
```

`--json` 在原有字段基础上新增 `engine`（`inproc`/`lsp`）与 `schemaVersion`（当前 `1`）。

退出码：`0` 无错误 · `1` 有错误/内部失败 · `2` 环境/网络失败。
被忽略的误报不计入退出码。

## 教 AI 写命令（--syntax / --complete）

除了查错，本工具还能当**版本语法老师**：直接给出 26.2 命令树的真实语法，供人或 AI 在
动笔前/写错后核对。语法数据来自 Spyglass 缓存的 26.2 命令树（和 VS Code DHP 同一份），
是该版本唯一可信的语法来源。

```bash
node dpkit.mjs --syntax="execute on"             # 打印 execute on 的 8 个合法值 + 后续可链内容
node dpkit.mjs --syntax="damage"                 # 打印参数链 + 每个参数的中文说明
node dpkit.mjs --syntax="advancement grant" --depth=6   # 深的命令加大展开深度（默认 4）
node dpkit.mjs --syntax="execute.banana"         # 路径写错时,报错会把已知下一级列出（退出码 1）
node dpkit.mjs --complete=battle/function/x.mcfunction:5:12   # 光标位置实时补全（1-based 行列）
node dpkit.mjs --dump-all                        # 生成全量参考 command-reference-26.2.md
node dpkit.mjs --dump=ref.md --version=26.3-snapshot-2        # 按别的版本生成参考
```

- `--syntax`/`--dump` 纯离线读缓存，不启动引擎、不碰存档；`--version=` 可指向已缓存的任何版本。
- `--complete` 启动引擎实时解析指定文件（`data/` 相对路径 + 行:列），返回该位置合法取值。
  **已知局限**：`$` 宏行引擎不做补全（返回空），普通命令行正常；大项目会先等文件解析完再查。
- `--syntax` 的报错路径也会把合法枚举列出来（如 `Expected "attacker", …, "vehicle"`），
  可作为写错时的修正反馈。

> **注意 `--files` 的路径**：glob 是相对数据包 `data/` 目录的，**不带 `data/` 前缀**，
> 如 `battle/function/snowman/*.mcfunction`（不是 `data/battle/...` 也不是 `function/battle/...`）。

## MCP server（AI IDE 原生调用）

把 dpkit 能力暴露成 MCP 工具，Claude Code / Cursor 等可直接调用，不再靠猜 26.2 语法：

```bash
npm run mcp        # 启动 stdio MCP server（node dist/mcp.js）
```

工具：`check_datapack`、`query_syntax`、`complete_at`、`list_versions`、`scan_gotchas`。
默认数据包自动探测，可用环境变量 `DPKIT_DATAPACK` 覆盖。冒烟：`node tests/mcp-smoke.mjs`。

## 类型化 API（脚本/工具直接调用）

CLI 与 MCP 都调用同一个 typed API（`dist/api.d.ts`）：

```ts
import { checkDatapack, querySyntax, completeAt } from 'dpkit';   // npm 包名导入
const r = await checkDatapack({ datapack, version: '26.2' });      // → CheckReport
querySyntax('execute on', '26.2');                                 // 同步、离线
await completeAt({ datapack, version, rel, line, column });        // → 补全项
```

## 构建与测试

```bash
npm run build        # tsc → dist/
npm test             # 21 个回归测试（单元 + fixture 集成，进程内 vs LSP 引擎对拍）
npm run parity       # inproc 与 LSP 引擎在 pvp 包上逐文件 issueSig 对拍（正确性闸门）
npm run mcp          # 启动 MCP server
```

源码在 `src/`：`cli.ts`（入口）/ `api.ts`（类型化 API + 报告组装）/ `engine/inproc.ts`
（进程内引擎）/ `lsp-legacy.ts`（LSP 回退）/ `mcp.ts`（MCP server）/ 若干纯逻辑模块。

## 误报过滤

已知误报 `Unknown key "LastHurtMob"`（Spyglass 的 mcdoc 实体 NBT schema 没收录该字段，
字段本身在原版有效、数据包在用）**默认自动过滤**：不计入错误/警告数，单列在报告末尾
`== 忽略(已知误报, 不计入结果) ==`。要看原始诊断用 `--no-ignore`。

`--ignore=<模式>` 可追加自定义忽略：普通字符串按子串匹配；`/正则/` 形式按正则匹配（可多个、
逗号分隔）。

> 注意：引擎输出的诊断消息里引号是**弯引号 `“ ”`**，不是 ASCII 直引号。要匹配带引号的消息
> 建议写 `/正则/` 形式，例如 `/Unknown key ["“]LastHurtMob["”]/`。

## 增量报告（--delta）

`--delta` 仍是**全量检查**——交叉引用需要完整工程上下文，跳过未改文件会误报 undeclaredSymbol——
只是把"相对上次无变化"的文件的诊断藏起来，突出**新增 / 变化 / 已解决**的问题：

```text
files : 72 checked, 71 clean · delta: 1 changed, 0 resolved   ← 只有 1 个文件有新增/变化
== x.mcfunction ==  ✓ resolved (previously 2 issue(s))        ← 上次 2 个问题这次修好了
```

基线存于 `dpkit/.dpkit-baseline.json`，按数据包路径 + 版本区分；
首次运行全部视为"新增"（等价于全量报告）。

## 26.2 已知坑扫描(heuristic)与游戏日志自检

引擎的宽松 schema 对"未知键/错层级"保持沉默、对运行时行为一无所知——dpkit 自带一个启发式坑扫描器，
捕获这些"dpkit 全量 0 警告、游戏里却静默失败"的写法，报告在 CHECK REPORT 末尾 `== 26.2 已知坑扫描 ==`：

- **JSON 成就**：`damage.source_entity`/`damage.direct_entity` 写在 damage 直接子级（26.2 应在 `damage.type.source_entity`）——游戏**静默丢弃整条成就**。
- **JSON 成就**：同触发器多 criteria + `requirements` OR——26.2 **不触发**，多来源监听要拆多个独立成就。
- **mcfunction**：`particle minecraft:item/block` 裸 ID——必须 map 语法（`{item:...}`/`{block_state:...}`），否则**整函数不加载**。
- **mcfunction**：`summon` 实体 NBT 小写/蛇形字段名——必须 PascalCase，否则被**静默忽略**。

坑扫描是启发式的、**不计入退出码**；`--no-gotchas` 关闭。

**游戏日志自检**（`--no-log` 关闭，全量检查默认顺带跑）：读最近一次 `latest.log`，提示
① 数据包文件比日志新（**可能还没 /reload**，报错/计数是旧的）、② 最近一次成就计数、③ 疑似数据包加载错误行。

## 说明

- **版本**：pvp 的 `pack.mcmeta` 用新字段 `min_format`/`max_format`（非老式 `pack_format`），引擎自动识别会偏到更新的版本，所以默认强制 `--version=26.2`（data_pack_version 107）。若 26.3+ 需复查。
- **游戏数据**：首次运行从 `api.spyglassmc.com` 下载 26.2 的命令树/注册表/原版数据包并缓存（`%LOCALAPPDATA%\spyglassmc-nodejs\Cache`），之后离线可用。
- **已知引擎坑**：客户端能力里必须带 `workspace.didChangeWatchedFiles.dynamicRegistration`，否则引擎不把数据包自己的文件纳入跟踪、函数/计分板/标签的交叉引用全部误报 undeclaredSymbol。

## 版本更新（与时俱进）

**新版本怎么支持：** 命令语法树、注册表、方块状态、NBT schema（vanilla-mcdoc）全部是
Spyglass 服务器下发的**数据**。每次运行引擎都带 `if-none-match`（ETag）做条件请求——
服务器一发布 26.4 的数据，**下次在线运行就自动拉到并识别**，无需手动清缓存或改代码。
例如从未用过的 `--version=26.1.2` 首次检查会自动下载它的命令树并按它校验（实测通过）。

```bash
node dpkit.mjs --versions                    # 看有哪些版本、最新正式版是什么、哪些已缓存
node dpkit.mjs --version=26.4                # 换到新版本检查（首次会自动下载）
node dpkit.mjs --version="latest release"    # 永远跟随最新正式版
node dpkit.mjs --version="latest snapshot"   # 永远跟随最新快照
```

**过旧提示：** 正常检查末尾会自动检测——如果当前按的版本落后于最新正式版，会提示
`切到新版本: node dpkit.mjs --version="26.4"`。用比最新正式版更新的快照时不提示。

**需要注意：**
- 前提是**在线**；离线时回退到上次缓存的数据（可能旧）。
- 本包 pack.mcmeta 用 `min_format`/`max_format`，`--version=auto` 会偏到更新的版本，
  建议**钉死版本号**（默认 26.2，升级后改成新版本）。
- **万一请求的版本不在（陈旧的）版本列表里，引擎会静默回退到最新快照**而非报错——
  离线/刚发布时 `--version=26.4` 可能悄悄按别的版本查。用 `--versions` 确认列表里有再检查。
- 极少数**全新参数类型 / 命令格式大改**属于代码侧（parser/引擎），需要
  `npm update @spyglassmc/language-server`。常规的新命令/子命令/注册表值/NBT 字段不需要。

## 已知真实问题（2026-08-11 首次全量检查）

- `frost_attack_trigger.json` / `break_stealth_trigger.json` 里的 `{"id":"minecraft:is_magic","expected":false}` 引用了 **原版不存在的伤害类型标签**（26.2 与 1.21.4 原版数据里都没有 `is_magic`）。该条件是空操作：技能魔法伤害实际靠 `sm_skill_guard` 护盾挡住。若要按"近战命中"精确限定，可考虑改用 `{"id":"minecraft:is_player_attack","expected":true}`（26.2 新增标签，含 player_attack/spear/mace_smash）。改不改由用户决定。
