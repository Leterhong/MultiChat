// SSRF 防护：拦截指向私有/内网地址的导入与远程资产请求。
// 注意：本地模型发现（/api/fetch-local-models）故意不在此拦截，因为它本就需要访问用户自己的 localhost 服务。
const { promises: dns } = require('dns');
const net = require('net');

function ipv4ToInt(ip: string): number {
  const parts = ip.split('.').map(Number);
  return (((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0;
}

function inCidr(ipInt: number, base: number, bits: number): boolean {
  if (bits === 0) return ipInt === (base >>> 0);
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (base & mask);
}

const PRIVATE_V4: Array<[number, number]> = [
  [0, 8], // 0.0.0.0/8
  [ipv4ToInt('10.0.0.0'), 8],
  [ipv4ToInt('100.64.0.0'), 10], // CGNAT
  [ipv4ToInt('127.0.0.0'), 8], // loopback
  [ipv4ToInt('169.254.0.0'), 16], // link-local
  [ipv4ToInt('172.16.0.0'), 12],
  [ipv4ToInt('192.0.0.0'), 24],
  [ipv4ToInt('192.168.0.0'), 16],
  [ipv4ToInt('198.18.0.0'), 15],
];

function isPrivateV4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === 0) return true;
  return PRIVATE_V4.some(([base, bits]) => inCidr(n, base, bits));
}

function isPrivateV6(ip: string): boolean {
  const a = ip.toLowerCase();
  if (a === '::1' || a === '::') return true;
  if (a.startsWith('fe80:')) return true; // link-local
  if (a.startsWith('fc') || a.startsWith('fd')) return true; // unique local fc00::/7
  const mapped = mappedV4(a);
  if (mapped) return isPrivateV4(mapped);
  return false;
}

function mappedV4(ip: string): string | null {
  const dotted = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (dotted) return dotted[1];
  const hex = ip.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (!hex) return null;
  const high = Number.parseInt(hex[1], 16), low = Number.parseInt(hex[2], 16);
  return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
}

function isMetadataAddress(ip: string): boolean {
  const value = ip.toLowerCase();
  const mapped = mappedV4(value);
  const v4 = mapped || (net.isIP(value) === 4 ? value : null);
  return Boolean(
    v4 && (v4.startsWith('0.') || v4.startsWith('169.254.') || v4 === '100.100.100.200')
  ) || value === '::' || value === 'fd00:ec2::254' || value.startsWith('fe80:');
}

async function assertSafeUrl(input: string, { allowPrivate = false }: { allowPrivate?: boolean } = {}): Promise<URL> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error('非法 URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('仅支持 http/https 链接');
  }
  // Node keeps square brackets around IPv6 URL hostnames; net.isIP expects the
  // bare address. Normalize before applying private/metadata checks.
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host) === 4) {
    if (isMetadataAddress(host)) throw new Error('SSRF: 目标为保留、元数据或链路本地地址 ' + host);
    if (!allowPrivate && isPrivateV4(host)) throw new Error('SSRF: 目标为内网地址 ' + host);
  } else if (net.isIP(host) === 6) {
    if (isMetadataAddress(host)) throw new Error('SSRF: 目标为保留、元数据或链路本地地址 ' + host);
    if (!allowPrivate && isPrivateV6(host)) throw new Error('SSRF: 目标为内网地址 ' + host);
  } else {
    const addrs = await dns.lookup(host, { all: true });
    for (const { address } of addrs) {
      const v = net.isIP(address);
      if (isMetadataAddress(address)) throw new Error('SSRF: 解析到保留、元数据或链路本地地址 ' + address);
      if (v === 4 && !allowPrivate && isPrivateV4(address)) throw new Error('SSRF: 解析到内网地址 ' + address);
      if (v === 6 && !allowPrivate && isPrivateV6(address)) throw new Error('SSRF: 解析到内网地址 ' + address);
    }
  }
  return url;
}

// 带 SSRF 校验的 fetch：手动处理重定向，每次跳转都重新校验目标地址。
async function safeFetch(input: string, options: RequestInit = {}, allowPrivate = false, depth = 0): Promise<Response> {
  const url = await assertSafeUrl(input, { allowPrivate });
  const resp = await fetch(url, { ...options, redirect: 'manual' });
  if ([301, 302, 307, 308].includes(resp.status) && depth < 3) {
    const loc = resp.headers.get('location');
    if (!loc) throw new Error('重定向缺少 Location');
    const nextUrl = new URL(loc, url);
    let nextOptions = options;
    if (nextUrl.origin !== url.origin && options.headers) {
      // Never forward credentials, cookies, MCP sessions or arbitrary custom
      // headers to another origin. Only protocol/content negotiation headers
      // are safe to retain across the redirect boundary.
      const current = new Headers(options.headers);
      const forwarded = new Headers();
      for (const name of ['accept', 'accept-language', 'content-type', 'mcp-protocol-version']) {
        const value = current.get(name);
        if (value !== null) forwarded.set(name, value);
      }
      nextOptions = { ...options, headers: forwarded };
    }
    return safeFetch(nextUrl.toString(), nextOptions, allowPrivate, depth + 1);
  }
  return resp;
}

module.exports = { isPrivateV4, isPrivateV6, assertSafeUrl, safeFetch };
