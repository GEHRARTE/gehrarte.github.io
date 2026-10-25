// Barra de ferramentas flutuante, leque e bandeja (D-0055).
//
// Substitui o painel `rail` do dock: a barra não é mais um painel encaixado com botões fixos no HTML, é um objeto SOLTO sobre o palco,
// montado pela pessoa a partir do catálogo (ferramentas-catalogo.js). O que ela monta é CONTEÚDO, não disposição de painéis — por isso
// vai para a chave `ferramentas`, irmã de `layout`, nas preferências da conta (core/preferencias.js).
//
// Gestos: arrastar a pegadeira move a barra (e ela gruda nas bordas); clique longo (ou botão direito) num botão com leque abre o leque;
// arrastar da bandeja para a barra adiciona (soltar ENTRE dois botões cria um botão; soltar EM CIMA de um põe as duas no mesmo leque);
// arrastar para fora da barra tira. Tudo o que muda é gravado ao SOLTAR, como no dock.js.
import { h, $ } from '../core/dom.js';
import { S, on, emit, setTool, selEls } from './state.js';
import { icon } from './icons.js';
import { toast } from './ui.js';
import { insertImageFile, contaGotas } from './tools.js';
import { editarNos } from './pontos.js';
import { abrirEditorImagem } from './imagem.js';
import { alternarReguas, alternarGrade } from './reguas.js';
import {
  CATALOGO, CATS, porId, PADRAO, normalizar, clonar, iguais, naBarra, slotDe, colocar, tirar, trazerAFrente, separar,
  ferramentaDoAtalho, chaveFerramentas, TAMANHOS, ANCORAS, MARGEM,
} from './ferramentas-catalogo.js';

let CFG = PADRAO(), palco = null, barra = null, bandeja = null, gravarFora = null, filtro = '', paineis = [], abaMontada = null;
let arrasto = null, vaga = null, foraDaBarra = false, leque = null, fecharLeque = () => {};
const seletorImagem = () => $('#rail-file');

// ---------- persistência ----------
// Mesma regra do dock.js: grava na hora no navegador (chave por pessoa), acompanha o que outra aba mudou e sobe para a conta com carimbo.
function lerLocal(slug) {
  try { return JSON.parse(localStorage.getItem(chaveFerramentas(slug))); } catch { return null; }
}
function gravar({ semSubir = false } = {}) {
  const t = Date.now();
  try { localStorage.setItem(chaveFerramentas(S.slug), JSON.stringify({ ...CFG, t })); } catch { /* armazenamento bloqueado: vale só nesta sessão */ }
  if (!semSubir) gravarFora?.(clonar(CFG), t);
}

// ---------- ligar ----------
// `lista`: os painéis que moram no baú, além do catálogo — [{ id, titulo, el, aoAbrir(), aoFechar() }]. O baú é o único lugar deles (D-0058).
export function initFerramentas({ app, slug, aoMudar = null, lista = [] }) {
  palco = app.querySelector('#center');
  paineis = lista;
  gravarFora = aoMudar;
  CFG = normalizar(lerLocal(slug));
  CFG.bandeja.aberta = false;                       // o baú sempre começa fechado (tela limpa); só lembra a aba e a posição
  barra = h('div', { class: 'barra', id: 'barra', role: 'toolbar', 'aria-label': 'Ferramentas' });
  palco.append(barra);
  ligarArrasteNaBarra();
  pintarBarra(); pintarBandeja();
  on('tool', pintarBarra);
  // O palco encolhe e cresce sozinho (painéis encaixados, gaveta do celular, réguas, janela): a barra acompanha, senão a que estava
  // encostada na direita fica atrás de um painel — ou fora da tela, que foi o que aconteceu ao recarregar com a barra ancorada à direita.
  addEventListener('resize', acompanharPalco);
  try { new ResizeObserver(acompanharPalco).observe(palco); } catch { /* navegador sem ResizeObserver: resta o resize da janela */ }
  // outra aba do editor mexeu na barra: adota sem ressuscitar o que esta aba acabou de mudar
  addEventListener('storage', (e) => {
    if (e.key !== chaveFerramentas(slug) || !e.newValue) return;
    try { aplicar(JSON.parse(e.newValue)); } catch { /* valor ilegível */ }
  });
  return {
    // a conta mandou uma configuração mais nova (dock.js › aoAdotar)
    adotar: (ferramentas) => aplicar(ferramentas),
    atual: () => clonar(CFG),
    atalho: (tecla) => {
      const id = ferramentaDoAtalho(CFG, tecla);
      if (!id) return false;
      usar(id);
      return true;
    },
    mostrar: (v = true) => { CFG.barra.visivel = v; pintarBarra(); gravar(); },
    visivel: () => CFG.barra.visivel,
    bandeja: (v) => alternarBandeja(v),
    abrirBau: (aba) => { CFG.bandeja.aba = aba; CFG.bandeja.aberta = true; CFG.barra.visivel = true; abaMontada = null; pintarBandeja(); pintarBarra(); gravar(); },
    bauAberto: () => !!CFG.bandeja.aberta,
    padrao: () => { CFG = PADRAO(); pintarBarra(); pintarBandeja(); gravar(); toast('Barra de ferramentas de volta ao padrão.', 'ok'); },
  };
}

function aplicar(bruto) {
  const nova = normalizar(bruto);
  nova.bandeja.aberta = CFG.bandeja.aberta;         // abrir ou fechar o baú é desta tela: não vem da conta nem de outra aba
  if (iguais(nova, CFG)) return false;
  CFG = nova;
  pintarBarra(); pintarBandeja();
  return true;
}

// ---------- executar a ferramenta ----------
function usar(id) {
  const f = porId[id];
  if (!f) return;
  if (!f.via) { toast(`${f.nome}: ${f.estado === 'planejada' ? 'ainda não foi feita (já tem requisito escrito).' : 'por enquanto é só uma ideia.'}`); return; }
  if (f.via.tool) { setTool(S.tool === f.via.tool && f.via.tool !== 'select' && !f.via.kind ? 'select' : f.via.tool, f.via.kind); pintarBarra(); return; }
  if (f.via.acao === 'imagem') return seletorImagem()?.click();
  if (f.via.acao === 'recorte' || f.via.acao === 'varinha') {
    const el = selEls()[0];
    const img = S.sel.length === 1 && el?.t === 'image' && !/gif|svg/.test(S.doc.assets?.[el.asset]?.mime || '') ? el : null;
    if (!img) return toast('Selecione uma imagem primeiro.');
    return abrirEditorImagem(img, { ferramenta: f.via.acao });
  }
  if (f.via.acao === 'reguas') return alternarReguas();
  if (f.via.acao === 'grade') return alternarGrade();
  if (f.via.acao === 'contagotas') return contaGotas();
  if (f.via.acao === 'nos') return editarNos();
}

// A ferramenta ligada hoje, para acender o botão certo (a de forma depende também do formato).
const ligada = (id) => {
  const v = porId[id]?.via;
  if (!v?.tool || S.tool !== v.tool) return false;
  return !v.kind || S.shapeKind === v.kind;
};

// ---------- desenhar a barra ----------
export function pintarBarra() {
  if (!barra) return;
  const B = CFG.barra;
  barra.hidden = !B.visivel;
  barra.dataset.orient = B.orient;
  barra.classList.toggle('rotulos', B.rotulos && B.orient === 'v');
  barra.replaceChildren();
  if (!B.visivel) return;

  const pega = h('div', { class: 'pega', title: 'Arraste para mover a barra · botão direito: opções', html: icon('grip', 14) });
  pega.addEventListener('pointerdown', comecarArraste);
  pega.addEventListener('contextmenu', (ev) => { ev.preventDefault(); menuDaBarra(ev.clientX, ev.clientY); });
  barra.append(pega);

  B.slots.forEach((slot, i) => barra.append(botao(slot, i)));
  if (B.slots.length) barra.append(h('div', { class: 'sep' }));

  // o botão da bandeja mora na própria barra: é de lá que se monta a seleção rápida
  barra.append(h('button', {
    class: 'frm btn-bandeja' + (CFG.bandeja.aberta ? ' on' : ''), type: 'button',
    title: 'Baú de ferramentas — elementos, modelos, mídia e as ferramentas da barra', 'aria-label': 'Baú de ferramentas',
    'aria-pressed': String(!!CFG.bandeja.aberta),
    style: { width: B.tam + 'px', height: B.tam + 'px' },
    onclick: () => alternarBandeja(),
  }, h('span', { html: icon('plus', Math.round(B.tam * 0.5)) }), h('span', { class: 'rot' }, 'Baú')));

  // o seletor de arquivos vive dentro da barra: assim abre na janela onde a barra estiver
  barra.append(h('input', {
    type: 'file', id: 'rail-file', accept: 'image/*', multiple: true, hidden: true,
    onchange: async (ev) => { for (const f of ev.target.files) await insertImageFile(f); ev.target.value = ''; },
  }));
  posicionarBarra();
}

function botao(slot, i) {
  const B = CFG.barra, f = porId[slot[0]];
  const acesa = slot.some(ligada);
  const b = h('button', {
    class: 'frm' + (acesa ? ' on' : '') + (slot.length > 1 ? ' tem-mais' : '') + (f.via ? '' : ' breve'),
    type: 'button', 'data-slot': String(i), 'data-id': f.id, draggable: 'true', 'aria-pressed': String(acesa),
    title: `${f.nome}${f.atalho ? ` (${f.atalho})` : ''}\n${f.dica}` + (slot.length > 1 ? `\n+${slot.length - 1} no leque (segure para abrir)` : ''),
    style: { width: B.rotulos && B.orient === 'v' ? 'auto' : B.tam + 'px', height: B.tam + 'px', minWidth: B.tam + 'px' },
  },
    h('span', { html: icon(f.icone, Math.round(B.tam * 0.52)) }),
    h('span', { class: 'rot' }, f.nome),
    f.atalho && !(B.rotulos && B.orient === 'v') ? h('span', { class: 'atalho' }, f.atalho) : null);
  if (slot.length > 1) b.setAttribute('aria-haspopup', 'menu');

  // clique curto usa; clique longo abre o leque (gesto do Affinity/Photoshop)
  let segurar = null;
  const soltar = () => { clearTimeout(segurar); segurar = null; };
  b.addEventListener('pointerdown', (ev) => { if (ev.button) return; segurar = setTimeout(() => { segurar = null; abrirLeque(b, i); }, 320); });
  b.addEventListener('pointerup', () => { if (segurar) { soltar(); usar(slot[0]); } });
  b.addEventListener('pointerleave', soltar);
  b.addEventListener('pointercancel', soltar);
  b.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); usar(slot[0]); } });
  b.addEventListener('contextmenu', (ev) => { ev.preventDefault(); soltar(); slot.length > 1 ? abrirLeque(b, i) : menuDoSlot(ev.clientX, ev.clientY, i); });
  b.addEventListener('dragstart', (ev) => {
    soltar();
    arrasto = { origem: 'barra', id: slot[0] };
    ev.dataTransfer.effectAllowed = 'move';
    try { ev.dataTransfer.setData('text/plain', slot[0]); } catch { /* ok */ }
    b.classList.add('puxando');
  });
  b.addEventListener('dragend', () => { b.classList.remove('puxando'); limparVaga(); soltarFora(); });
  return b;
}

// ---------- posição e arraste ----------
function acompanharPalco() { posicionarBarra(); posicionarBandeja(); }

function posicionarBarra() {
  if (!barra || !palco || !CFG.barra.visivel) return;
  const B = CFG.barra, r = palco.getBoundingClientRect();
  const cx = barra.offsetWidth || 46, cy = barra.offsetHeight || 300;
  let { x, y } = B.pos;
  if (B.ancora === 'esquerda') x = MARGEM;
  if (B.ancora === 'direita') x = r.width - cx - MARGEM;
  if (B.ancora === 'topo') y = MARGEM;
  if (B.ancora === 'base') y = r.height - cy - MARGEM;
  barra.style.left = Math.min(Math.max(x, 4), Math.max(4, r.width - cx - 4)) + 'px';
  barra.style.top = Math.min(Math.max(y, 4), Math.max(4, r.height - cy - 4)) + 'px';
}

function comecarArraste(ev) {
  ev.preventDefault();
  const r0 = barra.getBoundingClientRect(), p = palco.getBoundingClientRect();
  const dx = ev.clientX - r0.left, dy = ev.clientY - r0.top;
  barra.classList.add('arrastando');
  barra.setPointerCapture(ev.pointerId);
  const mover = (e) => {
    let x = e.clientX - p.left - dx, y = e.clientY - p.top - dy;
    const perto = 30, B = CFG.barra;                 // encaixe magnético: perto de uma borda, gruda nela
    let anc = 'livre';
    if (x < perto) { x = MARGEM; anc = 'esquerda'; }
    else if (x + r0.width > p.width - perto) { x = p.width - r0.width - MARGEM; anc = 'direita'; }
    if (y < perto) { y = MARGEM; if (anc === 'livre') anc = 'topo'; }
    else if (y + r0.height > p.height - perto) { y = p.height - r0.height - MARGEM; if (anc === 'livre') anc = 'base'; }
    B.pos = { x, y }; B.ancora = anc;
    barra.style.left = x + 'px'; barra.style.top = y + 'px';
  };
  const fim = () => {
    barra.classList.remove('arrastando');
    barra.removeEventListener('pointermove', mover);
    barra.removeEventListener('pointerup', fim);
    barra.removeEventListener('pointercancel', fim);
    // no topo ou na base a barra deitada faz mais sentido — e dá para desfazer no menu
    const B = CFG.barra;
    if ((B.ancora === 'topo' || B.ancora === 'base') && B.orient === 'v') B.orient = 'h';
    if ((B.ancora === 'esquerda' || B.ancora === 'direita') && B.orient === 'h') B.orient = 'v';
    pintarBarra(); gravar();
  };
  barra.addEventListener('pointermove', mover);
  barra.addEventListener('pointerup', fim);
  barra.addEventListener('pointercancel', fim);
}

// ---------- leque e menus ----------
function popup(x, y, filhos) {
  fecharLeque();
  const el = h('div', { class: 'leque', role: 'menu' }, filhos);
  document.body.append(el);
  const b = el.getBoundingClientRect();
  el.style.left = Math.max(8, Math.min(x, innerWidth - b.width - 8)) + 'px';
  el.style.top = Math.max(8, Math.min(y, innerHeight - b.height - 8)) + 'px';
  leque = el;
  const fora = (e) => { if (!el.contains(e.target)) fecharLeque(); };
  const tecla = (e) => { if (e.key === 'Escape') { e.stopPropagation(); fecharLeque(); } };
  setTimeout(() => { document.addEventListener('pointerdown', fora); document.addEventListener('keydown', tecla, true); }, 0);
  fecharLeque = () => {
    document.removeEventListener('pointerdown', fora); document.removeEventListener('keydown', tecla, true);
    el.remove(); leque = null; fecharLeque = () => {};
  };
  el.querySelector('button')?.focus();
  return el;
}

const itemMenu = ({ rotulo, ic = 'grip', k = '', on: aceso = false, faz }) =>
  h('button', { type: 'button', role: 'menuitem', class: aceso ? 'on' : '', onclick: () => { fecharLeque(); faz(); } },
    h('span', { class: 'ic', html: icon(ic, 16) }), h('span', {}, rotulo), k ? h('span', { class: 'k' }, k) : null);

function abrirLeque(botao, i) {
  const slot = CFG.barra.slots[i];
  if (!slot) return;
  const r = botao.getBoundingClientRect();
  const itens = slot.map((id) => itemMenu({
    rotulo: porId[id].nome, ic: porId[id].icone, k: porId[id].atalho, on: ligada(id),
    faz: () => { trazerAFrente(CFG, id); usar(id); pintarBarra(); gravar(); },
  }));
  itens.push(h('div', { class: 'div' }), itemMenu({ rotulo: 'Arrumar este botão…', ic: 'panels', faz: () => menuDoSlot(r.right, r.top, i) }));
  popup(r.right + 6, r.top, itens);
}

function menuDaBarra(x, y) {
  const B = CFG.barra;
  const muda = (fn) => { fn(); pintarBarra(); gravar(); };
  popup(x, y, [
    itemMenu({ rotulo: B.orient === 'v' ? 'Deitar a barra' : 'Levantar a barra', ic: 'layers', faz: () => muda(() => { B.orient = B.orient === 'v' ? 'h' : 'v'; }) }),
    itemMenu({ rotulo: 'Mostrar os nomes', ic: 'text', on: B.rotulos, faz: () => muda(() => { B.rotulos = !B.rotulos; }) }),
    h('div', { class: 'div' }),
    ...[['Pequena', 32], ['Média', 38], ['Grande', 46]].map(([rot, t]) =>
      itemMenu({ rotulo: rot, ic: 'square', on: B.tam === t, faz: () => muda(() => { B.tam = t; }) })),
    h('div', { class: 'div' }),
    itemMenu({ rotulo: 'Abrir o baú', ic: 'plus', faz: () => alternarBandeja(true) }),
    itemMenu({ rotulo: 'Esconder a barra', ic: 'eyeoff', faz: () => { muda(() => { B.visivel = false; }); toast('Barra escondida. Painéis › Barra de ferramentas para trazer de volta.'); } }),
    itemMenu({ rotulo: 'Voltar ao padrão', ic: 'reset', faz: () => { CFG = PADRAO(); pintarBarra(); pintarBandeja(); gravar(); toast('Barra de ferramentas de volta ao padrão.', 'ok'); } }),
  ]);
}

function menuDoSlot(x, y, i) {
  const slot = CFG.barra.slots[i];
  if (!slot) return;
  popup(x, y, [
    ...(slot.length > 1 ? [itemMenu({ rotulo: 'Separar em botões próprios', ic: 'bool', faz: () => { separar(CFG, i); pintarBarra(); gravar(); } }), h('div', { class: 'div' })] : []),
    itemMenu({ rotulo: 'Tirar da barra', ic: 'x', faz: () => { tirar(CFG, slot[0]); pintarBarra(); pintarBandeja(); gravar(); toast('Fora da barra — continua na bandeja.'); } }),
  ]);
}

// ---------- arrastar: bandeja ⇄ barra ----------
function limparVaga() {
  vaga?.remove(); vaga = null;
  barra?.querySelectorAll('.frm').forEach((b) => b.classList.remove('alvo'));
}

function ligarArrasteNaBarra() {
  barra.addEventListener('dragover', (ev) => {
    if (!arrasto) return;
    ev.preventDefault(); ev.dataTransfer.dropEffect = arrasto.origem === 'barra' ? 'move' : 'copy';
    foraDaBarra = false;
    const vertical = CFG.barra.orient === 'v';
    const botoes = [...barra.querySelectorAll('.frm[data-slot]')];
    const sobre = ev.target.closest?.('.frm[data-slot]');
    if (sobre && sobre.dataset.id !== arrasto.id) {
      const r = sobre.getBoundingClientRect();
      const t = vertical ? (ev.clientY - r.top) / r.height : (ev.clientX - r.left) / r.width;
      if (t > 0.3 && t < 0.7) {                      // terço do meio = empilhar no mesmo botão
        limparVaga();
        sobre.classList.add('alvo');
        arrasto.alvo = { tipo: 'dentro', slot: +sobre.dataset.slot };
        return;
      }
    }
    barra.querySelectorAll('.frm').forEach((b) => b.classList.remove('alvo'));
    let idx = botoes.length;                         // onde entra a vaga: antes do primeiro botão cujo meio passou do ponteiro
    for (const b of botoes) {
      const r = b.getBoundingClientRect();
      const meio = vertical ? r.top + r.height / 2 : r.left + r.width / 2;
      if ((vertical ? ev.clientY : ev.clientX) < meio) { idx = +b.dataset.slot; break; }
    }
    vaga ||= h('div', { class: 'vaga' });
    barra.insertBefore(vaga, botoes[idx] || barra.querySelector('.sep') || barra.querySelector('.btn-bandeja'));
    arrasto.alvo = { tipo: 'entre', idx };
  });
  barra.addEventListener('dragleave', (ev) => { if (!barra.contains(ev.relatedTarget)) limparVaga(); });
  barra.addEventListener('drop', (ev) => {
    ev.preventDefault();
    const a = arrasto;
    arrasto = null; limparVaga(); foraDaBarra = false;
    if (!a?.alvo) return;
    if (!colocar(CFG, a.id, a.alvo)) return;
    pintarBarra(); pintarBandeja(); gravar();
    toast(a.alvo.tipo === 'dentro' ? `${porId[a.id].nome} entrou no leque.` : `${porId[a.id].nome} na barra.`, 'ok');
  });
  // soltar FORA da barra tira a ferramenta (só vale para quem veio da barra)
  document.addEventListener('dragover', (ev) => { if (arrasto && !barra.contains(ev.target)) { foraDaBarra = true; ev.preventDefault(); } });
}

function soltarFora() {
  const a = arrasto;
  arrasto = null;
  if (!a || !foraDaBarra || a.origem !== 'barra') { foraDaBarra = false; return; }
  foraDaBarra = false;
  if (!tirar(CFG, a.id)) return;
  pintarBarra(); pintarBandeja(); gravar();
  toast(`${porId[a.id].nome} saiu da barra — continua na bandeja.`);
}

// ---------- bandeja ----------
function alternarBandeja(forcar) {
  CFG.bandeja.aberta = forcar ?? !CFG.bandeja.aberta;
  if (CFG.bandeja.aberta) CFG.barra.visivel = true;     // a bandeja só faz sentido com a barra à vista
  pintarBandeja(); pintarBarra(); gravar();
}

const abaValida = () => (CFG.bandeja.aba !== 'ferramentas' && paineis.some((p) => p.id === CFG.bandeja.aba) ? CFG.bandeja.aba : 'ferramentas');

// Solta o painel da aba que estava à mostra (a biblioteca só monta o conteúdo enquanto a aba está aberta).
function soltarAba() {
  const p = paineis.find((x) => x.id === abaMontada);
  if (p) { p.aoFechar?.(); p.el.remove(); }
  abaMontada = null;
}

// Desenha o baú. Com ele já na tela e na mesma aba, só atualiza o catálogo (marcas "na barra"); troca de aba refaz tudo.
function pintarBandeja() {
  if (!palco) return;
  if (!CFG.bandeja.aberta) { soltarAba(); bandeja?.remove(); bandeja = null; return; }
  const aba = abaValida();
  if (bandeja && abaMontada === aba && bandeja.dataset.aba === aba) { if (aba === 'ferramentas') pintarItens(bandeja.querySelector('.bj-body'), filtro); return; }
  if (!bandeja) { bandeja = h('div', { id: 'bandeja', role: 'dialog', 'aria-label': 'Baú de ferramentas' }); palco.append(bandeja); }
  soltarAba();
  bandeja.dataset.aba = aba;
  bandeja.replaceChildren();

  const cab = h('header', { class: 'bj-h' },
    h('span', { class: 'ic', html: icon('grip', 14), style: { color: '#5d5a6d' } }),
    h('b', {}, 'Baú de ferramentas'),
    h('button', { class: 'bj-b', type: 'button', title: 'Fechar (Esc)', 'aria-label': 'Fechar o baú', html: icon('x', 15), onclick: () => alternarBandeja(false) }));
  cab.addEventListener('pointerdown', (ev) => { if (!ev.target.closest('button')) arrastarBandeja(ev); });

  const abas = h('nav', { class: 'bj-abas', role: 'tablist', 'aria-label': 'Seções do baú' },
    [{ id: 'ferramentas', titulo: 'Ferramentas' }, ...paineis].map((a) => h('button', {
      type: 'button', role: 'tab', class: a.id === aba ? 'on' : '', 'aria-selected': String(a.id === aba),
      onclick: () => { if (a.id === CFG.bandeja.aba) return; CFG.bandeja.aba = a.id; pintarBandeja(); gravar(); },
    }, a.titulo)));
  bandeja.append(cab, abas);

  if (aba === 'ferramentas') {
    const inp = h('input', { type: 'search', placeholder: 'Procurar ferramenta…', value: filtro, 'aria-label': 'Procurar ferramenta' });
    inp.addEventListener('input', () => { filtro = inp.value; pintarItens(bandeja.querySelector('.bj-body'), filtro); });
    inp.addEventListener('keydown', (ev) => { ev.stopPropagation(); if (ev.key === 'Escape') { inp.value = ''; filtro = ''; pintarItens(bandeja.querySelector('.bj-body'), ''); } });
    const corpo = h('div', { class: 'bj-body' });
    pintarItens(corpo, filtro);
    bandeja.append(h('div', { class: 'bj-busca' }, inp), corpo,
      h('p', { class: 'bj-dica' }, 'Arraste para a barra. Soltando em cima de um botão, as duas dividem o mesmo lugar (leque). O + também adiciona.'));
    abaMontada = 'ferramentas';
    if (filtro) inp.focus();
  } else {
    const p = paineis.find((x) => x.id === aba);
    const corpo = h('div', { class: 'bj-painel' });
    corpo.append(p.el);
    bandeja.append(corpo);
    abaMontada = aba;
    p.aoAbrir?.();
  }
  posicionarBandeja();
}

function pintarItens(corpo, busca) {
  if (!corpo) return;
  corpo.replaceChildren();
  const q = (busca || '').trim().toLowerCase();
  let achou = 0;
  for (const cat of CATS) {
    const itens = CATALOGO.filter((f) => f.cat === cat && (!q || `${f.nome} ${f.dica} ${f.cat}`.toLowerCase().includes(q)));
    if (!itens.length) continue;
    achou += itens.length;
    corpo.append(h('div', { class: 'bj-cat' }, cat));
    const grade = h('div', { class: 'bj-grid' });
    for (const f of itens) {
      const usada = naBarra(CFG, f.id);
      const card = h('div', {
        class: 'bj-item' + (usada ? ' usada' : '') + (f.via ? '' : ' breve'), draggable: 'true', 'data-id': f.id, 'data-estado': f.via ? '' : f.estado,
        title: `${f.nome}\n${f.dica}` + (f.via ? '' : `\n(${f.estado})`) + (usada ? '\nJá está na barra' : '\nArraste para a barra'),
      },
        h('span', { class: 'ic', html: icon(f.icone, 20) }),
        h('span', {}, f.nome),
        h('button', { class: 'bj-mais', type: 'button', title: `Pôr ${f.nome} na barra`, 'aria-label': `Pôr ${f.nome} na barra`, disabled: usada || null, html: icon('plus', 13),
          onclick: (ev) => { ev.stopPropagation(); adicionar(f); } }));
      card.addEventListener('dragstart', (ev) => {
        arrasto = { origem: 'bandeja', id: f.id };
        ev.dataTransfer.effectAllowed = 'copy';
        try { ev.dataTransfer.setData('text/plain', f.id); } catch { /* ok */ }
        card.classList.add('puxando');
      });
      card.addEventListener('dragend', () => { card.classList.remove('puxando'); limparVaga(); arrasto = null; foraDaBarra = false; });
      card.addEventListener('dblclick', () => adicionar(f));
      grade.append(card);
    }
    corpo.append(grade);
  }
  if (!achou) corpo.append(h('p', { class: 'bj-vazio' }, 'Nada com esse nome.'));
}

function adicionar(f) {
  if (naBarra(CFG, f.id)) return toast('Já está na barra.');
  if (!colocar(CFG, f.id, { tipo: 'entre', idx: CFG.barra.slots.length })) return toast('A barra já está cheia: tire alguma ferramenta antes.', 'err');
  pintarBarra(); pintarBandeja(); gravar();
  toast(`${f.nome} na barra.`, 'ok');
}

function posicionarBandeja() {
  if (!bandeja || !palco) return;
  const p = palco.getBoundingClientRect(), b = bandeja.getBoundingClientRect();
  bandeja.style.left = Math.max(4, Math.min(CFG.bandeja.pos.x, p.width - (b.width || 340) - 4)) + 'px';
  bandeja.style.top = Math.max(4, Math.min(CFG.bandeja.pos.y, p.height - 120)) + 'px';
}

function arrastarBandeja(ev) {
  ev.preventDefault();
  const r0 = bandeja.getBoundingClientRect(), p = palco.getBoundingClientRect();
  const dx = ev.clientX - r0.left, dy = ev.clientY - r0.top, alvo = ev.currentTarget;
  alvo.setPointerCapture(ev.pointerId);
  const mover = (e) => {
    CFG.bandeja.pos = { x: e.clientX - p.left - dx, y: e.clientY - p.top - dy };
    bandeja.style.left = CFG.bandeja.pos.x + 'px';
    bandeja.style.top = CFG.bandeja.pos.y + 'px';
  };
  const fim = () => {
    alvo.removeEventListener('pointermove', mover); alvo.removeEventListener('pointerup', fim); alvo.removeEventListener('pointercancel', fim);
    posicionarBandeja(); gravar();
  };
  alvo.addEventListener('pointermove', mover);
  alvo.addEventListener('pointerup', fim);
  alvo.addEventListener('pointercancel', fim);
}
