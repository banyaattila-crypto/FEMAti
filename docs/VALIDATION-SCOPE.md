# Validation & Scope

*[Magyarul](VALIDATION-SCOPE.hu.md)*

> **Purpose of this document.** This is a direct, calibrated answer to the
> question a reviewing engineer or academic colleague will actually ask:
> *"Is the underlying mathematics/mechanics correct, and how do you know?"*
> It states plainly what has been verified, how, and what has not — so that
> nobody has to take the claim of correctness on faith, and nobody is
> surprised later by a limitation that could have been disclosed up front.

---

## 1. The short answer

The mechanical/mathematical core is **traceable to its source, cross-checked
against independent references, and validated against closed-form solutions
with machine-precision agreement** — not "it seems to work," but a specific,
inspectable evidence trail. The sections below are that evidence trail, plus
an explicit list of what this project does **not** claim.

## 2. Method 1 — line-by-line traceability to the source thesis

Every implemented formula is mapped to its exact page and equation number in
the original 1996 BME thesis (`Diplomaterv (BME).pdf`) in
[`docs/THEORY.md`](THEORY.md) — extracted from the PDF text and checked
equation by equation, not "implemented from memory of the general theory."
A reviewer can open `THEORY.md` and, for any piece of code, find the exact
thesis equation it implements, or find the ADR that documents a deliberate,
disclosed departure from it (see §6).

## 3. Method 2 — an explicit error taxonomy, not one blanket tolerance

[`docs/HIBATURESI-POLITIKA.md`](HIBATURESI-POLITIKA.md) (tolerance policy)
draws the distinction a numerical-methods reviewer expects, and that a
single "accuracy: 0.3%" claim would fail to draw:

| Error class | Required standard | Example |
|---|---|---|
| Identities that are exact by construction (shape-function partition of unity, stiffness-matrix symmetry, rigid-body modes) | machine precision (1e-12…1e-14) | never relaxed to "close enough" |
| Two independent algorithms computing the same quantity (Skyline-LDLᵀ vs. dense Gauss, frontal solver vs. Skyline) | 1e-9…1e-10 relative | agreement, not approximation |
| Equation-system solution (residual, global equilibrium ΣFz/ΣMy) | 1e-10 relative | exact in principle |
| Discretization error (mesh, layer count, load step) | **not a number — a convergence order**, measured on a log–log slope | never reported as a single "software accuracy" figure |
| Iterative solver stopping criterion | 1e-6 relative (1e-4%), the thesis's own 0.5% kept as an explicit opt-in "historical mode" | disclosed, not silently tightened or loosened |
| Modeling choices (shear factor, layering resolution, first-order theory) | not a numerical error at all — disclosed as a decision (§6) | never conflated with a bug |

The policy explicitly forbids raising a tolerance to make a test pass, and
forbids reporting a single-mesh result without a convergence study.

## 4. Method 3 — closed-form validation suite, run and checked before writing this document

29 cases, 195 individual checks, generated fresh from the actual test suite
(`pnpm --filter @femati/fem-validation test` → [`docs/VALIDATION.md`](VALIDATION.md),
regenerated automatically, never hand-edited). Representative results, taken
directly from that run:

| Case | Reference (closed-form) | Computed | Relative error |
|---|---|---|---|
| V-01 Cantilever tip deflection | −9.5980952×10⁻⁴ m | −9.5980952×10⁻⁴ m | 8.4×10⁻¹⁴ |
| V-03 Pure-bending patch test, curvature | 8.9286×10⁻⁵ 1/m | 8.9286×10⁻⁵ 1/m | ~1×10⁻¹³ |
| V-04 Shear locking, `selective` scheme, L/h up to 10 000 | 0 (no locking) | max 9.2×10⁻⁹ | stays at machine precision regardless of slenderness |
| V-04 Shear locking, `full` scheme (deliberately non-locking-free) | — | error plateaus at ~12–20%, does not vanish | this is the intended demonstration of the locking phenomenon itself |

13 linear cases (V-01…V-13: cantilever, simply supported, patch test,
locking, rigid-body motion, symmetry, thermal load ×2, support settlement,
self-weight equivalence, penalty vs. elimination, h-convergence, propped
cantilever) and 16 plastic cases (P-01…P-16: shape factors, limit loads for
statically determinate and indeterminate schemes, layered moment–curvature
curve, residual stresses, shakedown, hardening, layer-count convergence,
load-step independence, Newton vs. modified Newton) — every one currently
passing.

## 5. Method 4 — mutation testing (deliberately breaking the formula to prove the test catches it)

For each development phase, at least one formula term was intentionally
corrupted in the source (e.g. dropping the shear Gauss weight, dropping the
thermal κ₀ correction, dropping the hardening term in the plastic return
mapping, flipping a sign in the Lagrange-extrapolation denominator), the
test suite was confirmed to fail, and the code was restored. This proves the
tests guard the *formula*, not merely "the code runs." The full, reproducible
list is in `THEORY.md` §17.

## 6. Real errors found during development — disclosed, not hidden

A validation process that never finds anything is a validation process that
isn't looking hard enough. Three concrete, real errors were found and fixed,
each with a regression test added afterward:

- **R-factor formula was inverted** in the layered plastic return mapping
  (the pre-yield fraction `AB/AC` was used where the post-yield fraction
  `(AC−AB)/AC` belonged). Found by an *asymmetric* shakedown test case that
  the original, symmetric-only test suite could not have caught by
  construction. See [ADR-0007](ADR/0007-r-faktor-elojel-hiba.md).
- **Frontal-solver pivot tolerance was absolute, not relative to matrix
  scale** — with stiffness coefficients around 1e8, a genuinely singular
  pivot slipped through and only surfaced, much later, as a ~1e9-scale
  spurious displacement instead of a clean error. Found by a mutation test
  targeting a mechanism case. See `THEORY.md` §17.
- **Fiber-layer width used midpoint sampling**, which over-estimated area by
  ~40% and inertia by ~46–52% for an I-section layer straddling the
  web/flange transition. Found by an **external review** of a derivation
  document, confirmed by measurement, fixed with an area-preserving
  sub-sampling scheme, reduced to 0.07%/4.6% residual error, and closed with
  a regression test that specifically covers the previously-blind case. See
  [ADR-0014](ADR/0014-fiber-reteg-szelesseg-hiba.md).

Two further external critiques of the same derivation document were
investigated in full and found **not** to indicate errors (one claim was
structurally impossible given the code that computes it; the other two
compared numbers that were never meant to be equal — an elastic reference
figure vs. an actual plastic run at a different load level). Those
investigations, including the reasoning that closed each one, are on the
public record in the project's own change log
(`STATUS_REPORT.md`, entries 11, 12, 15).

## 7. Cross-checked against sources outside the thesis

- The Timoshenko element derivation (shape functions, B-matrix, weak form,
  shear locking countermeasure) matches an independent derivation in
  MathWorks' Symbolic Math Toolbox documentation for a Timoshenko beam
  element — this cross-check is also what surfaced a previously
  undocumented gap (a missing V-04 locking test), which was then written
  and added.
- A propped-cantilever, uniformly-loaded case was checked against
  Ahmed, A. M. & Rifai, A. M. (2021), *"Euler-Bernoulli and Timoshenko Beam
  Theories: Analytical and Numerical Comprehensive Revision,"* European
  Journal of Engineering and Technology Research, 6(7), 20–32 — the
  project's own force-method derivation was cross-checked against, and
  matched, the paper's published table to 4 significant decimal figures.
- The shear correction factor (κs) citation was corrected: the constant
  5/6 for a rectangular section is **not** Cowper's own result — Cowper,
  G. R. (1966), *"The Shear Coefficient in Timoshenko's Beam Theory,"*
  Journal of Applied Mechanics, 33(2), 335–340, derives a Poisson-ratio-
  dependent formula that only reduces to 5/6 at ν=0. The project now
  implements Cowper's actual formula for rectangular, circular, and
  thin-walled tube sections, with the correct citation.

## 8. What this project explicitly does **not** claim

- **No formal, credentialed peer review.** The external critiques in §6
  were informal, unsolicited reviews from unnamed sources, investigated by
  the author with AI assistance — not a chartered engineer's sign-off, not
  a journal-style peer review, not a NAFEMS-style commercial benchmark suite.
- **Faithful to a 1996 thesis, not independently re-derived from first
  principles for every constant.** The core Timoshenko beam-element theory
  (shape functions, B-matrix, stiffness integral) is cross-checked against
  independent sources (§7); thesis-specific tabulated values (e.g. the
  shape-factor table) are not.
- **Shear is always treated as elastic** in the plastic model — there is no
  moment–shear (M–V) coupled yield surface. This is the thesis's own
  (3.52) simplification, faithfully preserved, not a shortcut introduced by
  this implementation.
- **The Cowper shear factor for I- and U-sections uses a simplified
  "the web alone carries shear" approximation**, not Cowper's own (more
  complex) I-section formula.
- **First-order theory.** The second-order (P-Δ) extension is a basic
  addition to the linear stiffness, not a full stability/buckling analysis.
- **No formal NAFEMS-style benchmark suite** of the kind a commercial FEA
  vendor would run.
- **Test-coverage target (≥90% for the core package) has not been
  re-measured** since the P16 performance-profiling phase.
- **The closed-form validation suite covers the beam core only.** The 29 cases
  in [`VALIDATION.md`](VALIDATION.md) (V-01…V-13 linear, P-01…P-16 plastic) validate the
  Timoshenko element, the solvers and the layered plastic model against closed-form
  references. The following features are **outside that suite** — they are covered by
  unit and integration tests (all currently passing), but **not** by a published
  closed-form or handbook reference case, and should be treated accordingly:
  reinforced-concrete ULS capacity (EC2), vertical seismic component (EC8 / EN 1998-1),
  moment–shear (M–V) utilization check (EN 1993-1-1), composite steel–concrete
  cross-section, dynamics (natural frequencies, mode shapes, Newmark-β transient),
  Winkler foundation with uplift (no-tension), moving-load envelope, EN 1990 load
  combinations, serviceability (SLS) checks, section optimization and unit conversion.
  The tests that do cover them are in `packages/fem-core/test/` (e.g. `concreteEC2.test.ts`,
  `verticalSeismicSpectrum.test.ts`, `shearMomentInteraction.test.ts`,
  `contactFoundation.test.ts`, `modal.test.ts`, `transient.test.ts`) and
  `packages/ui/src/model/` (e.g. `rcCapacity.test.ts`, `designChecks.test.ts`,
  `combinations.test.ts`, `envelope.test.ts`).
- Every one of the above is stated explicitly in the code and in
  `docs/THEORY.md` / the ADR log — none of it is a hidden gap; a careful
  reader of the source will find each one flagged at the point where it
  applies.

## 9. Supporting documents

- [`THEORY.md`](THEORY.md) — formula ↔ code ↔ thesis page/equation map (18 sections)
- [`HIBATURESI-POLITIKA.md`](HIBATURESI-POLITIKA.md) — the full tolerance policy (§3 above is a summary)
- [`VALIDATION.md`](VALIDATION.md) — the generated validation protocol (regenerate with `pnpm --filter @femati/fem-validation test`)
- [`ADR/`](ADR/) — 22 architecture decision records, including every real bug found (0007, 0014) and every deliberate departure from the thesis
- [`STATUS_REPORT.md`](../STATUS_REPORT.md) (repo root, Hungarian) — the full development log, including the three external-review investigations in full detail

*This document was compiled 2026-09-05, cross-referencing the state of the
above files at that date. If the code changes, re-run the validation suite
before trusting the specific numbers quoted here — the pass/fail status and
methodology are what should be expected to remain stable, not any single
error figure.*
