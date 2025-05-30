import { getPermalink, getBlogPermalink, getAsset } from './utils/permalinks';

export const headerData = {
  links: [
    {
      text: 'Főoldal',
      href: getPermalink(''),
      
    },
    {
      text: 'Termékeink',
      href: getPermalink('/termekek'),
      
    },
    {
      text: 'Blog',
      links: [
        {
          text: 'Bejegyzések',
          href: getBlogPermalink(),
        },
        {
          text: 'Mi az a BSH?',
          href: getPermalink('janos_post', 'post'),
        },
      ],
    },
    {
      text: 'Kapcsolat',
      href: 'kapcsolat',
    },
  ],
  actions: [{ text: 'Árlista', href: '', target: '_blank' }],
};

export const footerData = {
  links: [
    {
      title: 'Product',
      links: [
        { text: 'Features', href: '#' },
        { text: 'Security', href: '#' },
        { text: 'Team', href: '#' },
        { text: 'Enterprise', href: '#' },
        { text: 'Customer stories', href: '#' },
        { text: 'Pricing', href: '#' },
        { text: 'Resources', href: '#' },
      ],
    },
    {
      title: 'Platform',
      links: [
        { text: 'Developer API', href: '#' },
        { text: 'Partners', href: '#' },
        { text: 'Atom', href: '#' },
        { text: 'Electron', href: '#' },
        { text: 'AstroWind Desktop', href: '#' },
      ],
    },
    {
      title: 'Support',
      links: [
        { text: 'Docs', href: '#' },
        { text: 'Community Forum', href: '#' },
        { text: 'Professional Services', href: '#' },
        { text: 'Skills', href: '#' },
        { text: 'Status', href: '#' },
      ],
    },
    {
      title: 'Nyitvatartás',
      links: [
        { text: 'Hétfő: 8:00-17:00'},
        { text: 'Kedd: 8:00-17:00'},
        { text: 'Szerda: 8:00-17:00'},
        { text: 'Csütörtök: 8:00-17:00'},
        { text: 'Péntek: 8:00-17:00'},
        { text: 'Szombat: zárva'},
        { text: 'Vasárnap: zárva'},
      ],
    },
  ],
  secondaryLinks: [
    { text: 'Terms', href: getPermalink('/terms') },
    { text: 'Privacy Policy', href: getPermalink('/privacy') },
  ],
  socialLinks: [
    { ariaLabel: 'X', icon: 'tabler:brand-x', href: '#' },
    { ariaLabel: 'Instagram', icon: 'tabler:brand-instagram', href: '#' },
    { ariaLabel: 'Facebook', icon: 'tabler:brand-facebook', href: '#' },
    { ariaLabel: 'RSS', icon: 'tabler:rss', href: getAsset('/rss.xml') },
    { ariaLabel: 'Github', icon: 'tabler:brand-github', href: 'https://github.com/onwidget/astrowind' },
  ],
  footNote: `
    <span class="inline-flex items-center text-sm text-gray-700 dark:text-gray-300">
  <span class="w-5 h-5 md:w-6 md:h-6 mr-2 inline-flex items-center justify-center rounded-sm bg-blue-100 text-blue-600 text-base">
    ☕️
  </span>
  Készítette: <a class="text-blue-600 underline dark:text-muted ml-1" href="https://jmeszaros.dev" target="_blank" rel="noopener noreferrer">jmeszaros.dev</a>  <span> . Minden jog fenntartva </span>.
</span>
`,
};
