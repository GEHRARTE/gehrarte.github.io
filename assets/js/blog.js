// Home do blog: monta Artigos, Páginas da equipe e Exposições a partir de
//   content/artigos.json, content/exposicoes.json (curadoria da equipe) e indice.json (gerado: o que está publicado).
// Sem conteúdo ainda, mostra estruturas-modelo (lorem ipsum, marcadas como provisórias).
import { h } from './core/dom.js';
import { BASE } from './core/util.js';
import { mountPublished } from './core/embed.js';
import { itensDeExemplo, recortar } from './core/listas.js';

const getJson = async (p) => { try { const r = await fetch(BASE + p, { cache: 'no-cache' }); return r.ok ? await r.json() : null; } catch { return null; } };
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dataExtenso = (v) => { const d = new Date(v); return Number.isNaN(+d) ? '' : `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`; };
// só http(s) ou caminho relativo ao site (nada de javascript:, data:, // etc.)
function seguro(u) {
  if (typeof u !== 'string' || !u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u) || u.startsWith('//')) return null;
  return BASE + u.replace(/^\/+/, '');
}
const aviso = () => h('span', { class: 'modelo-aviso' }, 'Modelo provisório — aguardando o material');

// ---------- Artigos ----------
function artigoCard(a, i) {
  const href = a.href ? seguro(a.href) : null;
  const titulo = a.modelo ? h('span', {}, a.titulo) : href ? h('a', { href }, a.titulo) : h('span', {}, a.titulo);
  return h('article', { class: 'art' + (a.modelo ? ' modelo' : '') },
    a.tags?.length ? h('p', { class: 'kicker' }, a.tags.join(' · ')) : h('p', { class: 'kicker' }, i === 0 ? 'Destaque' : 'Artigo'),
    h('h3', {}, titulo),
    h('p', { class: 'meta' }, [a.autor, a.data ? dataExtenso(a.data) : ''].filter(Boolean).join(' · ')),
    a.resumo ? h('p', { class: 'resumo' }, a.resumo) : null);
}

function listaArtigos(curados, indice) {
  const itens = [];
  const citados = new Set();
  for (const a of curados || []) {
    const pg = a.pagina && /^[a-z0-9-]+$/.test(a.pagina.slug || '') && /^[a-z0-9-]+$/.test(a.pagina.id || '') ? a.pagina : null;
    if (pg) citados.add(`${pg.slug}/${pg.id}`);
    itens.push({ titulo: a.titulo, autor: a.autor, data: a.data, resumo: a.resumo, tags: a.tags,
      href: pg ? `perfil.html?u=${pg.slug}&a=${pg.id}` : a.url || null, destaque: !!a.destaque });
  }
  for (const a of indice?.artigos || []) {                  // artigos feitos no editor e já publicados
    if (citados.has(`${a.slug}/${a.id}`)) continue;
    itens.push({ titulo: a.title, autor: a.autor, data: a.publishedAt, href: `perfil.html?u=${a.slug}&a=${a.id}`, tags: ['Artigo'] });
  }
  itens.sort((a, b) => (b.destaque - a.destaque) || String(b.data || '').localeCompare(String(a.data || '')));
  return itens;
}

// ---------- Páginas da equipe ----------
function pessoaCard(p) {
  const href = `${BASE}perfil.html?u=${encodeURIComponent(p.slug)}`;
  return h(p.modelo ? 'div' : 'a', { class: 'pessoa' + (p.modelo ? ' modelo' : ''), href: p.modelo ? null : href },
    h('span', { class: 'ini', 'aria-hidden': 'true' }, (p.nome || '?').trim()[0]),
    h('b', {}, p.nome),
    h('small', {}, p.title || 'Página em construção'),
    p.modelo ? null : h('span', { class: 'ir' }, 'Ler a página →'));
}

// ---------- Exposições ----------
let figN = 0;
function figura(f, vazia) {
  figN += 1;
  const src = f.src ? seguro(f.src) : null;
  return h('figure', {},
    h('div', { class: 'foto' + (src ? '' : ' vazia') }, src ? h('img', { src, alt: f.alt || f.legenda || '', loading: 'lazy' }) : 'Foto'),
    h('figcaption', {}, h('b', {}, `Fig. ${figN} —`), f.legenda || 'Legenda provisória.', f.credito ? h('small', {}, f.credito) : null));
}
function exposicao(e, modelo) {
  return h('article', { class: 'expo' },
    modelo ? aviso() : null,
    h('div', { class: 'expo-cab' }, h('h3', {}, e.titulo), (e.local || e.periodo) ? h('span', { class: 'quando' }, [e.local, e.periodo].filter(Boolean).join(' · ')) : null),
    e.descricao ? h('p', { class: 'desc' }, e.descricao) : null,
    h('div', { class: 'fotos' }, (e.fotos || []).map((f) => figura(f, modelo))));
}

// ---------- a página feita no editor ----------
// Um mesmo documento (`paginas/home/page.json`) atende aos dois estados, e QUEM DECIDE é o próprio
// documento: se ele traz blocos de lista, é a home inteira e substitui o conteúdo do casco; se não,
// é a antiga faixa de destaque e entra só no lugar dela. Assim a home não quebra no meio do
// caminho — e nada precisa ser publicado às pressas para a mudança valer (D-0053).
const destaque = document.getElementById('destaque-home');
const casco = document.getElementById('conteudo');
async function montarPaginaDaHome() {
  if (!destaque && !casco) return;
  const alvo = h('div', { id: 'home-doc' });
  const montado = await mountPublished(alvo, 'home', { modo: 'largura' }).catch(() => null);
  if (!montado) return;
  const ehPaginaInteira = !!alvo.querySelector('[data-lista]');
  if (ehPaginaInteira && casco) {
    casco.replaceChildren(alvo);
    preencherBlocos(alvo);
    return true;
  }
  if (destaque) {
    destaque.append(alvo);
    const bg = alvo.querySelector('.artboard')?.style.background;
    if (bg) destaque.style.background = bg;
  }
  return false;
}
async function montarPaginaDaHomeSegura() {
  try { return await montarPaginaDaHome(); } catch { return false; }   // home publicada com erro não derruba o resto
}

// ---------- montagem ----------
const [artigosJson, exposJson, indice] = await Promise.all([getJson('content/artigos.json'), getJson('content/exposicoes.json'), getJson('indice.json')]);

// Cada fonte de lista em um lugar só: o que o site mostra, e quantos itens há de verdade.
// `itensDeExemplo` vem de core/listas.js — a MESMA fonte que o editor usa para desenhar o bloco,
// para o provisório não ser escrito em dois lugares e divergir.
const FONTES = {
  artigos: () => {
    const reais = listaArtigos(artigosJson?.artigos, indice);
    return reais.length ? { reais: true, nos: reais.map((a, i) => artigoCard(a, i)) }
      : { reais: false, nos: itensDeExemplo('artigos').map((a, i) => artigoCard(a, i)) };
  },
  equipe: () => (indice?.perfis?.length
    ? { reais: true, nos: indice.perfis.map(pessoaCard) }
    : { reais: false, nos: itensDeExemplo('equipe').map(pessoaCard) }),
  exposicoes: () => {
    const reais = exposJson?.exposicoes || [];
    return reais.length ? { reais: true, nos: reais.map((e) => exposicao(e, false)) }
      : { reais: false, nos: itensDeExemplo('exposicoes').map((e) => exposicao(e, true)) };
  },
};

// Preenche um lugar de lista: o bloco do documento (data-lista) ou um contêiner do HTML do casco.
function preencher(caixa, fonte, { max = 0, antesDoAviso = null } = {}) {
  if (!caixa || !FONTES[fonte]) return;
  const { reais, nos } = FONTES[fonte]();
  if (!reais) (antesDoAviso || caixa).before(aviso());
  caixa.append(...recortar(nos, max));
}


// 2. Os blocos de um documento publicado (a home inteira feita no editor, D-0053). O embed já
// desenhou o lugar; aqui entram os dados.
export function preencherBlocos(raiz) {
  for (const bloco of raiz.querySelectorAll('[data-lista]')) {
    const fonte = bloco.dataset.lista;
    const max = Number(bloco.dataset.max) || 0;
    const colunas = Math.max(1, Number(bloco.dataset.colunas) || 1);
    bloco.replaceChildren();
    bloco.style.display = 'grid';
    bloco.style.gridTemplateColumns = `repeat(${colunas}, minmax(0, 1fr))`;
    bloco.style.gap = '18px';
    bloco.style.alignContent = 'start';
    bloco.style.overflow = 'auto';
    preencher(bloco, fonte, { max });
  }
}

// ---------- montagem, no fim, com tudo já definido ----------
// A página do editor decide primeiro: se ela substituiu o casco, preencher os contêineres antigos
// seria trabalho jogado fora (e aviso de "provisório" num nó descartado).
const virouPaginaInteira = await montarPaginaDaHomeSegura();
if (!virouPaginaInteira) {
  preencher(document.getElementById('lista-artigos'), 'artigos');
  preencher(document.getElementById('lista-paginas'), 'equipe');
  preencher(document.getElementById('lista-expos'), 'exposicoes');
}
