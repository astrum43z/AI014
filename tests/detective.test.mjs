import test from 'node:test';
import assert from 'node:assert/strict';
import { validateUsername, buildLeads, sherlockCommand, parseSherlockReport, analyzeUrl, exportReport } from '../public/detective/core.js';
const header = 'username,name,url_main,url_user,exists,http_status,response_time_s';
const csv = (url = 'https://github.com/alice', exists = 'Claimed') => `${header}\nalice,GitHub,https://github.com,${url},${exists},200,0.2`;

test('username trims and accepts bounded ASCII', () => {
  assert.equal(validateUsername(' Alice_1.a-b '), 'Alice_1.a-b');
  assert.equal(validateUsername('a'.repeat(64)).length, 64);
});
test('username rejects shell and XSS payloads', () => {
  for (const raw of ['', 'a'.repeat(65), '-a', '.', '你好', 'a;b', 'a\nb', 'a b', 'a$(id)', '`id`', 'a|ls', '<script>', null]) assert.throws(() => validateUsername(raw));
});
test('manual leads are independent unverified records across ten sites', () => {
  const leads = buildLeads('alice');
  assert.equal(leads.length, 10);
  assert.equal(new Set(leads.map(v => v.site)).size, 10);
  assert.ok(leads.every(v => v.status === 'unverified' && v.source === 'manual' && v.username === 'alice'));
  assert.equal(leads[0].url, 'https://github.com/alice');
});
test('shell command has no user-controlled flags or syntax', () => {
  assert.equal(sherlockCommand(' _alice '), 'sherlock _alice --csv');
  assert.throws(() => sherlockCommand('--help'));
  assert.throws(() => sherlockCommand('alice; curl evil'));
});
test('CSV imports affirmative results without verifying ownership', () => {
  const [lead] = parseSherlockReport(csv());
  assert.deepEqual(lead, {site: 'GitHub', url: 'https://github.com/alice', username: 'alice', status: 'unverified', source: 'sherlock-import', reported: true});
});
test('CSV rejects absent, false, unknown and numeric exists values', () => {
  for (const value of ['False', 'no', '1', '200', 'Unknown', '', 'Available', 'Illegal', 'WAF']) assert.throws(() => parseSherlockReport(csv(undefined, value)), /未找到/);
  assert.equal(parseSherlockReport(csv(undefined, 'YES')).length, 1);
});
test('BOM CRLF quotes commas and escaped quotes are parsed', () => {
  const text = '\uFEFF' + header + '\r\n' + 'alice,"Git, ""Hub""",https://github.com,"https://github.com/alice?q=a,b",True,200,0.2\r\n';
  assert.equal(parseSherlockReport(text)[0].site, 'Git, "Hub"');
});
test('CSV multiline quoted labels do not become unsafe UI labels', () => {
  const text = header + '\nalice,"Git\nHub",https://github.com,https://github.com/alice,True,200,1';
  assert.equal(parseSherlockReport(text)[0].site, 'github.com');
});
test('CSV header reordering works without guessing', () => {
  assert.equal(parseSherlockReport('name,username,exists,url_user,url_main,http_status,response_time_s\nGitHub,alice,True,https://github.com/alice,https://github.com,200,1').length, 1);
});
test('ambiguous and incomplete headers are rejected', () => {
  for (const h of [header.replace('name,', 'username,'), 'username,name,url,exists', header + ',url', header.replace('url_user', 'link')]) assert.throws(() => parseSherlockReport(h + '\na,b,c,d,True,200,1'));
});
test('malformed CSV fails rather than partially importing', () => {
  for (const suffix of ['\nalice,"open', '\nalice,Gi"t,https://github.com,https://github.com/alice,True,200,1', '\nalice,"Git"tail,a,b,True,200,1', '\nalice,Git,a,b,True']) assert.throws(() => parseSherlockReport(csv() + suffix));
});
test('only url_user is imported', () => {
  assert.throws(() => parseSherlockReport(csv('javascript:alert(1)')));
});
test('TXT accepts only standalone URLs and deduplicates canonical URLs', () => {
  const leads = parseSherlockReport('Sherlock report\n[+] GitHub: https://github.com/alice\nhttps://github.com/alice\nhttps://github.com:443/alice\n');
  assert.equal(leads.length, 1);
  assert.equal(leads[0].site, 'github.com');
});
test('CSV deduplicates canonical URLs', () => {
  assert.equal(parseSherlockReport(csv() + '\nalice,Other,https://github.com,https://github.com:443/alice,yes,200,1').length, 1);
});
test('private IPv4 and alternate numeric representations are rejected', () => {
  for (const host of ['127.0.0.1', '127.1', '2130706433', '0x7f000001', '10.1.2.3', '172.16.0.1', '192.168.0.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.1.1.1', 'localhost', 'localhost.', 'a.localhost', 'host.local', 'intranet']) assert.throws(() => parseSherlockReport(`http://${host}/alice`), host);
});
test('IPv6 loopback private mapped private and transition addresses rejected', () => {
  for (const host of ['::1', '::', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:a00:1', '::ffff:192.168.0.1', '2002:7f00:1::', '2001::7f00:1', '2001:db8::1']) assert.throws(() => parseSherlockReport(`http://[${host}]/alice`), host);
});
test('public IP literal import is allowed but URL analysis warns', () => {
  for (const url of ['https://8.8.8.8/', 'https://[2606:4700:4700::1111]/', 'https://[::ffff:808:808]/']) {
    assert.equal(parseSherlockReport(url).length, 1);
    assert.ok(analyzeUrl(url).warnings.some(v => v.includes('IP')));
  }
});
test('credentials protocols controls and backslashes rejected', () => {
  for (const raw of ['https://alice:pass@example.com/', 'https://@example.com/', 'javascript:alert(1)', 'data:text/html,test', '//example.com', 'example.com', 'https://exa\nmple.com', 'https://example.com/\t', 'https://example.com\\evil']) {
    assert.throws(() => analyzeUrl(raw), raw);
    assert.throws(() => parseSherlockReport(csv(raw)), raw);
  }
});
test('report byte size bounded by UTF8 byte count', () => {
  assert.throws(() => parseSherlockReport('a'.repeat(1024 * 1024 + 1)), /1 MiB/);
  assert.throws(() => parseSherlockReport('中'.repeat(350000)), /1 MiB/);
});
test('report row count bounded for both TXT and CSV', () => {
  assert.equal(parseSherlockReport(Array(1000).fill('https://github.com/alice').join('\n')).length, 1);
  assert.throws(() => parseSherlockReport(Array(1001).fill('https://github.com/alice').join('\n')), /1000/);
  const row = csv().split('\n')[1];
  assert.equal(parseSherlockReport(header + '\n' + Array(1000).fill(row).join('\n')).length, 1);
  assert.throws(() => parseSherlockReport(header + '\n' + Array(1001).fill(row).join('\n')), /1000/);
});
test('URL parser retains duplicate query params and explicit components', () => {
  assert.deepEqual(analyzeUrl('https://example.com:8443/a?q=1&q=2#x'), {url:'https://example.com:8443/a?q=1&q=2#x', protocol:'https:', hostname:'example.com', port:'8443', path:'/a', query:[{key:'q',value:'1'}, {key:'q',value:'2'}],fragment:'#x',warnings:[]});
});
test('URL warnings flag HTTP punycode and sensitive parameter names', () => {
  assert.equal(analyzeUrl('http://xn--bcher-kva.example/?token=abc').warnings.length, 3);
});
test('oversized URL and nonstrings rejected', () => {
  assert.throws(() => analyzeUrl('https://example.com/' + 'x'.repeat(8192)));
  assert.throws(() => analyzeUrl(null));
});
test('export forces statuses and escapes embedded markup without adding attacker fields', () => {
  const lead = { ...buildLeads('alice')[0], site:'</script><img src=x onerror=alert(1)>', status:'verified', payload:'evil' };
  const text = exportReport([lead], '2026-11-06T00:00:00Z');
  assert.ok(!text.includes('<'));
  const result = JSON.parse(text);
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.generatedAt, '2026-11-06T00:00:00.000Z');
  assert.equal(result.leads[0].status, 'unverified');
  assert.equal(result.leads[0].payload, undefined);
  assert.ok(result.disclaimer.includes('同名账号不代表同一人'));
});
test('export preserves imported reported flag but never trusts claimed status', () => {
  const lead = parseSherlockReport(csv())[0];
  assert.equal(JSON.parse(exportReport([lead])).leads[0].reported, true);
  assert.throws(() => exportReport([{ ...lead, url:'https://localhost/' }]));
  assert.throws(() => exportReport(Array(1001).fill(lead)));
});

test('actual Sherlock Claimed enum is a report assertion, not identity verification', () => {
  const [lead] = parseSherlockReport(csv(undefined, 'Claimed'));
  assert.equal(lead.reported, true);
  assert.equal(lead.status, 'unverified');
});
