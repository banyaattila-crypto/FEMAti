// VEM97 numerikus mag — 3 csomópontú izoparametrikus C0 Timoshenko gerendaelem
// Konvenciók: z lefelé pozitív, w a z irányú lehajlás, gamma = phi - dw/dx
// DOF sorrend elemenként: [w1, phi1, w2, phi2, w3, phi3]
// Belső egységek: m, kN, kNm, kN/m^2

const S06 = Math.sqrt(0.6),
  S13 = 1 / Math.sqrt(3);
const G3 = [
  [-S06, 5 / 9],
  [0, 8 / 9],
  [S06, 5 / 9],
];
const G2 = [
  [-S13, 1],
  [S13, 1],
];

export const GAUSS3 = G3;

function shp(x) {
  return { N: [(x * (x - 1)) / 2, 1 - x * x, (x * (x + 1)) / 2], dN: [x - 0.5, -2 * x, x + 0.5] };
}

// ---------------------------------------------------------------- adatbázis
// E, sigmaY: kN/cm^2 ; alpha: 1/°C ; rho: kg/m3
export const MATERIALS = {
  S235: {
    id: 'S235',
    name: 'S235 szerkezeti acél',
    E: 21000,
    nu: 0.3,
    sigmaY: 23.5,
    alpha: 1.2e-5,
    rho: 7850,
    Hp: 0,
    plastic: true,
    source: 'MSZ EN 10025-2',
    verified: true,
  },
  S275: {
    id: 'S275',
    name: 'S275 szerkezeti acél',
    E: 21000,
    nu: 0.3,
    sigmaY: 27.5,
    alpha: 1.2e-5,
    rho: 7850,
    Hp: 0,
    plastic: true,
    source: 'MSZ EN 10025-2',
    verified: true,
  },
  S355: {
    id: 'S355',
    name: 'S355 szerkezeti acél',
    E: 21000,
    nu: 0.3,
    sigmaY: 35.5,
    alpha: 1.2e-5,
    rho: 7850,
    Hp: 0,
    plastic: true,
    source: 'MSZ EN 10025-2',
    verified: true,
  },
  S235H: {
    id: 'S235H',
    name: 'S235 + keményedés (H′)',
    E: 21000,
    nu: 0.3,
    sigmaY: 23.5,
    alpha: 1.2e-5,
    rho: 7850,
    Hp: 420,
    plastic: true,
    source: 'kísérleti',
    verified: false,
  },
  AW6082: {
    id: 'AW6082',
    name: 'EN AW-6082 T6 alumínium',
    E: 7000,
    nu: 0.33,
    sigmaY: 25.0,
    alpha: 2.3e-5,
    rho: 2700,
    Hp: 0,
    plastic: true,
    source: 'MSZ EN 1999-1-1',
    verified: false,
  },
  C25: {
    id: 'C25',
    name: 'C25/30 beton (csak rugalmas)',
    E: 3100,
    nu: 0.2,
    sigmaY: 0,
    alpha: 1.0e-5,
    rho: 2500,
    Hp: 0,
    plastic: false,
    source: 'MSZ EN 1992-1-1 · E a tartós terhekhez (Ebt)',
    verified: false,
  },
  GL24h: {
    id: 'GL24h',
    name: 'GL24h rag. fa (csak rugalmas)',
    E: 1150,
    nu: 0.3,
    sigmaY: 0,
    alpha: 5e-6,
    rho: 420,
    Hp: 0,
    plastic: false,
    source: 'MSZ EN 14080 · légszáraz, 12% nedvesség; lassú alakváltozás nincs figyelembe véve',
    verified: false,
  },
};

// méretek mm-ben
export const SECTIONS = {
  IPE200: { id: 'IPE200', name: 'IPE 200', kind: 'I', h: 200, b: 100, tw: 5.6, tf: 8.5, Acat: 28.5, Icat: 1943, Wplcat: 220.6 },
  IPE300: { id: 'IPE300', name: 'IPE 300', kind: 'I', h: 300, b: 150, tw: 7.1, tf: 10.7, Acat: 53.8, Icat: 8356, Wplcat: 628.4 },
  IPE400: { id: 'IPE400', name: 'IPE 400', kind: 'I', h: 400, b: 180, tw: 8.6, tf: 13.5, Acat: 84.5, Icat: 23130, Wplcat: 1307 },
  HEA200: { id: 'HEA200', name: 'HEA 200', kind: 'I', h: 190, b: 200, tw: 6.5, tf: 10, Acat: 53.8, Icat: 3692, Wplcat: 429.5 },
  HEB300: { id: 'HEB300', name: 'HEB 300', kind: 'I', h: 300, b: 300, tw: 11, tf: 19, Acat: 149.1, Icat: 25170, Wplcat: 1869 },
  UPN200: { id: 'UPN200', name: 'UPN 200 (erős tengely)', kind: 'I', h: 200, b: 75, tw: 8.5, tf: 11.5, Acat: 32.2, Icat: 1910, Wplcat: 228 },
  CIRC200: { id: 'CIRC200', name: 'Kör ⌀200', kind: 'circle', h: 200, b: 200, D: 200 },
  TUBE200: { id: 'TUBE200', name: 'Körgyűrű ⌀200×10', kind: 'tube', h: 200, b: 200, D: 200, t: 10 },
  RECT: { id: 'RECT', name: 'Téglalap 120×300', kind: 'rect', h: 300, b: 120 },
  RECT500: { id: 'RECT500', name: 'Téglalap 300×500', kind: 'rect', h: 500, b: 300 },
};

// Réteges (fiber) felbontás. z középvonaltól, lefelé pozitív. Minden méret m-ben.
export function makeLayers(sec, nL) {
  const h = sec.h / 1000,
    layers = [];
  if (sec.kind === 'rect') {
    const t = h / nL,
      b = sec.b / 1000;
    for (let i = 0; i < nL; i++) layers.push({ b, t, z: -h / 2 + (i + 0.5) * t });
    return layers;
  }
  if (sec.kind === 'circle' || sec.kind === 'tube') {
    const ro = sec.D / 2000,
      ri = sec.kind === 'tube' ? ro - sec.t / 1000 : 0;
    const t = (2 * ro) / nL;
    for (let i = 0; i < nL; i++) {
      const z = -ro + (i + 0.5) * t;
      const outer = 2 * Math.sqrt(Math.max(0, ro * ro - z * z));
      const inner = Math.abs(z) < ri ? 2 * Math.sqrt(ri * ri - z * z) : 0;
      layers.push({ b: outer - inner, t, z });
    }
    return layers;
  }
  const tf = sec.tf / 1000,
    tw = sec.tw / 1000,
    bf = sec.b / 1000,
    hw = h - 2 * tf;
  let nf = Math.max(2, Math.round((nL * tf) / h));
  let nw = Math.max(4, nL - 2 * nf);
  const regions = [
    [-h / 2, tf, bf, nf],
    [-h / 2 + tf, hw, tw, nw],
    [h / 2 - tf, tf, bf, nf],
  ];
  for (const [z0, H, b, n] of regions) {
    const t = H / n;
    for (let i = 0; i < n; i++) layers.push({ b, t, z: z0 + (i + 0.5) * t });
  }
  return layers;
}

export function sectionProps(sec, mat, nL, layerOwnInertia) {
  const layers = makeLayers(sec, nL);
  const E = mat.E * 1e4,
    G = E / (2 * (1 + mat.nu)),
    sY = mat.sigmaY * 1e4;
  let A = 0,
    I = 0,
    Mp = 0;
  for (const L of layers) {
    A += L.b * L.t;
    I += L.b * L.t * (L.z * L.z + (layerOwnInertia ? (L.t * L.t) / 12 : 0));
    Mp += sY * L.b * L.t * Math.abs(L.z);
  }
  const h = sec.h / 1000;
  const Me = sY > 0 ? (sY * I) / (h / 2) : 0;
  const kappaS = sec.kind === 'rect' ? 5 / 6 : sec.kind === 'circle' ? 0.9 : sec.kind === 'tube' ? 0.5 : ((sec.tw / 1000) * h) / A; // I/U-szelvény: gerinc nyírt területe
  return {
    layers,
    A,
    I,
    Mp,
    Me,
    c: Me > 0 ? Mp / Me : 0,
    h,
    EI: E * I,
    GAs: kappaS * G * A,
    E,
    G,
    sY,
    kappaS,
    Hp: mat.Hp * 1e4,
    rho: mat.rho,
    plastic: mat.plastic !== false,
    Acat: sec.Acat,
    Icat: sec.Icat,
  };
}

// ------------------------------------------------------------------- háló
export function buildMesh(spec) {
  const { L, nEl } = spec;
  const nNode = 2 * nEl + 1,
    x = [];
  for (let i = 0; i < nNode; i++) x.push((L * i) / (nNode - 1));
  const els = [];
  for (let e = 0; e < nEl; e++) els.push([2 * e, 2 * e + 1, 2 * e + 2]);
  return { x, els, nNode, nDof: 2 * nNode, Le: L / nEl };
}

function nodeAt(mesh, xt) {
  let best = 0,
    bd = Infinity;
  for (let i = 0; i < mesh.x.length; i++) {
    const d = Math.abs(mesh.x[i] - xt);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

// támaszkészletek — presetből
export const PRESETS = {
  cantilever: { id: 'cantilever', name: 'Konzol, végponti P', supports: [{ r: 0, type: 'fixed' }], load: { q: 0, P: 20, xP: 1 }, ref: 'V-01 / P-03' },
  simple: {
    id: 'simple',
    name: 'Kéttámaszú, egyenletes q',
    supports: [
      { r: 0, type: 'pinned' },
      { r: 1, type: 'roller' },
    ],
    load: { q: 20, P: 0, xP: 0.5 },
    ref: 'V-02 / P-05',
  },
  simpleP: {
    id: 'simpleP',
    name: 'Kéttámaszú, középen P',
    supports: [
      { r: 0, type: 'pinned' },
      { r: 1, type: 'roller' },
    ],
    load: { q: 0, P: 60, xP: 0.5 },
    ref: 'P-04',
  },
  clamped: {
    id: 'clamped',
    name: 'Kétoldalt befogott, q',
    supports: [
      { r: 0, type: 'fixed' },
      { r: 1, type: 'fixed' },
    ],
    load: { q: 40, P: 0, xP: 0.5 },
    ref: 'P-06',
  },
  twospan: {
    id: 'twospan',
    name: 'Kétnyílású folytatólagos, q',
    supports: [
      { r: 0, type: 'pinned' },
      { r: 0.5, type: 'roller' },
      { r: 1, type: 'roller' },
    ],
    load: { q: 30, P: 0, xP: 0.25 },
    ref: 'P-08',
  },
};

function fixedDofs(mesh, spec) {
  const fx = new Set();
  for (const s of spec.supports) {
    const n = nodeAt(mesh, s.r * spec.L);
    fx.add(2 * n);
    if (s.type === 'fixed') fx.add(2 * n + 1);
  }
  return fx;
}

function loadVector(mesh, spec, props) {
  const f = new Float64Array(mesh.nDof),
    J = mesh.Le / 2;
  let q = spec.load.q || 0;
  if (spec.selfWeight) q += (props.A * props.rho * 9.81) / 1000; // kN/m
  if (q !== 0) {
    for (const el of mesh.els) {
      for (const [xi, wt] of G3) {
        const { N } = shp(xi);
        for (let i = 0; i < 3; i++) f[2 * el[i]] += wt * J * N[i] * q;
      }
    }
  }
  if (spec.load.P) f[2 * nodeAt(mesh, spec.load.xP * spec.L)] += spec.load.P;
  if (spec.load.M) f[2 * nodeAt(mesh, (spec.load.xM ?? 1) * spec.L) + 1] += spec.load.M;
  return f;
}

// ------------------------------------------------------------ lineáris mag
function elemK(EI, GAs, Le, mode) {
  const K = new Float64Array(36),
    J = Le / 2;
  for (const [xi, wt] of G3) {
    const { dN } = shp(xi),
      B = [0, dN[0] / J, 0, dN[1] / J, 0, dN[2] / J],
      c = wt * J * EI;
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) K[i * 6 + j] += c * B[i] * B[j];
  }
  for (const [xi, wt] of mode === 'full' ? G3 : G2) {
    const { N, dN } = shp(xi),
      B = [-dN[0] / J, N[0], -dN[1] / J, N[1], -dN[2] / J, N[2]],
      c = wt * J * GAs;
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) K[i * 6 + j] += c * B[i] * B[j];
  }
  return K;
}

function dofsOf(el) {
  return [2 * el[0], 2 * el[0] + 1, 2 * el[1], 2 * el[1] + 1, 2 * el[2], 2 * el[2] + 1];
}

function solveDense(K, f, n, fixed) {
  const free = [];
  for (let i = 0; i < n; i++) if (!fixed.has(i)) free.push(i);
  const m = free.length,
    A = new Float64Array(m * m),
    b = new Float64Array(m);
  for (let i = 0; i < m; i++) {
    b[i] = f[free[i]];
    for (let j = 0; j < m; j++) A[i * m + j] = K[free[i] * n + free[j]];
  }
  // Gauss-elimináció részleges főelemkereséssel
  for (let k = 0; k < m; k++) {
    let p = k,
      mx = Math.abs(A[k * m + k]);
    for (let i = k + 1; i < m; i++) {
      const v = Math.abs(A[i * m + k]);
      if (v > mx) {
        mx = v;
        p = i;
      }
    }
    if (mx < 1e-12) return { u: null, singular: true, freeDof: free[k] };
    if (p !== k) {
      for (let j = 0; j < m; j++) {
        const t = A[k * m + j];
        A[k * m + j] = A[p * m + j];
        A[p * m + j] = t;
      }
      const t = b[k];
      b[k] = b[p];
      b[p] = t;
    }
    for (let i = k + 1; i < m; i++) {
      const fct = A[i * m + k] / A[k * m + k];
      if (fct === 0) continue;
      for (let j = k; j < m; j++) A[i * m + j] -= fct * A[k * m + j];
      b[i] -= fct * b[k];
    }
  }
  const y = new Float64Array(m);
  for (let i = m - 1; i >= 0; i--) {
    let s = b[i];
    for (let j = i + 1; j < m; j++) s -= A[i * m + j] * y[j];
    y[i] = s / A[i * m + i];
  }
  const u = new Float64Array(n);
  for (let i = 0; i < m; i++) u[free[i]] = y[i];
  return { u, singular: false };
}

function assembleK(mesh, props, mode, EItan) {
  const n = mesh.nDof,
    K = new Float64Array(n * n);
  mesh.els.forEach((el, e) => {
    const EI = EItan ? EItan[e] : [props.EI, props.EI, props.EI];
    const ke = elemKTan(EI, props.GAs, mesh.Le, mode);
    const d = dofsOf(el);
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) K[d[i] * n + d[j]] += ke[i * 6 + j];
  });
  return K;
}

function elemKTan(EIgp, GAs, Le, mode) {
  const K = new Float64Array(36),
    J = Le / 2;
  G3.forEach(([xi, wt], g) => {
    const { dN } = shp(xi),
      B = [0, dN[0] / J, 0, dN[1] / J, 0, dN[2] / J],
      c = wt * J * EIgp[g];
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) K[i * 6 + j] += c * B[i] * B[j];
  });
  for (const [xi, wt] of mode === 'full' ? G3 : G2) {
    const { N, dN } = shp(xi),
      B = [-dN[0] / J, N[0], -dN[1] / J, N[1], -dN[2] / J, N[2]],
      c = wt * J * GAs;
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) K[i * 6 + j] += c * B[i] * B[j];
  }
  return K;
}

function strainsAt(u, el, xi, Le) {
  const J = Le / 2,
    { N, dN } = shp(xi),
    d = dofsOf(el);
  let kap = 0,
    gam = 0;
  for (let i = 0; i < 3; i++) {
    kap += (dN[i] / J) * u[d[2 * i + 1]];
    gam += -(dN[i] / J) * u[d[2 * i]] + N[i] * u[d[2 * i + 1]];
  }
  return { kap, gam };
}

// másodfokú extrapoláció a 3 Gauss-pontból tetszőleges xi-re
function extrap3(v, xi) {
  const p = [G3[0][0], G3[1][0], G3[2][0]];
  let s = 0;
  for (let i = 0; i < 3; i++) {
    let L = 1;
    for (let j = 0; j < 3; j++) if (j !== i) L *= (xi - p[j]) / (p[i] - p[j]);
    s += L * v[i];
  }
  return s;
}
function extrap2(v, xi) {
  const p = [G2[0][0], G2[1][0]];
  return (v[0] * (xi - p[1])) / (p[0] - p[1]) + (v[1] * (xi - p[0])) / (p[1] - p[0]);
}

function sampleFields(mesh, u, Mgp, Tgp, nSub, Mcap) {
  const cap = Mcap === undefined || !isFinite(Mcap) ? Infinity : Mcap;
  const out = { x: [], w: [], phi: [], M: [], T: [], jumps: [] };
  mesh.els.forEach((el, e) => {
    const xc = (mesh.x[el[0]] + mesh.x[el[2]]) / 2,
      d = dofsOf(el);
    for (let s = 0; s <= nSub; s++) {
      const xi = -1 + (2 * s) / nSub,
        { N } = shp(xi);
      let w = 0,
        ph = 0;
      for (let i = 0; i < 3; i++) {
        w += N[i] * u[d[2 * i]];
        ph += N[i] * u[d[2 * i + 1]];
      }
      out.x.push(xc + (xi * mesh.Le) / 2);
      out.w.push(w);
      out.phi.push(ph);
      // a Gauss-pontokból visszaadott nyomaték nem lépheti túl a képlékeny nyomatékot:
      // képlékeny elemben a másodfokú extrapoláció az elemszéleken túllőne
      const Mx = extrap3([Mgp[e][0], Mgp[e][1], Mgp[e][2]], xi);
      out.M.push(Math.max(-cap, Math.min(cap, Mx)));
      out.T.push(extrap2([Tgp[e][0], Tgp[e][1]], xi));
    }
  });
  // egyensúlyi maradék elemenként: dM/dx − T (a gyenge alakból csak közelítőleg teljesül)
  out.eqRes = 0;
  const dx = mesh.Le / nSub;
  mesh.els.forEach((el, e) => {
    const o = e * (nSub + 1);
    for (let i = 1; i < nSub; i++) {
      const dMdx = (out.M[o + i + 1] - out.M[o + i - 1]) / (2 * dx);
      const r = Math.min(Math.abs(dMdx - out.T[o + i]), Math.abs(dMdx + out.T[o + i]));
      if (r > out.eqRes) out.eqRes = r;
    }
  });
  for (let e = 1; e < mesh.els.length; e++) {
    const iL = e * (nSub + 1) - 1,
      iR = e * (nSub + 1);
    out.jumps.push({ x: out.x[iR], dM: Math.abs(out.M[iR] - out.M[iL]), dT: Math.abs(out.T[iR] - out.T[iL]) });
  }
  return out;
}

export function solveLinear(spec, props) {
  const mesh = buildMesh(spec);
  const K = assembleK(mesh, props, spec.integration, null);
  const f = loadVector(mesh, spec, props);
  const fixed = fixedDofs(mesh, spec);
  const { u, singular, freeDof } = solveDense(K, f, mesh.nDof, fixed);
  if (singular) return { ok: false, message: 'A szerkezet mechanizmus — nem elegendő megtámasztás (' + freeDof + '. szabadságfok).' };
  const Mgp = [],
    Tgp = [];
  mesh.els.forEach((el) => {
    Mgp.push(G3.map(([xi]) => props.EI * strainsAt(u, el, xi, mesh.Le).kap));
    Tgp.push(G2.map(([xi]) => props.GAs * strainsAt(u, el, xi, mesh.Le).gam));
  });
  const fields = sampleFields(mesh, u, Mgp, Tgp, 6);
  // reakciók
  const Ku = new Float64Array(mesh.nDof);
  for (let i = 0; i < mesh.nDof; i++) {
    let s = 0;
    for (let j = 0; j < mesh.nDof; j++) s += K[i * mesh.nDof + j] * u[j];
    Ku[i] = s;
  }
  const reactions = [];
  for (const s of spec.supports) {
    const n = nodeAt(mesh, s.r * spec.L);
    reactions.push({ x: mesh.x[n], R: Ku[2 * n] - f[2 * n], M: s.type === 'fixed' ? Ku[2 * n + 1] - f[2 * n + 1] : 0, type: s.type });
  }
  // a koncentrált erők / reakciók helyén a T-ugrás fizikai, nem diszkretizációs hiba
  const Tabs = fields.T.reduce((a, v) => Math.max(a, Math.abs(v)), 0);
  return {
    ok: true,
    mesh,
    u,
    f,
    fields,
    reactions,
    Mgp,
    Tgp,
    wmax: fields.w.reduce((a, v) => (Math.abs(v) > Math.abs(a) ? v : a), 0),
    Mmax: fields.M.reduce((a, v) => (Math.abs(v) > Math.abs(a) ? v : a), 0),
    Tmax: fields.T.reduce((a, v) => (Math.abs(v) > Math.abs(a) ? v : a), 0),
    errPct: Tabs > 0 ? (100 * fields.eqRes) / Tabs : 0,
    sumR: reactions.reduce((a, r) => a + r.R, 0),
    sumF: f.reduce((a, v, i) => (i % 2 === 0 ? a + v : a), 0),
  };
}

// --------------------------------------------------- rétegelt képlékeny mag
function newGPState(nL) {
  return { sig: new Float64Array(nL), alpha: new Float64Array(nL), epsP: new Float64Array(nL), kap: 0 };
}

// visszavetítés a diplomaterv 3.4.4 döntési táblázata szerint (1D, R-faktor)
function updateGP(st, kap, props, trial) {
  const L = props.layers,
    E = props.E,
    H = props.Hp,
    sY = props.sY;
  const dkap = kap - st.kap;
  let M = 0,
    EIt = 0,
    nYield = 0;
  for (let l = 0; l < L.length; l++) {
    const z = L[l].z,
      dEps = z * dkap;
    const s0 = st.sig[l],
      a0 = st.alpha[l];
    const sTr = s0 + E * dEps;
    const fy = Math.abs(sTr) - (sY + H * a0);
    let s = sTr,
      a = a0,
      ep = st.epsP[l],
      Et = E,
      yl = 0;
    if (fy > 0) {
      const dg = fy / (E + H),
        sg = Math.sign(sTr);
      s = sTr - E * dg * sg;
      a = a0 + dg;
      ep = st.epsP[l] + dg * sg;
      Et = (E * H) / (E + H);
      yl = 1;
    }
    trial.sig[l] = s;
    trial.alpha[l] = a;
    trial.epsP[l] = ep;
    trial.yl[l] = yl;
    if (yl) nYield++;
    M += s * L[l].b * z * L[l].t;
    EIt += Et * L[l].b * z * z * L[l].t;
  }
  return { M, EIt, nYield };
}

export function solveNonlinear(spec, props, opts) {
  const o = Object.assign({ dLambda: 0.05, lambdaMax: 3, tol: 1, iterMax: 25, iterMin: 3, algo: 'newton', minStep: 0.002 }, opts);
  const mesh = buildMesh(spec),
    n = mesh.nDof,
    nL = props.layers.length;
  const fRef = loadVector(mesh, spec, props);
  const fixed = fixedDofs(mesh, spec);
  const nEl = mesh.els.length;

  const gp = [],
    trialBuf = { sig: new Float64Array(nL), alpha: new Float64Array(nL), epsP: new Float64Array(nL), yl: new Uint8Array(nL) };
  for (let e = 0; e < nEl; e++) {
    gp.push([newGPState(nL), newGPState(nL), newGPState(nL)]);
  }

  let u = new Float64Array(n),
    lam = 0,
    dlam = o.dLambda;
  const history = [],
    convLog = [];
  let status = 'ok',
    steps = 0,
    totalIters = 0;

  const monitorDof = (() => {
    let best = 0,
      bv = 0;
    const lin = solveDense(assembleK(mesh, props, spec.integration, null), fRef, n, fixed);
    if (lin.u)
      for (let i = 0; i < n; i += 2)
        if (Math.abs(lin.u[i]) > bv) {
          bv = Math.abs(lin.u[i]);
          best = i;
        }
    return best;
  })();

  history.push({
    lam: 0,
    disp: 0,
    u: new Float64Array(n),
    M: new Array(nEl).fill(0).map(() => [0, 0, 0]),
    T: new Array(nEl).fill(0).map(() => [0, 0]),
    yieldFrac: new Array(nEl).fill(0),
    yieldGP: new Array(nEl * 3).fill(0),
    sig: new Float32Array(nEl * 3 * nL),
    iters: 0,
    res: 0,
  });

  const J = mesh.Le / 2;
  const evalState = (uu, commit) => {
    const p = new Float64Array(n),
      Mgp = [],
      Tgp = [],
      EIt = [],
      yieldGP = [];
    const sigSnap = commit ? new Float32Array(nEl * 3 * nL) : null;
    mesh.els.forEach((el, e) => {
      const d = dofsOf(el),
        Ms = [0, 0, 0],
        Ts = [0, 0],
        Es = [0, 0, 0],
        pe = new Float64Array(6);
      G3.forEach(([xi, wt], g) => {
        const { kap } = strainsAt(uu, el, xi, mesh.Le);
        const r = updateGP(gp[e][g], kap, props, trialBuf);
        Ms[g] = r.M;
        Es[g] = r.EIt;
        yieldGP.push(r.nYield / nL);
        if (commit) {
          gp[e][g].sig.set(trialBuf.sig);
          gp[e][g].alpha.set(trialBuf.alpha);
          gp[e][g].epsP.set(trialBuf.epsP);
          gp[e][g].kap = kap;
          for (let l = 0; l < nL; l++) sigSnap[(e * 3 + g) * nL + l] = trialBuf.sig[l];
        }
        const { dN } = shp(xi),
          B = [0, dN[0] / J, 0, dN[1] / J, 0, dN[2] / J];
        for (let i = 0; i < 6; i++) pe[i] += wt * J * B[i] * r.M;
      });
      G2.forEach(([xi, wt], g) => {
        const { gam } = strainsAt(uu, el, xi, mesh.Le);
        Ts[g] = props.GAs * gam;
        const { N, dN } = shp(xi),
          B = [-dN[0] / J, N[0], -dN[1] / J, N[1], -dN[2] / J, N[2]];
        for (let i = 0; i < 6; i++) pe[i] += wt * J * B[i] * Ts[g];
      });
      for (let i = 0; i < 6; i++) p[d[i]] += pe[i];
      Mgp.push(Ms);
      Tgp.push(Ts);
      EIt.push(Es);
    });
    return { p, Mgp, Tgp, EIt, yieldGP, sigSnap };
  };

  const snapshot = (uc) => {
    const gs = new Float64Array(n);
    for (let i = 0; i < n; i++) gs[i] = uc[i];
    return gs;
  };

  const saveState = () => gp.map((g) => g.map((s) => ({ sig: s.sig.slice(), alpha: s.alpha.slice(), epsP: s.epsP.slice(), kap: s.kap })));
  const restoreState = (S) => {
    for (let e = 0; e < nEl; e++)
      for (let g = 0; g < 3; g++) {
        gp[e][g].sig.set(S[e][g].sig);
        gp[e][g].alpha.set(S[e][g].alpha);
        gp[e][g].epsP.set(S[e][g].epsP);
        gp[e][g].kap = S[e][g].kap;
      }
  };

  let guard = 0;
  const path = o.path && o.path.length ? o.path.slice() : [{ to: o.lambdaMax }];
  let seg = 0;
  while (seg < path.length && guard++ < 1200) {
    const target = path[seg].to;
    if (Math.abs(target - lam) < 1e-9) {
      seg++;
      dlam = o.dLambda;
      continue;
    }
    const dir = target > lam ? 1 : -1;
    const uSave = snapshot(u),
      stSave = saveState(),
      lamSave = lam;
    let trial = lam + dir * dlam;
    if (dir > 0 ? trial > target : trial < target) trial = target;
    const f = new Float64Array(n);
    for (let i = 0; i < n; i++) f[i] = fRef[i] * trial;

    let cur = evalState(u, false);
    let converged = false,
      it = 0,
      stepLog = [];
    let KT = null;
    while (it < o.iterMax) {
      const psi = new Float64Array(n);
      for (let i = 0; i < n; i++) psi[i] = f[i] - cur.p[i];
      let nps = 0,
        nf = 0;
      for (let i = 0; i < n; i++)
        if (!fixed.has(i)) {
          nps += psi[i] * psi[i];
          nf += f[i] * f[i];
        }
      const res = nf > 1e-12 ? (100 * Math.sqrt(nps)) / Math.sqrt(nf) : Math.sqrt(nps) < 1e-8 ? 0 : 100;
      if (it > 0) stepLog.push(res);
      if (it > 0 && res <= o.tol) {
        converged = true;
        break;
      }
      if (o.algo === 'newton' || KT === null) KT = assembleK(mesh, props, spec.integration, cur.EIt);
      const sol = solveDense(KT, psi, n, fixed);
      if (!sol.u) {
        converged = false;
        break;
      }
      for (let i = 0; i < n; i++) u[i] += sol.u[i];
      cur = evalState(u, false);
      it++;
      totalIters++;
    }
    if (!converged) {
      u = uSave;
      restoreState(stSave);
      lam = lamSave;
      dlam = dlam / 2;
      if (dlam < o.minStep) {
        status = steps === 0 ? 'no-progress' : 'limit-load-reached';
        break;
      }
      convLog.push({ lam: trial, res: stepLog, halved: true });
      continue;
    }
    lam = trial;
    const fin = evalState(u, true);
    steps++;
    convLog.push({ lam, res: stepLog, halved: false });
    const yieldFrac = [];
    for (let e = 0; e < nEl; e++) yieldFrac.push(Math.max(fin.yieldGP[e * 3], fin.yieldGP[e * 3 + 1], fin.yieldGP[e * 3 + 2]));
    history.push({
      lam,
      disp: u[monitorDof],
      u: snapshot(u),
      M: fin.Mgp,
      T: fin.Tgp,
      yieldFrac,
      yieldGP: fin.yieldGP.slice(),
      sig: fin.sigSnap,
      iters: it,
      res: stepLog[stepLog.length - 1] || 0,
    });
    if (it < o.iterMin) dlam = Math.min(dlam * 1.5, o.dLambda * 2);
    if (Math.abs(lam - target) < 1e-9) {
      seg++;
      dlam = o.dLambda;
    }
  }

  const nSub = 6;
  const framesFields = history.map((h) => sampleFields(mesh, h.u, h.M, h.T, nSub, props.Mp * (props.Hp > 0 ? 1.4 : 1)));
  return {
    ok: true,
    mesh,
    history,
    framesFields,
    convLog,
    status,
    steps,
    totalIters,
    lambdaU: history.reduce((a, h) => Math.max(a, h.lam), 0),
    lambdaEnd: history[history.length - 1].lam,
    monitorDof,
    nL,
    fRef,
    path,
    monitorX: mesh.x[monitorDof / 2],
  };
}

// Sajátfeszültség-egyensúly (3.3, P-10): tehermentesített állapotban minden Gauss-pontban
// ∫σ dA = 0 és ∫σ·z dA = 0 kell legyen — a maradó feszültségek önmagukban egyensúlyt tartanak.
export function residualCheck(nl, props, frame) {
  const h = nl.history[Math.min(frame, nl.history.length - 1)],
    nL = props.layers.length;
  const nEl = nl.mesh.els.length;
  let resN = 0,
    resM = 0,
    normN = 0,
    normM = 0,
    sMax = 0;
  for (let e = 0; e < nEl; e++)
    for (let g = 0; g < 3; g++) {
      let sN = 0,
        sM = 0,
        aN = 0,
        aM = 0;
      for (let l = 0; l < nL; l++) {
        const s = h.sig[(e * 3 + g) * nL + l],
          A = props.layers[l].b * props.layers[l].t;
        sN += s * A;
        sM += s * A * props.layers[l].z;
        aN += Math.abs(s) * A;
        aM += Math.abs(s) * A * Math.abs(props.layers[l].z);
        if (Math.abs(s) > sMax) sMax = Math.abs(s);
      }
      resN = Math.max(resN, Math.abs(sN));
      resM = Math.max(resM, Math.abs(sM));
      normN = Math.max(normN, aN);
      normM = Math.max(normM, aM);
    }
  return {
    Npct: normN > 0 ? (100 * resN) / normN : 0,
    Mpct: normM > 0 ? (100 * resM) / normM : 0,
    MvsMp: props.Mp > 0 ? (100 * resM) / props.Mp : 0,
    sigMax: sMax / 1e4,
    unloaded: Math.abs(h.lam) < 1e-9,
  };
}

// ------------------------------------------------------------ analitikus ref
export function analytic(spec, props) {
  const { L } = spec,
    EI = props.EI,
    GAs = props.GAs,
    q = spec.load.q,
    P = spec.load.P,
    Mp = props.Mp;
  const s = spec.presetId;
  if (s === 'cantilever') return { w: (P * L ** 3) / (3 * EI) + (P * L) / GAs, label: 'w = PL³/3EI + PL/GAs', Pu: Mp / L, uLabel: 'Pᵤ = Mp/L' };
  if (s === 'simple')
    return {
      w: (5 * q * L ** 4) / (384 * EI) + (q * L * L) / (8 * GAs),
      label: 'w = 5qL⁴/384EI + qL²/8GAs',
      Pu: (8 * Mp) / (L * L),
      uLabel: 'qᵤ = 8Mp/L²',
    };
  if (s === 'simpleP')
    return { w: (P * L ** 3) / (48 * EI) + (P * L) / (4 * GAs), label: 'w = PL³/48EI + PL/4GAs', Pu: (4 * Mp) / L, uLabel: 'Pᵤ = 4Mp/L' };
  if (s === 'clamped')
    return { w: (q * L ** 4) / (384 * EI) + (q * L * L) / (8 * GAs), label: 'w = qL⁴/384EI', Pu: (16 * Mp) / (L * L), uLabel: 'qᵤ = 16Mp/L²' };
  if (s === 'twospan') return { w: null, label: '—', Pu: ((6 + 4 * Math.SQRT2) * Mp) / (L / 2) ** 2, uLabel: 'qᵤ = (6+4√2)Mp/ℓ²' };
  return { w: null, label: '—', Pu: null, uLabel: '—' };
}

// Gauss-pontok globális helye + görbület kiolvasása (inspektorhoz)
export function gpInfo(mesh) {
  const out = [];
  mesh.els.forEach((el, e) => {
    const xc = (mesh.x[el[0]] + mesh.x[el[2]]) / 2;
    G3.forEach(([xi], g) => out.push({ e, g, xi, x: xc + (xi * mesh.Le) / 2 }));
  });
  return out;
}
export function gpKappa(mesh, u, e, g) {
  return strainsAt(u, mesh.els[e], G3[g][0], mesh.Le).kap;
}

// h-konvergencia tanulmány a felület számára
export function meshStudy(spec, props, list) {
  return list.map((n) => {
    const s = Object.assign({}, spec, { nEl: n });
    const t0 = performance.now();
    const r = solveNonlinear(s, props, { dLambda: 0.1, lambdaMax: 6, tol: 0.1, minStep: 0.001, iterMax: 40 });
    return { nEl: n, lambdaU: r.lambdaU, ms: performance.now() - t0, steps: r.steps };
  });
}

export const fmt = (v, d = 3) => (v === null || v === undefined || !isFinite(v) ? '—' : Math.abs(v) < 1e-12 ? '0' : v.toFixed(d));
