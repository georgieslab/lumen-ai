// Keeps Lumen's server from being used to reach private networks. Every fetch of a URL that came from
// a user, a search result or a model goes through safeFetchText, which checks the address (including what
// the name resolves to), follows redirects one hop at a time and re-checks each hop, and limits the size.
import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export class UrlBlockedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UrlBlockedError';
  }
}

const stripBrackets = (host) => host.replace(/^\[|\]$/g, '');

function ipv4ToInt(ip) {
  return ip.split('.').reduce((total, part) => total * 256 + Number(part), 0);
}

const IPV4_BLOCKS = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]
].map(([base, bits]) => ({ start: ipv4ToInt(base), size: 2 ** (32 - bits) }));

function isPrivateIpv4(ip) {
  const value = ipv4ToInt(ip);
  return IPV4_BLOCKS.some((block) => value >= block.start && value < block.start + block.size);
}

// Expands an IPv6 address to its eight 16-bit groups.
function ipv6Groups(address) {
  let text = address.toLowerCase().split('%')[0];
  const embedded = text.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (embedded) {
    const [a, b, c, d] = embedded[1].split('.').map(Number);
    text = text.replace(embedded[1], `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`);
  }
  const [head, tail] = text.split('::');
  const headParts = head ? head.split(':') : [];
  const tailParts = tail === undefined ? [] : (tail ? tail.split(':') : []);
  const fill = tail === undefined ? 0 : 8 - headParts.length - tailParts.length;
  return [...headParts, ...Array(Math.max(0, fill)).fill('0'), ...tailParts].map((part) => parseInt(part || '0', 16));
}

export function isPrivateIp(address) {
  const ip = stripBrackets(String(address || ''));
  const version = isIP(ip);
  if (version === 4) return isPrivateIpv4(ip);
  if (version !== 6) return true; // not an address we understand: treat as unsafe
  const groups = ipv6Groups(ip);
  if (groups.length !== 8 || groups.some(Number.isNaN)) return true;
  const mappedV4 = () => `${groups[6] >> 8}.${groups[6] & 255}.${groups[7] >> 8}.${groups[7] & 255}`;
  if (groups.every((group) => group === 0)) return true; // ::
  if (groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1) return true; // ::1
  if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) return isPrivateIpv4(mappedV4()); // ::ffff:a.b.c.d
  if (groups.slice(0, 6).every((group) => group === 0)) return isPrivateIpv4(mappedV4()); // ::a.b.c.d (deprecated)
  if (groups[0] === 0x64 && groups[1] === 0xff9b) return isPrivateIpv4(mappedV4()); // 64:ff9b::/96 NAT64
  if ((groups[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((groups[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((groups[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (groups[0] === 0x2001 && groups[1] === 0x0db8) return true; // documentation range
  return false;
}

const BLOCKED_NAME = /(^|\.)(localhost|local|internal|intranet|lan|home|corp|localdomain)$/i;

function checkHostname(hostname) {
  const host = stripBrackets(hostname.toLowerCase().replace(/\.$/, ''));
  if (!host) throw new UrlBlockedError('The URL has no host.');
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new UrlBlockedError('That address is on a private or reserved network.');
    return host;
  }
  if (BLOCKED_NAME.test(host) || host === 'metadata.google.internal') throw new UrlBlockedError('That host name is for a private network.');
  if (!host.includes('.')) throw new UrlBlockedError('Only public host names are allowed.');
  return host;
}

// Throws UrlBlockedError unless the URL is a public http(s) address. A host name must resolve only to public
// addresses. Returns the parsed URL. `resolve` is injectable for tests.
export async function assertPublicUrl(urlString, { resolve = dnsLookup } = {}) {
  let url;
  try {
    url = new URL(String(urlString || '').trim());
  } catch (_) {
    throw new UrlBlockedError('That is not a valid URL.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new UrlBlockedError('Only http and https URLs are allowed.');
  if (url.username || url.password) throw new UrlBlockedError('URLs with embedded credentials are not allowed.');
  const host = checkHostname(url.hostname);
  if (!isIP(host)) {
    let records;
    try {
      records = await resolve(host, { all: true });
    } catch (_) {
      throw new UrlBlockedError('That host name could not be resolved.');
    }
    const addresses = (Array.isArray(records) ? records : [records]).map((record) => record?.address);
    if (addresses.length === 0 || addresses.some((address) => !address || isPrivateIp(address))) {
      throw new UrlBlockedError('That host name points to a private network.');
    }
  }
  return url;
}

// Reads at most maxBytes of a response body as text.
async function readCapped(response, maxBytes) {
  if (!response.body?.getReader) {
    const text = await response.text();
    return { text: text.slice(0, maxBytes), truncated: text.length > maxBytes };
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let received = 0;
  let text = '';
  let truncated = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      text += decoder.decode(value.subarray(0, Math.max(0, value.byteLength - (received - maxBytes))));
      truncated = true;
      await reader.cancel().catch(() => {});
      break;
    }
    text += decoder.decode(value, { stream: true });
  }
  return { text, truncated };
}

// A GET (or other method) fetch that stays on the public internet. Returns the final response's status,
// content type, text and URL. Throws UrlBlockedError when any hop is not allowed.
export async function safeFetchText(urlString, {
  method = 'GET',
  headers = {},
  signal,
  maxBytes = 2_000_000,
  maxRedirects = 5,
  resolve,
  fetchImpl = fetch
} = {}) {
  let current = String(urlString || '').trim();
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const url = await assertPublicUrl(current, resolve ? { resolve } : undefined);
    const response = await fetchImpl(url.href, { method, headers, signal, redirect: 'manual' });
    const location = response.headers?.get?.('location');
    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel?.().catch?.(() => {});
      current = new URL(location, url).href;
      continue;
    }
    const { text, truncated } = await readCapped(response, maxBytes);
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers?.get?.('content-type') || '',
      url: url.href,
      text,
      truncated
    };
  }
  throw new UrlBlockedError('Too many redirects.');
}
