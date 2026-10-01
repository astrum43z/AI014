import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { validateData } from "../src/lib/validate.ts";
import { groupReleases, releasesFor, localUrl } from "../src/lib/model.ts";
const initial = Object.fromEntries(
  ["products", "projects", "releases", "labs", "taxonomy"].map((name) => [
    name,
    JSON.parse(fs.readFileSync(`src/data/${name}.json`, "utf8")),
  ]),
);
const fixtureProduct = {"id": "test-product", "slug": "test-product", "name": "Test product", "subtitle": "", "type": "MOBILE_APP", "platforms": ["Android"], "status": null, "icon": "", "cover": "", "socialImage": "", "description": "", "updatedAt": null, "downloadUrl": "", "visitUrl": "", "repositoryUrl": "", "privacyUrl": "", "privacyText": "", "feedbackUrl": "", "screenshots": [], "tags": [], "featured": true, "order": 2};
const copy = () => ({...structuredClone(initial), products: [structuredClone(fixtureProduct)]});
const release = (date, id = "test-release") => ({
  id,
  productId: "test-product",
  version: "",
  date,
  platforms: ["Android"],
  changelog: [],
  visitUrl: "",
  files: [],
});
test("真实初始内容、未知状态、空发布记录有效", () => {
  assert.deepEqual(validateData(initial), []);
  assert.equal(initial.products.length, 0);
  assert.equal(initial.releases.length, 0);
  assert.equal(initial.labs.length, 0);
  assert.ok(initial.products.every((p) => p.status === null));
});
test("新增类型、不同显示标签与多平台产品无需改模板", () => {
  const d = copy();
  d.taxonomy.types.FUTURE = "未来类型";
  d.taxonomy.platforms.Device = "新设备";
  d.taxonomy.statuses.Review = "内部评估";
  d.products.push({
    ...d.products[0],
    id: "test-device",
    slug: "test-device",
    type: "FUTURE",
    platforms: ["Device"],
    status: "Review",
  });
  assert.deepEqual(validateData(d), []);
});
test("拒绝重复标识、未知分类与失效关联", () => {
  const d = copy();
  d.products.push({ ...d.products[0], type: "MISSING" });
  d.releases.push({ ...release("2026-01-01"), productId: "missing" });
  const errors = validateData(d).join("\n");
  assert.match(errors, /重复/);
  assert.match(errors, /type 未/);
  assert.match(errors, /未关联/);
});
test("发布日期拒绝不存在日期与不规范格式", () => {
  for (const date of ["2026-02-30", "2026-9-2", "not-a-date"]) {
    const d = copy();
    d.releases.push(release(date));
    assert.ok(validateData(d).some((e) => e.includes("date 必须")));
  }
});
test("通用下载同时支持多格式和不同平台", () => {
  const d = copy();
  d.products[0].platforms = ["Android", "Windows", "macOS", "Linux"];
  const r = release("2026-01-01");
  r.platforms = d.products[0].platforms;
  r.files = ["apk", "exe", "dmg", "zip", "tar.gz"].map((format, i) => ({
    label: "Test download",
    platform: r.platforms[i % 4],
    format,
    url: `/downloads/test/file.${format}`,
    size: "",
    minimumSystem: "",
  }));
  d.releases.push(r);
  assert.deepEqual(validateData(d), []);
});
test("年月分组、最新发布和同日顺序稳定", () => {
  const records = [
    release("2025-12-31", "old"),
    release("2026-02-01", "first"),
    release("2026-01-02", "middle"),
    release("2026-02-01", "second"),
  ];
  assert.deepEqual(
    releasesFor(records, "test-product").map((r) => r.id),
    ["first", "second", "middle", "old"],
  );
  const groups = groupReleases(records);
  assert.deepEqual(
    groups.map((g) => g.year),
    ["2026", "2025"],
  );
  assert.deepEqual(
    groups[0].months.map((g) => g.month),
    ["02", "01"],
  );
});
test("基础路径处理不改变外部下载和锚点", () => {
  assert.equal(
    localUrl("/products/test-product/", "/ai014/"),
    "/ai014/products/test-product/",
  );
  assert.equal(
    localUrl("/downloads/test/file.tar.gz", "/ai014/"),
    "/ai014/downloads/test/file.tar.gz",
  );
  assert.equal(
    localUrl("https://example.com/file.apk", "/ai014/"),
    "https://example.com/file.apk",
  );
  assert.equal(localUrl("#products", "/ai014/"), "#products");
});
test("拒绝协议相对地址、脚本地址和目录穿越", () => {
  for (const address of [
    "//example.com/file",
    "javascript:alert(1)",
    "/../file",
  ]) {
    const d = copy();
    d.products[0].downloadUrl = address;
    assert.ok(validateData(d).length > 0);
  }
});
test("图片拒绝 mailto，登记表拒绝继承属性", () => {
  const d = copy();
  d.products[0].cover = "mailto:test@example.com";
  d.products[0].type = "toString";
  const errors = validateData(d);
  assert.ok(errors.some((e) => e.includes("不接受邮件地址")));
  assert.ok(errors.some((e) => e.includes("type 未")));
});
test('weather product is removed and shared footer includes requested copy control',()=>{
 assert.ok(initial.products.every(p=>p.id!=='interesting-weather'));
 const layout=fs.readFileSync(new URL('../src/layouts/Layout.astro',import.meta.url),'utf8');
 assert.match(layout,/联系微信：/);
 assert.match(layout,/goodmorning2you/);
 assert.match(layout,/id="copy-wechat"/);
 assert.match(layout,/aria-live="polite"/);
});

test('public project data is independent and the footer is a single shared control',()=>{
 assert.deepEqual(initial.projects,[]);
 for(const filename of ['src/data/projects.json','src/layouts/Layout.astro','src/pages/index.astro','src/pages/about/index.astro']){
  const source=fs.readFileSync(filename,'utf8');
  assert.doesNotMatch(source,/yi[.-]wang/i);
 }
 const layout=fs.readFileSync('src/layouts/Layout.astro','utf8');
 for(const id of ['wechat-contact','copy-wechat','copy-wechat-status'])assert.equal(layout.split(`id="${id}"`).length,2);
 assert.match(layout,/projects\.length/);
 const home=fs.readFileSync('src/pages/index.astro','utf8');
 assert.match(home,/id="trends"/);
 assert.doesNotMatch(home,/id="projects"/);
 assert.match(fs.readFileSync('src/pages/projects/index.astro','utf8'),/!projects\.length/);
});

test("removed product has no public data, social card or navigation entry",()=>{
 assert.deepEqual(initial.products,[]);
 assert.equal(fs.existsSync("public/og/xiaoyi.png"),false);
 assert.match(fs.readFileSync("src/layouts/Layout.astro","utf8"),/products\.length/);
 assert.match(fs.readFileSync("src/pages/index.astro","utf8"),/products\.length > 0/);
});
