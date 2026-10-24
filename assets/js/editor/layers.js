// Painel de camadas: árvore com grupos (D-0056), ordem (arrastar para antes, depois ou DENTRO de um grupo), visibilidade, trava, renomear.
// O documento continua plano; a árvore sai de core/grupos.js. Oculto e travado de um grupo valem para todos os filhos (herdados).
import { h } from '../core/dom.js';

// Element.append(null) insere o TEXTO "null"; este ignora, como o h() faz com os filhos.
const por = (el, ...kids) => el.append(...kids.flat().filter((k) => k != null));
import { S, on, select, mutate, commit, removeEls, agruparSel, desagruparSel, moverCamadaPara, mutarGrupo } from './state.js';
import { arvoreDe, ehGrupo, folhas, herdado, travadoEfetivo, gruposCompletos, podeMover } from '../core/grupos.js';
import { icon } from './icons.js';

const TYPE_ICON = { text: 'text', shape: 'square', path: 'pencil', image: 'image', svg: 'burst', abas: 'layers', grupo: 'grupo' };
const label = (e) => e.name || (e.t === 'text' ? e.text.split('\n')[0].slice(0, 28) : e.t === 'shape' ? (e.label || 'Forma') : { path: 'Desenho', image: 'Imagem', svg: 'SVG' }[e.t]);

// Grupos recolhidos na lista. É estado de TELA: não vai para o documento (abrir uma pasta não pode marcar a página como alterada).
const recolhidos = new Set();
let arrasto = null;     // id da camada que está sendo arrastada

// A seleção é de elementos; um grupo está "selecionado" quando todo o conteúdo dele está.
const grupoSelecionado = (no) => { const fs = folhas(no); return fs.length > 0 && fs.every((e) => S.sel.includes(e.id)); };

function selecionarCamada(no, ev) {
  const ids = folhas(no).map((e) => e.id);
  if (!(ev.shiftKey || ev.ctrlKey || ev.metaKey)) return select(ids, 'set');
  if (ehGrupo(no) && grupoSelecionado(no)) return select(S.sel.filter((id) => !ids.includes(id)), 'set');   // alternar um grupo inteiro
  return select(ids, ehGrupo(no) ? 'add' : 'toggle');
}

function barraDoTopo() {
  const ap = () => S.sel.filter((id) => { const e = S.doc.elements.find((x) => x.id === id); return e && !travadoEfetivo(S.doc, e); });
  const b = (ic, title, fn, off) => h('button', { class: 'btn', type: 'button', title, disabled: off || null, onclick: fn }, h('span', { html: icon(ic, 14) }));
  return h('div', { class: 'cam-topo' },
    h('button', { class: 'btn', type: 'button', title: 'Agrupar a seleção (Ctrl G)', disabled: S.sel.length ? null : '', onclick: () => agruparSel() }, h('span', { html: icon('grupo', 14) }), 'Novo grupo'),
    h('button', { class: 'btn', type: 'button', title: 'Desfazer o grupo (Ctrl Shift G)', disabled: gruposCompletos(S.doc, S.sel).length ? null : '', onclick: () => desagruparSel() }, 'Desagrupar'),
    h('span', { class: 'spacer' }),
    b('trash', 'Apagar a seleção (Del)', () => { const ids = ap(); if (ids.length) removeEls(ids); }, !S.sel.length));
}

export function renderLayers(root) {
  root.innerHTML = '';
  root.append(barraDoTopo());
  if (!S.doc.elements.length) { root.append(h('p', { class: 'hint pad' }, 'Nenhum elemento ainda. Adicione formas, textos, imagens ou SVGs.')); return; }
  root.append(lista(arvoreDe(S.doc), 0, root));
}

function lista(nos, nivel, root) {
  const ul = h('ul', { class: 'layers' + (nivel ? ' filhos' : '') });
  // de cima para baixo como o olho vê: o último do array é o que está na frente
  for (const no of [...nos].reverse()) ul.append(item(no, nivel, root));
  return ul;
}

function item(no, nivel, root) {
  const grupo = ehGrupo(no), acima = herdado(S.doc, no);
  const oculto = !!no.hide || acima.oculto, travado = !!no.lock || acima.travado;
  const li = h('li', {});
  const linha = h('div', {
    class: 'layer' + (grupo ? ' grupo' : '') + ((grupo ? grupoSelecionado(no) : S.sel.includes(no.id)) ? ' on' : '') + (oculto ? ' dim' : ''),
    draggable: 'true', 'data-id': no.id, style: nivel ? `--nivel:${nivel}` : null,
  });

  linha.append(grupo
    ? h('span', { class: 'l-seta' + (recolhidos.has(no.id) ? '' : ' aberto'), title: recolhidos.has(no.id) ? 'Abrir o grupo' : 'Recolher o grupo', html: icon('chevR', 12),
        onclick: (ev) => { ev.stopPropagation(); recolhidos.has(no.id) ? recolhidos.delete(no.id) : recolhidos.add(no.id); renderLayers(root); } })
    : h('span', { class: 'l-seta vazio' }));
  por(linha,
    h('span', { class: 'l-ic', html: icon(TYPE_ICON[no.t] || 'square', 14) }),
    h('span', { class: 'l-name', title: 'Duplo clique para renomear' }, grupo ? (no.nome || 'Grupo') : label(no)),
    grupo ? h('span', { class: 'l-conta', title: 'Elementos dentro do grupo' }, String(folhas(no).length)) : null,
    h('button', { class: 'l-b' + (acima.oculto ? ' herdado' : ''), type: 'button', title: acima.oculto ? 'O grupo acima está oculto' : no.hide ? 'Mostrar' : 'Ocultar', html: icon(oculto ? 'eyeoff' : 'eye', 14),
      onclick: (ev) => { ev.stopPropagation(); if (grupo) mutarGrupo(no.id, (g) => { g.hide = !g.hide; }); else { mutate([no.id], (e) => { e.hide = !e.hide; }, 'struct'); commit(); renderLayers(root); } } }),
    h('button', { class: 'l-b' + (no.lock ? ' act' : '') + (acima.travado ? ' herdado' : ''), type: 'button', title: acima.travado ? 'O grupo acima está travado' : no.lock ? 'Destravar' : 'Travar', html: icon(travado ? 'lock' : 'unlock', 14),
      onclick: (ev) => { ev.stopPropagation(); if (grupo) mutarGrupo(no.id, (g) => { g.lock = !g.lock; }); else { mutate([no.id], (e) => { e.lock = !e.lock; }, 'struct'); commit(); renderLayers(root); } } }),
  );

  linha.addEventListener('click', (ev) => selecionarCamada(no, ev));
  linha.querySelector('.l-name').addEventListener('dblclick', (ev) => {
    ev.stopPropagation();
    const atual = grupo ? (no.nome || 'Grupo') : (no.name || label(no));
    const inp = h('input', { class: 'l-edit', value: atual });
    ev.target.replaceWith(inp); inp.focus(); inp.select();
    const fim = () => {
      const v = inp.value.trim();
      if (grupo) mutarGrupo(no.id, (g) => { g.nome = v || 'Grupo'; }); else { mutate([no.id], (e) => { e.name = v; }, 'struct'); commit(); renderLayers(root); }
    };
    inp.addEventListener('blur', fim);
    inp.addEventListener('keydown', (k) => { k.stopPropagation(); if (k.key === 'Enter') inp.blur(); if (k.key === 'Escape') { inp.value = grupo ? (no.nome || 'Grupo') : (no.name || ''); inp.blur(); } });
  });

  // arrastar: antes, depois ou DENTRO de um grupo (terço do meio). A lista é desenhada de trás para a frente, então "acima" na tela = na frente.
  const zonas = ['alvo-antes', 'alvo-depois', 'alvo-dentro'];
  linha.addEventListener('dragstart', (ev) => { ev.stopPropagation(); arrasto = no.id; ev.dataTransfer.effectAllowed = 'move'; try { ev.dataTransfer.setData('text/plain', no.id); } catch { /* ok */ } });
  linha.addEventListener('dragend', () => { arrasto = null; root.querySelectorAll('.alvo-antes,.alvo-depois,.alvo-dentro').forEach((x) => x.classList.remove(...zonas)); });
  linha.addEventListener('dragover', (ev) => {
    if (!arrasto || !podeMover(S.doc, arrasto, no.id)) return;
    ev.preventDefault(); ev.stopPropagation();
    const r = linha.getBoundingClientRect(), t = (ev.clientY - r.top) / r.height;
    linha.classList.remove(...zonas);
    linha.classList.add(grupo && t > 0.3 && t < 0.7 ? 'alvo-dentro' : t < 0.5 ? 'alvo-antes' : 'alvo-depois');
  });
  linha.addEventListener('dragleave', () => linha.classList.remove(...zonas));
  linha.addEventListener('drop', (ev) => {
    ev.preventDefault(); ev.stopPropagation();
    const dentro = linha.classList.contains('alvo-dentro'), antes = linha.classList.contains('alvo-antes');
    linha.classList.remove(...zonas);
    const id = arrasto; arrasto = null;
    if (!id || !podeMover(S.doc, id, no.id)) return;
    if (dentro) recolhidos.delete(no.id);
    moverCamadaPara(id, dentro ? { dentro: no.id } : { irmaoDe: no.id, acima: antes });
  });

  li.append(linha);
  if (grupo && !recolhidos.has(no.id)) li.append(lista(no.filhos, nivel + 1, root));
  return li;
}

export function initLayers(root) {
  const r = () => { if (root.isConnected && root.offsetParent !== null) renderLayers(root); };
  for (const ev of ['struct', 'select', 'struct-lite', 'layers']) on(ev, r);
  r();
}
export const refreshLayers = (root) => renderLayers(root);
