// 主模块加载失败（网络中断/旧缓存指向已删除的 chunk 等）时，#root 会保持空白
// 且主应用的错误兜底来不及挂载。这个独立脚本在 load 后检查一次：4 秒内
// #root 仍是空的就显示重试入口；应用一旦挂载立即隐藏。
(function () {
  function hide() { var fb = document.getElementById('bootFallback'); if (fb) fb.style.display = 'none'; }
  window.addEventListener('load', function () {
    setTimeout(function () {
      var root = document.getElementById('root');
      var fb = document.getElementById('bootFallback');
      if (!root || !fb) return;
      if (root.firstChild) { hide(); return; }
      fb.style.display = 'flex';
    }, 4000);
  });
  new MutationObserver(hide).observe(document.documentElement, { childList: true, subtree: true });
})();
