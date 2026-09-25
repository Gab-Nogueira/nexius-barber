import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: 'https://nexius-barber-demo.gabsilvanogueira.chatgpt.site/', changeFrequency: 'monthly', priority: 1 }];
}
