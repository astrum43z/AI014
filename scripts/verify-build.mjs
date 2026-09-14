import fs from "node:fs";
import path from "node:path";
const root = path.resolve("dist");
const base = (
  "/" +
  (process.env.BASE_PATH || "").replace(/^\/+|\/+$/g, "") +
  "/"
).replace(/\/+/g, "/");
const files = fs
  .readdirSync(root, { recursive: true })
  .filter((f) => f.endsWith(".html"));
const errors = [];
for (const file of files) {
  const html = fs.readFileSync(path.join(root, file), "utf8");
  if ((html.match(/<h1[ >]/g) || []).length !== 1)
    errors.push(`${file}: 必须有一个 h1`);
  for (const match of html.matchAll(/(href|src|srcset)="([^"]*)"/g)) {
    const targets =
      match[1] === "srcset"
        ? match[2].split(",").map((part) => part.trim().split(/\s+/)[0])
        : [match[2]];
    for (const target of targets) {
      if (!target || target === "#") {
        errors.push(`${file}: 空链接`);
        continue;
      }
      if (/^(https?:|mailto:|data:|#)/.test(target)) continue;
      if (!target.startsWith(base)) {
        errors.push(`${file}: 基础路径错误 ${target}`);
        continue;
      }
      const relative = decodeURIComponent(
        target.slice(base.length).split(/[?#]/)[0],
      );
      const local = path.join(root, relative);
      if (
        !fs.existsSync(local) &&
        !fs.existsSync(path.join(local, "index.html"))
      )
        errors.push(`${file}: 资源缺失 ${target}`);
    }
  }
}
for (const required of [
  "index.html",
  "404.html",
  "sitemap.xml",
  "robots.txt",
  "favicon.svg",
  "og/home.png",
  "og/interesting-weather.png",
  "og/xiaoyi.png",
])
  if (!fs.existsSync(path.join(root, required)))
    errors.push(`缺少 ${required}`);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`Build links OK: ${files.length} HTML pages; base ${base}`);
