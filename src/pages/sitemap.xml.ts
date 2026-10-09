import type { APIRoute } from 'astro';

const routes = [
  { path: '/', priority: '1.0', changefreq: 'monthly' },
  { path: '/work/imbirt', priority: '0.9', changefreq: 'monthly' },
  { path: '/work', priority: '0.7', changefreq: 'monthly' },
  { path: '/about', priority: '0.6', changefreq: 'yearly' },
  { path: '/contact', priority: '0.6', changefreq: 'yearly' },
  { path: '/cv', priority: '0.5', changefreq: 'yearly' },
];

export const GET: APIRoute = ({ site }) => {
  const origin = (site ?? new URL('https://hayelom.pages.dev')).toString().replace(/\/$/, '');
  const lastmod = new Date().toISOString().slice(0, 10);

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    (r) => `  <url>
    <loc>${origin}${r.path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>
`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
