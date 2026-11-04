import type { MetadataRoute } from 'next';
import { siteUrl } from '../lib/site';

const publicPaths = [
  '/',
  '/about',
  '/contact',
  '/faq',
  '/riders',
  '/vendors',
  '/privacy',
];

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPaths.map((path) => ({
    url: new URL(path, siteUrl).toString(),
  }));
}
