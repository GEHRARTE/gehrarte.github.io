// Grupos de camadas — lógica PURA (sem DOM), compartilhada pelo editor, pela página publicada e pelos testes.
//
// O documento continua com `doc.elements` PLANO, na ordem de empilhamento (o último está na frente): é o que a renderização, a
// animação, o PDF, a publicação e as abas de site já leem. A hierarquia é metadado por cima:
//   · `el.g`      id do grupo a que o elemento pertence (ausente = está na raiz)
//   · `doc.grupos` registro dos grupos: [{ id, nome, hide?, lock?, g? }]  (`g` = grupo pai, para grupo dentro de grupo)
// Se o grupo está aberto ou recolhido na lista de camadas é estado de TELA, não do documento (abrir uma pasta não pode "alterar" a página).
// Os membros de um grupo ficam sempre CONTÍGUOS no array (um grupo é uma unidade de empilhamento); as operações daqui refazem isso.
// A árvore da maquete (`{ t:'grupo', filhos }`) existe só em memória: `arvoreDe` a monta, `aplicar` a devolve ao formato plano.
// Decisão e alternativas recusadas: D-0056.
//
// Oculto e travado são HERDADOS: grupo oculto apaga os filhos sem mexer no `hide` de cada um (D-0056). `ocultoEfetivo` e
// `travadoEfetivo` são o que todo leitor de `el.hide` / `el.lock` deve usar.

export const novoIdGrupo = () => 'g' + Math.random().toString(36).slice(2, 9);
export const ehGrupo = (n) => n?.t === 'grupo';
const PROFUNDIDADE_MAX = 50;                      // trava contra um registro adulterado com ciclo (a → b → a)

export const grupoPorId = (doc, id) => (doc?.grupos || []).find((g) => g.id === id) || null;

// ---------- herança de oculto / travado ----------

// O que os grupos ACIMA de `x` (elemento ou registro de grupo) impõem. Não conta o próprio `hide`/`lock` de `x`.
export function herdado(doc, x) {
  let oculto = false, travado = false, gid = x?.g;
  for (let n = 0; gid && n < PROFUNDIDADE_MAX; n++) {
    const g = grupoPorId(doc, gid);
    if (!g) break;
    oculto = oculto || !!g.hide; travado = travado || !!g.lock;
    gid = g.g;
  }
  return { oculto, travado };
}
export const ocultoEfetivo = (doc, el) => !!el?.hide || (!!el?.g && herdado(doc, el).oculto);
export const travadoEfetivo = (doc, el) => !!el?.lock || (!!el?.g && herdado(doc, el).travado);

// ---------- árvore (só em memória) ----------

// Monta a árvore a partir do array plano. Grupo sem nenhum membro nesta lista de elementos NÃO aparece (pode ser de outra aba do site).
export function arvoreDe(doc) {
  const reg = new Map((doc?.grupos || []).map((g) => [g.id, g]));
  const nos = new Map(), raiz = [];
  const lista = (gid, vis) => (!gid || !reg.has(gid) || vis.has(gid) ? raiz : no(gid, vis).filhos);
  const no = (gid, vis) => {
    if (nos.has(gid)) return nos.get(gid);
    const g = reg.get(gid);
    const n = { t: 'grupo', id: g.id, nome: g.nome || 'Grupo', hide: !!g.hide, lock: !!g.lock, filhos: [] };
    nos.set(gid, n); vis.add(gid);
    lista(g.g, vis).push(n);
    return n;
  };
  for (const el of doc?.elements || []) lista(el.g, new Set()).push(el);
  return raiz;
}

export function* percorrer(nos, pai = null) {
  for (const n of nos) { yield { no: n, pai }; if (ehGrupo(n)) yield* percorrer(n.filhos, n); }
}
export const achar = (raiz, id) => { for (const r of percorrer(raiz)) if (r.no.id === id) return r; return null; };
export const folhas = (n) => (ehGrupo(n) ? n.filhos.flatMap(folhas) : [n]);
const listaDe = (raiz, pai) => (pai ? pai.filhos : raiz);
const idsDeGrupos = (raiz) => new Set([...percorrer(raiz)].filter((r) => ehGrupo(r.no)).map((r) => r.no.id));

// `candidato` está dentro de `id`? (impede soltar um grupo dentro de si mesmo)
export function ehDescendente(raiz, id, candidato) {
  const r = achar(raiz, id);
  if (!r || !ehGrupo(r.no)) return false;
  for (const x of percorrer(r.no.filhos, r.no)) if (x.no.id === candidato) return true;
  return false;
}

// Tira os grupos que ficaram sem elemento nenhum (de baixo para cima).
function podar(nos) {
  const out = [];
  for (const n of nos) {
    if (!ehGrupo(n)) { out.push(n); continue; }
    n.filhos = podar(n.filhos);
    if (n.filhos.length) out.push(n);
  }
  return out;
}

// Devolve a árvore ao formato plano (elements + grupos). `antes` = ids de grupo da árvore ANTES da operação: os grupos do registro que
// não estavam nela (de outra aba do site) são preservados; os que estavam e sumiram (ficaram vazios) saem do registro.
function aplicar(doc, raiz, antes) {
  raiz = podar(raiz);
  const elementos = [], grupos = [];
  const visitar = (nos, paiId) => {
    for (const n of nos) {
      if (ehGrupo(n)) {
        const g = { id: n.id, nome: n.nome || 'Grupo' };
        if (n.hide) g.hide = true;
        if (n.lock) g.lock = true;
        if (paiId) g.g = paiId;
        grupos.push(g);
        visitar(n.filhos, n.id);
      } else {
        if (paiId) n.g = paiId; else delete n.g;
        elementos.push(n);
      }
    }
  };
  visitar(raiz, null);
  doc.elements = elementos;
  const alheios = (doc.grupos || []).filter((g) => !antes.has(g.id));
  const todos = [...alheios, ...grupos];
  if (todos.length) doc.grupos = todos; else delete doc.grupos;
}

// ---------- operações ----------

// Agrupa elementos (ou grupos) pelos ids. O grupo nasce onde está o mais à frente, no pai dele; os membros mantêm a ordem entre si.
// Devolve o id do grupo novo, ou null se não havia o que agrupar.
export function agrupar(doc, ids, nome = 'Grupo') {
  const raiz = arvoreDe(doc), antes = idsDeGrupos(raiz);
  const pedidos = new Set(ids);
  // quem já está dentro de outro pedido sobe junto com ele: não entra duas vezes
  const alvos = [...percorrer(raiz)].filter((r) => pedidos.has(r.no.id) && ![...percorrer(raiz)].some((q) => ehGrupo(q.no) && pedidos.has(q.no.id) && ehDescendente(raiz, q.no.id, r.no.id)));
  if (!alvos.length) return null;
  const chefe = alvos[alvos.length - 1];                       // percorrer() segue a ordem do array: o último está na frente
  const alvoSet = new Set(alvos.map((r) => r.no));
  const irmaos = listaDe(raiz, chefe.pai);
  const em = irmaos.slice(0, irmaos.indexOf(chefe.no)).filter((n) => !alvoSet.has(n)).length;   // posição depois de tirar os membros
  for (const r of alvos) { const L = listaDe(raiz, r.pai); L.splice(L.indexOf(r.no), 1); }
  const grupo = { t: 'grupo', id: novoIdGrupo(), nome, hide: false, lock: false, filhos: alvos.map((r) => r.no) };
  listaDe(raiz, chefe.pai).splice(em, 0, grupo);
  aplicar(doc, raiz, antes);
  return grupo.id;
}

// Desfaz grupos. Um grupo oculto/travado deixa a marca nos filhos ao sumir: senão eles reapareceriam sozinhos (decisão 3 da maquete).
// Devolve os ids dos ELEMENTOS que ficaram soltos.
export function desagrupar(doc, gids) {
  const raiz = arvoreDe(doc), antes = idsDeGrupos(raiz);
  const soltos = [];
  // do mais fundo para o mais raso: desfazer o de fora não invalida o de dentro
  const alvos = [...percorrer(raiz)].filter((r) => ehGrupo(r.no) && gids.includes(r.no.id)).reverse();
  for (const r of alvos) {
    const L = listaDe(raiz, r.pai), at = L.indexOf(r.no);
    if (at < 0) continue;
    for (const f of r.no.filhos) { if (r.no.hide) f.hide = true; if (r.no.lock) f.lock = true; }
    L.splice(at, 1, ...r.no.filhos);
    soltos.push(...r.no.filhos.flatMap(folhas).map((e) => e.id));
  }
  if (!alvos.length) return [];
  aplicar(doc, raiz, antes);
  return soltos;
}

// Dá para soltar `id` em `destinoId`? Não se solta uma camada sobre si mesma nem um grupo dentro do que ele contém.
export function podeMover(doc, id, destinoId) {
  if (id === destinoId) return false;
  const raiz = arvoreDe(doc);
  return !!achar(raiz, id) && !!achar(raiz, destinoId) && !ehDescendente(raiz, id, destinoId);
}

// Move uma camada (elemento ou grupo): `{ dentro: idDoGrupo }` (vai para a frente do grupo; quem chama abre o grupo na tela) ou `{ irmaoDe: id, acima: bool }`
// (acima = na frente do irmão, que na lista de camadas é "em cima"). Devolve false se o movimento não vale.
export function moverCamada(doc, id, destino) {
  const raiz = arvoreDe(doc), antes = idsDeGrupos(raiz);
  const r = achar(raiz, id);
  const alvoId = destino?.dentro ?? destino?.irmaoDe;
  if (!r || !alvoId || alvoId === id || ehDescendente(raiz, id, alvoId)) return false;
  const alvo = achar(raiz, alvoId);
  if (!alvo || (destino.dentro && !ehGrupo(alvo.no))) return false;
  const origem = listaDe(raiz, r.pai);
  origem.splice(origem.indexOf(r.no), 1);
  if (destino.dentro) alvo.no.filhos.push(r.no);
  else {
    const L = listaDe(raiz, alvo.pai), i = L.indexOf(alvo.no);   // o índice só vale depois de tirar a camada (podia ser da mesma lista)
    L.splice(destino.acima ? i + 1 : i, 0, r.no);
  }
  aplicar(doc, raiz, antes);
  return true;
}

// Muda a ordem de empilhamento dentro da LISTA de cada pedido: 'front' | 'back' | 'up' | 'down'. Um grupo inteiro selecionado anda como uma
// peça só; um elemento anda entre os irmãos dele (não escapa do grupo). Sem grupos é exatamente o `reorder` de sempre. Devolve se mudou algo.
export function reordenar(doc, ids, modo) {
  const raiz = arvoreDe(doc), antes = idsDeGrupos(raiz), quer = new Set(ids), porLista = new Map();
  const visitar = (lista) => {
    for (const n of lista) {
      const fs = folhas(n);
      if (fs.length && fs.every((e) => quer.has(e.id))) { if (!porLista.has(lista)) porLista.set(lista, new Set()); porLista.get(lista).add(n); }
      else if (ehGrupo(n)) visitar(n.filhos);
    }
  };
  visitar(raiz);
  const ordemAntes = doc.elements.map((e) => e.id).join();
  for (const [L, escolhidos] of porLista) {
    if (modo === 'front') L.splice(0, L.length, ...L.filter((n) => !escolhidos.has(n)), ...L.filter((n) => escolhidos.has(n)));
    else if (modo === 'back') L.splice(0, L.length, ...L.filter((n) => escolhidos.has(n)), ...L.filter((n) => !escolhidos.has(n)));
    else {
      const dir = modo === 'up' ? 1 : -1;
      const idx = L.map((n, i) => (escolhidos.has(n) ? i : -1)).filter((i) => i >= 0);
      for (const i of dir > 0 ? idx.reverse() : idx) {
        const j = i + dir;
        if (j < 0 || j >= L.length || escolhidos.has(L[j])) continue;
        [L[i], L[j]] = [L[j], L[i]];
      }
    }
  }
  aplicar(doc, raiz, antes);
  return doc.elements.map((e) => e.id).join() !== ordemAntes;
}

// Remove elementos e dissolve os grupos que ficarem sem nenhum.
export function removerElementos(doc, ids) {
  const fora = new Set(ids), tocados = new Set();
  for (const e of doc.elements || []) {
    if (!fora.has(e.id)) continue;
    for (let gid = e.g, n = 0; gid && n < PROFUNDIDADE_MAX; n++) { tocados.add(gid); gid = grupoPorId(doc, gid)?.g; }
  }
  doc.elements = (doc.elements || []).filter((e) => !fora.has(e.id));
  if (!tocados.size) return;
  const vivos = new Set();
  for (const e of doc.elements) for (let gid = e.g, n = 0; gid && n < PROFUNDIDADE_MAX; n++) { vivos.add(gid); gid = grupoPorId(doc, gid)?.g; }
  const resto = (doc.grupos || []).filter((g) => !tocados.has(g.id) || vivos.has(g.id));
  if (resto.length) doc.grupos = resto; else delete doc.grupos;
}

// ---------- seleção ----------

// Ids dos elementos (as folhas) de um grupo, na ordem de empilhamento.
export function idsDoGrupo(doc, gid) {
  const r = achar(arvoreDe(doc), gid);
  return r && ehGrupo(r.no) ? folhas(r.no).map((e) => e.id) : [];
}

// Os grupos (os mais externos) cujo conteúdo está TODO na seleção: são os que "Desagrupar" desfaz.
export function gruposCompletos(doc, sel) {
  const quer = new Set(sel || []), out = [];
  const visitar = (nos) => {
    for (const n of nos) {
      if (!ehGrupo(n)) continue;
      const fs = folhas(n);
      if (fs.length && fs.every((e) => quer.has(e.id))) out.push(n.id); else visitar(n.filhos);
    }
  };
  if (doc?.grupos?.length) visitar(arvoreDe(doc));
  return out;
}

// Se a seleção é exatamente o conteúdo de UM grupo, devolve o registro dele (o mais externo, se houver vários iguais).
export function grupoDaSelecao(doc, sel) {
  if (!sel?.length || !doc?.grupos?.length) return null;
  const quer = new Set(sel);
  for (const r of percorrer(arvoreDe(doc))) {
    if (!ehGrupo(r.no)) continue;
    const ids = folhas(r.no).map((e) => e.id);
    if (ids.length === quer.size && ids.every((id) => quer.has(id))) return grupoPorId(doc, r.no.id);
  }
  return null;
}

// Uma cópia (duplicar/colar) não herda o grupo: nasce na raiz, senão entraria no grupo de fora de ordem.
export const semGrupo = (el) => { delete el.g; return el; };
