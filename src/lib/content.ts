import productData from "../data/products.json";
import projectData from "../data/projects.json";
import releaseData from "../data/releases.json";
import labData from "../data/labs.json";
import taxonomyData from "../data/taxonomy.json";
import type { Product, Project, Release, Lab, Taxonomy } from "./types";
import { localUrl, releasesFor } from "./model";
export const products = (productData as Product[]).sort(
  (a, b) => a.order - b.order,
);
export const projects = (projectData as Project[]).sort(
  (a, b) => a.order - b.order,
);
export const releases = (releaseData as Release[]).sort((a, b) =>
  b.date.localeCompare(a.date),
);
export const labs = (labData as Lab[]).sort((a, b) => a.order - b.order);
export const taxonomy = taxonomyData as Taxonomy;
export const url = (path: string) => localUrl(path, import.meta.env.BASE_URL);
export const productReleases = (id: string) => releasesFor(releases, id);
export const typeName = (type: string) => taxonomy.types[type] || type;
export const platformName = (platform: string) =>
  taxonomy.platforms[platform] || platform;
export const statusName = (status: string) =>
  taxonomy.statuses[status] || status;
export const dateText = (date: string | null | undefined) =>
  date ? date.replace(/-/g, ".") : "—";
