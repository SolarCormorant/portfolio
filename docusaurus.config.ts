import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'Solars Palace',
  tagline: 'Dinosaurs are cool',
  favicon: 'img/favicon.png',

  // Set the production url of your site here
  url: 'https://your-docusaurus-site.example.com',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'facebook', // Usually your GitHub org/user name.
  projectName: 'docusaurus', // Usually your repo name.

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/',
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/',
          // Useful options to enforce blogging best practices
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Dark mode ayarları
    colorMode: {
      defaultMode: 'dark',              // Varsayılan dark tema
      disableSwitch: false,             // Tema değiştirme butonu aktif
      respectPrefersColorScheme: false, // Tarayıcı tercihini yoksay
    },
    
    // Replace with your project's social card
    image: 'img/docusaurus-social-card.jpg',
    
    navbar: {
      title: 'My Portfolio',
      logo: {
        alt: 'My Site Logo',
        src: 'img/favicon.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'about_me',
          position: 'left',
          label: 'About Me',
        },
        {
          type: 'docSidebar',
          sidebarId: 'staircase',
          position: 'left',
          label: 'Staircase Algorithm',
        },
        {
          type: 'docSidebar',
          sidebarId: 'haus',
          position: 'left',
          label: 'Block Laying Algorithm',
        },
        {
          type: 'docSidebar',
          sidebarId: 'thesis',
          position: 'left',
          label: 'Thesis',
        },
        {
          type: 'docSidebar',
          sidebarId: 'buildingScience',
          position: 'left',
          label: 'Building Science',
        },
        {
          href: 'https://github.com/facebook/docusaurus',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'About Me',
              to: '/docs/thesis/thesis',
            },
          ],
        },
        {
          title: 'Crème de la crème',
          items: [
            {
              label: 'Information Transfer',
              to: '/docs/stair/utilities/info_transfer',
            },
            {
              label: 'Dynamic Step No and Depth',
              to: '/docs/stair/create_stair/step_no_depth',
            },
            {
              label: 'X',
              href: 'https://x.com/docusaurus',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'Blog',
              to: '/blog',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/facebook/docusaurus',
            },
          ],
        },
      ],
      copyright: `Built mostly with vibe-coding. Some videos are sped up for cinematic effect.`,
    },
    
    prism: {
      theme: prismThemes.synthwave84,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;