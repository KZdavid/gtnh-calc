# GTNH 计算器 · 最小源码包

本包是 GTNH Calculator 的**最小源码发行版**，用于在本地浏览器中运行。  
无需 Git，无需预装 Node.js（脚本可自动下载本地 Node 至 `.local-node/`，不影响系统环境）。

> **注意**：本包为浏览器运行版，不含 Electron 桌面程序。

---

## 快速开始

### Windows（PowerShell）

```powershell
# 第一步：安装依赖并编译（首次运行或更新后执行）
./install.ps1

# 第二步：启动本地服务
./run-local.ps1
# 浏览器访问 http://127.0.0.1:5173
```

### macOS / Linux

```bash
# 刚解压时脚本可能没有执行权限，用 bash 调用即可：
bash install.sh
# install.sh 会自动为其他 .sh 脚本添加执行权限
./run-local.sh
# 浏览器访问 http://127.0.0.1:5173
```

---

## 脚本说明

| 脚本 | 说明 |
|------|------|
| `install.*` | 检测/安装 Node.js、安装构建依赖、执行编译 |
| `run-local.*` | 启动静态文件服务器，在浏览器中打开计算器 |
| `clean.*` | 删除依赖、编译产物及本地 Node（还原至解压状态） |

`install.*` 详细流程：

1. 检测系统 Node.js 版本（需 ≥ 18）
2. 若版本不足或未安装，询问是否下载本地 Node 至 `.local-node/`
3. 安装最小构建依赖（无 Electron）
4. 自动修复常见写入权限问题（`assets/`、`dist/`、`.npm-cache-local/`）
5. 执行编译；若系统 Node 构建失败，提供本地 Node 回退

---

## 包含内容

```
源码与数据：  src/  assets/  data/  index.html
构建配置：    package.json  tsconfig.json
授权协议：    LICENSE
入口脚本：    install.*  run-local.*  clean.*
工作流脚本：  scripts/minimal-release/
```

**不含**：Electron 程序、预构建产物（`dist/`）、`node_modules/`、`export/` 目录

---

## 非交互模式

Windows：

```powershell
./install.ps1 -YesLocal
```

macOS / Linux：

```bash
./install.sh --yes
```

---

## 清理

```powershell
# Windows
./clean.ps1
```

```bash
# macOS / Linux
./clean.sh
```

---

## English Summary

This is the minimal source-only release of GTNH Calculator for local browser use.  
No Electron, no pre-built binaries. Run `install.*` then `run-local.*` to get started.  
For advanced usage see the script comments or the files under `scripts/minimal-release/`.


Main entry for most users:
- `install.ps1` (Windows)
- `install.sh` (macOS/Linux)
- `run-local.ps1` / `run-local.sh` (start local server for browser)

What `install.*` does:
1. Detects system Node.js (`node` + `npm`) and checks version (>= 18)
2. If system Node is missing/too old, asks whether to install local Node in this folder (`.local-node`)
3. Installs only minimal build dependencies (no Electron)
4. Auto-fixes common permission issues for writable folders (`assets/`, `assets/js/`, `dist/`, `.npm-cache-local`)
5. Runs build
6. If build fails with system Node, offers local-Node fallback

What `run-local.*` does:
1. Uses local Node first (`.local-node`), otherwise system Node
2. Starts static server for `dist/`
3. Opens browser at `http://127.0.0.1:5173`

Included:
- Source/data for web build (`src/`, `assets/`, `data/`, `index.html`)
- Build config (`package.json`, `tsconfig.json`)
- Entry scripts: `install.*`, `run-local.*`, `clean.*`
- Developer scripts under `scripts/minimal-release/` (editable workflow internals)

Not included:
- Electron packaged binaries
- Electron dependency installation in minimal install flow
- `export/` outputs
- Prebuilt `dist/`, `release/`, `node_modules/`

### Quick start (Windows)

```powershell
./install.ps1
./run-local.ps1
```

### Quick start (macOS/Linux)

```bash
# Option A: if scripts already have execute permission
./install.sh
./run-local.sh

# Option B: first run after unzip (Windows-created zips strip Unix permissions)
bash install.sh
# install.sh automatically chmod +x all .sh scripts;
# run-local.sh and clean.sh can then be called directly:
./run-local.sh
```

### Optional non-interactive mode
Windows:

```powershell
./install.ps1 -YesLocal
```

macOS/Linux:

```bash
./install.sh --yes
```

### Cleanup (remove dependencies + outputs + local Node)
Windows:

```powershell
./clean.ps1
```

macOS/Linux:

```bash
# If already executable:
./clean.sh
# Or run directly without execute permission:
bash clean.sh
```

`clean.*` removes: `node_modules`, `dist`, `release`, `.npm-cache-local`, `.local-node`, `.local-node-download`.

### Full reset
Delete the extracted folder.
