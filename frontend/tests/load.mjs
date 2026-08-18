// 最小 DOM / 浏览器环境 stub：在 Node 下加载前端源模块并触发 bootstrap，
// 验证「模块装配 + 启动」无 ReferenceError（等价于浏览器加载期/启动期）。
// 用途：E1-3 物理拆分后，无浏览器环境下确认没有遗漏的跨模块函数引用。
function makeEl() {
  const target = function () { return makeEl(); };
  return new Proxy(target, {
    get(_t, prop) {
      if (prop === 'classList') return { add() {}, remove() {}, toggle() {}, contains() { return false; } };
      if (prop === 'style') return {};
      if (prop === 'dataset') return {};
      if (prop === 'files') return [];
      if (prop === 'value') return '';
      if (prop === Symbol.toPrimitive) return () => '';
      if (prop === 'toString') return () => '';
      if (prop === 'then') return undefined; // 不是 promise，避免被 await
      return makeEl();
    },
    set() { return true; },
    apply() { return makeEl(); },
  });
}

global.window = global;
global.document = {
  querySelector: () => makeEl(),
  querySelectorAll: () => [],
  getElementById: () => makeEl(),
  createElement: () => makeEl(),
  addEventListener: () => {},
  body: makeEl(),
};
global.localStorage = (() => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
})();
global.location = { search: '' };
global.fetch = async () => ({
  ok: true, status: 200,
  headers: { get: () => 'application/json' },
  json: async () => ({}),
  text: async () => '',
});
global.confirm = () => true;
global.prompt = () => null;
global.Blob = class {};
global.FormData = class { get() { return null; } entries() { return []; } };
global.URLSearchParams = URLSearchParams;
global.URL = URL;

// 动态 import 必须在 stub 就绪之后（ESM 静态 import 会先于脚本主体执行）。
const names = [
  'core/index', 'modules/init', 'modules/data', 'modules/conversations',
  'modules/modelPicker', 'modules/agentPicker', 'modules/settings',
  'modules/pluginsUI', 'modules/importExport', 'modules/modal',
  'modules/render', 'modules/markdown', 'modules/send',
];
const mods = {};
for (const n of names) mods[n] = await import('../src/' + n + '.js');

const merged = {};
for (const k in mods) Object.assign(merged, mods[k]);
Object.assign(globalThis, merged);

try {
  if (typeof globalThis.bootstrap !== 'function') throw new Error('bootstrap not found on globalThis after assembly');
  await globalThis.bootstrap();
  console.log('LOAD_OK: all modules imported and bootstrap executed without ReferenceError');
  process.exit(0);
} catch (e) {
  console.error('LOAD_FAIL:', (e && e.stack) || e);
  process.exit(1);
}
