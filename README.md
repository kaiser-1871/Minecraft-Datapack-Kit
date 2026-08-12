# dpkit — DHP 引擎命令行工具:查错 + 教 AI 写命令

用 **Datapack Helper Plus (Spyglass)** 的同一个引擎检查**任意**数据包,产出和 VS Code 里 DHP
完全一致的诊断(格式 / 命令语法 / 引用 / 版本识别)。引擎默认**进程内**直接驱动
`@spyglassmc/core`(不再 spawn 子进程 + 手搓 LSP 协议);旧的 LSP 子进程路径保留为
`--engine=lsp`,供对拍回归。另提供 **MCP server**,把查错/语法/补全暴露给 AI IDE 原生调用。

代码为 TypeScript,源码在 `src/`,编译到 `dist/`(根 `dpkit.mjs` 是 shim,`node dpkit.mjs` 用法不变)。

> 本工具是**通用**的。默认检查哪个包、按哪个版本,由 `.dpkit.json` 配置(见下);仓库本身
> 不附带任何特定存档/数据包的内容。

## 配置(.dpkit.json)

把"默认检查哪个数据包、按哪个版本"写进配置文件,就不用每次带参数。查找顺序:
当前目录 `.dpkit.json` → 家目录 `.dpkit.json`;也可用 `--config=<path>` 或 `DPKIT_CONFIG` 指定。
相对路径按配置文件所在目录解析。字段:

| 字段 | 含义 |
|---|---|
| `datapack` | 数据包路径(绝对或相对配置文件) |
| `version` | 游戏版本:`"auto"`(默认,读 pack.mcmeta) / `"latest release"` / `"1.21.4"` … |
| `ignore` | 额外忽略模式数组(子串或 `/regex/`,同 `--ignore`) |
| `minecraftRoot` | Minecraft 安装根目录(含 `versions/`、`logs/`),用于自动探测与日志自检 |
| `baselineFile` | `--delta` 基线文件路径(默认 `.dpkit-baseline.json`) |
| `gotchas` / `logcheck` | 关闭坑扫描 / 日志自检(默认都开) |

每个值的优先级:**CLI 参数 > 环境变量 > 配置文件 > 内置默认**。环境变量:
`DPKIT_DATAPACK`、`DPKIT_VERSION`、`DPKIT_CONFIG`(CLI 与 MCP 都认)。示例见
`.dpkit.example.json`,复制成 `.dpkit.json` 改成自己的路径即可。

## 使用

```bash
node dpkit.mjs                                   # 检查数据包(默认按 .dpkit.json)
node dpkit.mjs --version=auto                    # 让引擎从 pack.mcmeta 自动识别版本
node dpkit.mjs --datapack=D:\其他包 --version=1.21.4   # 检查别的数据包/版本
node dpkit.mjs --files=test/function/*.mcfunction      # 只看部分文件(*通配,相对 data/)
node dpkit.mjs --engine=inproc|lsp               # 进程内引擎(默认) / 旧 LSP 子进程
node dpkit.mjs --mode=analyze                    # LSP 引擎专用: 用 spyglassmc/analyzeProject
node dpkit.mjs --json                            # 输出机器可读 JSON(接脚本/CI)
node dpkit.mjs --delta                           # 只重报相对上次有变化的问题(发现新增问题)
node dpkit.mjs --no-ignore                       # 不自动过滤已知误报(含数据驱动的 vanilla 注册表误报)
node dpkit.mjs --ignore='Unknown key "X"'        # 额外忽略模式(子串或 /正则/,可多个、逗号分隔)
node dpkit.mjs --verbose                         # 打印引擎自己的日志
node dpkit.mjs --no-gotchas                      # 关闭已知坑扫描(heuristic,默认开)
node dpkit.mjs --no-macro                        # 关闭 $ 宏行注册表 ID 校验(默认开)
node dpkit.mjs --strict                          # 警告也令退出码为 1(CI 友好)
node dpkit.mjs --no-log                          # 关闭游戏日志自检(默认开)
node dpkit.mjs --config=my.json                  # 指定配置文件
node dpkit.mjs --baseline=my-baseline.json       # 指定 --delta 基线文件
node dpkit.mjs --versions                        # 列出可用游戏版本,提示是否有新版
node dpkit.mjs --help                            # 全部选项说明
```

`--json` 在原有字段基础上新增 `engine`(`inproc`/`lsp`)与 `schemaVersion`(当前 `1`)。

退出码:`0` 无错误 · `1` 有错误/内部失败 · `2` 环境/网络失败。
被忽略的误报不计入退出码。

## 教 AI 写命令(--syntax / --complete)

除了查错,本工具还能当**版本语法老师**:直接给出目标版本命令树的真实语法,供人或 AI 在
动笔前/写错后核对。语法数据来自 Spyglass 缓存的命令树(和 VS Code DHP 同一份),
是**该版本唯一可信的语法来源**。目标版本 = `--version=` 或配置里的 `version`。

```bash
node dpkit.mjs --syntax="execute on"             # 打印 execute on 的 8 个合法值 + 后续可链内容
node dpkit.mjs --syntax="damage"                 # 打印参数链 + 每个参数的中文说明
node dpkit.mjs --syntax="advancement grant" --depth=6   # 深的命令加大展开深度(默认 4)
node dpkit.mjs --syntax="execute.banana"         # 路径写错时,报错会把已知下一级列出(退出码 1)
node dpkit.mjs --registry=mob_effect             # 列出该版本 mob_effect 注册表全部值(离线)
node dpkit.mjs --registry=?                      # 列出全部可用注册表(182 个)+ 每个的数量
node dpkit.mjs --complete=test/function/x.mcfunction:1:24   # 光标位置实时补全(1-based 行列)
node dpkit.mjs --complete-inline="effect give @s knock"     # 直接补全一段命令字符串(免造临时数据包)
node dpkit.mjs --dump-all                        # 生成全量参考 command-reference-<版本>.md
node dpkit.mjs --dump=ref.md --version=1.21.4    # 按别的版本生成参考
```

- `--syntax`/`--registry`/`--dump` 纯离线读缓存,不启动引擎、不碰存档;`--version=` 可指向已缓存的任何版本。
- `--complete` 启动引擎实时解析指定文件(`data/` 相对路径 + 行:列),返回该位置合法取值;
  `--complete-inline="<文本>"` 补全一段命令字符串的末尾(仍需要 datapack 做工程上下文,
  可用 `--datapack=` 或配置指定)。**已知局限**:`$` 宏行引擎不做补全(返回空),普通命令行正常;
  大项目会先等文件解析完再查。
- `--syntax` 的报错路径也会把合法枚举列出来(如 `Expected "attacker", …, "vehicle"`),
  可作为写错时的修正反馈。

## $ 宏行校验与覆盖度

引擎的解析器对 `$` 宏行**不做任何注册表校验**(只把它切成字面段 + `$(var)` 插值段)——所以
`$execute run effect give @s minecraft:knockback` 这类宏行在 26.2(已移除 knockback)会
**0 报错但游戏里运行时报错**。dpkit 现在对宏行做了独立的注册表校验:

- 把 `$(...)` 之外的字面 token 沿命令树走到注册表参数槽位(如 `effect give <target> <effect>`),
  对照该版本注册表值;不中 → 报 `[macro]` 前缀的 Warning。
- **保守原则**:含宏变量、自定义命名空间、`#tag`、或树遍历无法跟上的位置一律标"未校验",
  绝不在歧义时误报。包内自声明的数据驱动注册表(damage_type/worldgen/biome 等)自动放行。
- **覆盖度透明**:报告新增 `coverage` 行(宏行数 · 已校验/未校验 · 自动误报过滤数),有未校验
  位置的文件会标注 `⚠ 含 N 处宏行注册表位置未校验`——不再有"这段没查"的假绿。
- `--no-macro` 关闭该检查;`--ignore=/\[macro\]/` 可单独压掉宏行警告。

### 已知误报(数据驱动自动过滤)

`Cannot find attribute/mob_effect/… "minecraft:<合法ID>"` 这类"vanilla 注册表未在包内声明"
的误报现在**自动过滤**:只有当 ID **恰在当前版本注册表值里**才过滤——按版本数据驱动
(1.21.1 里 `minecraft:generic.attack_speed` 是合法名会被过滤;1.21.2 改名后它是真错,不过滤)。
同理,`Cannot find tag/<reg> "minecraft:<vanilla标签>"`(如 `#minecraft:is_projectile`)在
vanilla 标签数据缓存存在时也自动过滤。已移除的 `minecraft:knockback`、拼写错误照报。
`--no-ignore` 看**全部原始诊断**——注意它会连同 `.dpkit.json` 里的 `ignore` 规则一起关掉。

> **注意 `--files` 的路径**:glob 是相对数据包 `data/` 目录的,**不带 `data/` 前缀**,
> 如 `test/function/*.mcfunction`(不是 `data/test/...`)。

## MCP server(AI IDE 原生调用)

把 dpkit 能力暴露成 MCP 工具,Claude Code / Cursor 等可直接调用,不再靠猜语法:

```bash
npm run mcp        # 启动 stdio MCP server(node dist/mcp.js)
```

工具:`check_datapack`、`query_syntax`、`complete_at`、`list_registry`、`list_versions`、
`scan_gotchas`。`check_datapack` 现在也返回宏行校验结果与 `coverage`(见上节);`list_registry`
可一键查某个注册表的合法值(写宏行前先查是否还在该版本)。默认数据包/版本走 `.dpkit.json`
与 `$DPKIT_DATAPACK` / `$DPKIT_VERSION`,工具参数可逐次覆盖。
冒烟:`node tests/mcp-smoke.mjs`(默认在 `tests/fixtures/pack` 上跑,任何机器可复现)。

## 类型化 API(脚本/工具直接调用)

CLI 与 MCP 都调用同一个 typed API(`dist/api.d.ts`):

```ts
import { checkDatapack, querySyntax, completeAt } from 'dpkit';   // npm 包名导入
const r = await checkDatapack({ datapack, version: '26.2' });      // → CheckReport
querySyntax('execute on', '26.2');                                 // 同步、离线
await completeAt({ datapack, version, rel, line, column });        // → 补全项
```

## 构建与测试

```bash
npm run build        # tsc → dist/
npm test             # 50+ 个回归测试(单元 + fixture 集成,进程内 vs LSP 引擎对拍)
npm run parity       # inproc 与 LSP 引擎逐文件 issueSig 对拍(正确性闸门,默认在 fixture 上跑)
npm run mcp          # 启动 MCP server
```

源码在 `src/`:`cli.ts`(入口)/ `api.ts`(类型化 API + 报告组装)/ `engine/inproc.ts`
(进程内引擎)/ `lsp-legacy.ts`(LSP 回退)/ `mcp.ts`(MCP server)/ `config.ts`(配置)/
若干纯逻辑模块。`tests/fixtures/pack` 是自包含 fixture 数据包(namespace `test`),
集成/对拍/冒烟测试都基于它,不依赖任何真实存档。

## 误报过滤

已知误报 `Unknown key "LastHurtMob"`(Spyglass 的 mcdoc 实体 NBT schema 没收录该字段,
字段本身在原版有效)默认自动过滤:不计入错误/警告数,单列在报告末尾
`== 忽略(已知误报, 不计入结果) ==`。要看原始诊断用 `--no-ignore`。

`--ignore=<模式>` 或配置里的 `ignore` 数组可追加自定义忽略:普通字符串按子串匹配;
`/正则/` 形式按正则匹配(可多个、逗号分隔)。

> 注意:引擎输出的诊断消息里引号是**弯引号 `“ ”`**,不是 ASCII 直引号。要匹配带引号的消息
> 建议写 `/正则/` 形式,例如 `/Unknown key ["“]LastHurtMob["”]/`。

## 增量报告(--delta)

`--delta` 仍是**全量检查**——交叉引用需要完整工程上下文,跳过未改文件会误报 undeclaredSymbol——
只是把"相对上次无变化"的文件的诊断藏起来,突出**新增 / 变化 / 已解决**的问题:

```text
files : 72 checked, 71 clean · delta: 1 changed, 0 resolved   ← 只有 1 个文件有新增/变化
== x.mcfunction ==  ✓ resolved (previously 2 issue(s))        ← 上次 2 个问题这次修好了
```

基线存于 `.dpkit-baseline.json`(仓库根,git-ignored),按 `数据包路径@@版本` 分条目——检查
不同数据包/版本互不覆盖,`--baseline=` 可换文件。首次运行某包的 `--delta` 视为全新增。
历史格式(单条目)自动读取并迁移。

## 已知坑扫描(heuristic)与游戏日志自检

引擎的宽松 schema 对"未知键/错层级"保持沉默、对运行时行为一无所知——dpkit 自带一个**通用**
启发式坑扫描器(内容级正则/结构遍历,不针对任何具体包),捕获这些"dpkit 全量 0 警告、游戏里却
静默失败"的写法,报告在 CHECK REPORT 末尾 `== <版本> 已知坑扫描 ==`:

- **JSON 成就**:`damage.source_entity`/`damage.direct_entity` 写在 damage 直接子级(应在 `damage.type.source_entity`)——游戏**静默丢弃整条成就**。
- **JSON 成就**:同触发器多 criteria + `requirements` OR——**不触发**,多来源监听要拆多个独立成就。
- **mcfunction**:`particle minecraft:item/block` 裸 ID——必须 map 语法(`{item:...}`/`{block_state:...}`),否则**整函数不加载**。
- **mcfunction**:`summon` 实体 NBT 小写/蛇形字段名——必须 PascalCase,否则被**静默忽略**。

坑扫描是启发式的、**不计入退出码**;`--no-gotchas` 关闭。消息前缀用实际生效版本。

**游戏日志自检**(`--no-log` 关闭,全量检查默认顺带跑):从数据包的 `versions` 段 /
配置的 `minecraftRoot` / `%APPDATA%` 推导 `latest.log`,按数据包自己 `data/` 的命名空间过滤,
提示 ① 数据包文件比日志新(**可能还没 /reload**,报错/计数是旧的)、② 最近一次成就计数、
③ 疑似数据包加载错误行。

## 说明

- **版本**:默认版本 = `--version=` / `DPKIT_VERSION` / 配置的 `version` / 内置默认 `auto`
  (`src/config.ts` 的 `DEFAULT_VERSION`)。`auto` 从包的 `pack.mcmeta` 自动识别版本,不锁死任何版本;
  但用 `min_format`/`max_format` 的包会被引擎识别到偏新版本,需要固定时在配置里钉版本号。
  离线语法/坑扫描(`--syntax`/`--dump`/`--complete` 之外的纯文件扫描)默认取本地缓存的最新正式版。
- **游戏数据**:首次运行从 `api.spyglassmc.com` 下载目标版本的命令树/注册表/原版数据包并缓存
  (`%LOCALAPPDATA%\spyglassmc-nodejs\Cache`),之后离线可用。
- **已知引擎坑**:客户端能力里必须带 `workspace.didChangeWatchedFiles.dynamicRegistration`,
  否则引擎不把数据包自己的文件纳入跟踪、函数/计分板/标签的交叉引用全部误报 undeclaredSymbol。

## 版本更新(与时俱进)

**新版本怎么支持:** 命令语法树、注册表、方块状态、NBT schema(vanilla-mcdoc)全部是
Spyglass 服务器下发的**数据**。每次运行引擎都带 `if-none-match`(ETag)做条件请求——
服务器一发布新版数据,**下次在线运行就自动拉到并识别**,无需手动清缓存或改代码。

```bash
node dpkit.mjs --versions                    # 看有哪些版本、最新正式版是什么、哪些已缓存
node dpkit.mjs --version=1.21.4              # 换到新版本检查(首次会自动下载)
node dpkit.mjs --version="latest release"    # 永远跟随最新正式版
node dpkit.mjs --version="latest snapshot"   # 永远跟随最新快照
```

**过旧提示:** 正常检查末尾会自动检测——如果当前按的版本落后于最新正式版,会提示
`切到新版本: node dpkit.mjs --version="…"`。用比最新正式版更新的快照时不提示。

**需要注意:**
- 前提是**在线**;离线时回退到上次缓存的数据(可能旧)。
- 用 `min_format`/`max_format` 的包 `--version=auto` 会偏到更新版本,建议**钉死版本号**。
- **万一请求的版本不在(陈旧的)版本列表里,引擎会静默回退到最新快照**而非报错——
  离线/刚发布时可能悄悄按别的版本查。用 `--versions` 确认列表里有再检查。
- 极少数**全新参数类型 / 命令格式大改**属于代码侧(parser/引擎),需要
  `npm update @spyglassmc/language-server`。常规的新命令/子命令/注册表值/NBT 字段不需要。
