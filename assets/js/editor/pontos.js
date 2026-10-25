// Edição de pontos e Caneta no canvas (REQ-VT, D-0057). A geometria mora em core/vetor.js (pura e testada); aqui só o gesto e o desenho.
//
// Dois modos que usam a mesma camada de desenho:
//   · EDITAR PONTOS — sobre um `path` (ou uma forma, que é convertida antes): arrastar pontos e alças, acrescentar e apagar pontos, trocar o tipo.
//   · CANETA — desenhar nó a nó: clique = ponto de canto; clique e arrasto = ponto suave com alças; clicar no primeiro ponto fecha.
// Tudo o que mexe no desenho passa por `reencaixar` (a caixa do elemento acompanha, nenhum ponto sai do lugar na página) e vira UM passo de desfazer
// por gesto, gravado ao soltar. O teclado do modo não vaza para os atalhos do editor.
import { frameOf, setFrame, makeElement } from '../core/model.js';
import { NORM } from '../core/render.js';
import * as V from '../core/vetor.js';
import { S, on, emit, byId, select, commit, setTool, addEls, removeEls } from './state.js';
import { place, inkColor } from './tools.js';
import { toast } from './ui.js';

let X = null;                 // { camada, barraHost, dePagina(cx, cy), sx(x), zoom() } — vem do palco (evita import circular)
let barra = null;
let ep = null;                // modo Editar pontos: { id, sel: [{sub, i}] }
let pena = null;              // Caneta: { pts: [{x, y, ei?, di?}] em px de página, seguir: {x, y} | null }

const TOL = 8;                // alvo de clique, em px de TELA (não muda com o zoom)
const MEIO = 4.5;             // metade do lado do quadradinho do ponto
const COR = '#38d6c4';        // azul-piscina: a cor do contorno em edição (a mesma das guias do usuário)
const mesmo = (a, b) => a.sub === b.sub && a.i === b.i;
const num = (n) => +(+n).toFixed(2);

export const ativo = () => !!ep;
export const desenhando = () => !!pena;

export function initPontos(ctx) {
  X = ctx;
  barra = document.createElement('div');
  barra.className = 'pt-barra'; barra.hidden = true;
  X.barraHost.append(barra);
  on('select', () => { if (ep && (S.sel.length !== 1 || S.sel[0] !== ep.id)) sair(); });
  on('struct', () => { if (!ep) return; const el = byId(ep.id); if (!el || el.t !== 'path') return sair(); ep.sel = ep.sel.filter((r) => el.nos?.[r.sub]?.pts[r.i]); desenhar(); });
  for (const ev of ['zoom', 'page', 'device', 'geom']) on(ev, () => { if (ep || pena) desenhar(); });
  on('tool', () => { if (pena && S.tool !== 'caneta') cancelarPena(); });
  X.viewport.addEventListener('pointermove', (e) => { if (pena) { pena.seguir = X.dePagina(e.clientX, e.clientY); desenhar(); } });
}

// ---------- coordenadas ----------
const frame = () => S.dev;
const naPagina = (el, x, y) => V.posicaoNaPagina(el, frame(), x, y);
const naTela = (el, x, y) => { const p = naPagina(el, x, y); return { x: X.sx(p.x), y: X.sx(p.y) }; };
const noVb = (el, px, py) => V.vbDePagina(el, frame(), px, py);
const escala = (el) => { const fr = el.f[frame()]; return Math.sqrt((fr.w / el.vb[0]) * (fr.h / el.vb[1])) || 1; };   // px de página por unidade de vb
const elemento = () => (ep ? byId(ep.id) : null);

function atualizar(el) {                       // depois de mexer em `nos`: reencaixa, redesenha o elemento e a camada
  V.reencaixar(el);
  emit('el', { ids: [el.id], src: 'canvas' });
  desenhar();
}

// ---------- entrar e sair ----------
// Converte uma forma do editor em caminho editável. Devolve as perdas (texto) ou null se não deu.
export function converterForma(id) {
  const el = byId(id); if (!el || el.t !== 'shape') return null;
  const fr = el.f.d, r = V.nosDeForma(el.shape, fr.w, fr.h, { s: el.s, normas: NORM });
  if (!r) return null;
  const perdas = [...r.perdas], mf = el.f.m;
  if (mf && Math.abs(mf.w / mf.h - fr.w / fr.h) > 0.01) perdas.push('a proporção própria do celular (cantos arredondados esticam)');
  const s = el.s || {}, rotulo = (el.label || '').trim(), ls = el.ls || {};
  const estilo = r.aberta ? { stroke: s.stroke || '#17161d', sw: +s.sw || 4, fill: null, cap: 'round' }
    : { stroke: s.stroke || '#17161d', sw: +s.sw || 0, fill: s.grad ? s.grad.c1 : (s.fill ?? null), cap: 'round' };
  el.t = 'path'; delete el.shape; delete el.label; delete el.ls;
  el.vb = r.vb; el.nos = r.nos; el.s = estilo; el.d = V.caminhoDeNos(r.nos);
  if (rotulo) {                                // o rótulo não vira caminho: continua como texto, no mesmo lugar
    const fs = +ls.fontSize || 24;
    const txt = makeElement('text', { text: rotulo, name: `Rótulo (${el.name || 'forma'})`, s: { fontFamily: ls.fontFamily || 'Inter', fontSize: fs, fontWeight: ls.fontWeight || 600, color: ls.color || '#ffffff', align: 'center' } },
      { x: fr.x, y: fr.y + fr.h / 2 - fs * 0.625, w: fr.w, h: fs * 1.25, r: fr.r || 0 });
    emit('struct'); addEls([txt], { select: false });
    select([el.id]);
  } else { emit('struct'); commit(); }
  return perdas;
}

export function entrarPontos(id) {
  let el = byId(id); if (!el) return false;
  if (el.t === 'shape') {
    const perdas = converterForma(id);
    if (perdas === null) { toast('Esta forma não tem como virar caminho editável.', 'err'); return false; }
    toast(perdas.length ? `Virou caminho editável. Perdeu: ${perdas.join('; ')}.` : 'Virou caminho editável.', 'ok');
    el = byId(id);
  }
  if (el.t !== 'path') { toast('Selecione um desenho ou uma forma para editar os pontos.'); return false; }
  const nos = V.nosDoElemento(el);
  if (V.contarPontos(nos) > V.PONTOS_POR_ELEMENTO) { toast(`Este desenho tem mais de ${V.PONTOS_POR_ELEMENTO} pontos: não dá para editar ponto a ponto.`, 'err'); return false; }
  if (S.dev === 'm' && !el.f.m) setFrame(el, 'm', {});              // o frame do celular passa a existir: o reencaixe atualiza todos
  el.nos = nos;
  if (S.sel.length !== 1 || S.sel[0] !== id) select([id]);
  ep = { id, sel: [] };
  document.body.classList.add('editando-pontos');
  emit('struct-lite');
  montarBarra(); desenhar();
  return true;
}

export function sair() {
  if (!ep) return;
  ep = null;
  document.body.classList.remove('editando-pontos');
  barra.hidden = true; barra.replaceChildren();
  desenhar(); emit('struct-lite');
}

// Editar nós pela barra: serve ao desenho ou à forma selecionados.
export function editarNos() {
  const el = S.sel.length === 1 ? byId(S.sel[0]) : null;
  if (!el || (el.t !== 'path' && el.t !== 'shape')) return void toast('Selecione um desenho ou uma forma para editar os nós.');
  entrarPontos(el.id);
}

// ---------- barra flutuante do modo ----------
function montarBarra() {
  barra.replaceChildren(); barra.hidden = false;
  const b = (rotulo, dica, fn) => { const e = document.createElement('button'); e.type = 'button'; e.textContent = rotulo; e.title = dica; e.addEventListener('pointerdown', (ev) => ev.stopPropagation()); e.addEventListener('click', fn); barra.append(e); return e; };
  for (const [rot, tipo, dica] of [['Canto', 'canto', 'Alças independentes'], ['Suave', 'suave', 'Alças na mesma reta'], ['Simétrico', 'simetrico', 'Alças na mesma reta e do mesmo tamanho']]) {
    b(rot, `${dica} (duplo clique no ponto troca)`, () => aoSelecionados((nos, r) => V.converterTipo(nos, r, tipo), `Ponto virou ${rot.toLowerCase()}`));
  }
  b('Apagar ponto', 'Apaga o ponto mantendo a forma (Delete); Ctrl + Delete liga os vizinhos em reta', () => apagarSelecionados(false));
  b('Abrir/Fechar', 'Abre um caminho fechado ou fecha um aberto', () => { const el = elemento(); const subs = [...new Set((ep.sel.length ? ep.sel : el.nos.map((_, i) => ({ sub: i }))).map((r) => r.sub))]; let n = 0; for (const s of subs) if (V.alternarFechado(el.nos, s)) n++; if (n) { atualizar(el); commit(); } });
  b('Inverter', 'Inverte a direção do caminho', () => { const el = elemento(); const subs = [...new Set((ep.sel.length ? ep.sel : el.nos.map((_, i) => ({ sub: i }))).map((r) => r.sub))]; for (const s of subs) V.inverter(el.nos, s); atualizar(el); commit(); });
  b('Dividir', 'Corta o caminho no ponto selecionado', () => { const el = elemento(); if (ep.sel.length !== 1) return void toast('Selecione um ponto para dividir.'); if (V.dividir(el.nos, ep.sel[0])) { ep.sel = []; atualizar(el); commit(); } else toast('Não dá para dividir numa ponta aberta.'); });
  b('Sair', 'Fecha o modo (Esc)', () => sair());
}
function aoSelecionados(fn, aviso) {
  const el = elemento(); if (!el || !ep.sel.length) return void toast('Selecione um ponto primeiro.');
  for (const r of ep.sel) fn(el.nos, r);
  atualizar(el); commit();
  if (aviso) toast(`${aviso}.`, 'ok');
}
function apagarSelecionados(manterForma) {
  const el = elemento(); if (!el || !ep.sel.length) return;
  const ordem = ep.sel.slice().sort((a, b) => b.sub - a.sub || b.i - a.i);
  for (const r of ordem) V.apagarPonto(el.nos, r, { manterForma });
  ep.sel = [];
  if (!el.nos.length) { const id = el.id; sair(); removeEls([id]); return; }
  atualizar(el); commit();
}

// ---------- desenhar a camada ----------
function desenhar() {
  const camada = X.camada;
  if (!ep && !pena) { camada.replaceChildren(); return; }
  const w = X.tamanho().w, h = X.tamanho().h;
  let svg = '';
  if (ep) {
    const el = elemento();
    if (!el?.nos) return sair();
    const poli = V.achatar(el.nos).map((s) => `<polyline points="${s.pts.map((p) => { const q = naTela(el, p.x, p.y); return `${num(q.x)},${num(q.y)}`; }).join(' ')}${s.fechado && s.pts.length ? ` ${(() => { const q = naTela(el, s.pts[0].x, s.pts[0].y); return `${num(q.x)},${num(q.y)}`; })()}` : ''}" fill="none" stroke="${COR}" stroke-width="1.5"/>`).join('');
    svg += poli;
    const visiveis = new Set();                                       // alças: as do ponto selecionado e as dos vizinhos dele
    for (const r of ep.sel) { const s = el.nos[r.sub]; if (!s) continue; const n = s.pts.length; for (const k of [-1, 0, 1]) { const j = r.i + k; if (j >= 0 && j < n) visiveis.add(`${r.sub}:${j}`); else if (s.fechado) visiveis.add(`${r.sub}:${(j + n) % n}`); } }
    el.nos.forEach((s, si) => s.pts.forEach((p, i) => {
      const c = naTela(el, p.x, p.y), sel = ep.sel.some((r) => r.sub === si && r.i === i);
      if (visiveis.has(`${si}:${i}`)) for (const lado of ['ei', 'di']) {
        if (!p[lado]) continue;
        const a = naTela(el, p.x + p[lado][0], p.y + p[lado][1]);
        svg += `<line x1="${num(c.x)}" y1="${num(c.y)}" x2="${num(a.x)}" y2="${num(a.y)}" stroke="${COR}" stroke-width="1"/><circle cx="${num(a.x)}" cy="${num(a.y)}" r="4" fill="#fff" stroke="${COR}" stroke-width="1.5"/>`;
      }
      const forma = p.tipo === 'canto' ? `<rect x="${num(c.x - MEIO)}" y="${num(c.y - MEIO)}" width="${MEIO * 2}" height="${MEIO * 2}"` : `<circle cx="${num(c.x)}" cy="${num(c.y)}" r="${MEIO}"`;
      svg += `${forma} fill="${sel ? COR : '#fff'}" stroke="${sel ? '#fff' : COR}" stroke-width="1.5"/>`;
    }));
  }
  if (pena) svg += desenharPena();
  camada.innerHTML = `<svg width="${num(w)}" height="${num(h)}" style="position:absolute;left:0;top:0;overflow:visible;pointer-events:none">${svg}</svg>`;
}

// ---------- Editar pontos: o ponteiro ----------
function pontoSobre(el, tx, ty) {
  let achado = null, melhor = TOL * TOL;
  el.nos.forEach((s, si) => s.pts.forEach((p, i) => { const c = naTela(el, p.x, p.y), d = (c.x - tx) ** 2 + (c.y - ty) ** 2; if (d <= melhor) { melhor = d; achado = { sub: si, i }; } }));
  return achado;
}
function alcaSobre(el, tx, ty) {
  for (const r of ep.sel) for (const k of [-1, 0, 1]) {
    const s = el.nos[r.sub]; if (!s) continue;
    const n = s.pts.length; let j = r.i + k; if (j < 0 || j >= n) { if (!s.fechado) continue; j = (j + n) % n; }
    const p = s.pts[j];
    for (const lado of ['ei', 'di']) {
      if (!p[lado]) continue;
      const a = naTela(el, p.x + p[lado][0], p.y + p[lado][1]);
      if ((a.x - tx) ** 2 + (a.y - ty) ** 2 <= (TOL * 0.8) ** 2) return { ref: { sub: r.sub, i: j }, lado };
    }
  }
  return null;
}
const tela = (e) => { const p = X.dePagina(e.clientX, e.clientY); return { px: p.x, py: p.y, tx: X.sx(p.x), ty: X.sx(p.y) }; };

function arrastar(e, aoMover, aoSoltar) {
  const move = (ev) => aoMover(ev), up = (ev) => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); aoSoltar?.(ev); };
  addEventListener('pointermove', move); addEventListener('pointerup', up, { once: true }); addEventListener('pointercancel', up, { once: true });
}

// Devolve true se o modo tratou o clique (o palco não deve fazer mais nada).
export function pontosDown(e) {
  if (!ep) return false;
  const el = elemento(); if (!el?.nos) { sair(); return false; }
  const m = tela(e);
  const alca = alcaSobre(el, m.tx, m.ty);
  if (alca) { moverAlca(e, el, alca); return true; }
  const ref = pontoSobre(el, m.tx, m.ty);
  if (ref) {
    if (e.shiftKey) ep.sel = ep.sel.some((r) => mesmo(r, ref)) ? ep.sel.filter((r) => !mesmo(r, ref)) : [...ep.sel, ref];
    else if (!ep.sel.some((r) => mesmo(r, ref))) ep.sel = [ref];
    desenhar(); moverPontos(e, el);
    return true;
  }
  const v = noVb(el, m.px, m.py), perto = V.maisProximo(el.nos, v);
  if (perto && perto.dist * escala(el) * X.zoom() <= TOL && perto.t > 0.001 && perto.t < 0.999) {          // clicar no traço acrescenta um ponto, sem mudar a forma
    const novo = V.adicionarPonto(el.nos, { sub: perto.sub, seg: perto.seg }, perto.t);
    if (novo) { ep.sel = [novo]; atualizar(el); moverPontos(e, el, true); return true; }   // acrescentar já é um passo de desfazer; arrastar em seguida o completa
  }
  caixaDeSelecao(e, el, m);
  return true;
}

function moverPontos(e, el, gravar = false) {
  const alvos = ep.sel.map((r) => ({ r, ini: naPagina(el, el.nos[r.sub].pts[r.i].x, el.nos[r.sub].pts[r.i].y) }));
  const p0 = X.dePagina(e.clientX, e.clientY);
  let moveu = false;
  arrastar(e, (ev) => {
    if (!moveu && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 3) return;
    moveu = true;
    const p = X.dePagina(ev.clientX, ev.clientY);
    let dx = p.x - p0.x, dy = p.y - p0.y;
    if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
    for (const a of alvos) { const q = noVb(el, a.ini.x + dx, a.ini.y + dy), pt = el.nos[a.r.sub].pts[a.r.i]; pt.x = q.x; pt.y = q.y; }
    atualizar(el);
  }, () => { if (moveu || gravar) commit(); });
}

function moverAlca(e, el, { ref, lado }) {
  let moveu = false;
  arrastar(e, (ev) => {
    moveu = true;
    const p = X.dePagina(ev.clientX, ev.clientY), v = noVb(el, p.x, p.y), pt = el.nos[ref.sub].pts[ref.i];
    V.moverAlca(el.nos, ref, lado, [v.x - pt.x, v.y - pt.y], { quebrar: ev.altKey });
    atualizar(el);
  }, () => { if (moveu) commit(); });
}

function caixaDeSelecao(e, el, m0) {
  const r = document.createElement('div'); r.className = 'marquee draw'; r.style.pointerEvents = 'none'; X.camada.append(r);
  let moveu = false, box = null;
  arrastar(e, (ev) => {
    const m = tela(ev);
    if (!moveu && Math.hypot(m.tx - m0.tx, m.ty - m0.ty) < 4) return;
    moveu = true;
    box = { x0: Math.min(m0.tx, m.tx), y0: Math.min(m0.ty, m.ty), x1: Math.max(m0.tx, m.tx), y1: Math.max(m0.ty, m.ty) };
    Object.assign(r.style, { left: box.x0 + 'px', top: box.y0 + 'px', width: box.x1 - box.x0 + 'px', height: box.y1 - box.y0 + 'px' });
  }, () => {
    r.remove();
    if (moveu) {
      const dentro = [];
      el.nos.forEach((s, si) => s.pts.forEach((p, i) => { const c = naTela(el, p.x, p.y); if (c.x >= box.x0 && c.x <= box.x1 && c.y >= box.y0 && c.y <= box.y1) dentro.push({ sub: si, i }); }));
      ep.sel = e.shiftKey ? [...ep.sel, ...dentro.filter((d) => !ep.sel.some((q) => mesmo(q, d)))] : dentro;
      desenhar();
    } else if (ep.sel.length) { ep.sel = []; desenhar(); }             // clique no vazio: tira a seleção
    else sair();                                                       // e, sem nada selecionado, sai do modo
  });
}

// Duplo clique no modo: no ponto troca o tipo (canto → suave → simétrico); numa alça, recolhe-a.
export function pontosDbl(e) {
  if (!ep) return false;
  const el = elemento(); if (!el?.nos) return false;
  const m = tela(e);
  const alca = alcaSobre(el, m.tx, m.ty);
  if (alca) { delete el.nos[alca.ref.sub].pts[alca.ref.i][alca.lado]; atualizar(el); commit(); return true; }
  const ref = pontoSobre(el, m.tx, m.ty);
  if (ref) {
    const p = el.nos[ref.sub].pts[ref.i], prox = { canto: 'suave', suave: 'simetrico', simetrico: 'canto' }[p.tipo] || 'suave';
    ep.sel = [ref]; V.converterTipo(el.nos, ref, prox); atualizar(el); commit(); toast(`Ponto virou ${prox}.`, 'ok');
  }
  return true;
}

// Teclado do modo. Devolve true para engolir a tecla (as combinações com Ctrl passam, exceto Ctrl+A, para desfazer, salvar e zoom continuarem).
export function pontosTecla(e) {
  if (pena) return penaTecla(e);
  if (!ep) return false;
  const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey, el = elemento();
  if (mod && k === 'a' && el) { ep.sel = el.nos.flatMap((s, si) => s.pts.map((_, i) => ({ sub: si, i }))); desenhar(); return true; }
  if (mod && k !== 'delete' && k !== 'backspace') return false;
  if (k === 'escape') { sair(); return true; }
  if (k === 'delete' || k === 'backspace') { apagarSelecionados(!mod); return true; }
  if (k.startsWith('arrow') && el && ep.sel.length) {
    const n = e.shiftKey ? 10 : 1, dx = k === 'arrowleft' ? -n : k === 'arrowright' ? n : 0, dy = k === 'arrowup' ? -n : k === 'arrowdown' ? n : 0;
    for (const r of ep.sel) { const pt = el.nos[r.sub].pts[r.i], a = naPagina(el, pt.x, pt.y), q = noVb(el, a.x + dx, a.y + dy); pt.x = q.x; pt.y = q.y; }
    atualizar(el); commit(); return true;
  }
  return true;                                                         // qualquer outra letra: nada de atalho de ferramenta lá dentro
}

// ---------- Caneta ----------
const paginaDeTela = (e) => X.dePagina(e.clientX, e.clientY);
function pertoDoPrimeiro(p) { const a = pena.pts[0]; return pena.pts.length >= 2 && Math.hypot((p.x - a.x) * X.zoom(), (p.y - a.y) * X.zoom()) <= TOL; }

export function penaDown(e) {
  const p = paginaDeTela(e);
  pena ||= { pts: [], seguir: null };
  if (pertoDoPrimeiro(p)) { terminarPena(true); return; }
  const novo = { x: p.x, y: p.y };
  pena.pts.push(novo);
  arrastar(e, (ev) => {                                                // clicar e arrastar: ponto suave, a alça de saída segue o ponteiro
    const q = paginaDeTela(ev), vx = q.x - novo.x, vy = q.y - novo.y;
    if (Math.hypot(vx, vy) * X.zoom() < 4) { delete novo.di; delete novo.ei; return; }
    novo.di = [vx, vy]; novo.ei = [-vx, -vy]; pena.seguir = q; desenhar();
  }, () => desenhar());
  desenhar();
}
export function penaDbl() {
  if (!pena) return;
  const n = pena.pts.length;
  if (n >= 2 && Math.hypot(pena.pts[n - 1].x - pena.pts[n - 2].x, pena.pts[n - 1].y - pena.pts[n - 2].y) * X.zoom() < 6) pena.pts.pop();   // o 2º clique do duplo clique repetiu o ponto
  terminarPena(false);
}
function penaTecla(e) {
  const k = e.key;
  if (k === 'Enter') { terminarPena(false); return true; }
  if (k === 'Escape') { cancelarPena(); setTool('select'); return true; }
  if (k === 'Backspace' || k === 'Delete') { pena.pts.pop(); if (!pena.pts.length) cancelarPena(); else desenhar(); return true; }
  return !(e.ctrlKey || e.metaKey);
}
export function cancelarPena() { if (!pena) return; pena = null; desenhar(); }

function terminarPena(fechado) {
  const pts = pena?.pts || [];
  pena = null;
  if (pts.length < 2) { desenhar(); return; }
  const nos = [{ fechado, pts: pts.map((p) => { const q = { x: p.x, y: p.y, tipo: p.di ? 'simetrico' : 'canto' }; if (p.ei) q.ei = p.ei; if (p.di) q.di = p.di; return q; }) }];
  const c = V.caixaDeNos(nos);
  const box = { x: c.x, y: c.y, w: Math.max(1, c.w), h: Math.max(1, c.h) };
  for (const p of nos[0].pts) { p.x -= box.x; p.y -= box.y; }
  const el = makeElement('path', { name: 'Caneta', d: V.caminhoDeNos(nos), vb: [box.w, box.h], nos, s: { stroke: S.pen.stroke || inkColor(), sw: S.pen.sw, fill: fechado ? '#e4572e' : null, cap: 'round' } });
  place(el, box);
  addEls([el]);
  setTool('select');
  desenhar();
  emit('page');
}

function desenharPena() {
  if (!pena?.pts.length) return '';
  const pts = pena.pts;
  const nos = [{ fechado: false, pts: pts.map((p) => ({ x: p.x, y: p.y, ei: p.ei, di: p.di })) }];
  if (pena.seguir) nos[0].pts.push({ x: pena.seguir.x, y: pena.seguir.y });
  const linha = V.achatar(nos)[0].pts.map((p) => `${num(X.sx(p.x))},${num(X.sx(p.y))}`).join(' ');
  let svg = `<polyline points="${linha}" fill="none" stroke="${COR}" stroke-width="1.5" stroke-dasharray="4 3"/>`;
  pts.forEach((p, i) => {
    const c = { x: X.sx(p.x), y: X.sx(p.y) };
    for (const lado of ['ei', 'di']) if (p[lado]) { const a = { x: X.sx(p.x + p[lado][0]), y: X.sx(p.y + p[lado][1]) }; svg += `<line x1="${num(c.x)}" y1="${num(c.y)}" x2="${num(a.x)}" y2="${num(a.y)}" stroke="${COR}" stroke-width="1"/><circle cx="${num(a.x)}" cy="${num(a.y)}" r="3.5" fill="#fff" stroke="${COR}" stroke-width="1.5"/>`; }
    const fecha = i === 0 && pena.seguir && pena.pts.length >= 2 && pertoDoPrimeiro(pena.seguir);
    svg += `<rect x="${num(c.x - MEIO)}" y="${num(c.y - MEIO)}" width="${MEIO * 2}" height="${MEIO * 2}" fill="${fecha ? COR : '#fff'}" stroke="${COR}" stroke-width="1.5"/>`;
  });
  return svg;
}
