# MultiChat 桌面壳（Tauri v2）

用 Tauri v2 开一个原生窗口，由 Rust 侧启动本地 Node 后端（Express），窗口加载该后端地址，
关闭窗口时结束后端子进程。当前为**骨架阶段**：依赖系统已安装的 Node。

> 本目录全部为新增文件，不修改仓库根目录及 `frontend/`、`.github/`、`README.md` 等任何已有文件。

## 目录结构

```
desktop/
├── package.json                       # npm 脚本与 @tauri-apps/cli / api 依赖
├── .gitignore                         # 忽略 node_modules、target、gen
├── README.md                          # 本文件
├── scripts/
│   └── gen_icons.py                   # 纯 Python 标准库生成图标（无需 Pillow）
└── src-tauri/
    ├── Cargo.toml                     # Tauri v2 桌面应用（bin = src/main.rs）
    ├── build.rs                       # tauri_build::build()
    ├── tauri.conf.json                # Tauri v2 配置
    ├── capabilities/
    │   └── default.json               # main 窗口的 core:default 权限集
    ├── icons/                         # 生成好的图标
    │   ├── 32x32.png
    │   ├── 128x128.png
    │   ├── 128x128@2x.png            # 256x256
    │   ├── icon.ico                   # 内嵌 16/32/48/256 PNG
    │   └── icon.icns                  # 16/32/64/128/256/512 PNG 条目
    └── src/
        └── main.rs                    # 启动后端 + 建窗口 + 退出清理
```

## 前置条件

- **Rust stable**（含 `cargo`）。本机当前**没有 Rust 工具链**，见文末说明。
- **Node.js >= 22.13.0**（与根 `package.json` 的 `engines` 一致），且 `node` 在 `PATH` 中。
- 仓库根已执行过 `npm run build`，产出 `frontend/dist`（`tauri build` 需要 `build.frontendDist` 存在）。
- Windows：WebView2 Runtime；macOS / Linux：对应的系统 WebView 依赖。

## 安装与启动

在**仓库根**执行（所有命令用 `--prefix desktop` 指向本目录）：

```bash
# 1. 安装依赖（会在 desktop/node_modules 下安装 Tauri CLI）
npm install --prefix desktop

# 2. 开发模式：等价于 tauri dev
npm run dev --prefix desktop

# 3. 生产构建：等价于 tauri build
npm run build --prefix desktop
```

`npm run tauri --prefix desktop` 对应 `tauri` CLI 本体；需要给 CLI 传子命令时，
可先 `cd desktop` 再用 `npm run tauri -- info` 之类的形式。

### 图标

图标已随仓库提供。需要重新生成时（仅用 Python 标准库）：

```bash
python  desktop/scripts/gen_icons.py     # Windows / python 命令可用时
python3 desktop/scripts/gen_icons.py     # macOS / Linux
# 或：npm run icon --prefix desktop
```

图案取自 `frontend/src/components/BrandMark.tsx`：品牌蓝 `#3b6cf6` 的双弧 + 中心实心圆核，
透明背景。`icon.ico` 与 `icon.icns` 均为内嵌 PNG 的现代容器格式。

## 环境变量

| 变量 | 作用 | 默认值 |
| --- | --- | --- |
| `MULTICHAT_NODE_PATH` | `node` 可执行文件路径。系统未把 Node 加入 PATH、或要用指定版本时设置 | `node`（走 PATH） |
| `MULTICHAT_PORT` | 后端监听端口 | 未设置时由 `TcpListener::bind("127.0.0.1:0")` 取一个空闲端口 |

示例（Windows PowerShell）：

```powershell
$env:MULTICHAT_NODE_PATH = "C:\Program Files\nodejs\node.exe"
$env:MULTICHAT_PORT = "3000"
npm run dev --prefix desktop
```

说明：

- `tauri.conf.json` 里的 `build.devUrl = "http://127.0.0.1:3000"` 只是给 Tauri CLI 的提示；
  窗口真实地址由 Rust 在运行时按实际端口用 `WebviewUrl::External` 构造。
  `app.windows` 为空、`beforeDevCommand` / `beforeBuildCommand` 为空字符串，
  是为了让后端只由 Rust 启动一次、窗口只由 Rust 创建一次（避免出现两个窗口 / 两次启动）。
- 后端命令固定为：`<仓库根>/bin/multichat.mjs web --port <port> --no-open`，
  工作目录为仓库根；路径由 `CARGO_MANIFEST_DIR`（`desktop/src-tauri`）向上两级推导。
- Rust 侧轮询 `http://127.0.0.1:<port>/api/health`（标准库 TCP + 最小 HTTP GET，
  不引入 `reqwest` 等第三方 HTTP 客户端），最多等约 20 秒；窗口关闭 / 应用退出时 kill 子进程。

## 生产分发的限制（重要）

当前骨架**依赖目标机器上已安装 Node 运行时**：`main.rs` 通过 `node` 命令启动后端。
这意味着 `tauri build` 打出的安装包在没有 Node 的机器上无法运行。

正式分发前需要把 **Node 运行时作为 sidecar 一起打包**，大致步骤：

1. 在 `tauri.conf.json` 的 `bundle.externalBin` 声明 Node 可执行文件（按平台提供二进制）；
2. `main.rs` 改用 `app.path().resolve("...", BaseDirectory::Resource)`（或 sidecar 解析 API）
   得到可执行文件绝对路径，替换现在的 `MULTICHAT_NODE_PATH` / `node`；
3. 把 `bin/multichat.mjs` 及其依赖的 `backend/`、`frontend/dist`、`node_modules`
   一并作为资源打包，或在安装时释放到可写目录。

这部分**尚未实现**，本目录仅完成「启动本地后端 → 开窗口 → 退出清理」的骨架。

## 验证状态（如实说明）

- 所有 JSON 已用 `json.load` 逐个校验可解析。
- 图标 PNG / ICO / ICNS 已用 Python 校验结构（签名、CRC、尺寸、目录项偏移）并目视确认图案正确。
- **本机无 Rust 工具链，未执行 `cargo build` / `cargo check`，也未执行 `npm install` / `tauri build`。**
  因此 Rust 代码与 Tauri 配置未经编译验证；Rust 侧 API 写法依据 Tauri v2 官方文档核对，
  但仍需在装有 Rust stable 的机器上 `npm run dev --prefix desktop` 实测。
- `src-tauri/gen/schemas/`（capability 的 `$schema` 指向处）由 `tauri-build` 在首次构建时生成，
  已加入 `.gitignore`；首次 `cargo build` 前编辑器可能提示 schema 文件缺失，属正常现象。
