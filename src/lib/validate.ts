import type { Product, Project, Release, Lab, Taxonomy } from "./types.ts";
export interface SiteData {
  products: Product[];
  projects: Project[];
  releases: Release[];
  labs: Lab[];
  taxonomy: Taxonomy;
}
export function validateData(data: SiteData): string[] {
  const errors: string[] = [];
  const check = (ok: unknown, where: string, message: string) => {
    if (!ok) errors.push(`${where}: ${message}`);
  };
  const isDate = (v: unknown) =>
    typeof v === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    !Number.isNaN(Date.parse(v)) &&
    new Date(v).toISOString().slice(0, 10) === v;
  const isUrl = (v: unknown) =>
    typeof v === "string" &&
    (v === "" ||
      (/^\/(?!\/)/.test(v) && !v.includes("..") && !v.includes("\\")) ||
      /^https?:\/\/[^\s]+$/.test(v) ||
      /^mailto:[^\s@]+@[^\s@]+$/.test(v));
  const taxonomy = data.taxonomy;
  const registered = (table: Record<string, string>, key: string) =>
    Object.hasOwn(table, key);
  for (const category of ["types", "platforms", "statuses"] as const) {
    check(
      taxonomy[category] && typeof taxonomy[category] === "object",
      "taxonomy",
      `${category} 必须是登记表`,
    );
    for (const [key, label] of Object.entries(taxonomy[category] || {})) {
      check(
        key.trim() && typeof label === "string" && label.trim(),
        "taxonomy",
        `${category} 的标识和标签不能为空`,
      );
    }
  }
  const strings = (
    record: Record<string, unknown>,
    keys: string[],
    where: string,
  ) =>
    keys.forEach((key) =>
      check(
        typeof record[key] === "string",
        where,
        `${key} 必须是字符串，未知内容请填 ""`,
      ),
    );
  const list = (
    record: Record<string, unknown>,
    key: string,
    where: string,
  ) => {
    check(
      Array.isArray(record[key]) &&
        (record[key] as unknown[]).every((x) => typeof x === "string"),
      where,
      `${key} 必须是字符串数组`,
    );
  };
  for (const collection of ["products", "projects", "labs"] as const) {
    const ids = new Set<string>(),
      slugs = new Set<string>();
    if (!Array.isArray(data[collection])) {
      errors.push(`${collection}: 必须是数组`);
      continue;
    }
    for (const record of data[collection]) {
      const r = record as unknown as Record<string, unknown>,
        where = `${collection}[${record.id || "?"}]`;
      strings(
        r,
        [
          "id",
          "slug",
          "name",
          "type",
          "description",
          "cover",
          "visitUrl",
          "repositoryUrl",
        ],
        where,
      );
      for (const key of ["id", "slug"] as const) {
        const value = record[key];
        check(
          /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value || ""),
          where,
          `${key} 仅使用小写英文、数字与连接号`,
        );
        const set = key === "id" ? ids : slugs;
        check(!set.has(value), where, `${key} 重复`);
        set.add(value);
      }
      check(record.name?.trim(), where, "name 不能为空");
      check(
        registered(taxonomy.types, record.type),
        where,
        "type 未在 taxonomy 登记",
      );
      check(
        record.status === null || registered(taxonomy.statuses, record.status),
        where,
        "status 请填 null 或已登记状态",
      );
      check(Number.isFinite(record.order), where, "order 必须是数字");
      check(
        typeof record.featured === "boolean",
        where,
        "featured 必须是 true 或 false",
      );
      list(r, "tags", where);
      for (const key of [
        "cover",
        "socialImage",
        "visitUrl",
        "repositoryUrl",
        "icon",
        "downloadUrl",
        "privacyUrl",
        "feedbackUrl",
      ])
        if (key in r)
          check(
            isUrl(r[key]),
            where,
            `${key} 必须是站内 / 路径、完整 https/http 地址或 mailto 地址`,
          );
      for (const key of ["cover", "socialImage", "icon", "downloadUrl"])
        if (typeof r[key] === "string")
          check(
            !(r[key] as string).startsWith("mailto:"),
            where,
            `${key} 不接受邮件地址`,
          );
      const pics =
        collection === "products"
          ? (record as Product).screenshots
          : (record as Project).images;
      check(Array.isArray(pics), where, "截图/图片必须是数组");
      if (Array.isArray(pics))
        for (const pic of pics) {
          check(
            pic.src && isUrl(pic.src) && !pic.src.startsWith("mailto:"),
            where,
            "图片 src 无效",
          );
          check(
            typeof pic.alt === "string" && pic.alt.trim(),
            where,
            "图片必须填写 alt",
          );
          check(
            Number.isInteger(pic.width) &&
              pic.width > 0 &&
              Number.isInteger(pic.height) &&
              pic.height > 0,
            where,
            "图片宽高必须是正整数",
          );
        }
      if (collection === "products") {
        const p = record as Product;
        strings(
          r,
          [
            "subtitle",
            "icon",
            "downloadUrl",
            "privacyUrl",
            "privacyText",
            "feedbackUrl",
          ],
          where,
        );
        list(r, "platforms", where);
        check(p.platforms?.length, where, "至少填写一个平台");
        if (Array.isArray(p.platforms))
          p.platforms.forEach((platform) =>
            check(
              registered(taxonomy.platforms, platform),
              where,
              `未登记平台 ${platform}`,
            ),
          );
        check(
          p.updatedAt === null || isDate(p.updatedAt),
          where,
          "updatedAt 请填 null 或真实 YYYY-MM-DD 日期",
        );
      } else {
        const p = record as Project;
        strings(r, ["technicalNotes"], where);
        list(r, "developmentNotes", where);
        check(
          p.year === null ||
            (Number.isInteger(p.year) && p.year >= 1000 && p.year <= 9999),
          where,
          "year 请填 null 或四位年份",
        );
        if (collection === "labs")
          check(
            typeof (p as Lab).number === "string",
            where,
            'number 请填字符串，未编号填 ""',
          );
      }
    }
  }
  const releaseIds = new Set<string>();
  if (!Array.isArray(data.releases)) errors.push("releases: 必须是数组");
  else
    for (const release of data.releases) {
      const where = `releases[${release.id || "?"}]`,
        r = release as unknown as Record<string, unknown>;
      strings(r, ["id", "productId", "version", "date", "visitUrl"], where);
      check(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(release.id || "") &&
          !releaseIds.has(release.id),
        where,
        "id 必须有效且唯一",
      );
      releaseIds.add(release.id);
      const product = data.products.find((p) => p.id === release.productId);
      check(product, where, "productId 未关联有效产品");
      check(isDate(release.date), where, "date 必须是有效 YYYY-MM-DD 日期");
      check(isUrl(release.visitUrl), where, "visitUrl 无效");
      list(r, "changelog", where);
      list(r, "platforms", where);
      check(release.platforms?.length, where, "至少填写一个发布平台");
      if (Array.isArray(release.platforms))
        release.platforms.forEach((p) => {
          check(registered(taxonomy.platforms, p), where, `未登记平台 ${p}`);
          check(
            product?.platforms.includes(p),
            where,
            `平台 ${p} 不在产品的 platforms 中`,
          );
        });
      check(Array.isArray(release.files), where, "files 必须是数组");
      if (Array.isArray(release.files))
        for (const file of release.files) {
          strings(
            file as unknown as Record<string, unknown>,
            ["label", "platform", "format", "url", "size", "minimumSystem"],
            where,
          );
          check(
            registered(taxonomy.platforms, file.platform) &&
              release.platforms?.includes(file.platform),
            where,
            "文件平台必须属于本次发布",
          );
          check(file.format?.trim(), where, "文件 format 不能为空");
          check(
            file.url && isUrl(file.url) && !file.url.startsWith("mailto:"),
            where,
            "文件 url 必须有效且非空",
          );
        }
    }
  return errors;
}
