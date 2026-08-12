# CLAUDE.md — dpkit(通用数据包工具:查错 + 教 AI 写命令)

本工具是**通用**的:检查任意数据包、按任意游戏版本检查。默认值来自 `.dpkit.json`(查找
顺序 cwd → 家目录,`--config=<path>` 可指定;见 `.dpkit.example.json`)。仓库本身不附带任何
特定存档/数据包的内容,裸跑 `node dpkit.mjs` 查什么由配置决定。**别的包/别的版本一律用
`--datapack=` / `--version=` 或改配置,不要假设任务永远针对同一个包/版本**。优先级:
`CLI 参数 > 环境变量(DPKIT_DATAPACK / DPKIT_VERSION / DPKIT_CONFIG)> .dpkit.json > 内置默认`。

**架构(2026-08 重构后)**:源码是 TypeScript,在 `src/`(cli / api / engine / lsp-legacy / mcp /
syntax / registry / macrocheck / config / 纯逻辑模块),编译到 `dist/`。根 `dpkit.mjs` 是 shim,`node dpkit.mjs` 用法不变。
**改源码后必须 `npm run build` 才生效**。默认用进程内引擎(`@spyglassmc/core` 的 `Project` 直驱,
不 spawn 子进程),`--engine=lsp` 保留旧 LSP 子进程路径做对拍。另有 MCP server(`npm run mcp`,
工具 check_datapack/query_syntax/complete_at/list_versions/scan_gotchas)与类型化 API(`dist/api.d.ts`)。
回归测试:`npm test`(22 个);正确性闸门:`npm run parity`(inproc vs LSP 逐文件 issueSig 相等,
默认在自包含 fixture 上跑,`DPKIT_PARITY_DATAPACK` 可指向真实包)。
进程内引擎的关键坑:projectRoot 必须过 `core.normalizeUri`(盘符小写),否则 `analyzeProject`
大小写敏感匹配不到文件、分析 0 文件。

## 写命令之前:先查 ground-truth 语法(重要)

**不要凭记忆臆测某条命令/参数是否存在于目标版本,也不要猜枚举值。** 先用下面的命令拿到
该版本真实语法,再动笔。目标版本 = `--version=` 或配置里的 `version`:

```bash
# 查一条命令/子命令的完整语法(离线、毫秒级,不用开游戏)
node dpkit.mjs --syntax="execute on"            # 显示 on 的 8 个合法值 + 后续能链什么
node dpkit.mjs --syntax="damage"                # 显示完整参数链与各参数含义
node dpkit.mjs --syntax="advancement grant" --depth=6   # 深的命令可加大展开深度

# 查注册表值(离线;写宏行/命令里的 registry ID 前先查它是否还在该版本)
node dpkit.mjs --registry=mob_effect            # 该版本全部 mob_effect(26.2 无 knockback)
node dpkit.mjs --registry=?                     # 列出全部可用注册表 + 数量

# 在某个具体文件的光标位置问"这里能填什么"(实时,引擎真实解析)
node dpkit.mjs --complete=<data相对路径>:行:列
#   ← 格式:相对 datapack 的 data/ 的路径:行:列(1-based);$ 宏行不支持补全,普通行支持
node dpkit.mjs --complete-inline="effect give @s knock"   # 免造临时数据包,直接补全命令字符串

# 全量参考(默认解析到本地缓存的最新正式版,现为 26.2,92 条顶层命令)已离线生成:
#   command-reference-26.2.md     重新生成: node dpkit.mjs --dump-all [--depth=N]
```

> 语法数据来自 Spyglass 官方按版本发布的命令树(已缓存到
> `%LOCALAPPDATA%\spyglassmc-nodejs\Cache`),与 VS Code 的 Datapack Helper Plus 完全一致,
> 是**该版本唯一可信的语法来源**。`--syntax` 报错时也会把合法取值列出来,同样可作为反馈。

## 检查数据包

```bash
node dpkit.mjs                                       # 全量检查(默认按配置里的数据包/版本)
node dpkit.mjs --delta                               # 只报新增/变化/已解决的问题
node dpkit.mjs --files=test/function/*.mcfunction    # 只看部分文件
node dpkit.mjs --json                                # 机器可读输出
node dpkit.mjs --datapack=D:\其他包 --version=1.21.4 # 检查任意别的数据包/版本
```

- `--files` 是相对 `data/` 的路径,**不带 `data/` 前缀**。
- `pack.mcmeta` 也纳入检查:坏 mcmeta 之前静默导致版本自动识别错(0 诊断),现在会报解析错。
- 已知误报 `Unknown key "LastHurtMob"` 与 `Cannot find <reg> "minecraft:<合法ID>"`(vanilla 注册表
  未在包内声明)默认自动过滤;`--no-ignore` 看原始诊断。
- 退出码:0=无错误,1=有错误(或 `--strict` 时有警告),2=环境/网络失败。

## 配置(.dpkit.json)

把"默认检查哪个包/哪个版本"写进配置,就不用每次带参数。字段:datapack / version / ignore /
minecraftRoot / baselineFile / gotchas / logcheck。相对路径按配置文件所在目录解析。

```json
{
  "datapack": "D:/.../datapacks/MyPack",
  "version": "1.21.4",
  "minecraftRoot": "D:/.../.minecraft",
  "ignore": ["/Unknown key [\"“]Foo[\"”]/"]
}
```

## 版本与已知问题

- **默认 auto,不锁版本**:版本来自 `--version=` / `DPKIT_VERSION` / 配置的 `version` /
  内置默认 `auto`(`src/config.ts` 的 `DEFAULT_VERSION`)。`auto` 读包内 pack.mcmeta 自动识别,
  不锁任何版本;但 `min_format`/`max_format` 的包会被引擎识别到偏新版本,要固定时在配置/参数里钉版本号。
  离线语法/坑扫描(`--syntax`/`--dump`)默认取本地缓存的最新正式版。
- **升级到新版本**:命令树/注册表/NBT schema 都是数据驱动,在线跑
  `node dpkit.mjs --version=<新版>` 会自动下载识别;`--versions` 可查可用版本。
  `--version="latest release"` 永远跟随最新正式版。过旧时检查报告末尾会提示。
  极少数全新参数类型/格式大改才需 `npm update @spyglassmc/language-server`。
- **坑扫描(gotchas)与日志自检都是通用的**:内容级正则/命名空间推导,不针对任何具体包;
  消息前缀用实际生效版本。`--no-gotchas` / `--no-log` 关闭。另有 `$` 宏行注册表校验
  (`src/macrocheck.ts`,默认开,`--no-macro` 关):引擎对宏行**不做任何校验**,dpkit 独立沿命令树
  把 `$(...)` 之外的字面 ID 对照注册表,不中报 `[macro]` Warning;保守原则——含宏变量/自定义
  命名空间/`#tag`/树遍历脱同步一律标"未校验"不误报,包内自声明数据驱动注册表自动放行。
  报告带 `coverage`(宏行数/已校验/未校验/自动误报过滤数),有未校验位置的文件会标注。
- **数据驱动误报过滤**:`Cannot find <reg> "minecraft:<合法ID>"` 当 ID 恰在当前版本注册表值里
  时自动过滤(按版本数据驱动,如 1.21.1 的 `generic.attack_speed` 合法、1.21.2 起是真错);
  `Cannot find tag/<reg> "minecraft:<vanilla标签>"`(vanilla-data tarball 缓存存在时)同样自动过滤。
  真拼写错/已移除 ID 照报。`--strict` 令警告也 exit 1(CI)。`--no-ignore` 看全部原始诊断
  (会把 `.dpkit.json` 里的 `ignore` 规则也一并关掉)。
- `$` 宏行(`$execute ...`):Spyglass 对宏行**不做补全**(返回空),但 `--syntax`/`--registry` 离线
  查法不受影响;宏行的**注册表 ID 校验**由 dpkit 后处理(见上)。需要补全时把要查的片段先写到
  普通行,或用 `--complete-inline="<命令>"` 直接补全。
