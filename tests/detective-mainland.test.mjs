import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSharedText, checkBusinessCode, buildCnSearch } from '../public/detective/mainland-core.js';

test('extracts Chinese sharing text without opening links and recognizes short links', () => {
  const result = analyzeSharedText('分享给你：https://xhslink.com/a/abc，看看吧！另一个 https://b23.tv/xyz。');
  assert.equal(result.links.length, 2);
  assert.equal(result.links[0].hostname, 'xhslink.com');
  assert.equal(result.links[0].shortLink, true);
  assert.equal(result.links[0].platform, '小红书');
  assert.match(result.disclaimer, /没有访问/);
});
test('recognizes all requested short-link hosts, not lookalike suffixes', () => {
  for (const host of ['xhslink.com','b23.tv','v.douyin.com','t.cn']) assert.equal(analyzeSharedText(`https://${host}/a`).links[0].shortLink, true);
  assert.equal(analyzeSharedText('https://xhslink.com.example.org/a').links[0].shortLink, false);
});
test('handles balanced ASCII parentheses and punctuation wrappers', () => {
  const a = analyzeSharedText('(https://example.com/page(foo)), https://example.com/other.');
  assert.equal(a.links[0].url, 'https://example.com/page(foo)');
  assert.equal(a.links[1].url, 'https://example.com/other');
});
test('handles bracketed IPv6 and trailing prose bracket', () => {
  const a = analyzeSharedText('[https://[2001:db8::1]/a]');
  assert.equal(a.links[0].hostname, '[2001:db8::1]');
  assert.match(a.links[0].warnings.join(''), /IP 地址/);
});
test('normalizes www with explicit assumption and deduplicates', () => {
  const a = analyzeSharedText('www.example.com/a https://www.example.com/a');
  assert.equal(a.links.length, 1);
  assert.equal(a.links[0].assumedHttps, true);
});
test('rejects credentials and malformed URLs without leaking them in rejection', () => {
  const a = analyzeSharedText('https://user:password@example.com/a https://? https://example.com\\evil');
  assert.equal(a.links.length, 0);
  assert.equal(a.rejected.length, 3);
  assert.ok(!JSON.stringify(a.rejected).includes('password'));
});
test('warns on spoofing hostname, not on a genuine platform subdomain', () => {
  assert.match(analyzeSharedText('https://weixin.qq.com.attacker.example/a').links[0].warnings.join(''), /不属于/);
  assert.ok(!analyzeSharedText('https://mp.weixin.qq.com/a').links[0].warnings.some(v => v.includes('不属于')));
  assert.equal(analyzeSharedText('https://mp.weixin.qq.com/a').links[0].platform, '微信');
});
test('warns on HTTP, IDN, IP and local host', () => {
  assert.match(analyzeSharedText('http://example.com').links[0].warnings.join(''), /未加密/);
  assert.match(analyzeSharedText('https://例子.中国/').links[0].warnings.join(''), /国际化/);
  assert.match(analyzeSharedText('https://127.0.0.1/').links[0].warnings.join(''), /IP/);
  assert.match(analyzeSharedText('https://localhost/').links[0].warnings.join(''), /本地/);
});
test('redacts sensitive parameter values and fragment in display only', () => {
  const a = analyzeSharedText('https://example.com/?token=very-secret&token=again&lang=zh#private-fragment').links[0];
  assert.ok(!a.displayUrl.includes('very-secret'));
  assert.ok(!a.displayUrl.includes('again'));
  assert.ok(!a.displayUrl.includes('private-fragment'));
  assert.ok(a.displayUrl.includes('lang=zh'));
  assert.ok(a.url.includes('very-secret'));
  assert.deepEqual(a.queryKeys, ['token','token','lang']);
});
test('bounds input and result count', () => {
  assert.throws(() => analyzeSharedText('中'.repeat(12001)), /12,000/);
  assert.throws(() => analyzeSharedText('🦉'.repeat(12001)), /12,000/);
  const a = analyzeSharedText(Array.from({length:21},(_,i)=>`https://example.com/${i}`).join(' '));
  assert.equal(a.links.length, 20); assert.equal(a.truncated, true);
});
test('handles missing links, unsupported schemes, empty and control input', () => {
  for (const input of ['', null, '没有链接', 'javascript:alert(1)', 'ftp://example.com', 'https://example.com\u0000']) assert.throws(() => analyzeSharedText(input));
});
test('business code synthetic checksum fixture and invalid check digit', () => {
  assert.equal(checkBusinessCode('91350211M000100Y46').valid, true);
  assert.equal(checkBusinessCode('91350211M000100Y44').valid, false);
  assert.equal(checkBusinessCode('91350211M000100Y44').formatValid, true);
  assert.match(checkBusinessCode('91350211M000100Y46').disclaimer, /不证明企业存在/);
});
test('business code normalizes case, whitespace and fullwidth', () => {
  assert.equal(checkBusinessCode(' ９１３５０２１１ｍ０００１００ｙ４６\n').valid, true);
});
test('business code rejects wrong length and forbidden letters', () => {
  for (const code of ['', '123', '91350211M000100Y461', '91350211I000100Y43', '91350211O000100Y43','91350211S000100Y43','91350211V000100Y43','91350211Z000100Y43']) {
    assert.equal(checkBusinessCode(code).valid, false); assert.equal(checkBusinessCode(code).formatValid, false);
  }
  assert.throws(() => checkBusinessCode(null));
});
test('Chinese searches encode names and explicitly label indexed pages', () => {
  const a = buildCnSearch('示例科技 & 公司');
  assert.equal(a.length, 6);
  assert.equal(new URL(a[0].url).searchParams.get('wd'), '示例科技 & 公司');
  assert.equal(new URL(a[1].url).hostname, 'cn.bing.com');
  assert.match(a[2].note, /不是平台完整站内搜索/);
  assert.ok(a.every(v => /发送给搜索引擎/.test(v.note)));
});
test('search rejects unnecessary private identifiers and secrets', () => {
  for (const query of ['13800138000', '+86 138-0013-8000','联系我：１３８００１３８０００','11010519491231002X','a@example.com','密码：12345','token=abc','https://example.com/?token=abc','hello\nthere']) assert.throws(() => buildCnSearch(query), query);
});
test('search permits ordinary business names and public nicknames, rejects bounds', () => {
  for (const query of ['小明同学', '示例信息科技有限公司', 'example_user', '公司2026']) assert.equal(buildCnSearch(query).length,6);
  for (const query of ['', '中'.repeat(81), null]) assert.throws(() => buildCnSearch(query));
});
test('warns on removed prose punctuation and possible redirect parameters', () => {
  const a = analyzeSharedText('https://example.com/?redirect=https%3A%2F%2Fother.example%2F.').links[0];
  assert.match(a.warnings.join(''), /疑似文案标点/);
  assert.match(a.warnings.join(''), /可能用于跳转/);
  assert.equal(a.hostname, 'example.com');
});
test('business checksum matches independent modular-power construction and rejects single-character mutations', () => {
  const alphabet = '0123456789ABCDEFGHJKLMNPQRTUWXY';
  const prefix = '91350211M000100Y4';
  let residue = 0;
  for (let i=0;i<17;i++) residue = (residue + alphabet.indexOf(prefix[i]) * (3 ** i % 31)) % 31;
  const fixture = prefix + alphabet[(31-residue)%31];
  assert.equal(checkBusinessCode(fixture).valid, true);
  for (let i=0;i<18;i++) {
    const changed = fixture.slice(0,i) + alphabet[(alphabet.indexOf(fixture[i])+1)%31] + fixture.slice(i+1);
    assert.equal(checkBusinessCode(changed).valid, false, `mutation ${i}`);
  }
  assert.equal(checkBusinessCode('0'.repeat(18)).valid, true); // mathematically valid, never claims an entity exists
});
test('sensitive percent-encoded parameter names are recognized', () => {
  const a = analyzeSharedText('https://example.com/?%74oken=hidden').links[0];
  assert.ok(!a.displayUrl.includes('hidden'));
  assert.deepEqual(a.queryKeys, ['token']);
});
test('search output never interpolates executable schemes or unencoded query syntax', () => {
  const results = buildCnSearch('示例&wd=其他<script>');
  for (const result of results) {
    const parsed = new URL(result.url);
    assert.equal(parsed.protocol, 'https:');
    assert.ok(['www.baidu.com','cn.bing.com'].includes(parsed.hostname));
    assert.equal([...parsed.searchParams.keys()].length,1);
    assert.ok(!result.url.includes('<script>'));
  }
});
