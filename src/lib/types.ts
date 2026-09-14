export interface Picture {
  src: string;
  alt: string;
  width: number;
  height: number;
}
export interface Product {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  type: string;
  platforms: string[];
  status: string | null;
  icon: string;
  cover: string;
  socialImage?: string;
  description: string;
  updatedAt: string | null;
  downloadUrl: string;
  visitUrl: string;
  repositoryUrl: string;
  privacyUrl: string;
  privacyText: string;
  feedbackUrl: string;
  screenshots: Picture[];
  tags: string[];
  featured: boolean;
  order: number;
}
export interface ReleaseFile {
  label: string;
  platform: string;
  format: string;
  url: string;
  size: string;
  minimumSystem: string;
}
export interface Release {
  id: string;
  productId: string;
  version: string;
  date: string;
  platforms: string[];
  changelog: string[];
  visitUrl: string;
  files: ReleaseFile[];
}
export interface Project {
  id: string;
  slug: string;
  name: string;
  type: string;
  category?: string;
  status: string | null;
  year: number | null;
  description: string;
  cover: string;
  images: Picture[];
  visitUrl: string;
  repositoryUrl: string;
  technicalNotes: string;
  developmentNotes: string[];
  tags: string[];
  featured: boolean;
  order: number;
}
export interface Lab extends Project {
  number: string;
}
export interface Taxonomy {
  types: Record<string, string>;
  platforms: Record<string, string>;
  statuses: Record<string, string>;
}
