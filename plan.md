# Keresztlinkek stratégia: Elvira Tüzép ↔ MatekMegoldások.hu

## Helyzetfelmérés

### Elvira Tüzép kalkulátor oldalai:
1. `/kalkulatorok` — gyűjtőoldal, 3 kalkulátorra linkel
2. `/faanyag-terfogat-kalkulator` — köbméter + ár (deszka, gerenda, fűrészáru)
3. `/faanyag-negyzetmeter-kalkulator` — négyzetméter + ár (lambéria, hajópadló)
4. `/tuzifa-ar-osszehasonlito` — tűzifa mértékegység-átváltás + ár-összehasonlítás

### MatekMegoldások.hu releváns oldalai:
- `/bevezetes/kalkulatorok` — gyűjtőoldal 30+ kalkulátor
- `/atvaltasok/terfogat/kobmeter-liter` — köbméter ↔ liter
- `/atvaltasok/suruseg/beton-suly-terfogat-atvalto` — beton súly-térfogat
- `/atvaltasok/suruseg/homok-suly-terfogat-atvalto` — homok
- `/atvaltasok/suruseg/kavics-suly-terfogat-atvalto` — kavics
- `/atvaltasok/suruseg/soder-suly-terfogat-atvalto` — sóder
- `/atvaltasok/suruseg/kg-m3-g-cm3-atvalto` — sűrűség egység
- `/atvaltasok/tomeg/tonna-kilogramm` — tonna ↔ kg
- `/atvaltasok/terulet/negyzetol-negyzetmeter` — terület átváltás

**Fontos:** A matekmegoldasok.hu-n NINCS tűzifa- vagy faanyag-specifikus kalkulátor.

---

## Javasolt linkstratégia

### A) Elvira Tüzép → MatekMegoldások.hu linkek

#### 1. `/kalkulatorok` gyűjtőoldalra — EGY új szekció

A meglévő 3 kalkulátor felsorolása után egy új blokk:

```
---

## További hasznos kalkulátorok

Amennyiben más jellegű átváltásra vagy számításra van szüksége — például súly, térfogat, sűrűség vagy mértékegység-átváltásra — a [MatekMegoldások.hu kalkulátor gyűjteménye](https://matekmegoldasok.hu/bevezetes/kalkulatorok) több mint 30 ingyenes online eszközt kínál:

- [Köbméter → Liter átváltó](https://matekmegoldasok.hu/atvaltasok/terfogat/kobmeter-liter) — ha köbméterben kapott mennyiséget szeretne literben is értelmezni
- [Tonna → Kilogramm átváltó](https://matekmegoldasok.hu/atvaltasok/tomeg/tonna-kilogramm) — hasznos nagyobb mennyiségű anyag átszámításához
- [Beton súly-térfogat kalkulátor](https://matekmegoldasok.hu/atvaltasok/suruseg/beton-suly-terfogat-atvalto) — ha építkezéshez betonszükségletet is számol
```

**Indoklás:**
- Nem versenyző, hanem kiegészítő kalkulátorok (mértékegység-átváltás vs. ár-kalkuláció)
- A felhasználó aki tüzépben nézelődik, építkezhet is → beton/kavics releváns
- A köbméter ↔ liter átváltó releváns a tűzifa m³ megértéséhez

#### 2. `/faanyag-terfogat-kalkulator` oldalra — 1 kontextuális link

A "Matematikai háttér" szekció végén:

```
Ha a köbméter és liter közötti átváltásra is kíváncsi, használja a [köbméter → liter átváltót](https://matekmegoldasok.hu/atvaltasok/terfogat/kobmeter-liter).
```

**Indoklás:** Természetes kontextus, mert a felhasználó épp m³-ről olvas.

#### 3. `/tuzifa-ar-osszehasonlito` oldalra — 2 kontextuális link

A "Matematikai háttér" szekció végére vagy a "Tipikus értékek" szekció alá:

```
Amennyiben a tonnáról kilogrammra vagy fordítva kell átváltania, hasznos lehet a [tonna → kilogramm átváltó](https://matekmegoldasok.hu/atvaltasok/tomeg/tonna-kilogramm). A köbméter és liter közötti összefüggéshez lásd a [köbméter → liter kalkulátort](https://matekmegoldasok.hu/atvaltasok/terfogat/kobmeter-liter).
```

**Indoklás:** A tűzifa kalkulátor explicit használ tonnát és m³-t, tehát a cross-link természetes.

#### 4. `/faanyag-negyzetmeter-kalkulator` — NEM linkelünk

**Indoklás:** A matekmegoldasok.hu terület-átváltói (hektár, hold, négyszögöl) nem relevánsak burkoló faanyagokhoz. Erőltetett link lenne.

---

### B) MatekMegoldások.hu → Elvira Tüzép linkek (visszafelé)

Ezt a matekmegoldasok.hu kódján kell megvalósítani, de a stratégia:

#### 1. Köbméter → Liter oldalra
"Ha faanyag térfogatát szeretné köbméterben kiszámolni, használja az [Elvira Tüzép faanyag térfogat kalkulátorát](https://elviratuzep.hu/faanyag-terfogat-kalkulator)."

#### 2. Tonna → Kilogramm oldalra
"Tűzifa mennyiség átszámításánál hasznos eszköz lehet a [tűzifa ár-összehasonlító kalkulátor](https://elviratuzep.hu/tuzifa-ar-osszehasonlito), amely a különböző mértékegységek (erdei m³, mázsa, tonna) közötti valós ár-összehasonlítást teszi lehetővé."

#### 3. Sűrűség kalkulátorok oldalra (beton/homok/kavics)
"Ha építőanyag mellett faanyagra is szüksége van, az [Elvira Tüzép termékkínálata](https://elviratuzep.hu/termekek) hasznos lehet." — opcionális, gyengébb relevancia.

#### 4. `/bevezetes/kalkulatorok` gyűjtőoldalra
Egy új szekció "Partnereink kalkulátorai" vagy "Szakágazati kalkulátorok" címmel, benne:
- Faanyag térfogat kalkulátor → elviratuzep.hu
- Tűzifa ár-összehasonlító → elviratuzep.hu

---

## Összefoglaló mátrix

| Elvira oldal | → Matek oldal | Típus |
|---|---|---|
| `/kalkulatorok` | `/bevezetes/kalkulatorok` + 3 konkrét | Szekció (3-4 link) |
| `/faanyag-terfogat-kalkulator` | `/atvaltasok/terfogat/kobmeter-liter` | 1 kontextuális link |
| `/tuzifa-ar-osszehasonlito` | tonna↔kg + m³↔liter | 2 kontextuális link |
| `/faanyag-negyzetmeter-kalkulator` | — | Nem linkelünk |

| Matek oldal | → Elvira oldal | Típus |
|---|---|---|
| köbméter→liter | `/faanyag-terfogat-kalkulator` | 1 kontextuális link |
| tonna→kg | `/tuzifa-ar-osszehasonlito` | 1 kontextuális link |
| `/bevezetes/kalkulatorok` | mindkét Elvira kalkulátor | Szekció (2 link) |

**Összesen: ~6 link Elvira→Matek, ~4 link Matek→Elvira**

---

## Megvalósítás lépései

### Elvira oldalon (jelen projekt):
1. `kalkulatorok.md` — új "További hasznos kalkulátorok" szekció hozzáadása
2. `faanyag-terfogat-kalkulator.mdx` — 1 link a Matematikai háttér végére
3. `tuzifa-ar-osszehasonlito.mdx` — 2 link a Matematikai háttér vagy Tipikus értékek alá

### MatekMegoldások.hu oldalon (külön projekt):
4. Köbméter→liter oldal módosítása
5. Tonna→kg oldal módosítása
6. Gyűjtőoldal bővítése
