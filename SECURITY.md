# Security Policy

*[Magyarul lentebb](#biztonsági-szabályzat-magyarul)*

## Threat model — what this project actually is

FEM@ti is a **fully client-side application**: it has no backend, no database, no
authentication and no server-side component. Every calculation runs in the visitor's
browser, and **models and calculation data never leave the user's machine** — there is
no upload, no sync, no account.

Fonts are self-hosted (no third-party CDN). The hosted demo at `femati.vercel.app`
runs **Vercel Web Analytics**, which counts page views without cookies, without
`localStorage`, without cross-site tracking and without identifying individuals — it
records page, referrer, country and device type only. It sees **nothing** about your
model, your inputs or your results. The GitHub repository itself ships no analytics:
if you build and run it yourself, it makes no outbound requests at all.

This means the classic web-application attack surface (authentication, authorization,
injection, SSRF, CSRF, rate limiting) largely does not exist here. The realistic
security-relevant areas are:

- parsing of untrusted `.femati.json` model files (`packages/ui/src/model/fileIO.ts`);
- rendering of generated LaTeX through KaTeX (`packages/ui/src/derivation/Formula.tsx`);
- the development toolchain and dependencies (relevant to contributors who clone the repo).

## Supported versions

This is a single-developer project. Only the latest `main` is supported; there are no
maintained release branches or backports.

| Version | Supported |
|---|---|
| latest `main` | ✅ |
| anything older | ❌ |

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Preferred: use GitHub's private vulnerability reporting —
[**Report a vulnerability**](https://github.com/banyaattila-crypto/FEMAti/security/advisories/new)
(Security tab → Report a vulnerability). This creates a private advisory visible only
to the maintainer.

If that is unavailable to you, open a regular issue that says only *"security report,
please contact me"* — with **no technical detail** — and I will follow up privately.

What helps:

- what you did, what happened, what you expected;
- the affected file/function, or a URL/model file that reproduces it;
- your assessment of impact.

**Response expectations — stated honestly:** this is a hobby project maintained by one
person alongside a full-time engineering job. I aim to acknowledge a report within
**7 days** and to assess it within **30 days**. There is no SLA, no bug bounty, and no
guarantee of a fix timeline.

## Scope

**In scope:** anything that lets a crafted model file, URL or page interaction run code,
read data it shouldn't, or silently produce a *wrong engineering result* presented as
valid. The last one is treated as a serious defect in this project, not a cosmetic bug.

**Out of scope:** known vulnerabilities in dev-only dependencies that do not affect the
built application (these are tracked openly and fixed on a normal schedule); anything
requiring a compromised developer machine; social engineering; findings against the
hosted demo's infrastructure (Vercel) rather than this code.

## A note on engineering correctness

FEM@ti is **not certified design software**. A numerically wrong result is a bug and I
want to hear about it — but all results must be independently verified under
professional engineering responsibility regardless. See
[`docs/VALIDATION-SCOPE.md`](docs/VALIDATION-SCOPE.md) for exactly what is and is not
validated.

---

# Biztonsági szabályzat (magyarul)

## Fenyegetettségi modell

A FEM@ti **teljesen kliensoldali** alkalmazás: nincs backendje, adatbázisa,
hitelesítése, semmilyen szerveroldali komponense. Minden számítás a látogató
böngészőjében fut, és **a modell, illetve minden számítási adat a felhasználó gépén
marad** — nincs feltöltés, nincs szinkronizálás, nincs fiók.

A betűtípusokat saját magunk szolgáljuk ki (nincs harmadik feles CDN). A
`femati.vercel.app` címen futó demón **Vercel Web Analytics** mér: süti nélkül,
`localStorage` nélkül, keresztoldali követés nélkül és személyazonosítás nélkül —
kizárólag oldalletöltést, hivatkozót, országot és eszköztípust rögzít. A modellről,
a bemenetekről és az eredményekről **semmit** nem lát. Maga a GitHub-repó nem
tartalmaz analitikát külön beállítás nélkül: ha magadnak buildeled és futtatod,
egyáltalán nem indít kimenő kérést.

Emiatt a klasszikus webes támadási felület (hitelesítés, jogosultság, injekció, SSRF,
CSRF) itt érdemben nem létezik. A ténylegesen releváns területek:

- a nem megbízható `.femati.json` fájlok beolvasása (`packages/ui/src/model/fileIO.ts`);
- a generált LaTeX KaTeX-szel való megjelenítése (`packages/ui/src/derivation/Formula.tsx`);
- a fejlesztői eszközlánc és a függőségek (a repót klónozó fejlesztőket érinti).

## Támogatott verziók

Egyszemélyes projekt: kizárólag a legfrissebb `main` támogatott, nincs karbantartott
kiadási ág és nincs visszaportolás.

## Sebezhetőség bejelentése

**Kérlek, biztonsági problémáról NE nyiss nyilvános issue-t.**

Elsődleges út: a GitHub privát sebezhetőség-bejelentője —
[**Report a vulnerability**](https://github.com/banyaattila-crypto/FEMAti/security/advisories/new)
(Security fül → Report a vulnerability). Ez csak a karbantartó számára látható.

Ha ez nem elérhető: nyiss egy sima issue-t azzal a szöveggel, hogy *"biztonsági
bejelentés, kérlek keress meg"* — **műszaki részlet nélkül** —, és privátban válaszolok.

**Válaszidő, őszintén:** ez egy főállás mellett, egy ember által karbantartott projekt.
Célom a **7 napon belüli** visszaigazolás és a **30 napon belüli** érdemi értékelés.
Nincs SLA, nincs bug bounty, és nincs garantált javítási határidő.

## Hatókör

**Beletartozik:** minden, ami egy megfelelően összeállított modellfájllal, URL-lel vagy
interakcióval kódfuttatást, illetéktelen adathozzáférést, vagy **némán téves mérnöki
eredményt** okoz, amit a program érvényesként mutat. Az utóbbit ez a projekt komoly
hibának tekinti, nem szépséghibának.

**Nem tartozik bele:** a csak fejlesztői függőségekben lévő, a kész alkalmazást nem
érintő ismert sérülékenységek (ezeket nyíltan követjük és normál ütemben javítjuk);
a fejlesztői gép kompromittálását feltételező esetek; a social engineering; valamint a
demót kiszolgáló infrastruktúrát (Vercel) érintő, nem ezt a kódot érintő találatok.
