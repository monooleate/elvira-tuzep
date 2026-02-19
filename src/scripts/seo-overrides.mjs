// src/scripts/seo-overrides.mjs
// SEO audit v3 alapján – meta, description, faqdesc és FAQ override-ok
// Ez a script a sheets-to-json UTÁN fut és felülírja a JSON-ban az értékeket.

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const CATEGORIES_DIR = path.join(ROOT, "src", "data", "categories");

// ─── Meta title + description override-ok ───────────────────────────────
const metaOverrides = {
  "telitett-hegyzett-colop": {
    title: "Telített hegyezett cölöp | Elvira Tüzép",
    description: "Telített hegyezett cölöpök 40-80 mm átmérőben. Faültetéshez, szőlőkarónak, kerítésoszlopnak. UC4, 15+ év. Rendelés online.",
  },
  "telitett-deszka": {
    title: "Telített deszka – impregnált kültéri | Elvira",
    description: "Impregnált telített deszka kerítéshez, magaságyáshoz, burkolathoz. Időjárás-álló, 15+ év élettartam. Több méret kapható.",
  },
  "telitett-pallo": {
    title: "Telített palló – impregnált fa | Elvira Tüzép",
    description: "Masszív telített palló támfalhoz, magaságyáshoz, szerkezetépítéshez. Nyomás alatt impregnált, kültéri használatra.",
  },
  "telitett-oszlop": {
    title: "Telített faoszlop 70×70–90×90 | Elvira Tüzép",
    description: "Telített faoszlop 70×70 és 90×90 mm méretben. Játszótérhez, kerítéshez, pergolához. Erős, tartós, impregnált.",
  },
  "telitett-rudfa": {
    title: "Telített rúdfa – körmart borovi | Elvira Tüzép",
    description: "Körmart telített rúdfa kerítésekhez, hintaállványokhoz és kerti építményekhez. Tartós, nem mártott, nyomás alatti impregnálás.",
  },
  "telitett-felcolop": {
    title: "Telített félcölöp szegélyekhez | Elvira Tüzép",
    description: "Impregnált félcölöp ágyásszegélyekhez, kerti útszegélyekhez, farögzítő szettekhez. Tartós, természetes megoldás.",
  },
  "bsh-ragasztott-gerenda": {
    title: "BSH ragasztott gerenda – méretezés | Elvira",
    description: "BSH ragasztott gerenda több méretben: 8×12-tól 20×20-ig. Egyedi méret is! Méretezési segítség, gyors szállítás.",
  },
  "csereplec-ellenlec": {
    title: "Cserépléc és ellenléc – luc fenyő | Elvira",
    description: "Cserépléc és ellenléc lucfenyőből, több méretben. Egalizált és Bramac lécek. Osztrák faanyag, kedvező áron.",
  },
  "osb-lapok": {
    title: "OSB lapok – árak, méretek, 6–18mm | Elvira",
    description: "OSB lapok 6mm-től 18mm-ig, kedvező áron. Nedvességálló OSB 3 típus. Raktárról azonnal elvihető, szállítás is.",
  },
  "hajopadlo": {
    title: "Hajópadló – luc és borovi fenyő | Elvira Tüzép",
    description: "Hajópadló luc és borovi fenyőből, fózolt és softline profilban. AB és C minőség, 4m-es hosszban.",
  },
  "lamberia": {
    title: "Lambéria – fenyő lambéria bel-kültérre | Elvira",
    description: "Fenyő lambéria falra és mennyezetre – softline, fózolt profil. Osztrák prémium, bel- és kültérre egyaránt.",
  },
  "fahaz-epito-profil": {
    title: "Rönkház profil, zsindely profil | Elvira Tüzép",
    description: "Rönkház profil és zsindely profil luc és borovi fenyőből. Osztrák Pabst-Holz gyártó. Faházakhoz, burkolatokhoz.",
  },
  "fureszelt-deszka": {
    title: "Fűrészelt deszka – légszáraz faanyag | Elvira",
    description: "Fűrészelt deszka légszáraz vagy friss kivitelben. Építkezéshez, zsaluzathoz. Kedvező áron, raktárról.",
  },
  "gyalult-deszka": {
    title: "Gyalult deszka – műszárított luc | Elvira Tüzép",
    description: "Gyalult luc deszka műszárított kivitelben, több méretben. Beltéri és kültéri felhasználásra, kiváló árakon.",
  },
  "kemenyfa-brikett": {
    title: "Keményfa brikett – RUF, Pini Kay | Elvira Érd",
    description: "RUF bükk és Pini Kay tölgy fabrikett magas fűtőértékkel. Raklapos rendelés Érdről, országos szállítással.",
  },
  "pellet": {
    title: "Pellet – fenyő pellet ENplus A1 | Elvira Tüzép",
    description: "Fenyő pellet ENplus A1 tanúsítvánnyal, 15 kg zsákban. Alacsony hamu, tiszta égés. Pellet kazánhoz és kandallóhoz.",
  },
};

// ─── Faqdesc override-ok (üres mezők kitöltése) ─────────────────────────
const faqdescOverrides = {
  "bsh-ragasztott-gerenda": "A BSH (Brettschichtholz) ragasztott gerenda a modern faszerkezet-építés alapanyaga, amely többrétegű, ragasztott technológiával készül. Az alábbi kérdések segítenek eligazodni a BSH gerenda méretezésében, teherbírásában, áraiban és felhasználási lehetőségeiben.",
  "hajopadlo": "A hajópadló egy nútféderes, gyalult burkolóanyag, amely falra, mennyezetre és padlóra egyaránt alkalmas. Az alábbi gyakori kérdések segítenek a hajópadló típusok, méretek, profilok és felhasználási lehetőségek megértésében.",
  "lamberia": "A lambéria népszerű fal- és mennyezetburkoló faanyag, amely bel- és kültérre egyaránt használható. Az alábbi kérdések segítenek eligazodni a lambéria típusok, méretek, profilok és felszerelés kapcsán.",
  "fahaz-epito-profil": "A faház építő profil – más néven rönkház profil vagy zsindely profil – rusztikus, természetes hatású burkolóanyag homlokzatokhoz, belső falakhoz és kerti építményekhez. Az alábbi kérdések segítenek a profiltípusok, méretek és felhasználás megértésében.",
  "gyalult-deszka": "A gyalult deszka sima felületű, mérettartó faanyag, amely beltéri burkolatokhoz, bútorokhoz és látszó szerkezetekhez ideális. Az alábbi kérdések segítenek a gyalult deszka típusok, méretek és felhasználási területek megismerésében.",
};

// ─── Description override-ok ────────────────────────────────────────────
const descriptionOverrides = {
  "fahaz-epito-profil": "Prémium minőségű osztrák rönkház profil (D-profil) és zsindely profil lucfenyőből és borovi fenyőből, közvetlenül a Pabst-Holz gyártótól. A rönkház profil félköríves kialakítása a klasszikus gerendaház hatását kelti, míg a zsindely profil modernebb, laposabb vonalvezetéssel dolgozik – mindkét típus nútféderes illesztéssel szerelhető. A rönkház profil ideális homlokzatburkolatokhoz, melléképületek, kerti házak, kerítések és beltéri díszfalak kialakításához, ahol rusztikus, alpesi hangulatot szeretne elérni. Kültéri használat esetén megfelelő felületkezeléssel (lazúr vagy fedőfesték) a fa tartósan megőrzi esztétikus megjelenését. Kínálatunkban 19×116 mm és 24×146 mm méretekben, jellemzően 4 méteres hosszban érhetők el a profilok – a vastagabb 24 mm-es változat nagyobb merevséget és jobb hőszigetelő képességet biztosít. Az osztrák Pabst-Holz gyártó termékei AB minőségben, műszárított kivitelben készülnek, így kiváló mérettartást és egységes felületet kínálnak. Tekintse meg teljes <a href='/telifa'>telített fa kínálatunkat</a> is, vagy válasszon a <a href='/termekek/lamberia'>lambéria</a> és <a href='/termekek/hajopadlo'>hajópadló</a> alternatívák közül.",
};

// ─── Törött/hiányos FAQ válaszok javítása ────────────────────────────────
// slug → { faqId: newAnswer }
const faqAnswerFixes = {
  "lamberia": {
    "2": "Két fő típusa van: a <b>beltéri lambéria</b> (softline vagy fózolt profil, 12,5–14 mm vastag, sima felületű, falakra és mennyezetre) és a <b>kültéri lambéria</b> (vastagabb, 14–19 mm, időjárásálló, homlokzatokra és ereszekre). A beltéri változat vékonyabb és finomabb felületű, míg a kültéri vastagabb és tartósabb, gyakran borovi fenyőből készül a jobb időjárás-állóság érdekében.",
  },
  "gyalult-deszka": {
    "2": "A gyalult deszka széles körben felhasználható: beltéri falburkolatokhoz, mennyezetekhez, polcokhoz, bútorokhoz, ajtó- és ablakkeretekhez, valamint díszítő elemekhez. Sima felülete és pontos mérettartása miatt látszó szerkezeteknél is előnyös, ahol esztétikus megjelenés szükséges. Kültéren megfelelő felületkezeléssel (lazúr, fedőfesték) teraszburkolatokhoz és kerti bútorokhoz is alkalmazható.",
  },
};

// ─── Description kiegészítés: telitett-* visszalink /telifa-ra ──────────
const descriptionAppend = {
  "telitett-hegyzett-colop": ' Tekintse meg teljes <a href="/telifa"><b>telített fa kínálatunkat</b></a>.',
  "telitett-deszka": ' Tekintse meg teljes <a href="/telifa"><b>telített fa kínálatunkat</b></a>.',
  "telitett-pallo": ' Tekintse meg teljes <a href="/telifa"><b>telített fa kínálatunkat</b></a>.',
  "telitett-oszlop": ' Tekintse meg teljes <a href="/telifa"><b>telített fa kínálatunkat</b></a>.',
  "telitett-rudfa": ' Tekintse meg teljes <a href="/telifa"><b>telített fa kínálatunkat</b></a>.',
  "telitett-felcolop": ' Tekintse meg teljes <a href="/telifa"><b>telített fa kínálatunkat</b></a>.',
};

// ═══════════════════════════════════════════════════════════════════════════
// APPLY OVERRIDES
// ═══════════════════════════════════════════════════════════════════════════

let metaCount = 0;
let contentCount = 0;

// Collect all slugs that need any work
const allSlugs = new Set([
  ...Object.keys(metaOverrides),
  ...Object.keys(faqdescOverrides),
  ...Object.keys(descriptionOverrides),
  ...Object.keys(faqAnswerFixes),
  ...Object.keys(descriptionAppend),
]);

for (const slug of allSlugs) {
  const filePath = path.join(CATEGORIES_DIR, `${slug}.json`);

  try {
    const raw = await fs.readFile(filePath, "utf8");
    const data = JSON.parse(raw);
    let changed = false;

    // 1) Meta title + description
    const meta = metaOverrides[slug];
    if (meta) {
      if (data.meta?.title !== meta.title) {
        data.meta.title = meta.title;
        changed = true;
      }
      if (data.meta?.description !== meta.description) {
        data.meta.description = meta.description;
        changed = true;
      }
      if (changed) metaCount++;
    }

    // 2) Faqdesc
    const faqdesc = faqdescOverrides[slug];
    if (faqdesc && data.faqdesc !== faqdesc) {
      data.faqdesc = faqdesc;
      changed = true;
    }

    // 3) Description override (teljes csere)
    const descOverride = descriptionOverrides[slug];
    if (descOverride && data.description !== descOverride) {
      data.description = descOverride;
      changed = true;
    }

    // 4) Description append (visszalink – csak ha még nincs benne)
    const append = descriptionAppend[slug];
    if (append && data.description && !data.description.includes('/telifa')) {
      data.description = data.description.trimEnd() + append;
      changed = true;
    }

    // 5) FAQ answer fixes
    const faqFixes = faqAnswerFixes[slug];
    if (faqFixes && Array.isArray(data.faq)) {
      for (const [faqId, newAnswer] of Object.entries(faqFixes)) {
        const faqItem = data.faq.find(f => f.id === faqId);
        if (faqItem && faqItem.answer !== newAnswer) {
          faqItem.answer = newAnswer;
          changed = true;
          contentCount++;
        }
      }
    }

    if (changed) {
      await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n");
    }
  } catch (err) {
    console.warn(`⚠️  SEO override skipped for ${slug}: ${err.message}`);
  }
}

console.log(`✅ SEO overrides applied: ${metaCount} meta + ${contentCount} content fixes across ${allSlugs.size} categories`);
