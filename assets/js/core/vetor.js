// Núcleo geométrico da edição vetorial (REQ-VT, D-0057) — lógica PURA: sem DOM, sem relógio, sem rede.
//
// Modelo (§4.2 do REQ-VT): um caminho é uma lista de SUBCAMINHOS `{ fechado, pts }`; cada ponto é `{ x, y, tipo, ei, di }`, onde `ei` e `di` são as
// alças de ENTRADA e de SAÍDA, RELATIVAS ao ponto, no sistema do `vb`. Alça ausente = segmento reto daquele lado. `tipo` (canto · suave · simetrico) só
// diz como a tela se comporta ao arrastar uma alça; o `d` não o guarda. `d` continua sendo a verdade de DESENHO (quem renderiza só lê `d`) e `nos` a
// de EDIÇÃO: se `nos` faltar, deriva-se de `d` (nosDeCaminho).
//
// Referência a um ponto: `{ sub, i }` (índice do subcaminho e do ponto). Referência a um segmento: `{ sub, seg }` — o segmento `seg` vai do ponto `seg` ao
// `seg + 1`; num subcaminho fechado o último segmento (`seg = n - 1`) volta ao ponto 0.
import { lerCaminho } from './puppet.js';

export const PONTOS_POR_ELEMENTO = 5000;
export const TIPOS = ['canto', 'suave', 'simetrico'];
const EPS = 1e-9;
const K_ELIPSE = 0.5522847498;                    // constante da cúbica que aproxima um quarto de círculo

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const norma = (v) => Math.hypot(v[0], v[1]);
const clone = (o) => JSON.parse(JSON.stringify(o));
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const temAlca = (v) => Array.isArray(v) && norma(v) > EPS;

// ---------- ler e escrever ----------

// Arco do SVG (ponto final) → cúbicas (até uma por quarto de volta; spec SVG F.6.5). Arco degenerado vira reta.
export function arcoParaCubicas(x1, y1, a) {
  let rx = Math.abs(a.rx), ry = Math.abs(a.ry);
  if (!rx || !ry || (x1 === a.x && y1 === a.y)) return [{ c: 'L', x: a.x, y: a.y }];
  const phi = ((a.rot || 0) * Math.PI) / 180, cos = Math.cos(phi), sin = Math.sin(phi);
  const dx = (x1 - a.x) / 2, dy = (y1 - a.y) / 2;
  const x1p = cos * dx + sin * dy, y1p = -sin * dx + cos * dy;
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) { const s = Math.sqrt(lam); rx *= s; ry *= s; }
  const sinal = !!a.grande !== !!a.varre ? 1 : -1;
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p, den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const co = sinal * Math.sqrt(Math.max(0, num / den));
  const cxp = (co * rx * y1p) / ry, cyp = (-co * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + a.x) / 2, cy = sin * cxp + cos * cyp + (y1 + a.y) / 2;
  const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const th1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dth = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!a.varre && dth > 0) dth -= 2 * Math.PI; else if (a.varre && dth < 0) dth += 2 * Math.PI;
  const n = Math.max(1, Math.ceil(Math.abs(dth) / (Math.PI / 2) - 1e-9)), d = dth / n, t = (4 / 3) * Math.tan(d / 4);
  const P = (u) => [cos * rx * Math.cos(u) - sin * ry * Math.sin(u) + cx, sin * rx * Math.cos(u) + cos * ry * Math.sin(u) + cy];
  const D = (u) => [-cos * rx * Math.sin(u) - sin * ry * Math.cos(u), -sin * rx * Math.sin(u) + cos * ry * Math.cos(u)];
  const out = [];
  for (let i = 0; i < n; i++) {
    const u1 = th1 + i * d, u2 = u1 + d, p1 = P(u1), p2 = P(u2), d1 = D(u1), d2 = D(u2);
    out.push({ c: 'C', x1: p1[0] + t * d1[0], y1: p1[1] + t * d1[1], x2: p2[0] - t * d2[0], y2: p2[1] - t * d2[1], x: i === n - 1 ? a.x : p2[0], y: i === n - 1 ? a.y : p2[1] });
  }
  return out;
}

// Segmentos só com M L C Z: a quadrática vira cúbica (exato) e o arco vira cúbicas (aproximação abaixo de 0,01 px nos tamanhos da página).
export function normalizarSegmentos(segs) {
  const out = []; let cx = 0, cy = 0, ix = 0, iy = 0;
  for (const s of segs || []) {
    if (s.c === 'M') { out.push({ c: 'M', x: s.x, y: s.y }); cx = ix = s.x; cy = iy = s.y; }
    else if (s.c === 'L') { out.push({ c: 'L', x: s.x, y: s.y }); cx = s.x; cy = s.y; }
    else if (s.c === 'C') { out.push({ c: 'C', x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, x: s.x, y: s.y }); cx = s.x; cy = s.y; }
    else if (s.c === 'Q') {
      out.push({ c: 'C', x1: cx + (2 / 3) * (s.x1 - cx), y1: cy + (2 / 3) * (s.y1 - cy), x2: s.x + (2 / 3) * (s.x1 - s.x), y2: s.y + (2 / 3) * (s.y1 - s.y), x: s.x, y: s.y });
      cx = s.x; cy = s.y;
    } else if (s.c === 'A') { for (const k of arcoParaCubicas(cx, cy, s)) out.push(k); cx = s.x; cy = s.y; }
    else if (s.c === 'Z') { out.push({ c: 'Z' }); cx = ix; cy = iy; }
  }
  return out;
}

const fmt = (n, casas) => String(+(+n).toFixed(casas) + 0);
export function escreverCaminho(segs, casas = 2) {
  const f = (n) => fmt(n, casas);
  return segs.map((s) => (s.c === 'Z' ? 'Z' : s.c === 'M' || s.c === 'L' ? `${s.c}${f(s.x)} ${f(s.y)}` : `C${f(s.x1)} ${f(s.y1)} ${f(s.x2)} ${f(s.y2)} ${f(s.x)} ${f(s.y)}`)).join('');
}

function inferirTipo(p) {
  if (!temAlca(p.ei) || !temAlca(p.di)) return 'canto';
  const cruz = p.ei[0] * p.di[1] - p.ei[1] * p.di[0], pont = p.ei[0] * p.di[0] + p.ei[1] * p.di[1];
  const ne = norma(p.ei), nd = norma(p.di);
  if (Math.abs(cruz) > 0.01 * ne * nd || pont > 0) return 'canto';              // não colineares, ou do mesmo lado
  return Math.abs(ne - nd) <= 0.01 * Math.max(ne, nd) ? 'simetrico' : 'suave';
}

// d → nos. Subcaminho fechado cujo último ponto coincide com o primeiro vira um ponto só (a alça de entrada passa para o primeiro).
export function nosDeCaminho(d) {
  const segs = normalizarSegmentos(lerCaminho(d));
  const subs = []; let sub = null;
  for (const s of segs) {
    if (s.c === 'M') { sub = { fechado: false, pts: [{ x: s.x, y: s.y }] }; subs.push(sub); }
    else if (!sub) continue;
    else if (s.c === 'L') sub.pts.push({ x: s.x, y: s.y });
    else if (s.c === 'C') {
      const prev = sub.pts[sub.pts.length - 1], di = [s.x1 - prev.x, s.y1 - prev.y], ei = [s.x2 - s.x, s.y2 - s.y];
      if (temAlca(di)) prev.di = di;
      const pt = { x: s.x, y: s.y }; if (temAlca(ei)) pt.ei = ei;
      sub.pts.push(pt);
    } else if (s.c === 'Z') {
      sub.fechado = true;
      const a = sub.pts[0], b = sub.pts[sub.pts.length - 1];
      if (sub.pts.length > 1 && Math.hypot(a.x - b.x, a.y - b.y) < 1e-6) { if (b.ei) a.ei = b.ei; sub.pts.pop(); }
      sub = null;
    }
  }
  const nos = subs.filter((s) => s.pts.length >= 1);
  for (const s of nos) for (const p of s.pts) p.tipo = inferirTipo(p);
  return nos;
}

// Segmentos de um caminho de nós: { sub, seg, p, q, c1, c2, curva }. `c1`/`c2` são pontos absolutos de controle.
export function* segmentos(nos) {
  for (let si = 0; si < nos.length; si++) {
    const { pts, fechado } = nos[si], n = pts.length, total = fechado && n > 1 ? n : n - 1;
    for (let i = 0; i < total; i++) {
      const p = pts[i], q = pts[(i + 1) % n], curva = temAlca(p.di) || temAlca(q.ei);
      yield { sub: si, seg: i, p, q, curva, c1: { x: p.x + (p.di?.[0] || 0), y: p.y + (p.di?.[1] || 0) }, c2: { x: q.x + (q.ei?.[0] || 0), y: q.y + (q.ei?.[1] || 0) } };
    }
  }
}

// nos → d. Determinístico (mesma entrada, mesma saída), 2 casas decimais por padrão.
export function caminhoDeNos(nos, casas = 2) {
  const out = [];
  for (const { pts, fechado } of nos) {
    if (!pts.length) continue;
    out.push({ c: 'M', x: pts[0].x, y: pts[0].y });
    const n = pts.length;
    for (let i = 1; i < n; i++) out.push(passo(pts[i - 1], pts[i]));
    if (fechado && n > 1) { const p = pts[n - 1], q = pts[0]; if (temAlca(p.di) || temAlca(q.ei)) out.push(passo(p, q)); }
    if (fechado) out.push({ c: 'Z' });
  }
  return escreverCaminho(out, casas);
}
function passo(p, q) {
  if (!temAlca(p.di) && !temAlca(q.ei)) return { c: 'L', x: q.x, y: q.y };
  return { c: 'C', x1: p.x + (p.di?.[0] || 0), y1: p.y + (p.di?.[1] || 0), x2: q.x + (q.ei?.[0] || 0), y2: q.y + (q.ei?.[1] || 0), x: q.x, y: q.y };
}

// ---------- validação (VT-03) ----------
// `nos` pode vir de fora (projeto importado, página publicada): cada campo é conferido e o que não presta cai no padrão — nunca vira texto.
export function lerNos(bruto, { max = PONTOS_POR_ELEMENTO } = {}) {
  if (!Array.isArray(bruto)) return null;
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const alca = (v) => (Array.isArray(v) && num(v[0]) !== null && num(v[1]) !== null && Math.hypot(v[0], v[1]) > EPS ? [v[0], v[1]] : null);
  const out = []; let total = 0;
  for (const s of bruto) {
    if (!s || typeof s !== 'object' || !Array.isArray(s.pts)) continue;
    const pts = [];
    for (const p of s.pts) {
      if (!p || typeof p !== 'object' || num(p.x) === null || num(p.y) === null) continue;
      if (++total > max) return null;
      const q = { x: p.x, y: p.y, tipo: TIPOS.includes(p.tipo) ? p.tipo : 'canto' };
      const ei = alca(p.ei), di = alca(p.di);
      if (ei) q.ei = ei; if (di) q.di = di;
      pts.push(q);
    }
    if (pts.length) out.push({ fechado: s.fechado === true, pts });
  }
  return out.length ? out : null;
}
export const contarPontos = (nos) => (nos || []).reduce((n, s) => n + s.pts.length, 0);
// Os nós de um elemento `path`: os guardados (validados) ou, se faltarem ou estiverem estragados, os derivados de `d`.
export const nosDoElemento = (el) => lerNos(el?.nos) || nosDeCaminho(el?.d || '');

// ---------- geometria ----------
const raizes = (a, b, c) => {                      // a t² + b t + c = 0 em (0, 1)
  if (Math.abs(a) < EPS) return Math.abs(b) < EPS ? [] : [-c / b].filter((t) => t > 0 && t < 1);
  const disc = b * b - 4 * a * c;
  if (disc < 0) return [];
  const r = Math.sqrt(disc);
  return [(-b + r) / (2 * a), (-b - r) / (2 * a)].filter((t) => t > 0 && t < 1);
};
const cubica = (p0, p1, p2, p3, t) => { const u = 1 - t; return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3; };

// Caixa EXATA (inclui o ponto mais alto da curva, não só os pontos de controle). Devolve { x, y, w, h } ou null.
export function caixaDeNos(nos) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const ponto = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  for (const s of nos || []) for (const p of s.pts) ponto(p.x, p.y);
  for (const g of segmentos(nos || [])) {
    if (!g.curva) continue;
    for (const eixo of ['x', 'y']) {
      const p0 = g.p[eixo], p1 = g.c1[eixo], p2 = g.c2[eixo], p3 = g.q[eixo];
      const A = -p0 + 3 * p1 - 3 * p2 + p3, B = 2 * (p0 - 2 * p1 + p2), C = p1 - p0;
      for (const t of raizes(A, B, C)) ponto(cubica(g.p.x, g.c1.x, g.c2.x, g.q.x, t), cubica(g.p.y, g.c1.y, g.c2.y, g.q.y, t));
    }
  }
  return Number.isFinite(x0) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

// Ponto da curva do segmento em t (reta ou cúbica).
export const pontoNoSegmento = (g, t) => (g.curva
  ? { x: cubica(g.p.x, g.c1.x, g.c2.x, g.q.x, t), y: cubica(g.p.y, g.c1.y, g.c2.y, g.q.y, t) }
  : lerp(g.p, g.q, t));

// Caminho achatado em linhas poligonais (para desenhar, medir e acertar): [{ pts:[{x,y}], fechado }].
export function achatar(nos, passos = 16) {
  const out = nos.map((s) => ({ pts: [], fechado: s.fechado }));
  for (const g of segmentos(nos)) {
    const L = out[g.sub].pts;
    if (!L.length) L.push({ x: g.p.x, y: g.p.y });
    const n = g.curva ? passos : 1;
    for (let k = 1; k <= n; k++) L.push(pontoNoSegmento(g, k / n));
  }
  for (let i = 0; i < nos.length; i++) if (!out[i].pts.length && nos[i].pts[0]) out[i].pts.push({ x: nos[i].pts[0].x, y: nos[i].pts[0].y });
  return out;
}

// Ponto do caminho mais próximo de (x, y): { sub, seg, t, x, y, dist } ou null.
export function maisProximo(nos, ponto) {
  let melhor = null;
  const d2 = (p) => (p.x - ponto.x) ** 2 + (p.y - ponto.y) ** 2;
  for (const g of segmentos(nos)) {
    const N = g.curva ? 32 : 1;
    let bt = 0, bd = Infinity;
    for (let k = 0; k <= N; k++) { const dd = d2(pontoNoSegmento(g, k / N)); if (dd < bd) { bd = dd; bt = k / N; } }
    if (g.curva) {                                                              // refina em volta do melhor passo
      let a = Math.max(0, bt - 1 / N), b = Math.min(1, bt + 1 / N);
      for (let i = 0; i < 24; i++) { const m1 = a + (b - a) / 3, m2 = b - (b - a) / 3; if (d2(pontoNoSegmento(g, m1)) < d2(pontoNoSegmento(g, m2))) b = m2; else a = m1; }
      bt = (a + b) / 2; bd = d2(pontoNoSegmento(g, bt));
    } else {                                                                    // reta: projeção exata
      const vx = g.q.x - g.p.x, vy = g.q.y - g.p.y, L2 = vx * vx + vy * vy;
      bt = L2 ? Math.max(0, Math.min(1, ((ponto.x - g.p.x) * vx + (ponto.y - g.p.y) * vy) / L2)) : 0; bd = d2(pontoNoSegmento(g, bt));
    }
    if (!melhor || bd < melhor.d2) { const p = pontoNoSegmento(g, bt); melhor = { sub: g.sub, seg: g.seg, t: bt, x: p.x, y: p.y, d2: bd }; }
  }
  return melhor ? { sub: melhor.sub, seg: melhor.seg, t: melhor.t, x: melhor.x, y: melhor.y, dist: Math.sqrt(melhor.d2) } : null;
}

// O ponto está dentro do preenchimento? (regra 'nonzero' ou 'evenodd'; o preenchimento fecha todo subcaminho)
export function dentro(nos, x, y, regra = 'nonzero') {
  let giro = 0, cruza = 0;
  for (const { pts } of achatar(nos)) {
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if ((a.y <= y) !== (b.y <= y)) {
        const t = (y - a.y) / (b.y - a.y), xi = a.x + t * (b.x - a.x);
        if (xi > x) { cruza++; giro += b.y > a.y ? 1 : -1; }
      }
    }
  }
  return regra === 'evenodd' ? cruza % 2 === 1 : giro !== 0;
}

export function comprimento(nos) {
  let L = 0;
  for (const { pts } of achatar(nos, 24)) for (let i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]);
  return L;
}

// ---------- edição (mexem em `nos` no lugar) ----------
const pt = (nos, r) => nos[r.sub]?.pts[r.i];
const vizinhos = (nos, r) => {
  const s = nos[r.sub], n = s.pts.length;
  const a = r.i > 0 ? s.pts[r.i - 1] : s.fechado && n > 1 ? s.pts[n - 1] : null;
  const b = r.i < n - 1 ? s.pts[r.i + 1] : s.fechado && n > 1 ? s.pts[0] : null;
  return [a, b];
};
const unit = (v) => { const n = norma(v); return n > EPS ? [v[0] / n, v[1] / n] : [0, 0]; };

export function moverPonto(nos, r, dx, dy) { const p = pt(nos, r); if (p) { p.x += dx; p.y += dy; } }

// Move uma alça. Suave: a oposta gira junto e mantém o comprimento; simétrico: espelha também o comprimento; Alt (quebrar) desliga a regra no gesto.
export function moverAlca(nos, r, lado, rel, { quebrar = false } = {}) {
  const p = pt(nos, r); if (!p || (lado !== 'ei' && lado !== 'di')) return;
  const outro = lado === 'ei' ? 'di' : 'ei';
  if (norma(rel) > EPS) p[lado] = [rel[0], rel[1]]; else delete p[lado];
  if (quebrar || p.tipo === 'canto' || !p.tipo) return;
  if (p.tipo === 'simetrico') { if (p[lado]) p[outro] = [-rel[0], -rel[1]]; else delete p[outro]; }
  else if (p.tipo === 'suave' && p[outro] && p[lado]) { const len = norma(p[outro]), u = unit(rel); p[outro] = [-u[0] * len, -u[1] * len]; }
}

// Muda o tipo do ponto. Canto → suave NÃO mexe no desenho (só passa a espelhar no próximo arrasto); ponto sem alças ganha alças de um terço do segmento.
export function converterTipo(nos, r, tipo) {
  const p = pt(nos, r); if (!p || !TIPOS.includes(tipo)) return;
  p.tipo = tipo;
  if (tipo === 'canto') return;
  const [a, b] = vizinhos(nos, r);
  if (!temAlca(p.ei) && !temAlca(p.di)) {
    let dir = null;
    if (a && b) dir = unit([b.x - a.x, b.y - a.y]); else if (b) dir = unit([b.x - p.x, b.y - p.y]); else if (a) dir = unit([p.x - a.x, p.y - a.y]);
    if (!dir) return;
    if (b) p.di = [dir[0] * dist(p, b) / 3, dir[1] * dist(p, b) / 3];
    if (a) p.ei = [-dir[0] * dist(p, a) / 3, -dir[1] * dist(p, a) / 3];
  } else if (tipo === 'simetrico') {
    const ne = temAlca(p.ei) ? norma(p.ei) : null, nd = temAlca(p.di) ? norma(p.di) : null;
    const len = ne !== null && nd !== null ? (ne + nd) / 2 : ne ?? nd;
    const u = temAlca(p.di) ? unit(p.di) : unit([-p.ei[0], -p.ei[1]]);
    p.di = [u[0] * len, u[1] * len]; p.ei = [-u[0] * len, -u[1] * len];
  }
}

// Acrescenta um ponto no segmento SEM mudar a forma (Casteljau). Devolve a referência do ponto novo.
export function adicionarPonto(nos, ref, t) {
  const s = nos[ref.sub]; if (!s) return null;
  const n = s.pts.length;
  if (ref.seg < 0 || ref.seg >= (s.fechado ? n : n - 1) || !(t > 0 && t < 1)) return null;
  const p = s.pts[ref.seg], q = s.pts[(ref.seg + 1) % n];
  const curva = temAlca(p.di) || temAlca(q.ei);
  let novo;
  if (!curva) { const m = lerp(p, q, t); novo = { x: m.x, y: m.y, tipo: 'canto' }; }
  else {
    const P1 = { x: p.x + (p.di?.[0] || 0), y: p.y + (p.di?.[1] || 0) }, P2 = { x: q.x + (q.ei?.[0] || 0), y: q.y + (q.ei?.[1] || 0) };
    const q0 = lerp(p, P1, t), q1 = lerp(P1, P2, t), q2 = lerp(P2, q, t), r0 = lerp(q0, q1, t), r1 = lerp(q1, q2, t), m = lerp(r0, r1, t);
    if (norma([q0.x - p.x, q0.y - p.y]) > EPS) p.di = [q0.x - p.x, q0.y - p.y]; else delete p.di;
    if (norma([q2.x - q.x, q2.y - q.y]) > EPS) q.ei = [q2.x - q.x, q2.y - q.y]; else delete q.ei;
    novo = { x: m.x, y: m.y, tipo: 'suave', ei: [r0.x - m.x, r0.y - m.y], di: [r1.x - m.x, r1.y - m.y] };
  }
  const at = ref.seg + 1;
  s.pts.splice(at, 0, novo);
  return { sub: ref.sub, i: at };
}

// Apaga um ponto. `manterForma`: refaz as alças dos vizinhos para o desenho ficar o mais parecido possível; senão os vizinhos ficam ligados em reta.
// Devolve false se não apagou. Subcaminho que fica com menos de 2 pontos some; se não sobra nada, `nos` fica vazio (quem chama apaga o elemento).
export function apagarPonto(nos, ref, { manterForma = true } = {}) {
  const s = nos[ref.sub], p = pt(nos, ref); if (!p) return false;
  const [a, b] = vizinhos(nos, ref);
  if (a && b && a !== b) {
    const curvo = temAlca(a.di) || temAlca(p.ei) || temAlca(p.di) || temAlca(b.ei);
    if (manterForma && curvo) {
      const gA = { p: a, q: p, curva: true, c1: { x: a.x + (a.di?.[0] || 0), y: a.y + (a.di?.[1] || 0) }, c2: { x: p.x + (p.ei?.[0] || 0), y: p.y + (p.ei?.[1] || 0) } };
      const gB = { p, q: b, curva: true, c1: { x: p.x + (p.di?.[0] || 0), y: p.y + (p.di?.[1] || 0) }, c2: { x: b.x + (b.ei?.[0] || 0), y: b.y + (b.ei?.[1] || 0) } };
      const len = (g) => { let L = 0, ant = g.p; for (let k = 1; k <= 24; k++) { const m = pontoNoSegmento(g, k / 24); L += dist(ant, m); ant = m; } return L; };
      // Se o ponto nasceu de uma subdivisão (Casteljau), as alças dele dividem na razão exata t = |ei| / (|ei| + |di|); senão, pelo comprimento dos dois trechos.
      const ne = temAlca(p.ei) ? norma(p.ei) : 0, nd = temAlca(p.di) ? norma(p.di) : 0;
      const LA = len(gA), LB = len(gB), razao = ne > 0 && nd > 0 ? ne / (ne + nd) : LA / (LA + LB || 1), r = Math.min(0.95, Math.max(0.05, razao));
      const c1 = [(gA.c1.x - a.x) / r, (gA.c1.y - a.y) / r], c2 = [(gB.c2.x - b.x) / (1 - r), (gB.c2.y - b.y) / (1 - r)];
      if (norma(c1) > EPS) a.di = c1; else delete a.di;
      if (norma(c2) > EPS) b.ei = c2; else delete b.ei;
    } else if (!manterForma) { delete a.di; delete b.ei; }
  } else if (a && !b) delete a.di; else if (b && !a) delete b.ei;
  s.pts.splice(ref.i, 1);
  if (s.pts.length < 2) nos.splice(ref.sub, 1);
  return true;
}

export function inverter(nos, sub) {
  const s = nos[sub]; if (!s) return false;
  const pts = s.pts.slice().reverse().map((p) => { const q = { ...p }; const ei = p.di, di = p.ei; delete q.ei; delete q.di; if (ei) q.ei = ei; if (di) q.di = di; return q; });
  if (s.fechado && pts.length > 1) pts.unshift(pts.pop());                    // o ponto inicial continua sendo o primeiro
  s.pts = pts;
  return true;
}
export function alternarFechado(nos, sub) { const s = nos[sub]; if (!s || s.pts.length < 2) return false; s.fechado = !s.fechado; return true; }

// Corta no ponto: aberto → dois subcaminhos que repartem o ponto; fechado → um aberto que começa e termina nele.
export function dividir(nos, ref) {
  const s = nos[ref.sub], p = pt(nos, ref); if (!p) return false;
  const n = s.pts.length;
  if (s.fechado) {
    const girado = [...s.pts.slice(ref.i), ...s.pts.slice(0, ref.i)].map((q) => ({ ...q }));
    const fim = { ...girado[0] }; delete fim.di; const ini = girado[0]; delete ini.ei;
    nos[ref.sub] = { fechado: false, pts: [...girado, fim] };
    return true;
  }
  if (ref.i <= 0 || ref.i >= n - 1) return false;
  const esq = s.pts.slice(0, ref.i + 1).map((q) => ({ ...q })), dir = s.pts.slice(ref.i).map((q) => ({ ...q }));
  delete esq[esq.length - 1].di; delete dir[0].ei;
  nos.splice(ref.sub, 1, { fechado: false, pts: esq }, { fechado: false, pts: dir });
  return true;
}

// Junta o FIM do subcaminho `a` ao COMEÇO do `b` (dois abertos). Pontas coincidentes viram um ponto só.
export function juntar(nos, a, b) {
  const A = nos[a], B = nos[b];
  if (!A || !B || a === b || A.fechado || B.fechado) return false;
  const fim = A.pts[A.pts.length - 1], ini = B.pts[0];
  const pts = A.pts.concat(dist(fim, ini) < 1e-6 ? (() => { if (ini.di) fim.di = ini.di; return B.pts.slice(1); })() : B.pts);
  nos[Math.min(a, b)] = { fechado: false, pts };
  nos.splice(Math.max(a, b), 1);
  return true;
}

// ---------- o elemento: reencaixe da caixa (§4.5) ----------
// Depois de uma edição a caixa exata pode mudar: atualiza `vb` e TODOS os frames do elemento para nenhum ponto sair do lugar na tela, também com o
// elemento girado (ele gira em torno do centro do frame), e reescreve `nos` e `d`. Devolve se algo mudou de lugar.
export function reencaixar(el, { minimo = 1 } = {}) {
  const nos = el.nos; if (!nos?.length) return false;
  const caixa = caixaDeNos(nos); if (!caixa) return false;
  let { x: bx, y: by, w: bw, h: bh } = caixa;
  if (bw < minimo) { bx -= (minimo - bw) / 2; bw = minimo; }
  if (bh < minimo) { by -= (minimo - bh) / 2; bh = minimo; }
  const vb = el.vb || [bw, bh], mudou = Math.abs(bx) > 1e-9 || Math.abs(by) > 1e-9 || Math.abs(bw - vb[0]) > 1e-9 || Math.abs(bh - vb[1]) > 1e-9;
  if (mudou) {
    for (const k of Object.keys(el.f || {})) {
      const fr = el.f[k]; if (!fr || !(fr.w > 0 && fr.h > 0)) continue;
      const sx = fr.w / vb[0], sy = fr.h / vb[1], a = ((fr.r || 0) * Math.PI) / 180;
      const ox = (bx + bw / 2) * sx - fr.w / 2, oy = (by + bh / 2) * sy - fr.h / 2;           // centro da caixa nova, relativo ao centro do frame
      const cx = fr.x + fr.w / 2 + ox * Math.cos(a) - oy * Math.sin(a), cy = fr.y + fr.h / 2 + ox * Math.sin(a) + oy * Math.cos(a);
      fr.w = bw * sx; fr.h = bh * sy; fr.x = cx - fr.w / 2; fr.y = cy - fr.h / 2;
    }
    for (const s of nos) for (const p of s.pts) { p.x -= bx; p.y -= by; }
    el.vb = [bw, bh];
  }
  el.d = caminhoDeNos(nos);
  return mudou;
}

// Posição na tela (px de página) de um ponto do `vb`, para o frame dado — a conta que o reencaixe tem de preservar (e o teste confere).
export function posicaoNaPagina(el, frame, x, y) {
  const fr = el.f[frame], sx = fr.w / el.vb[0], sy = fr.h / el.vb[1], a = ((fr.r || 0) * Math.PI) / 180;
  const lx = x * sx - fr.w / 2, ly = y * sy - fr.h / 2;
  return { x: fr.x + fr.w / 2 + lx * Math.cos(a) - ly * Math.sin(a), y: fr.y + fr.h / 2 + lx * Math.sin(a) + ly * Math.cos(a) };
}

// O inverso de posicaoNaPagina: de um ponto da página para o sistema do `vb`, no frame dado.
export function vbDePagina(el, frame, px, py) {
  const fr = el.f[frame], sx = fr.w / el.vb[0], sy = fr.h / el.vb[1], a = ((fr.r || 0) * Math.PI) / 180;
  const dx = px - (fr.x + fr.w / 2), dy = py - (fr.y + fr.h / 2);
  const lx = dx * Math.cos(a) + dy * Math.sin(a) + fr.w / 2, ly = -dx * Math.sin(a) + dy * Math.cos(a) + fr.h / 2;
  return { x: lx / sx, y: ly / sy };
}

// ---------- forma → caminho (VT-12) ----------
const ngonPts = (cx, cy, rx, ry, n, rot = -Math.PI / 2, inner = 1) => {
  const passos = inner === 1 ? n : n * 2, out = [];
  for (let i = 0; i < passos; i++) { const k = inner === 1 ? 1 : i % 2 ? inner : 1, a = rot + (i * 2 * Math.PI) / passos; out.push({ x: cx + Math.cos(a) * rx * k, y: cy + Math.sin(a) * ry * k }); }
  return out;
};
const fechadoDe = (pts) => [{ fechado: true, pts: pts.map((p) => ({ ...p, tipo: p.tipo || 'canto' })) }];

// Nós de uma forma do editor (as 17 de SHAPE_LIST) no tamanho w × h, com a mesma geometria do desenho (traço para dentro, como em render.js › shapeSvg).
// `normas` = os caminhos 100 × 100 de render.js › NORM. Devolve { nos, vb, estilo, perdas } ou null se a forma não existe.
export function nosDeForma(forma, w, h, { s = {}, normas = {} } = {}) {
  const sw = +s.sw || 0, i = sw / 2, iw = Math.max(1, w - sw), ih = Math.max(1, h - sw);
  const cx = w / 2, cy = h / 2, perdas = [];
  let nos = null, aberta = false;
  switch (forma) {
    case 'rect': {
      const r = Math.min(+s.radius || 0, iw / 2, ih / 2), x0 = i, y0 = i, x1 = w - i, y1 = h - i;
      if (r <= 0) nos = fechadoDe([{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]);
      else {
        const k = K_ELIPSE * r;
        nos = fechadoDe([
          { x: x0 + r, y: y0, ei: [-k, 0] }, { x: x1 - r, y: y0, di: [k, 0] }, { x: x1, y: y0 + r, ei: [0, -k] }, { x: x1, y: y1 - r, di: [0, k] },
          { x: x1 - r, y: y1, ei: [k, 0] }, { x: x0 + r, y: y1, di: [-k, 0] }, { x: x0, y: y1 - r, ei: [0, k] }, { x: x0, y: y0 + r, di: [0, -k] },
        ]);
        for (const p of nos[0].pts) if (!p.ei && !p.di) p.tipo = 'canto';
      }
      break;
    }
    case 'ellipse': {
      const rx = iw / 2, ry = ih / 2, kx = K_ELIPSE * rx, ky = K_ELIPSE * ry;
      nos = fechadoDe([
        { x: cx, y: i, ei: [-kx, 0], di: [kx, 0], tipo: 'simetrico' }, { x: w - i, y: cy, ei: [0, -ky], di: [0, ky], tipo: 'simetrico' },
        { x: cx, y: h - i, ei: [kx, 0], di: [-kx, 0], tipo: 'simetrico' }, { x: i, y: cy, ei: [0, ky], di: [0, -ky], tipo: 'simetrico' },
      ]);
      break;
    }
    case 'triangle': nos = fechadoDe([{ x: cx, y: i }, { x: w - i, y: h - i }, { x: i, y: h - i }]); break;
    case 'diamond': nos = fechadoDe([{ x: cx, y: i }, { x: w - i, y: cy }, { x: cx, y: h - i }, { x: i, y: cy }]); break;
    case 'star': nos = fechadoDe(ngonPts(cx, cy, iw / 2, ih / 2, Math.max(3, s.sides | 0), -Math.PI / 2, s.inner ?? 0.45)); break;
    case 'polygon': nos = fechadoDe(ngonPts(cx, cy, iw / 2, ih / 2, Math.max(3, s.sides | 0))); break;
    case 'line': aberta = true; nos = [{ fechado: false, pts: [{ x: i + 2, y: cy, tipo: 'canto' }, { x: w - i - 2, y: cy, tipo: 'canto' }] }]; break;
    case 'arrow': {
      aberta = true;
      const hd = Math.min(h / 2 - 2, w / 3, 40);
      nos = [
        { fechado: false, pts: [{ x: i + 2, y: cy, tipo: 'canto' }, { x: w - 4, y: cy, tipo: 'canto' }] },
        { fechado: false, pts: [{ x: w - 4 - hd, y: cy - hd, tipo: 'canto' }, { x: w - 4, y: cy, tipo: 'canto' }, { x: w - 4 - hd, y: cy + hd, tipo: 'canto' }] },
      ];
      break;
    }
    default: {
      if (!normas[forma]) return null;
      const sx = iw / 100, sy = ih / 100;
      nos = nosDeCaminho(normas[forma]).map((sub) => ({ fechado: sub.fechado, pts: sub.pts.map((p) => {
        const q = { x: p.x * sx + i, y: p.y * sy + i, tipo: p.tipo };
        if (p.ei) q.ei = [p.ei[0] * sx, p.ei[1] * sy]; if (p.di) q.di = [p.di[0] * sx, p.di[1] * sy];
        return q;
      }) }));
    }
  }
  if (s.grad) perdas.push('o degradê (o caminho tem preenchimento liso)');
  if (s.dash) perdas.push('o tracejado');
  return { nos, vb: [w, h], aberta, perdas };
}
