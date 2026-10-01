import fs from "node:fs";
import path from "node:path";
import { validateHousing } from "../src/lib/trends/housing.ts";
import { validateData } from "../src/lib/validate.ts";
const data = Object.fromEntries(
  ["products", "projects", "releases", "labs", "taxonomy"].map((name) => [
    name,
    JSON.parse(fs.readFileSync(`src/data/${name}.json`, "utf8")),
  ]),
);
const errors = validateData(data);
const publicRoot = path.resolve("public");
function inspect(value, key = "") {
  if (Array.isArray(value)) {
    value.forEach((v) => inspect(v, key));
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) inspect(v, k);
    return;
  }
  if (
    typeof value === "string" &&
    value.startsWith("/") &&
    ["src", "icon", "cover", "socialImage", "url", "downloadUrl"].includes(key)
  ) {
    const target = path.resolve(
      publicRoot,
      "." + decodeURIComponent(value.split(/[?#]/)[0]),
    );
    if (
      !target.startsWith(publicRoot + path.sep) ||
      !fs.existsSync(target) ||
      !fs.statSync(target).isFile()
    )
      errors.push(`资源不存在或不是文件: ${value}（请放入 public 对应目录）`);
  }
}
inspect(data);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(
  `Data OK: ${data.products.length} products, ${data.projects.length} projects, ${data.labs.length} labs, ${data.releases.length} releases.`,
);

validateHousing(JSON.parse(fs.readFileSync("src/data/nbs-housing.json","utf8")));
console.log("NBS indexes OK: 70 cities, 12 monthly releases, separated base regimes.");
