# PUBLISHING.md — dpkit 开源发布手册

> **ℹ️ 本文档里的 GitHub 仓库地址 `https://github.com/kaiser-1871/MC-DPKIT` 已替换为真实地址。**
> 如果仓库将来迁移到其他用户名/仓库名下，请同步更新本文档、README 徽章、`package.json` 的
> `repository`/`bugs`/`homepage`，以及 `.github/` 里的所有相关占位符。
> 默认分支约定为 **`master`**；如果你改用 `main`，请同步修改下文的推送命令和 CI 徽章链接。

本文是 dpkit 从"本地仓库"到"GitHub + npm 公开发布"的完整操作手册。命令保持英文原文，
说明用中文。流程共 5 步 + 1 个附录，建议**严格按顺序**执行，不要跳步。

---

## 流程总览

```
第 1 步  发布前检查清单   —— 本地质量门禁（构建 / 测试 / 打包 / 版本号 / CHANGELOG）
第 2 步  推送到 GitHub     —— 建仓库、加 remote、push、打 tag、发 GitHub Release
第 3 步  发布到 npm        —— 登录、2FA、npm publish（包名 dpkit-mc）
第 4 步  发布后仓库设置    —— 默认分支、Issue、徽章、README
第 5 步  常见问题（FAQ）   —— 许可证、第三方合规、包名占用、首次开源的心理准备
附录 A   npm 包名可用性查询 与 占位地址替换清单
```

---

## 第 1 步 · 发布前检查清单

在 `git push` 和 `npm publish` 之前，逐项确认：

```bash
# 1) 工作区干净（不要带着未提交的修改发布）
git status --short            # 应只看到预期的、要提交的文件

# 2) 构建通过
npm run build                 # tsc --emitDeclarationOnly + esbuild bundle → dist/

# 3) 完整回归测试通过（含 MCP smoke）
npm test                      # 单测 + fixture 集成 + CLI + MCP smoke

# 4) 检查实际会打进 npm 包的文件清单（重要！）
npm pack --dry-run            # 确认 dist/、两个 bin、README/LICENSE/CHANGELOG/THIRD_PARTY_NOTICES、vendor 都在
                              # 确认没有误包 tests/、src/、.backup/、node_modules/、源码 map

# 5) 更新 CHANGELOG.md
#    把 [Unreleased] 下的条目归入一个新版本段，格式遵循 Keep a Changelog + SemVer
#    （本仓库 CHANGELOG 顶部已按此格式维护）

# 6) 打版本号（三者选一，会自动改 package.json/package-lock.json 并创建 git tag）
npm version patch             # 修复 → 1.0.0 → 1.0.1
npm version minor             # 新功能 → 1.0.0 → 1.1.0
npm version major             # 破坏性变更 → 1.0.0 → 2.0.0
```

> `npm version` 会触发 `preversion`/`version`/`postversion` 生命周期；本项目没有这些钩子，
> 它只改版本号、更新 lockfile、并打一个 `vX.Y.Z` 的 tag。
>
> 发布前最后再跑一遍 `npm test`（`npm version` 改了 package.json，理论上不影响构建，但验证一次更稳）。

---

## 第 2 步 · 推送到 GitHub

### 2.1 创建空仓库

在 GitHub 上 **New repository**，注意：

- **不要** 勾选 "Initialize this repository with a README / .gitignore / license" ——
  本仓库已经自带这些文件，初始化会立刻造成历史冲突。
- 默认分支名选择 **`master`**（与本仓库现状一致）。

### 2.2 添加 remote 并推送

```bash
git remote add origin https://github.com/kaiser-1871/MC-DPKIT.git   # ⚠️ 替换成你的真实仓库地址
git remote -v                                               # 确认 remote 已加对
git push -u origin master                                   # 首次推送并建立 upstream 跟踪
```

> **master vs main 的取舍**：本仓库历史上一直用 `master`，为保持 `git push -u origin master`
> 这条命令和 CI 徽章（`/actions/workflows/ci.yml`）简单直接，文档约定继续用 `master`。
> 如果你更偏好 `main`（GitHub 现在新建仓库的默认值），可以：
>
> ```bash
> git branch -M main
> git push -u origin main
> ```
>
> 但改完记得同步：CI 徽章链接里的 `master`、本文档与 README 中的分支名、以及 GitHub 仓库
> Settings → General → Default branch。

### 2.3 打 tag 并推送

```bash
git tag v1.0.0             # npm version 已经打过 tag 时，这步可跳过（用 git tag 确认）
git tag                    # 列出所有 tag，确认 v1.0.0 存在
git push origin v1.0.0     # 把 tag 单独推到远端（git push --tags 可推全部）
```

### 2.4 创建 GitHub Release

**方式一：gh CLI**

```bash
gh release create v1.0.0 \
  --title "dpkit v1.0.0" \
  --notes-file <(git log --oneline --no-merges v1.0.0^..v1.0.0) \
  --generate-notes
```

`--generate-notes` 让 GitHub 自动从已合并的 PR / commit 生成 release notes。

**方式二：网页操作**

1. 进入仓库 → **Releases** → **Draft a new release**。
2. "Choose a tag" 选 `v1.0.0`（或输入后点 "Create new tag on publish"）。
3. 点 **"Generate release notes"** 按钮（在正文编辑区右上角）自动生成 changelog。
4. 填标题（如 `v1.0.0`），点 **Publish release**。

**可选**：在 Release 里附带发布物。构建产物是 npm 包（见第 3 步），GitHub Release 附件不是
必需的；如果想让 GitHub 侧也有一个可分发的归档，可以：

```bash
npm pack                      # 生成 dpkit-mc-1.0.0.tgz（注意：实际文件名是 dpkit-mc-*.tgz）
gh release upload v1.0.0 dpkit-mc-1.0.0.tgz
```

> 建议只把 npm 作为唯一分发渠道，GitHub Release 仅作 tag + release notes 记录，避免双渠道
> 版本漂移。上传 `.tgz` 是可选做法。

---

## 第 3 步 · 发布到 npm

### 3.1 登录并确认身份

```bash
npm login        # 交互式登录（会提示用户名/密码/邮箱，以及 TOTP 一次性口令）
npm whoami       # 确认当前登录身份，返回你的 npm 用户名
```

### 3.2 启用 2FA（强烈建议）

npm 现在对发布操作强制要求 **two-factor authentication (2FA)**。在
[npmjs.com → Account → Two-Factor Authentication](https://www.npmjs.com/settings/two-factor-auth)
开启 **Authorization**（或更高等级的 "Authorization and Publishing"）级别：
发布时必须输入认证器（authenticator app）生成的一次性 TOTP 口令。

> 启用 2FA 后，`npm publish` 会额外提示输入 TOTP；CI 发布可以用
> `--otp` / automation token 等方式，详见 npm 官方文档。

### 3.3 发布

```bash
npm publish
```

- `prepublishOnly` 钩子（见 `package.json`）会自动先跑 `npm run build`，确保发布的是最新
  构建产物，无需手动 build。
- 首次发布一个 **未用过的新包名** 会成功；如果包名已被占用会直接报错（见 §5.3 / 附录 A）。
- 发布后立即验证：

```bash
npm view dpkit-mc version        # 应显示刚发布的 1.0.0
npm view dpkit-mc                 # 查看完整元数据（name/version/description/repository/bin/...）
```

### 3.4 包名被占用时的处理

本项目包名约定为 **`dpkit-mc`**（`dpkit` 已被他人占用，来龙去脉见 §5.3）。如果 `dpkit-mc`
也被占用，可选方案：

1. **换名**：再找一个可用的名字（`npm view <候选名>` 返回 404 即可用），同步修改
   `package.json` 的 `name`、`package-lock.json`，以及 README 里的安装/`npx`/import 示例和
   npm 版本徽章。
2. **加 scope**：`"name": "@<你的用户名>/dpkit"`。scoped 包默认是私有的，公开发布需要显式：

   ```bash
   npm publish --access public
   ```

   此时安装命令变成 `npm install -g @<你的用户名>/dpkit`，`npx @<你的用户名>/dpkit`。

### 3.5 deprecate / unpublish（谨慎）

```bash
npm deprecate dpkit-mc@"<1.0.0" "legacy: use a newer release"   # 标记旧版本弃用（推荐，不删包）
npm unpublish dpkit-mc@1.0.0 --force                            # 删除某个版本（几乎不要用）
```

注意：`npm unpublish` 有严格限制——发布 **72 小时之内** 才能 unpublish，之后只能
`deprecate`（标记弃用，包仍留在 registry）。**结论：宁可多跑几遍 `npm pack --dry-run` 和
`npm test` 把内容做对，也不要在发布后仓促 unpublish。**

---

## 第 4 步 · 发布后仓库设置与徽章

### 4.1 GitHub 仓库设置

1. **Settings → General → Default branch**：设为 `master`（如果用的就是 `master`，跳过）。
2. **Settings → General → Features**：确认 **Issues** 开启（开源项目靠 issue 收集反馈）。
3. **Settings → General → Issues → Labels**：按需调整标签（`bug` / `enhancement` /
   `question` / `documentation` / `good first issue`）。
4. **Settings → Access → Collaborators**：邀请协作者（如需要）。
5. 写一个 **About**（仓库简介 + 官网/文档链接 + 主题标签），提升可发现性。

### 4.2 CI 徽章

README 顶部已放置两条徽章（占位地址，发布前替换为真实仓库名）：

```markdown
[![CI](https://github.com/kaiser-1871/MC-DPKIT/actions/workflows/ci.yml/badge.svg)](https://github.com/kaiser-1871/MC-DPKIT/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/dpkit-mc)](https://www.npmjs.com/package/dpkit-mc)
```

- CI 徽章：`https://github.com/<用户名>/<仓库名>/actions/workflows/ci.yml/badge.svg`，
  链接到 `.../actions/workflows/ci.yml`（工作流文件名是 `.github/workflows/ci.yml`）。
- npm 版本徽章：Shields.io 动态生成 `https://img.shields.io/npm/v/dpkit-mc`，发布后自动
  显示最新版本号，无需维护。

> GitHub 徽章只对**已存在的仓库 + 已跑过至少一次成功的 workflow** 生效；推上去跑绿 CI 后，
> 徽章才会显示 "passing"。

---

## 第 5 步 · 常见问题（FAQ）

### 5.1 为什么用 ISC 许可证？

`LICENSE` 是 **ISC License**（Copyright (c) 2026 dpkit contributors）。ISC 与 MIT 几乎等价，
但文本更短、措辞更简洁；对使用者的义务只有"保留版权声明和许可声明"。它允许任何用途
（含商业）、修改、再分发，是最宽松的开源许可证之一。选它是因为本项目定位是"工具类库 +
CLI"，希望最大程度降低使用/内嵌门槛。

> 如果你想改成 MIT / Apache-2.0，改 `LICENSE` 文件并把 `package.json` 的 `license` 字段
> 改成对应 SPDX 标识即可（MIT 直接换文本，Apache-2.0 还需注意 NOTICE 约定）。

### 5.2 vendored 第三方代码（vendor/spyglass）的合规注意

本仓库把 Spyglass 引擎的 8 个包（`@spyglassmc/*`）以**构建产物**形式 vendored 在
`vendor/spyglass/` 里（MIT 许可），构建时再打进 `dist/`。发布/分发时必须保留：

- `vendor/spyglass/LICENSE` —— Spyglass 的 MIT 许可证文本；
- `vendor/spyglass/VENDORED.md` —— 来源、许可证、以及本仓库对其打的补丁清单；
- `THIRD_PARTY_NOTICES.md` —— 汇总所有被 bundle 进 `dist/` 的第三方库及其许可证
  （Spyglass + `@zip.js/zip.js` 等）。

**检查点**：`npm pack --dry-run` 的输出里必须能看到这些文件（或其内容被 `THIRD_PARTY_NOTICES.md`
覆盖）。如果某次改动后 `VENDORED.md` / `THIRD_PARTY_NOTICES.md` 没随包发布，第三方归属声明
就不完整——这是发布前必须修的合规问题。

### 5.3 为什么包名叫 `dpkit-mc`？`dpkit` 名字哪去了？

- 本工具**项目名仍叫 dpkit**，只有 npm 包名用了 `dpkit-mc`。
- 原因：npm 上的裸名 `dpkit` 已被他人占用。查询命令与结果：

  ```bash
  npm view dpkit
  # name: dpkit
  # version: 2.0.0
  # author/maintainer: datisthq
  # license: MIT
  # description: "Fast TypeScript data management framework built on top of the Data Package
  #               standard and Polars DataFrames"
  # bin: dpkit
  ```

  对方是另一个完全无关的项目（数据管理框架），还自带同名 `bin: dpkit`。若我们坚持用
  `dpkit` 发布，会 (a) 因无该名权限被拒；(b) 让 `npm install -g dpkit` / `npx dpkit` 装到
  别人的包，产生同名二进制冲突。因此发布包名改为 **`dpkit-mc`**。

- 怎么查一个名字是否可用：`npm view <名字>` 返回 404 = 可用；返回元数据 = 已被占用。
  候选名 `dpkit-mcp`（另一个 bin）也单独可查：

  ```bash
  npm view dpkit-mc    # 404 或 "was unpublished" 的提示 = 当前空闲
  npm view dpkit-mcp    # 同理
  ```

> 小提醒：`npx <包名>` 默认执行包内**与包名同名**的 bin。`bin` 字段里应保证有一个
> `dpkit-mc` 入口（与 `dpkit-mcp` 并存），否则 `npx dpkit-mc` 会找不到
> 对应可执行文件。改包名时请连同 `bin` 名一起核对（详见附录 A 的替换清单）。

### 5.4 首次开源的心理准备（issue 治理）

- **不要追求"零 issue"**：issue 是使用者的反馈渠道，冷清反而说明没人用。
- 明确可接受的反馈类型：bug 报告、功能请求、文档纠错、datapack 检查误报/漏报
  （附最小复现 pack 最好）。
- 用标签分流，`good first issue` 能降低新贡献者的门槛；`question` 引导到 Discussions 或
  issue 均可。
- 对安全漏洞走**私密渠道**（见 `SECURITY.md`），不要公开在 issue 里。
- 设好边界：本工具检查的是"内容"，不是"运行时沙箱"，把 `SECURITY.md` 里的边界声明贴在
  README 可见处能减少不必要的安全误报。

---

## 附录 A · npm 包名可用性查询 与 占位地址替换清单

### A.1 查名字

```bash
npm view dpkit            # 已被占用（上面 §5.3 有结果）
npm view dpkit-mc        # 当前空闲（本项目的目标包名）
npm view dpkit-mcp        # 另一个 bin 的候选名，同样可查
npm view @<你的用户名>/dpkit   # 若走 scoped 路线，查这个
```

### A.2 发布前"替换占位地址"清单

`https://github.com/kaiser-1871/MC-DPKIT` 是占位。发布前，用你真实的
`https://github.com/<用户名>/<仓库名>` 替换下列位置：

| 位置 | 说明 |
|---|---|
| `PUBLISHING.md`（本文件） | 顶部占位声明 + 2.2 的 `git remote add` 地址 |
| `README.md` | 顶部 CI 徽章链接（两处：图片 URL + 链接 URL） |
| `package.json` | `repository` / `bugs` / `homepage` 字段（fixer 已放占位） |
| `.github/` | 任何引用仓库地址的位置（如有） |

同时确认 **默认分支**（`master`）在以下位置一致：

| 位置 | 说明 |
|---|---|
| `PUBLISHING.md` 2.2 | `git push -u origin master` |
| `README.md` | CI 徽章 URL 里的 `ci.yml`（分支无关，但若改 `main` 需看 badge 的默认分支） |
| GitHub 仓库 Settings | Default branch |

改完后全局搜索 `dpkit/dpkit` 应**零命中**（除了你在文档里刻意保留的"占位说明"示例），再执行
第 2 步的 `git push`。
