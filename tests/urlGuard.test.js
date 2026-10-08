import test from 'node:test';
import assert from 'node:assert/strict';
import { UrlBlockedError, assertPublicUrl, isPrivateIp, safeFetchText } from '../services/urlGuard.js';

const publicDns = async () => [{ address: '93.184.216.34', family: 4 }];
const dnsTo = (...addresses) => async () => addresses.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));
const blocked = (promise) => assert.rejects(promise, (error) => error instanceof UrlBlockedError);

test('private and reserved IPv4 addresses are recognised', () => {
  for (const ip of ['127.0.0.1', '127.9.9.9', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '0.0.0.0', '100.64.0.1', '224.0.0.1', '255.255.255.255']) {
    assert.equal(isPrivateIp(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '93.184.216.34', '172.15.0.1', '172.32.0.1', '1.1.1.1']) {
    assert.equal(isPrivateIp(ip), false, ip);
  }
});

test('private and reserved IPv6 addresses are recognised, including mapped IPv4', () => {
  for (const ip of ['::1', '::', '[::1]', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:10.0.0.1', '64:ff9b::7f00:1']) {
    assert.equal(isPrivateIp(ip), true, ip);
  }
  for (const ip of ['2606:4700:4700::1111', '2001:4860:4860::8888', '::ffff:8.8.8.8']) {
    assert.equal(isPrivateIp(ip), false, ip);
  }
  assert.equal(isPrivateIp('not an ip'), true);
});

test('sneaky ways of writing localhost are blocked', async () => {
  for (const url of [
    'http://localhost/', 'http://LOCALHOST:3000/', 'http://127.0.0.1/', 'http://127.1/', 'http://0x7f.0.0.1/',
    'http://2130706433/', 'http://017700000001/', 'http://[::1]/', 'http://[::ffff:127.0.0.1]/',
    'http://169.254.169.254/latest/meta-data/', 'http://metadata.google.internal/', 'http://app.internal/',
    'http://printer.local/', 'http://intranet/', 'http://localhost./', 'http://0.0.0.0/'
  ]) {
    await blocked(assertPublicUrl(url, { resolve: publicDns }));
  }
});

test('only http and https URLs without credentials are allowed', async () => {
  for (const url of ['ftp://example.com/', 'file:///etc/passwd', 'javascript:alert(1)', 'http://user:pass@example.com/', 'not a url', '']) {
    await blocked(assertPublicUrl(url, { resolve: publicDns }));
  }
});

test('a host name that resolves to a private address is blocked', async () => {
  await blocked(assertPublicUrl('https://rebind.example.com/', { resolve: dnsTo('10.0.0.5') }));
  await blocked(assertPublicUrl('https://mixed.example.com/', { resolve: dnsTo('93.184.216.34', '192.168.0.9') }));
  await blocked(assertPublicUrl('https://v6.example.com/', { resolve: dnsTo('::1') }));
  await blocked(assertPublicUrl('https://gone.example.com/', { resolve: async () => { throw new Error('ENOTFOUND'); } }));
});

test('a public URL is accepted', async () => {
  const url = await assertPublicUrl('https://example.com/a?b=1', { resolve: publicDns });
  assert.equal(url.hostname, 'example.com');
  await assertPublicUrl('https://8.8.8.8/dns', { resolve: publicDns });
});

function fakeResponse({ status = 200, headers = {}, body = '' } = {}) {
  const bytes = new TextEncoder().encode(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    body: new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } }),
    text: async () => body
  };
}

test('a redirect to a private address is blocked before it is fetched', async () => {
  const fetched = [];
  const fetchImpl = async (url) => {
    fetched.push(url);
    return fakeResponse({ status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } });
  };
  await blocked(safeFetchText('https://example.com/start', { fetchImpl, resolve: publicDns }));
  assert.deepEqual(fetched, ['https://example.com/start']);
});

test('redirects are followed hop by hop, including relative ones', async () => {
  const fetched = [];
  const fetchImpl = async (url) => {
    fetched.push(url);
    if (url.endsWith('/a')) return fakeResponse({ status: 301, headers: { location: '/b' } });
    return fakeResponse({ body: 'hello', headers: { 'content-type': 'text/plain' } });
  };
  const result = await safeFetchText('https://example.com/a', { fetchImpl, resolve: publicDns });
  assert.deepEqual(fetched, ['https://example.com/a', 'https://example.com/b']);
  assert.equal(result.text, 'hello');
  assert.equal(result.contentType, 'text/plain');
  assert.equal(result.url, 'https://example.com/b');
});

test('a redirect loop stops', async () => {
  const fetchImpl = async () => fakeResponse({ status: 302, headers: { location: 'https://example.com/loop' } });
  await blocked(safeFetchText('https://example.com/loop', { fetchImpl, resolve: publicDns, maxRedirects: 3 }));
});

test('big responses are cut at the byte limit', async () => {
  const fetchImpl = async () => fakeResponse({ body: 'x'.repeat(5000) });
  const result = await safeFetchText('https://example.com/', { fetchImpl, resolve: publicDns, maxBytes: 1000 });
  assert.equal(result.text.length, 1000);
  assert.equal(result.truncated, true);
});

test('requests ask for manual redirects so the guard can check each hop', async () => {
  let seen;
  const fetchImpl = async (url, options) => { seen = options; return fakeResponse({ body: 'ok' }); };
  await safeFetchText('https://example.com/', { fetchImpl, resolve: publicDns });
  assert.equal(seen.redirect, 'manual');
});
