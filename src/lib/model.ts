import type { Release } from "./types.ts";
export function releasesFor(releases: Release[], productId: string): Release[] {
  return releases
    .filter((r) => r.productId === productId)
    .sort((a, b) => b.date.localeCompare(a.date));
}
export function groupReleases(
  releases: Release[],
): { year: string; months: { month: string; releases: Release[] }[] }[] {
  const result: ReturnType<typeof groupReleases> = [];
  for (const release of [...releases].sort((a, b) =>
    b.date.localeCompare(a.date),
  )) {
    const [year, month] = release.date.split("-");
    let y = result.find((x) => x.year === year);
    if (!y) {
      y = { year, months: [] };
      result.push(y);
    }
    let m = y.months.find((x) => x.month === month);
    if (!m) {
      m = { month, releases: [] };
      y.months.push(m);
    }
    m.releases.push(release);
  }
  return result;
}
export function localUrl(path: string, base = "/"): string {
  if (!path || /^(https?:|mailto:)/i.test(path) || path.startsWith("#"))
    return path;
  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}
