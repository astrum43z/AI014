import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
const files = ["products", "projects", "labs"];
const sources = new Set();
function collect(value, key = "") {
  if (Array.isArray(value)) value.forEach((v) => collect(v, key));
  else if (value && typeof value === "object")
    Object.entries(value).forEach(([k, v]) => collect(v, k));
  else if (
    typeof value === "string" &&
    ["src", "cover", "icon"].includes(key) &&
    /^\/(?!\/)/.test(value) &&
    /\.(png|jpe?g|webp|avif)$/i.test(value)
  )
    sources.add(value);
}
for (const name of files)
  collect(JSON.parse(await fs.readFile(`src/data/${name}.json`, "utf8")));
if (sources.size) await fs.mkdir("public/optimized", { recursive: true });
for (const src of sources) {
  const key = createHash("sha256").update(src).digest("hex").slice(0, 16);
  const pipeline = sharp("public" + src)
    .rotate()
    .resize({ width: 1600, withoutEnlargement: true });
  await pipeline
    .clone()
    .avif({ quality: 65 })
    .toFile(`public/optimized/${key}.avif`);
  await pipeline
    .clone()
    .webp({ quality: 83 })
    .toFile(`public/optimized/${key}.webp`);
}
console.log(`Images OK: ${sources.size} local images optimized.`);
