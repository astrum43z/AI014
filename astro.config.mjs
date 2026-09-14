import { defineConfig } from "astro/config";

const base = (
  "/" +
  (process.env.BASE_PATH || "").replace(/^\/+|\/+$/g, "") +
  "/"
).replace(/\/+/g, "/");
export default defineConfig({
  site: process.env.SITE_URL || "https://ai014.com",
  base,
  output: "static",
  devToolbar: { enabled: false },
  trailingSlash: "always",
  build: { format: "directory" },
  vite: { build: { cssMinify: true } },
});
