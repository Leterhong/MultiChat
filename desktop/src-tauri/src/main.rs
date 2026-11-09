#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! MultiChat 桌面壳（Tauri v2）。
//!
//! 启动流程：
//!   1. 在 setup 里 spawn 本地 Node 后端（bin/multichat.mjs web --port <port> --no-open）；
//!   2. 轮询 /api/health 等它就绪；
//!   3. 用 WebviewWindowBuilder 手动创建 main 窗口，加载后端地址；
//!   4. 窗口关闭 / 应用退出时 kill 掉后端子进程，避免残留。
//!
//! 注意：这里只使用 Rust 标准库做 HTTP 探测，不引入任何第三方 HTTP 客户端 crate。

use std::{
    env,
    io::{self, Read, Write},
    net::{SocketAddr, TcpListener, TcpStream},
    path::{Path, PathBuf},
    process::{Child, Command},
    sync::Mutex,
    thread,
    time::{Duration, Instant},
};

use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder, WindowEvent};

/// 后端子进程句柄，放进 Tauri 的全局 state。
/// 用 Mutex<Option<..>> 是为了在多个出口（窗口事件、RunEvent::Exit）里用 take() 幂等地取走。
type BackendChild = Mutex<Option<Child>>;

/// 把一段文本包成 io::Error，方便在 setup 里用 `?` 转成 Box<dyn Error>。
fn other_err(msg: impl Into<String>) -> io::Error {
    io::Error::new(io::ErrorKind::Other, msg.into())
}

/// 选择后端端口：优先 MULTICHAT_PORT，否则让内核分配一个空闲端口。
fn pick_port() -> io::Result<u16> {
    if let Ok(raw) = env::var("MULTICHAT_PORT") {
        if let Ok(port) = raw.trim().parse::<u16>() {
            return Ok(port);
        }
    }
    // 绑定 127.0.0.1:0 拿到一个空闲端口，listener 离开作用域即释放；
    // 随后 Node 后端会绑定该端口。存在极小的端口抢占竞态，靠下面的健康轮询兜底。
    let listener = TcpListener::bind("127.0.0.1:0")?;
    Ok(listener.local_addr()?.port())
}

/// 启动本地 Node 后端，工作目录设为仓库根。
fn spawn_backend(repo_root: &Path, port: u16) -> io::Result<Child> {
    // node 可执行文件：环境变量优先，没设就用 PATH 里的 `node`。
    let node = env::var("MULTICHAT_NODE_PATH").unwrap_or_else(|_| "node".to_string());
    let script = repo_root.join("bin").join("multichat.mjs");

    let mut cmd = Command::new(node);
    cmd.arg(script)
        .arg("web")
        .arg("--port")
        .arg(port.to_string())
        .arg("--no-open")
        .current_dir(repo_root);

    // Windows 上 node.exe 是控制台程序，直接 spawn 会闪出一个黑色控制台窗口；
    // 加 CREATE_NO_WINDOW 隐藏它（仅 Windows 生效）。
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    cmd.spawn()
}

/// 用标准库发一个最小 HTTP GET 探测 /api/health，避免引入任何 HTTP 客户端 crate。
/// 只要能连上并收到 `HTTP/` 响应头，就认为后端已就绪。
fn probe_health(port: u16) -> bool {
    let addr: SocketAddr = format!("127.0.0.1:{port}")
        .parse()
        .expect("构造本地回环地址失败");
    let mut stream = match TcpStream::connect_timeout(&addr, Duration::from_millis(300)) {
        Ok(s) => s,
        Err(_) => return false,
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(300)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(300)));

    let request = format!(
        "GET /api/health HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n"
    );
    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }
    let mut buf = [0u8; 32];
    matches!(stream.read(&mut buf), Ok(n) if n > 0 && buf[..n].starts_with(b"HTTP/"))
}

/// 最多等约 20 秒，直到后端 /api/health 可访问；子进程提前退出则立即报错。
fn wait_for_backend(port: u16, child: &mut Child) -> io::Result<()> {
    let deadline = Instant::now() + Duration::from_secs(20);
    loop {
        if let Some(status) = child.try_wait()? {
            return Err(other_err(format!("本地后端进程提前退出：{status}")));
        }
        if probe_health(port) {
            return Ok(());
        }
        if Instant::now() >= deadline {
            return Err(other_err("等待本地后端 /api/health 超时（约 20 秒）"));
        }
        thread::sleep(Duration::from_millis(250));
    }
}

/// 从全局 state 里取出并 kill 后端子进程；用 take() 保证多次调用只杀一次。
fn kill_backend(handle: &tauri::AppHandle) {
    if let Some(state) = handle.try_state::<BackendChild>() {
        // 即使别的线程 panic 导致锁中毒，也要继续把子进程收掉。
        let mut guard = state.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
            let _ = child.wait(); // 回收，避免僵尸进程
        }
    }
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // 1) CARGO_MANIFEST_DIR 是 desktop/src-tauri，向上两级即仓库根。
            let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
            let repo_root = manifest_dir
                .join("..")
                .join("..")
                .canonicalize()
                .map_err(|e| other_err(format!("无法定位仓库根目录：{e}")))?;

            // 2) 选端口并启动后端。
            let port = pick_port()?;
            let mut child = spawn_backend(&repo_root, port).map_err(|e| {
                other_err(format!(
                    "启动本地后端失败（请确认已安装 Node，或用 MULTICHAT_NODE_PATH 指定）：{e}"
                ))
            })?;

            // 3) 等健康检查通过，确认后端真的能对外提供页面与 /api/health。
            wait_for_backend(port, &mut child)?;

            // 4) 手动创建 main 窗口，加载本地后端地址（WebviewUrl::External 必须是 http/https）。
            //    配置里 app.windows 为空，就是为了让窗口只在这里被创建一次。
            let handle = app.handle().clone();
            let url = format!("http://127.0.0.1:{port}");
            let window = WebviewWindowBuilder::new(&handle, "main", WebviewUrl::External(url.parse()?))
                .title("MultiChat")
                .inner_size(1280.0, 800.0)
                .min_inner_size(960.0, 640.0)
                .build()?;

            // 5) 把子进程交给 Tauri 管理，供窗口事件 / 退出事件取用。
            app.manage(Mutex::new(Some(child)));

            // 6) 窗口关闭（收到关闭请求或已销毁）时结束后端子进程。
            window.on_window_event(move |event| match event {
                WindowEvent::CloseRequested { .. } | WindowEvent::Destroyed => {
                    kill_backend(&handle);
                }
                _ => {}
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("构建 Tauri 应用失败")
        .run(|handle, event| {
            // 7) 事件循环退出时兜底再 kill 一次（与窗口事件里的 kill 通过 take() 幂等）。
            if let RunEvent::Exit = event {
                kill_backend(handle);
            }
        });
}
