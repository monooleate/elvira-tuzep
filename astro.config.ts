import path from 'path';
import { fileURLToPath } from 'url';

import { defineConfig } from 'astro/config';
import dotenv from "dotenv";
dotenv.config();
const USE_API = process.env.PUBLIC_USE_API === "true";

import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';
import partytown from '@astrojs/partytown';
import icon from 'astro-icon';
import compress from 'astro-compress';
import type { AstroIntegration } from 'astro';

import astrowind from './vendor/integration';

import { readingTimeRemarkPlugin, responsiveTablesRehypePlugin, lazyImagesRehypePlugin } from './src/utils/frontmatter';

import preact from '@astrojs/preact';

import netlify from '@astrojs/netlify';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const hasExternalScripts = false;
const whenExternalScripts = (items: (() => AstroIntegration) | (() => AstroIntegration)[] = []) =>
  hasExternalScripts ? (Array.isArray(items) ? items.map((item) => item()) : [items()]) : [];

/* console.log("🧭 USE_API:", USE_API);
console.log("🧭 PUBLIC_USE_API:", process.env.PUBLIC_USE_API); */
export default defineConfig({
   output: USE_API ? "server" : "static",

  integrations: [tailwind({
    applyBaseStyles: false,
  }), sitemap(), mdx(), icon({
    include: {
      tabler: ['*'],
      'flat-color-icons': [
        'template',
        'gallery',
        'approval',
        'document',
        'advertising',
        'currency-exchange',
        'voice-presentation',
        'business-contact',
        'database',
      ],
    },
  }), 
  
  partytown({
      config: {
        forward: ['dataLayer.push'],
      },
    }),
  
  compress({
    CSS: true,
    HTML: {
      'html-minifier-terser': {
        removeAttributeQuotes: false,
      },
    },
    Image: false,
    JavaScript: true,
    SVG: false,
    Logger: 1,
  }), 
  
  astrowind({
    config: './src/config.yaml',
  }), 
  
  preact()
],

  image: {
    domains: ['cdn.pixabay.com'],
  },

  markdown: {
    remarkPlugins: [readingTimeRemarkPlugin],
    rehypePlugins: [responsiveTablesRehypePlugin, lazyImagesRehypePlugin],
  },

  vite: {
    resolve: {
      alias: {
        '~': path.resolve(__dirname, './src'),
      },
    },
    optimizeDeps: {
      exclude: ["@medusajs/js-sdk"], // ne próbálja prebundle-ölni
    },
    ssr: {
      noExternal: ["@medusajs/js-sdk"], // így CJS fallback lesz
    },
  },

  adapter: netlify(),
});