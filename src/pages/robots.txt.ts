import type { APIRoute } from 'astro';
import { url } from '../lib/content';
export const GET: APIRoute=({site})=>new Response(`User-agent: *\nAllow: /\nSitemap: ${new URL(url('/sitemap.xml'),site).href}\n`,{headers:{'Content-Type':'text/plain'}});
