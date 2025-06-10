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
      text: 'Tudástár',
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
      href: '/kapcsolat',
    },
  ],
  actions: [{ text: 'Árlista', href: '', target: '_blank' }],
};

export const footerData = {
  links: [
    {
      title: 'Információk',
      links: [
        { text: 'Adatvédelem', href: '/adatkezelesi-tajekoztato' },
        { text: 'Impresszum', href: '/impresszum' },
      ],
    },
    {
      title: 'Kapcsolat',
      links: [
        { text: 'Online Űrlap', href: '/kapcsolat'},
        { text: '+36 70 xxx xx xx'},
        { text: 'info@elviratuzep.hu'},
        { text: '2030 Érd, Elvira utca 33.'},
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
    /* { ariaLabel: 'X', icon: 'tabler:brand-x', href: '#' }, */
    { ariaLabel: 'Instagram', icon: 'tabler:brand-instagram', href: '#' },
    { ariaLabel: 'Facebook', icon: 'tabler:brand-facebook', href: '#' },
    /* { ariaLabel: 'RSS', icon: 'tabler:rss', href: getAsset('/rss.xml') }, */
  ],
  footNote: `
    
`,
};

/* <span class="inline-flex items-center text-sm text-gray-700 dark:text-gray-300">
  <span class="w-5 h-5 md:w-6 md:h-6 mr-2 inline-flex items-center justify-center rounded-sm bg-blue-100 text-blue-600 text-base">
    ☕️
  </span>
  Készítette: <a class="text-blue-600 underline dark:text-muted ml-1" href="https://jmeszaros.dev" target="_blank" rel="noopener noreferrer">jmeszaros.dev</a>  <span> . Minden jog fenntartva </span>.
</span> */
