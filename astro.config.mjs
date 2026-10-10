// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

const hasValue = (v) => !!v && v.length > 0;

// The site is served from the root of its own domain — a GitHub Pages *user*
// site, then the custom domain once it is bought. Keeping it at the root means
// internal links need no base prefix: Astro does not rewrite literal
// `href="/about"`, so a project site under /portfolio/ would 404 on every
// route. Only the origin changes between hosts, and only here.
const site = hasValue(process.env.SITE_URL)
  ? process.env.SITE_URL
  : 'https://hayouprogrammer.github.io';

// https://astro.build/config
export default defineConfig({
  site,
  trailingSlash: 'ignore',
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    plugins: [tailwindcss()],
    build: {
      cssMinify: 'lightningcss',
    },
  },
});
