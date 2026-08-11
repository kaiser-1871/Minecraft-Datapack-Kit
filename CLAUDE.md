# CLAUDE.md — dpkit(pvp 数据包工具:查错 + 教 AI 写命令)

本目录工具用于检查存档「丽格乔娅史诗」的 `pvp` 数据包(位于 `../datapacks/pvp`)。
游戏版本固定 **26.2**(data_pack_version 107)。引擎自动识别会偏新,所以一律用 `--version=26.2`。

**架构(2026-08 重构后)**:源码是 TypeScript,在 `src/`(cli / api / engine / lsp-legacy / mcp /
syntax / 纯逻辑模块),编译到 `dist/`。根 `dpkit.mjs` 是 shim,`node dpkit.mjs` 用法不变。
**改源码后必须 `npm run build` 才生效**。默认用进程内引擎(`@spyglassmc/core` 的 `Project` 直驱,
不 spawn 子进程),`--engine=lsp` 保留旧 LSP 子进程路径做对拍。新增 MCP server(`npm run mcp`,
工具 check_datapack/query_syntax/complete_at/list_versions/scan_gotchas)与类型化 API(`dist/api.d.ts`)。
回归测试:`npm test`(21 个);正确性闸门:`npm run parity`(inproc vs LSP 逐文件 issueSig 相等)。
进程内引擎的关键坑:projectRoot 必须过 `core.normalizeUri`(盘符小写),否则 `analyzeProject`
大小写敏感匹配不到文件、分析 0 文件。

## 写命令之前:先查 ground-truth 语法(重要)

**不要凭记忆臆测某条命令/参数是否存在于 26.2,也不要猜枚举值。** 先用下面的命令拿到
该版本真实语法,再动笔:

```bash
# 查一条命令/子命令的完整语法(离线、毫秒级,不用开游戏)
node dpkit.mjs --syntax="execute on"            # 显示 on 的 8 个合法值 + 后续能链什么
node dpkit.mjs --syntax="damage"                # 显示完整参数链与各参数含义
node dpkit.mjs --syntax="advancement grant" --depth=6   # 深的命令可加大展开深度

# 在某个具体文件的光标位置问"这里能填什么"(实时,引擎真实解析)
node dpkit.mjs --complete=battle/function/x.mcfunction:5:12
#   ← 格式:data/ 相对路径:行:列(1-based);$ 宏行不支持补全,普通行支持

# 全量参考(92 条顶层命令)已离线生成,可让 Claude 直接阅读:
#   command-reference-26.2.md     重新生成: node dpkit.mjs --dump-all [--depth=N]
```

> 语法数据来自 Spyglass 官方按版本发布的命令树(已缓存到
> `%LOCALAPPDATA%\spyglassmc-nodejs\Cache`),与 VS Code 的 Datapack Helper Plus 完全一致,
> 是**该版本唯一可信的语法来源**。`--syntax` 报错时也会把合法取值列出来,同样可作为反馈。

## 检查数据包

```bash
node dpkit.mjs                                       # 全量检查 pvp 包(默认 26.2)
node dpkit.mjs --delta                               # 只报新增/变化/已解决的问题
node dpkit.mjs --files=battle/function/snowman/*.mcfunction   # 只看部分文件
node dpkit.mjs --json                                # 机器可读输出
```

- `--files` 是相对 `data/` 的路径,**不带 `data/` 前缀**。
- 已知误报 `Unknown key "LastHurtMob"` 默认过滤;`--no-ignore` 看原始诊断。
- 退出码:0=无错误,1=有错误,2=环境/网络失败。

## 版本与已知问题

- pack.mcmeta 用新字段 `min_format`/`max_format`,引擎自动识别会偏到更新版本,
  所以默认强制 `--version=26.2`。
- **升级到新版本**:命令树/注册表/NBT schema 都是数据驱动,在线跑
  `node dpkit.mjs --version=<新版>` 会自动下载识别;`--versions` 可查可用版本。
  `--version="latest release"` 永远跟随最新正式版。过旧时检查报告末尾会提示。
  极少数全新参数类型/格式大改才需 `npm update @spyglassmc/language-server`。
- 已知真实问题:`is_magic` 伤害类型标签原版不存在(frost_attack_trigger /
  break_stealth_trigger),详见 README「已知真实问题」。
- `$` 宏行(`$execute ...`):Spyglass 对宏行**不做补全**(返回空),但 `--syntax` 离线查法不受影响;
  需要补全时把要查的片段先写到普通行,或在另一条普通命令上查。
