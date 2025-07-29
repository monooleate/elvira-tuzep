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
      text: 'Szolgáltatásaink',
      href: getPermalink('/szolgaltatasok'),
      links: [
        {
          text: 'Vágás',
          href: getPermalink('/szolgaltatasok/vagas')
        },
        {
          text: 'Csiszolás',
          href: getPermalink('/szolgaltatasok/csiszolas')
        },
               {
          text: 'Festés',
          href: getPermalink('/szolgaltatasok/festes')
        }
      ]
      
    },
    {
      text: 'Tudástár',
      href: getPermalink('/tudastar'),
      
    },
    {
      text: 'Kalkulátorok',
      href: getPermalink('/kalkulatorok'),
      links: [
        {
          text: 'Térfogat Ár Kalkulátor',
          href: getPermalink('/faanyag-terfogat-kalkulator')
        },
        {
          text: 'Felület Ár Kalkulátor',
          href: getPermalink('/faanyag-negyzetmeter-kalkulator')
        },
                {
          text: 'Tüzifa Ár Összehasonlító',
          href: getPermalink('/tuzifa-ar-osszehasonlito')
        }
        
        
      ]
      
    },
    {
      text: 'Kapcsolat',
      href: '/kapcsolat',
    },
  ],
  actions: [{ text: 'Infó', href: '/kapcsolat' }],
};

export const footerData = {
  links: [
    {
      title: 'Információk',
      links: [
        { text: 'Partnereink', href: '/partnereink' },
        { text: 'Adatvédelem', href: '/adatkezelesi-tajekoztato' },
        { text: 'Elállási tájékoztató', href: '/visszakuldes' },
        { text: 'Impresszum', href: '/impresszum' },
        { text: 'Gigawood.hu', href: 'https://gigawood.hu/', target: '_blank' } 
      ],
    },
    {
      title: 'Kapcsolat',
      links: [
        { text: 'Online Űrlap', href: '/kapcsolat'},
        { text: '+36 70 368 7809'},
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

  footNote: `
    
`,
};

/* <span class="inline-flex items-center text-sm text-gray-700 dark:text-gray-300">
  <span class="w-5 h-5 md:w-6 md:h-6 mr-2 inline-flex items-center justify-center rounded-sm bg-blue-100 text-blue-600 text-base">
    ☕️
  </span>
  Készítette: <a class="text-blue-600 underline dark:text-muted ml-1" href="https://jmeszaros.dev" target="_blank" rel="noopener noreferrer">jmeszaros.dev</a>  <span> . Minden jog fenntartva </span>.
</span>
*/
