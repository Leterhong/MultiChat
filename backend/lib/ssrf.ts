// SSRF 防护：拦截指向私有/内网地址的导入与远程资产请求。
// 注意：本地模型发现（/api/fetch-local-models）故意不在此拦截，因为它本就需要访问用户自己的 localhost 服务。
import { promises as dns } from 'dns';
import net from 'net';

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

export function isPrivateV4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === 0) return true;
  return PRIVATE_V4.some(([base, bits]) => inCidr(n, base, bits));
}

export function isPrivateV6(ip: string): boolean {
  const a = ip.toLowerCase();
  if (a === '::1' || a === '::') return true;
  if (a.startsWith('fe80:')) return true; // link-local
  if (a.startsWith('fc') || a.startsWith('fd')) return true; // unique local fc00::/7
  const m = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/); // IPv4-mapped
  if (m) return isPrivateV4(m[1]);
  return false;
}

export async function assertSafeUrl(input: string, { allowPrivate = false }: { allowPrivate?: boolean } = {}): Promise<URL> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error('非法 URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('仅支持 http/https 链接');
  }
  const host = url.hostname;
  if (net.isIP(host) === 4) {
    if (!allowPrivate && isPrivateV4(host)) throw new Error('SSRF: 目标为内网地址 ' + host);
  } else if (net.isIP(host) === 6) {
    if (!allowPrivate && isPrivateV6(host)) throw new Error('SSRF: 目标为内网地址 ' + host);
  } else {
    const addrs = await dns.lookup(host, { all: true });
    for (const { address } of addrs) {
      const v = net.isIP(address);
      if (v === 4 && !allowPrivate && isPrivateV4(address)) throw new Error('SSRF: 解析到内网地址 ' + address);
      if (v === 6 && !allowPrivate && isPrivateV6(address)) throw new Error('SSRF: 解析到内网地址 ' + address);
    }
  }
  return url;
}

// 带 SSRF 校验的 fetch：手动处理重定向，每次跳转都重新校验目标地址。
export async function safeFetch(input: string, options: RequestInit = {}, allowPrivate = false, depth = 0): Promise<Response> {
  const url = await assertSafeUrl(input, { allowPrivate });
  const resp = await fetch(url, { ...options, redirect: 'manual' });
  if ([301, 302, 307, 308].includes(resp.status) && depth < 3) {
    const loc = resp.headers.get('location');
    if (!loc) throw new Error('重定向缺少 Location');
    const next = new URL(loc, url).toString();
    return safeFetch(next, options, allowPrivate, depth + 1);
  }
  return resp;
}
