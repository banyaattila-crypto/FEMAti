# VALIDATION — validációs jegyzőkönyv

> **EZ A DOKUMENTUM GENERÁLT** (`pnpm --filter @femati/fem-validation test`),
> ne szerkeszd kézzel. Forrás: `packages/fem-validation/src/cases/*.ts`.

Generálva: 2026-09-06T19:57:20.688Z

**Összesítés:** 29 eset, 195 ellenőrzés, MIND ZÖLD ✅.

## V-01 — Konzol, végponti P ✅

w = P·L³/(3·EI) + P·L/(GAs) — a kvadratikus elem itt nodálisan pontos.

*Hivatkozás:* Diplomaterv 3.1.7 (3.11)/(3.24)–(3.26), 38./43. oldal; MASTER-PROMPT-TERV 3.1 táblázat

| Ellenőrzés | Referencia | Számított | Hiba | Tűrés | Eredmény |
|---|---|---|---|---|---|
| w a szabad végen [m] | -0.00095980952 | -0.00095980952 | 8.4381e-14 (rel.) | 1.0000e-8 | OK |

## V-02 — Kéttámaszú tartó, egyenletesen megoszló teherrel ✅

w_max = 5qL⁴/(384EI) + qL²/(8GAs) — diszkretizációs hiba, 8 elemmel.

*Hivatkozás:* Diplomaterv (3.19)–(3.23), 40–42. oldal; MASTER-PROMPT-TERV 3.1 táblázat

| Ellenőrzés | Referencia | Számított | Hiba | Tűrés | Eredmény |
|---|---|---|---|---|---|
| w a középső csomópontban [m] | -0.00060936429 | -0.00060936429 | 6.9390e-15 (rel.) | 0.0001 | OK |

## V-03 — Tiszta hajlítás patch-test ✅

Konstans M → konstans κ, lineáris φ, nulla nyíróerő — mindenütt egzakt.

*Hivatkozás:* Diplomaterv (3.30)–(3.31), 45. oldal; MASTER-PROMPT-TERV 3.1 táblázat

| Ellenőrzés | Referencia | Számított | Hiba | Tűrés | Eredmény |
|---|---|---|---|---|---|
| κ a(z) "E0" elem x=0.113 pontjában [1/m] | 8.9286e-5 | 8.9286e-5 | 8.7111e-13 (rel.) | 1.0000e-12 | OK |
| T (nyíróerő) a(z) "E0" elem x=0.113 pontjában [kN] | 0 | 1.1284e-11 | 1.1284e-11 (abs.) | 5.0000e-9 | OK |
| κ a(z) "E0" elem x=0.500 pontjában [1/m] | 8.9286e-5 | 8.9286e-5 | 7.4999e-13 (rel.) | 1.0000e-12 | OK |
| T (nyíróerő) a(z) "E0" elem x=0.500 pontjában [kN] | 0 | 7.2975e-14 | 7.2975e-14 (abs.) | 5.0000e-9 | OK |
| κ a(z) "E0" elem x=0.887 pontjában [1/m] | 8.9286e-5 | 8.9286e-5 | 6.2886e-13 (rel.) | 1.0000e-12 | OK |
| T (nyíróerő) a(z) "E0" elem x=0.887 pontjában [kN] | 0 | 1.1384e-11 | 1.1384e-11 (abs.) | 5.0000e-9 | OK |
| κ a(z) "E1" elem x=1.113 pontjában [1/m] | 8.9286e-5 | 8.9286e-5 | 5.5661e-13 (rel.) | 1.0000e-12 | OK |
| T (nyíróerő) a(z) "E1" elem x=1.113 pontjában [kN] | 0 | 1.0910e-11 | 1.0910e-11 (abs.) | 5.0000e-9 | OK |
| κ a(z) "E1" elem x=1.500 pontjában [1/m] | 8.9286e-5 | 8.9286e-5 | 4.4671e-13 (rel.) | 1.0000e-12 | OK |
| T (nyíróerő) a(z) "E1" elem x=1.500 pontjában [kN] | 0 | 1.4595e-13 | 1.4595e-13 (abs.) | 5.0000e-9 | OK |
| κ a(z) "E1" elem x=1.887 pontjában [1/m] | 8.9286e-5 | 8.9286e-5 | 3.3682e-13 (rel.) | 1.0000e-12 | OK |
| T (nyíróerő) a(z) "E1" elem x=1.887 pontjában [kN] | 0 | 9.9246e-12 | 9.9246e-12 (abs.) | 5.0000e-9 | OK |
| κ a(z) "E2" elem x=2.113 pontjában [1/m] | 8.9286e-5 | 8.9286e-5 | 2.7762e-13 (rel.) | 1.0000e-12 | OK |
| T (nyíróerő) a(z) "E2" elem x=2.113 pontjában [kN] | 0 | 9.6510e-12 | 9.6510e-12 (abs.) | 5.0000e-9 | OK |
| κ a(z) "E2" elem x=2.500 pontjában [1/m] | 8.9286e-5 | 8.9286e-5 | 1.8655e-13 (rel.) | 1.0000e-12 | OK |
| T (nyíróerő) a(z) "E2" elem x=2.500 pontjában [kN] | 0 | 0 | 0 (abs.) | 5.0000e-9 | OK |
| κ a(z) "E2" elem x=2.887 pontjában [1/m] | 8.9286e-5 | 8.9286e-5 | 9.5778e-14 (rel.) | 1.0000e-12 | OK |
| T (nyíróerő) a(z) "E2" elem x=2.887 pontjában [kN] | 0 | 7.4435e-12 | 7.4435e-12 (abs.) | 5.0000e-9 | OK |
| κ a(z) "E3" elem x=3.113 pontjában [1/m] | 8.9286e-5 | 8.9286e-5 | 7.4224e-14 (rel.) | 1.0000e-12 | OK |
| T (nyíróerő) a(z) "E3" elem x=3.113 pontjában [kN] | 0 | 3.2474e-12 | 3.2474e-12 (abs.) | 5.0000e-9 | OK |
| κ a(z) "E3" elem x=3.500 pontjában [1/m] | 8.9286e-5 | 8.9286e-5 | 3.9313e-14 (rel.) | 1.0000e-12 | OK |
| T (nyíróerő) a(z) "E3" elem x=3.500 pontjában [kN] | 0 | 0 | 0 (abs.) | 5.0000e-9 | OK |
| κ a(z) "E3" elem x=3.887 pontjában [1/m] | 8.9286e-5 | 8.9286e-5 | 4.7054e-15 (rel.) | 1.0000e-12 | OK |
| T (nyíróerő) a(z) "E3" elem x=3.887 pontjában [kN] | 0 | 2.0433e-12 | 2.0433e-12 (abs.) | 5.0000e-9 | OK |
| φ a(z) "N0" csomópontban (x=0 m) [rad] | 0 | 0 | 0 (rel.) | 1.0000e-11 | OK |
| φ a(z) "N1" csomópontban (x=0.5 m) [rad] | 4.4643e-5 | 4.4643e-5 | 8.2816e-13 (rel.) | 1.0000e-11 | OK |
| φ a(z) "N2" csomópontban (x=1 m) [rad] | 8.9286e-5 | 8.9286e-5 | 7.4999e-13 (rel.) | 1.0000e-11 | OK |
| φ a(z) "N3" csomópontban (x=1.5 m) [rad] | 0.00013392857 | 0.00013392857 | 6.7252e-13 (rel.) | 1.0000e-11 | OK |
| φ a(z) "N4" csomópontban (x=2 m) [rad] | 0.00017857143 | 0.00017857143 | 5.9835e-13 (rel.) | 1.0000e-11 | OK |
| φ a(z) "N5" csomópontban (x=2.5 m) [rad] | 0.00022321429 | 0.00022321429 | 5.2786e-13 (rel.) | 1.0000e-11 | OK |
| φ a(z) "N6" csomópontban (x=3 m) [rad] | 0.00026785714 | 0.00026785714 | 4.6103e-13 (rel.) | 1.0000e-11 | OK |
| φ a(z) "N7" csomópontban (x=3.5 m) [rad] | 0.0003125 | 0.0003125 | 4.0402e-13 (rel.) | 1.0000e-11 | OK |
| φ a(z) "N8" csomópontban (x=4 m) [rad] | 0.00035714286 | 0.00035714286 | 3.5564e-13 (rel.) | 1.0000e-11 | OK |

## V-04 — Nyírási záródás (shear locking) kimutatása ✅

Kéttámaszú tartó, egyenletes q, 2 elemes durva háló, L/h=10…10000 karcsúsági söprés. A `selective` séma hibája a karcsúsággal NEM nő (gépi pontosság marad), a `full` séma hibája NEM tűnik el, hanem nemnulla platón marad — ez maga a záródás. Részletek: L/h=10: selective=1.18e-15, full=1.20e-1; L/h=100: selective=1.18e-12, full=1.99e-1; L/h=1000: selective=4.92e-12, full=2.00e-1; L/h=10000: selective=9.23e-9, full=2.00e-1.

*Hivatkozás:* Diplomaterv 3.1.4 (szelektív redukált integrálás indoklása); element/quadrature.ts; docs/THEORY.md 4. fejezet

| Ellenőrzés | Referencia | Számított | Hiba | Tűrés | Eredmény |
|---|---|---|---|---|---|
| max relatív hiba (selective, minden L/h-nál) | 0 | 9.2306e-9 | 9.2306e-9 (abs.) | 1.0000e-6 | OK |
| min relatív hiba (full, minden L/h-nál) — a záródás NEM tűnik el | [0.05, 1] | 0.12015367 | 0 (sávon kívül) | — | OK |
| záródási arány: min(full-hiba) / max(selective-hiba) | [1000, 1.0000e+12] | 1.3017e+7 | 0 (sávon kívül) | — | OK |

## V-05 — Merevtest-mozgás ✅

Kₑ·u_rigid = 0 tiszta eltolásra és merev elfordulásra egyaránt.

*Hivatkozás:* Diplomaterv (3.11), 3.1.5, 38. oldal

| Ellenőrzés | Referencia | Számított | Hiba | Tűrés | Eredmény |
|---|---|---|---|---|---|
| Kₑ·u_eltolás — 0. komponens | 0 | -3.4925e-10 | 3.4925e-10 (abs.) | 1.2283e-5 | OK |
| Kₑ·u_eltolás — 1. komponens | 0 | -2.3283e-10 | 2.3283e-10 (abs.) | 1.2283e-5 | OK |
| Kₑ·u_eltolás — 2. komponens | 0 | 9.3132e-10 | 9.3132e-10 (abs.) | 1.2283e-5 | OK |
| Kₑ·u_eltolás — 3. komponens | 0 | 4.6566e-10 | 4.6566e-10 (abs.) | 1.2283e-5 | OK |
| Kₑ·u_eltolás — 4. komponens | 0 | -6.9849e-10 | 6.9849e-10 (abs.) | 1.2283e-5 | OK |
| Kₑ·u_eltolás — 5. komponens | 0 | 9.3132e-10 | 9.3132e-10 (abs.) | 1.2283e-5 | OK |
| Kₑ·u_merev elfordulás — 0. komponens | 0 | -1.1642e-9 | 1.1642e-9 (abs.) | 1.2283e-5 | OK |
| Kₑ·u_merev elfordulás — 1. komponens | 0 | -1.8626e-9 | 1.8626e-9 (abs.) | 1.2283e-5 | OK |
| Kₑ·u_merev elfordulás — 2. komponens | 0 | 3.2596e-9 | 3.2596e-9 (abs.) | 1.2283e-5 | OK |
| Kₑ·u_merev elfordulás — 3. komponens | 0 | 0 | 0 (abs.) | 1.2283e-5 | OK |
| Kₑ·u_merev elfordulás — 4. komponens | 0 | -1.8626e-9 | 1.8626e-9 (abs.) | 1.2283e-5 | OK |
| Kₑ·u_merev elfordulás — 5. komponens | 0 | 2.3283e-9 | 2.3283e-9 (abs.) | 1.2283e-5 | OK |

## V-06 — Szimmetria + pozitív definitség ✅

K = Kᵀ, és megtámasztás után minden LDLᵀ-pivot pozitív.

*Hivatkozás:* Diplomaterv 3.1.7.1, 43. oldal

| Ellenőrzés | Referencia | Számított | Hiba | Tűrés | Eredmény |
|---|---|---|---|---|---|
| K szimmetria-hibája (relatív) | 0 | 0 | 0 (abs.) | 1.0000e-13 | OK |
| Negatív pivotok száma (tehetetlenségi szám) | 0 | 0 | 0 (abs.) | 0 | OK |

## V-07 — Hőteher, statikailag határozott (kéttámaszú) ✅

M ≡ 0, w_max = κ0·L²/8 — a szerkezet szabadon felveheti a hőteher-görbületet.

*Hivatkozás:* ADR-0006; Diplomaterv 3.1.7

| Ellenőrzés | Referencia | Számított | Hiba | Tűrés | Eredmény |
|---|---|---|---|---|---|
| w a középső csomópontban [m] | -0.0027 | -0.0027 | 3.5979e-14 (rel.) | 1.0000e-8 | OK |
| M a(z) "E0" elem x=0.169 pontjában [kNm] | 0 | -1.0929e-12 | 1.0929e-12 (abs.) | 0.0001344 | OK |
| M a(z) "E0" elem x=0.750 pontjában [kNm] | 0 | -3.5215e-12 | 3.5215e-12 (abs.) | 0.0001344 | OK |
| M a(z) "E0" elem x=1.331 pontjában [kNm] | 0 | -5.9501e-12 | 5.9501e-12 (abs.) | 0.0001344 | OK |
| M a(z) "E1" elem x=1.669 pontjában [kNm] | 0 | -5.8772e-12 | 5.8772e-12 (abs.) | 0.0001344 | OK |
| M a(z) "E1" elem x=2.250 pontjában [kNm] | 0 | -6.1444e-12 | 6.1444e-12 (abs.) | 0.0001344 | OK |
| M a(z) "E1" elem x=2.831 pontjában [kNm] | 0 | -6.4358e-12 | 6.4358e-12 (abs.) | 0.0001344 | OK |
| M a(z) "E2" elem x=3.169 pontjában [kNm] | 0 | -4.5901e-12 | 4.5901e-12 (abs.) | 0.0001344 | OK |
| M a(z) "E2" elem x=3.750 pontjában [kNm] | 0 | -3.8858e-12 | 3.8858e-12 (abs.) | 0.0001344 | OK |
| M a(z) "E2" elem x=4.331 pontjában [kNm] | 0 | -3.1086e-12 | 3.1086e-12 (abs.) | 0.0001344 | OK |
| M a(z) "E3" elem x=4.669 pontjában [kNm] | 0 | -4.0558e-12 | 4.0558e-12 (abs.) | 0.0001344 | OK |
| M a(z) "E3" elem x=5.250 pontjában [kNm] | 0 | -2.3800e-12 | 2.3800e-12 (abs.) | 0.0001344 | OK |
| M a(z) "E3" elem x=5.831 pontjában [kNm] | 0 | -7.0430e-13 | 7.0430e-13 (abs.) | 0.0001344 | OK |
| egyensúly (reakciók + terhek összege, gépi pontosság) | 0 | -2.5352e-11 | 2.5352e-11 (abs.) | 1.0000e-9 | OK |

## V-08 — Hőteher, mindkét végén befogott tartó ✅

w ≡ 0, φ ≡ 0, M = −EI·κ0 állandó mindenütt — a teljes befogás megakadályozza a szabad hőgörbületet.

*Hivatkozás:* ADR-0006; Diplomaterv 3.1.7

| Ellenőrzés | Referencia | Számított | Hiba | Tűrés | Eredmény |
|---|---|---|---|---|---|
| w a(z) "N0" csomópontban [m] | 0 | 0 | 0 (abs.) | 1.0000e-9 | OK |
| φ a(z) "N0" csomópontban [rad] | 0 | 0 | 0 (abs.) | 1.0000e-9 | OK |
| w a(z) "N1" csomópontban [m] | 0 | 7.3317e-21 | 7.3317e-21 (abs.) | 1.0000e-9 | OK |
| φ a(z) "N1" csomópontban [rad] | 0 | 1.4015e-20 | 1.4015e-20 (abs.) | 1.0000e-9 | OK |
| w a(z) "N2" csomópontban [m] | 0 | 1.8575e-20 | 1.8575e-20 (abs.) | 1.0000e-9 | OK |
| φ a(z) "N2" csomópontban [rad] | 0 | 1.0431e-20 | 1.0431e-20 (abs.) | 1.0000e-9 | OK |
| w a(z) "N3" csomópontban [m] | 0 | 2.0531e-20 | 2.0531e-20 (abs.) | 1.0000e-9 | OK |
| φ a(z) "N3" csomópontban [rad] | 0 | -1.0752e-20 | 1.0752e-20 (abs.) | 1.0000e-9 | OK |
| w a(z) "N4" csomópontban [m] | 0 | 7.6134e-34 | 7.6134e-34 (abs.) | 1.0000e-9 | OK |
| φ a(z) "N4" csomópontban [rad] | 0 | -4.9533e-20 | 4.9533e-20 (abs.) | 1.0000e-9 | OK |
| w a(z) "N5" csomópontban [m] | 0 | -2.0531e-20 | 2.0531e-20 (abs.) | 1.0000e-9 | OK |
| φ a(z) "N5" csomópontban [rad] | 0 | -1.0752e-20 | 1.0752e-20 (abs.) | 1.0000e-9 | OK |
| w a(z) "N6" csomópontban [m] | 0 | -1.8575e-20 | 1.8575e-20 (abs.) | 1.0000e-9 | OK |
| φ a(z) "N6" csomópontban [rad] | 0 | 1.0431e-20 | 1.0431e-20 (abs.) | 1.0000e-9 | OK |
| w a(z) "N7" csomópontban [m] | 0 | -7.3317e-21 | 7.3317e-21 (abs.) | 1.0000e-9 | OK |
| φ a(z) "N7" csomópontban [rad] | 0 | 1.4015e-20 | 1.4015e-20 (abs.) | 1.0000e-9 | OK |
| w a(z) "N8" csomópontban [m] | 0 | 0 | 0 (abs.) | 1.0000e-9 | OK |
| φ a(z) "N8" csomópontban [rad] | 0 | 0 | 0 (abs.) | 1.0000e-9 | OK |
| M a(z) "E0" elem x=0.169 pontjában [kNm] | -134.4 | -134.4 | 0 (rel.) | 1.0000e-8 | OK |
| M a(z) "E0" elem x=0.750 pontjában [kNm] | -134.4 | -134.4 | 0 (rel.) | 1.0000e-8 | OK |
| M a(z) "E0" elem x=1.331 pontjában [kNm] | -134.4 | -134.4 | 0 (rel.) | 1.0000e-8 | OK |
| M a(z) "E1" elem x=1.669 pontjában [kNm] | -134.4 | -134.4 | 0 (rel.) | 1.0000e-8 | OK |
| M a(z) "E1" elem x=2.250 pontjában [kNm] | -134.4 | -134.4 | 0 (rel.) | 1.0000e-8 | OK |
| M a(z) "E1" elem x=2.831 pontjában [kNm] | -134.4 | -134.4 | 0 (rel.) | 1.0000e-8 | OK |
| M a(z) "E2" elem x=3.169 pontjában [kNm] | -134.4 | -134.4 | 2.1147e-16 (rel.) | 1.0000e-8 | OK |
| M a(z) "E2" elem x=3.750 pontjában [kNm] | -134.4 | -134.4 | 0 (rel.) | 1.0000e-8 | OK |
| M a(z) "E2" elem x=4.331 pontjában [kNm] | -134.4 | -134.4 | 0 (rel.) | 1.0000e-8 | OK |
| M a(z) "E3" elem x=4.669 pontjában [kNm] | -134.4 | -134.4 | 0 (rel.) | 1.0000e-8 | OK |
| M a(z) "E3" elem x=5.250 pontjában [kNm] | -134.4 | -134.4 | 0 (rel.) | 1.0000e-8 | OK |
| M a(z) "E3" elem x=5.831 pontjában [kNm] | -134.4 | -134.4 | 0 (rel.) | 1.0000e-8 | OK |

## V-09 — Támaszsüllyedés, kétnyílású folytatólagos tartó ✅

Erőmódszeres (kompatibilitási) zárt alak a középső támasz reakciójára és nyomatékára.

*Hivatkozás:* Diplomaterv 3.1.6.5, 3.1.7; MASTER-PROMPT-TERV 3.1 táblázat

| Ellenőrzés | Referencia | Számított | Hiba | Tűrés | Eredmény |
|---|---|---|---|---|---|
| reakció a bal végtámasznál [kN] | -42.794371 | -42.794371 | 8.8215e-13 (rel.) | 1.0000e-6 | OK |
| reakció a jobb végtámasznál [kN] | -42.794371 | -42.794371 | 2.1419e-14 (rel.) | 1.0000e-6 | OK |
| reakció a középső (süllyedő) támasznál [kN] | 85.588741 | 85.588741 | 1.3160e-12 (rel.) | 1.0000e-6 | OK |
| globális egyensúly (reakciók összege, gépi pontosság) | 0 | -1.5130e-10 | 1.5130e-10 (abs.) | 1.0000e-9 | OK |

## V-10 — Önsúly = ekvivalens megoszló teher ✅

A selfWeight és egy azonos p_z intenzitású distributedForce TELJES megoldása egyezik.

*Hivatkozás:* Diplomaterv (3.23); MASTER-PROMPT-TERV 3.1 táblázat

| Ellenőrzés | Referencia | Számított | Hiba | Tűrés | Eredmény |
|---|---|---|---|---|---|
| w a(z) "N0" csomópontban [m] | 0 | 0 | 0 (rel.) | 1.0000e-10 | OK |
| φ a(z) "N0" csomópontban [rad] | 0 | 0 | 0 (rel.) | 1.0000e-10 | OK |
| w a(z) "N1" csomópontban [m] | 9.2184e-5 | 9.2184e-5 | 0 (rel.) | 1.0000e-10 | OK |
| φ a(z) "N1" csomópontban [rad] | 0.00026104521 | 0.00026104521 | 0 (rel.) | 1.0000e-10 | OK |
| w a(z) "N2" csomópontban [m] | 0.00032628489 | 0.00032628489 | 0 (rel.) | 1.0000e-10 | OK |
| φ a(z) "N2" csomópontban [rad] | 0.00045721528 | 0.00045721528 | 0 (rel.) | 1.0000e-10 | OK |
| w a(z) "N3" csomópontban [m] | 0.00066368506 | 0.00066368506 | 0 (rel.) | 1.0000e-10 | OK |
| φ a(z) "N3" csomópontban [rad] | 0.00059777809 | 0.00059777809 | 0 (rel.) | 1.0000e-10 | OK |
| w a(z) "N4" csomópontban [m] | 0.0010734921 | 0.0010734921 | 0 (rel.) | 1.0000e-10 | OK |
| φ a(z) "N4" csomópontban [rad] | 0.00069200151 | 0.00069200151 | 0 (rel.) | 1.0000e-10 | OK |
| w a(z) "N5" csomópontban [m] | 0.0015286746 | 0.0015286746 | 0 (rel.) | 1.0000e-10 | OK |
| φ a(z) "N5" csomópontban [rad] | 0.00074915342 | 0.00074915342 | 0 (rel.) | 1.0000e-10 | OK |
| w a(z) "N6" csomópontban [m] | 0.0020099246 | 0.0020099246 | 0 (rel.) | 1.0000e-10 | OK |
| φ a(z) "N6" csomópontban [rad] | 0.0007785017 | 0.0007785017 | 0 (rel.) | 1.0000e-10 | OK |
| w a(z) "N7" csomópontban [m] | 0.0025017955 | 0.0025017955 | 0 (rel.) | 1.0000e-10 | OK |
| φ a(z) "N7" csomópontban [rad] | 0.00078931422 | 0.00078931422 | 0 (rel.) | 1.0000e-10 | OK |
| w a(z) "N8" csomópontban [m] | 0.0029965643 | 0.0029965643 | 0 (rel.) | 1.0000e-10 | OK |
| φ a(z) "N8" csomópontban [rad] | 0.00079085887 | 0.00079085887 | 0 (rel.) | 1.0000e-10 | OK |
| befogási reakció (Fz) [kN] | -18.387469 | -18.387469 | 0 (rel.) | 1.0000e-10 | OK |

## V-11 — Penalty vs. elimináció ✅

A két peremfeltétel-kezelési stratégia azonos elmozdulásmezőt ad.

*Hivatkozás:* Diplomaterv 3.1.7.3, 44. oldal

| Ellenőrzés | Referencia | Számított | Hiba | Tűrés | Eredmény |
|---|---|---|---|---|---|
| w a(z) "N0" csomópontban [m] | 0 | -6.2630e-10 | 6.2630e-10 (abs.) | 1.3737e-8 | OK |
| φ a(z) "N0" csomópontban [rad] | -0.00010148746 | -0.00010148876 | 1.2957e-9 (abs.) | 1.3737e-8 | OK |
| w a(z) "N1" csomópontban [m] | -7.5022e-5 | -7.5024e-5 | 1.5904e-9 (abs.) | 1.3737e-8 | OK |
| φ a(z) "N1" csomópontban [rad] | -9.3624e-5 | -9.3625e-5 | 1.2404e-9 (abs.) | 1.3737e-8 | OK |
| w a(z) "N2" csomópontban [m] | -0.00013824859 | -0.00013825106 | 2.4715e-9 (abs.) | 1.3737e-8 | OK |
| φ a(z) "N2" csomópontban [rad] | -7.0033e-5 | -7.0034e-5 | 1.0746e-9 (abs.) | 1.3737e-8 | OK |
| w a(z) "N3" csomópontban [m] | -0.00017788422 | -0.00017788741 | 3.1869e-9 (abs.) | 1.3737e-8 | OK |
| φ a(z) "N3" csomópontban [rad] | -3.0715e-5 | -3.0715e-5 | 7.9817e-10 (abs.) | 1.3737e-8 | OK |
| w a(z) "N4" csomópontban [m] | -0.00018213345 | -0.00018213711 | 3.6534e-9 (abs.) | 1.3737e-8 | OK |
| φ a(z) "N4" csomópontban [rad] | 2.4331e-5 | 2.4330e-5 | 4.1121e-10 (abs.) | 1.3737e-8 | OK |
| w a(z) "N5" csomópontban [m] | -0.00014269302 | -0.00014269681 | 3.7883e-9 (abs.) | 1.3737e-8 | OK |
| φ a(z) "N5" csomópontban [rad] | 6.9992e-5 | 6.9992e-5 | 8.6301e-11 (abs.) | 1.3737e-8 | OK |
| w a(z) "N6" csomópontban [m] | -8.1943e-5 | -8.1946e-5 | 3.5086e-9 (abs.) | 1.3737e-8 | OK |
| φ a(z) "N6" csomópontban [rad] | 8.1157e-5 | 8.1158e-5 | 6.9438e-10 (abs.) | 1.3737e-8 | OK |
| w a(z) "N7" csomópontban [m] | -2.5754e-5 | -2.5757e-5 | 2.7314e-9 (abs.) | 1.3737e-8 | OK |
| φ a(z) "N7" csomópontban [rad] | 5.7827e-5 | 5.7828e-5 | 1.4130e-9 (abs.) | 1.3737e-8 | OK |
| w a(z) "N8" csomópontban [m] | 0 | -1.3737e-9 | 1.3737e-9 (abs.) | 1.3737e-8 | OK |
| φ a(z) "N8" csomópontban [rad] | 0 | 2.2422e-9 | 2.2422e-9 (abs.) | 1.3737e-8 | OK |

## V-12 — Konvergencia-tanulmány: h-finomítás ✅

Az elmozdulásmező (nem csomóponti, fix x=3.7 m helyen interpolált) hibájának log–log meredeksége (konvergencia-rendje) 2.8 és 3.2 közé esik. Mérési pontok: n=8: hiba=2.357e-8, n=16: hiba=7.088e-9, n=32: hiba=1.105e-9, n=64: hiba=3.573e-11.

*Hivatkozás:* Diplomaterv 3.1.7.4, 46. oldal (extrapoláció alapja); MASTER-PROMPT-TERV 3.1 táblázat

| Ellenőrzés | Referencia | Számított | Hiba | Tűrés | Eredmény |
|---|---|---|---|---|---|
| log–log meredekség (konvergencia-rend) | [2.8, 3.2] | 3.0778311 | 0 (sávon kívül) | — | OK |

## V-13 — Befogott-csuklós tartó, egyenletesen megoszló teherrel ✅

Erőmódszeres (kompatibilitási) zárt alak a befogási nyomatékra és a reakciókra — keresztellenőrizve egy külső szakirodalmi forrás (Ahmed & Rifai, 2021) táblázatával.

*Hivatkozás:* Ahmed A.M., Rifai A.M. (2021), Table VI (Fixed-Hinged Beam with UDL); saját erőmódszeres levezetés

| Ellenőrzés | Referencia | Számított | Hiba | Tűrés | Eredmény |
|---|---|---|---|---|---|
| reakció a befogásnál [kN] | 74.94818 | 74.94818 | 2.5787e-13 (rel.) | 1.0000e-6 | OK |
| befogási nyomaték M_A [kNm] | 89.689078 | 89.689078 | 3.1071e-13 (rel.) | 1.0000e-6 | OK |
| reakció a csuklós támasznál [kN] | 45.05182 | 45.05182 | 3.2663e-13 (rel.) | 1.0000e-6 | OK |
| globális egyensúly (reakciók összege, gépi pontosság) | 120 | 120 | 3.4049e-11 (abs.) | 1.0000e-9 | OK |

## P-01 — Téglalap keresztmetszet, Mp/Mₑ alaki tényező ✅

c = Kp/Kₑ = Mp/Mₑ = 1.50 téglalap keresztmetszetre (zárt alak, parametrikus).

*Hivatkozás:* Diplomaterv 4. táblázat, 54. oldal; (3.37), (3.39), 53. oldal

| Ellenőrzés | Referencia | Számított | Hiba | Tűrés | Eredmény |
|---|---|---|---|---|---|
| c = Kp/Kₑ | 1.5 | 1.5 | 1.4803e-16 (rel.) | 0.01 | OK |
| c = Mp/Mₑ (a teherbírásokból számolva) | 1.5 | 1.5 | 1.4803e-16 (rel.) | 0.01 | OK |

## P-02 — Kör, körgyűrű, I-szelvény alaki tényezője ✅

c = Kp/Kₑ a diplomaterv 4. táblázatának megfelelő értékekre áll be.

*Hivatkozás:* Diplomaterv 4. táblázat, 54. oldal

| Ellenőrzés | Referencia | Számított | Hiba | Tűrés | Eredmény |
|---|---|---|---|---|---|
| kör: c = Kp/Kₑ | 1.7 | 1.6976527 | 0.0013807492 (rel.) | 0.02 | OK |
| körgyűrű: c = Kp/Kₑ | 1.27 | 1.2796162 | 0.0075718045 (rel.) | 0.02 | OK |
| I-szelvény: c = Kp/Kₑ | [1.14, 1.16] | 1.1514492 | 0 (sávon kívül) | — | OK |

## P-03 — Konzol, végponti P — határteher ✅

Statikailag határozott konzol, egyetlen képlékeny csukló a befogásnál. A számított határteher az utolsó konvergált teherlépcsőből.

*Hivatkozás:* MASTER-PROMPT-TERV 3.2 táblázat (P-03)

| Ellenőrzés | Referencia | Számított | Hiba | Tűrés | Eredmény |
|---|---|---|---|---|---|
| a teher-vezérelt eljárás a határteher közelében leáll ("limit-load-reached") | 1 | 1 | 0 (abs.) | 0 | OK |
| Pu = Mp/L | 470 | 474.06201 | 0.0086425781 (rel.) | 0.02 | OK |

## P-04 — Kéttámaszú tartó, középen P — határteher ✅

Statikailag határozott kéttámaszú tartó, egyetlen képlékeny csukló a teher alatt. A számított határteher az utolsó konvergált teherlépcsőből.

*Hivatkozás:* MASTER-PROMPT-TERV 3.2 táblázat (P-04)

| Ellenőrzés | Referencia | Számított | Hiba | Tűrés | Eredmény |
|---|---|---|---|---|---|
| a teher-vezérelt eljárás a határteher közelében leáll | 1 | 1 | 0 (abs.) | 0 | OK |
| Pu = 4·Mp/L | 1880 | 1912.9551 | 0.017529297 (rel.) | 0.02 | OK |

## P-05 — Kéttámaszú tartó, egyenletes q — határteher ✅

Statikailag határozott kéttámaszú tartó egyenletes megoszló teherrel, egyetlen képlékeny csukló a középső keresztmetszetnél.

*Hivatkozás:* MASTER-PROMPT-TERV 3.2 táblázat (P-05)

| Ellenőrzés | Referencia | Számított | Hiba | Tűrés | Eredmény |
|---|---|---|---|---|---|
| a teher-vezérelt eljárás a határteher közelében leáll | 1 | 1 | 0 (abs.) | 0 | OK |
| qu = 8·Mp/L² | 940 | 940.36719 | 0.000390625 (rel.) | 0.02 | OK |

## P-06 — Kétoldalt befogott tartó, egyenletes q — határteher ✅

Statikailag határozatlan (3 csuklós mechanizmus: mindkét befogás + a nyílás közepe), a csuklók fokozatosan alakulnak ki — előbb a befogásoknál.

*Hivatkozás:* MASTER-PROMPT-TERV 3.2 táblázat (P-06)

| Ellenőrzés | Referencia | Számított | Hiba | Tűrés | Eredmény |
|---|---|---|---|---|---|
| a teher-vezérelt eljárás a határteher közelében leáll | 1 | 1 | 0 (abs.) | 0 | OK |
| qu = 16·Mp/L² | 1880 | 1912.9551 | 0.017529297 (rel.) | 0.03 | OK |

## P-07 — Kétoldalt befogott tartó, középen P — határteher ✅

Statikailag határozatlan (3 csuklós mechanizmus: mindkét befogás + a teher alatt), a csuklók fokozatosan alakulnak ki.

*Hivatkozás:* MASTER-PROMPT-TERV 3.2 táblázat (P-07)

| Ellenőrzés | Referencia | Számított | Hiba | Tűrés | Eredmény |
|---|---|---|---|---|---|
| a teher-vezérelt eljárás a határteher közelében leáll | 1 | 1 | 0 (abs.) | 0 | OK |
| Pu = 8·Mp/L | 3760 | 3825.9102 | 0.017529297 (rel.) | 0.03 | OK |

## P-08 — Kétnyílású folytatólagos gerenda — a diplomaterv fő feladattípusa ✅

A képlékeny csuklók kialakulásának sorrendje (a tehertörténetből ténylegesen megfigyelve, a szimmetria-modellen — a középső támasz itt a szimmetria-tengelynek megfelelő befogás): 1) λ=0.5625-nél a középső támasznál (E63, x≈3.969 m) megfolyik a keresztmetszet — a nyomatéki ábra a támasz fölött "ellaposodik" (a többlet nyomaték a mező felé redistribuálódik). 2) λ=0.7734-nél a mezőben (E24, x≈1.531 m, a befogástól ≈2.469 m-re) is megfolyik a keresztmetszet — ekkortól a szerkezet (fél-modellben) 2, a teljes kétnyílású szerkezetben pedig 3 csuklós mechanizmussá válik, és a teher-vezérelt eljárás a határteher közelében leáll. A számított határteher qu≈1381.5 kN/m, a zárt alak qu=(6+4√2)·Mp/L²≈1369.7 kN/m.

*Hivatkozás:* MASTER-PROMPT-TERV 3.2 táblázat (P-08); a diplomaterv fő mintafeladata

| Ellenőrzés | Referencia | Számított | Hiba | Tűrés | Eredmény |
|---|---|---|---|---|---|
| a teher-vezérelt eljárás a határteher közelében leáll | 1 | 1 | 0 (abs.) | 0 | OK |
| qu = (6 + 4√2)·Mp/L² | 1369.6804 | 1381.5179 | 0.0086425781 (rel.) | 0.03 | OK |
| a középső támasznál (szimmetria-tengely) KELETKEZIK csukló a határteherig | 1 | 1 | 0 (abs.) | 0 | OK |
| a nyílásban is KELETKEZIK csukló a határteherig | 1 | 1 | 0 (abs.) | 0 | OK |
| a KIALAKULÁS SORRENDJE helyes: a támasz-csukló ELŐBB folyik meg, mint a nyílásbeli | 1 | 1 | 0 (abs.) | 0 | OK |

## P-09 — Rétegelt keresztmetszet M–κ görbéje — zárt megoldással ✅

Rugalmas–tökéletesen képlékeny téglalap keresztmetszet M(κ) görbéje a rétegelt (64 réteges) modellel, kézi levezetésű zárt alakhoz hasonlítva öt görbületi szinten (rugalmas, éppen folyó, és három képlékeny pont).

*Hivatkozás:* Diplomaterv 3.4.3, (3.53)-(3.59), 63-65. oldal; a zárt alak klasszikus rugalmas-képlékeny hajlítási eredmény

| Ellenőrzés | Referencia | Számított | Hiba | Tűrés | Eredmény |
|---|---|---|---|---|---|
| M(κ) — rugalmas tartomány | 626.66667 | 626.51367 | 0.00024414063 (rel.) | 0.01 | OK |
| M(κ) — folyási határ tartomány | 1253.3333 | 1253.0273 | 0.00024414063 (rel.) | 0.01 | OK |
| M(κ) — képlékeny tartomány | 1723.3333 | 1723.0273 | 0.00017755682 (rel.) | 0.01 | OK |
| M(κ) — képlékeny tartomány | 1854.9333 | 1854.928 | 2.8868e-6 (rel.) | 0.01 | OK |
| M(κ) — képlékeny tartomány | 1879.7493 | 1879.5984 | 8.0300e-5 (rel.) | 0.01 | OK |

## P-10 — Tehermentesítés — sajátfeszültségek ✅

Egy téglalap keresztmetszetet 1.5·κY-ig terhelünk (részleges folyás), majd nulla nyomatékig tehermentesítünk — a visszamaradó rétegenkénti feszültségek egyensúlyt tartanak, de egyedileg nem nullák (sajátfeszültség).

*Hivatkozás:* MASTER-PROMPT-TERV 3.2 táblázat (P-10), 3.3 pont; Diplomaterv 3.4.4 elve

| Ellenőrzés | Referencia | Számított | Hiba | Tűrés | Eredmény |
|---|---|---|---|---|---|
| ∫σ·z dA = 0 (a tehermentesítés PONTOSAN nullnyomatékra vezet vissza) | 0 | 8.4199e-13 | 8.4199e-13 (abs.) | 1.0000e-6 | OK |
| ∫σ dA = 0 (nincs axiális erő — a szimmetria megőrződik) | 0 | 4.1211e-13 | 4.1211e-13 (abs.) | 1.0000e-6 | OK |
| a legkülső réteg maradó feszültsége a σY nagyságrendjében van (valódi sajátfeszültség) | [0.05, 1] | 0.25804162 | 0 (sávon kívül) | — | OK |

## P-11 — Beállás (shakedown) ✅

A P-10 tehermentesítése után κ1-ig újraterhelve a válasz TISZTÁN rugalmas: a nyomaték pontosan M₁-re tér vissza, és egyetlen rétegben sem keletkezik ÚJ képlékeny alakváltozás.

*Hivatkozás:* MASTER-PROMPT-TERV 3.2 táblázat (P-11), 3.3 pont; klasszikus "shakedown" tétel

| Ellenőrzés | Referencia | Számított | Hiba | Tűrés | Eredmény |
|---|---|---|---|---|---|
| az újraterhelés κ1-nél pontosan M₁-et ad vissza | 1601.3821 | 1601.3821 | 0 (rel.) | 1.0000e-8 | OK |
| egyetlen rétegben sem nő az effektív képlékeny alakváltozás (beállás) | 0 | 0 | 0 (abs.) | 1.0000e-10 | OK |

## P-12 — Keményedés — egytengelyű ellenőrzés ✅

EI_T = EI·H'/(EI+H') zárt alakban, H' = 0-nál EI_T = 0.

*Hivatkozás:* Diplomaterv (3.50)–(3.51), 63. oldal

| Ellenőrzés | Referencia | Számított | Hiba | Tűrés | Eredmény |
|---|---|---|---|---|---|
| EI_T, H' = 5000 kNm² | 4000 | 4000 | 0 (rel.) | 1.0000e-8 | OK |
| EI_T, H' = EI (fele akkora tangens) | 10000 | 10000 | 0 (rel.) | 1.0000e-8 | OK |
| EI_T, H' = 0 (tökéletesen képlékeny) | 0 | 0 | 0 (rel.) | 1.0000e-8 | OK |

## P-13 — Rétegszám-konvergencia és a semleges tengely elmozdulása ✅

Mp a rétegszámmal monoton tart a zárt alakú M0-hoz (64 rétegnél 1%-on belül); aszimmetrikus (T-szerű) szelvénynél a képlékeny (egyenlő-terület) semleges tengely kimutathatóan és helyesen eltér a rugalmas súlyponttól.

*Hivatkozás:* MASTER-PROMPT-TERV P10 prompt "Elfogadás" pontja; Diplomaterv 3.4.3, (3.54), (3.59)

| Ellenőrzés | Referencia | Számított | Hiba | Tűrés | Eredmény |
|---|---|---|---|---|---|
| Mp (4 réteg) → M0 zárt alak | 1880 | 1880 | 3.3864e-15 (rel.) | 0.1 | OK |
| Mp (8 réteg) → M0 zárt alak | 1880 | 1880 | 3.3864e-15 (rel.) | 0.1 | OK |
| Mp (16 réteg) → M0 zárt alak | 1880 | 1880 | 3.2655e-15 (rel.) | 0.1 | OK |
| Mp (32 réteg) → M0 zárt alak | 1880 | 1880 | 3.3864e-15 (rel.) | 0.1 | OK |
| Mp (64 réteg) → M0 zárt alak | 1880 | 1880 | 3.3864e-15 (rel.) | 0.01 | OK |
| a hiba nem nő a legdurvábbtól a legfinomabb hálóig (konvergencia/egzaktság) | 0 | 0 | 0 (abs.) | 0 | OK |
| N(rugalmas súlypont, z=0)/N_max ERŐSEN nullától eltérő (legalább 10%, a tengely NEM ott van) | [0.1, 1] | 0.28076923 | 0 (sávon kívül) | — | OK |
| N(egyenlő-terület tengely) ≈ 0 (a helyes képlékeny semleges tengely) | 0 | -11.75 | 11.75 (abs.) | 17.625 | OK |
| a képlékeny tengely a szélesebb (alsó) öv felé tolódik (zPna > 0, lefelé) | 1 | 1 | 0 (abs.) | 0 | OK |

## P-14 — Teherlépcső-függetlenség ✅

Monoton terhelésnél a végállapot (λ=1) gyakorlatilag független a kezdeti lépésszámtól (2 vs. 20 lépés) — a radial-return anyagmodell útfüggetlensége.

*Hivatkozás:* MASTER-PROMPT-TERV P11 prompt, "Elfogadás" (P-14)

| Ellenőrzés | Referencia | Számított | Hiba | Tűrés | Eredmény |
|---|---|---|---|---|---|
| mindkét lépésszám konvergál λ=1-ig (2 lépés) | 1 | 1 | 0 (abs.) | 0 | OK |
| mindkét lépésszám konvergál λ=1-ig (20 lépés) | 1 | 1 | 0 (abs.) | 0 | OK |
| a végponti lehajlás lépésszám-független (2 vs. 20 lépés) | -0.040599943 | -0.040599943 | 2.5483e-13 (rel.) | 0.0001 | OK |

## P-15 — Newton vs. módosított Newton ✅

A teljes és a módosított Newton–Raphson ugyanahhoz a végállapothoz konvergál, de a módosított séma lépésenként legfeljebb egyszer építi újra a tangenciális merevségi mátrixot.

*Hivatkozás:* MASTER-PROMPT-TERV P11 prompt, "Elfogadás" (P-15); diplomaterv lábjegyzet, 10. oldal

| Ellenőrzés | Referencia | Számított | Hiba | Tűrés | Eredmény |
|---|---|---|---|---|---|
| teljes Newton konvergál | 1 | 1 | 0 (abs.) | 0 | OK |
| módosított Newton konvergál | 1 | 1 | 0 (abs.) | 0 | OK |
| a végponti lehajlás a két algoritmusnál egyezik | -0.040599943 | -0.040599943 | 0 (rel.) | 0.001 | OK |
| a módosított Newton lépésenként LEGFELJEBB egyszer épít K_T-t | [0, 3] | 3 | 0 (sávon kívül) | — | OK |
| a módosított Newton SOSEM épít több K_T-t, mint a teljes Newton | [0, 3] | 3 | 0 (sávon kívül) | — | OK |

## P-16 — Reziduum-monotonitás teljes Newtonnál ✅

Egy képlékeny teherlépcsőn belül a reziduum-mérőszám (CONUND) iterációról iterációra monoton csökken — a helyes tangenciális merevségi mátrix jele.

*Hivatkozás:* MASTER-PROMPT-TERV P11 prompt, "Elfogadás" (P-16); HIBATURESI-POLITIKA.md 5. pont

| Ellenőrzés | Referencia | Számított | Hiba | Tűrés | Eredmény |
|---|---|---|---|---|---|
| a futás konvergál | 1 | 1 | 0 (abs.) | 0 | OK |
| van legalább egy többiterációs (képlékeny) lépés a futásban | 1 | 1 | 0 (abs.) | 0 | OK |
| a reziduum monoton csökken a képlékeny lépésen belül (0 megszegés) | 0 | 0 | 0 (abs.) | 0 | OK |
