// Catálogo de ferramentas do ArtAtk e a configuração da barra montada pela pessoa — lógica PURA (sem DOM), testável como dock-layout.js.
//
// O catálogo diz O QUE existe (nome, atalho, categoria, estado); `via` diz COMO se executa e quem executa é o editor (barra.js). A barra de cada
// pessoa é uma lista de SLOTS; cada slot é uma lista de ferramentas — a primeira é a cara do botão, as outras ficam no leque (clique longo).
// Os ids são gravados nas preferências da conta: nunca mudam de significado (um id removido do catálogo some da barra sozinho).
// Ver D-0055 e experimentos/interface-ferramentas/README.md (a maquete que originou isto).

// `estado`: 'pronta' = funciona no editor hoje · 'planejada' = há requisito escrito · 'ideia' = só esboço.
// `via`: { tool } liga a ferramenta (S.tool) · { tool:'shape', kind } liga a ferramenta de forma com aquele formato · { acao } executa na hora.
export const CATALOGO = [
  // --- selecionar
  { id: 'select',   nome: 'Selecionar',        atalho: 'V', cat: 'Selecionar', icone: 'cursor',     estado: 'pronta',    via: { tool: 'select' },  dica: 'Escolher e mover elementos' },
  { id: 'nos',      nome: 'Editar nós',        atalho: 'A', cat: 'Selecionar', icone: 'nos',        estado: 'pronta',    via: { acao: 'nos' },     dica: 'Mexer nos pontos e nas alças do desenho ou da forma selecionados (também: Enter ou duplo clique no desenho)' },
  { id: 'hand',     nome: 'Mover a vista',     atalho: 'H', cat: 'Selecionar', icone: 'hand',       estado: 'pronta',    via: { tool: 'hand' },    dica: 'Arrastar o canvas' },
  { id: 'zoom',     nome: 'Zoom',              atalho: 'Z', cat: 'Selecionar', icone: 'lupa',       estado: 'pronta',    via: { tool: 'zoom' },    dica: 'Clique aproxima, Alt + clique afasta' },
  // --- desenho
  { id: 'shape',    nome: 'Retângulo',         atalho: 'R', cat: 'Desenho',    icone: 'square',     estado: 'pronta',    via: { tool: 'shape', kind: 'rect' },    dica: 'Arraste no canvas' },
  { id: 'elipse',   nome: 'Elipse',            atalho: 'E', cat: 'Desenho',    icone: 'circle',     estado: 'pronta',    via: { tool: 'shape', kind: 'ellipse' }, dica: 'Arraste no canvas' },
  { id: 'estrela',  nome: 'Estrela',           atalho: '',  cat: 'Desenho',    icone: 'estrela',    estado: 'pronta',    via: { tool: 'shape', kind: 'star' },    dica: 'Estrela com pontas ajustáveis' },
  { id: 'linha',    nome: 'Linha',             atalho: 'L', cat: 'Desenho',    icone: 'linha',      estado: 'pronta',    via: { tool: 'shape', kind: 'line' },    dica: 'Segmento reto' },
  { id: 'seta',     nome: 'Seta',              atalho: '',  cat: 'Desenho',    icone: 'seta',       estado: 'pronta',    via: { tool: 'shape', kind: 'arrow' },   dica: 'Linha com ponta' },
  { id: 'pencil',   nome: 'Lápis',             atalho: 'P', cat: 'Desenho',    icone: 'pencil',     estado: 'pronta',    via: { tool: 'pencil' },  dica: 'Traço livre' },
  { id: 'caneta',   nome: 'Caneta',            atalho: 'B', cat: 'Desenho',    icone: 'caneta',     estado: 'pronta',    via: { tool: 'caneta' }, dica: 'Clique faz um ponto; clique e arraste faz uma curva; clicar no primeiro ponto fecha; Enter termina; Esc cancela' },
  { id: 'borracha', nome: 'Borracha',          atalho: '',  cat: 'Desenho',    icone: 'borracha',   estado: 'ideia',     via: null,                 dica: 'Apagar traço' },
  // --- texto
  { id: 'text',     nome: 'Texto',             atalho: 'T', cat: 'Texto',      icone: 'text',       estado: 'pronta',    via: { tool: 'text' },    dica: 'Caixa de texto' },
  { id: 'textocurva', nome: 'Texto em curva',  atalho: '',  cat: 'Texto',      icone: 'textocurva', estado: 'ideia',     via: null,                 dica: 'Texto seguindo um caminho' },
  // --- imagem
  { id: 'image',    nome: 'Imagem',            atalho: '',  cat: 'Imagem',     icone: 'image',      estado: 'pronta',    via: { acao: 'imagem' },  dica: 'Inserir imagem' },
  { id: 'wand',     nome: 'Varinha mágica',    atalho: 'W', cat: 'Imagem',     icone: 'wand',       estado: 'pronta',    via: { tool: 'wand' },    dica: 'Clique numa imagem para tirar o fundo (EI-09)' },
  { id: 'recorte',  nome: 'Recortar',          atalho: 'C', cat: 'Imagem',     icone: 'crop',       estado: 'pronta',    via: { acao: 'recorte' }, dica: 'Aparar a imagem selecionada' },
  { id: 'contagotas', nome: 'Conta-gotas',     atalho: 'I', cat: 'Imagem',     icone: 'eyedrop',    estado: 'pronta',    via: { acao: 'contagotas' }, dica: 'Pegar a cor de qualquer ponto da tela e aplicar no elemento selecionado' },
  { id: 'mascara',  nome: 'Máscara',           atalho: '',  cat: 'Imagem',     icone: 'mascara',    estado: 'ideia',     via: null,                 dica: 'Esconder parte com uma forma' },
  // --- vetor
  { id: 'bool',     nome: 'Booleanas',         atalho: '',  cat: 'Vetor',      icone: 'bool',       estado: 'planejada', via: null,                 dica: 'União, subtração, interseção (VT-20)' },
  { id: 'simplificar', nome: 'Simplificar',    atalho: '',  cat: 'Vetor',      icone: 'simplificar', estado: 'planejada', via: null,                dica: 'Reduzir nós do caminho' },
  { id: 'contorno', nome: 'Contorno do traço', atalho: '',  cat: 'Vetor',      icone: 'contorno',   estado: 'planejada', via: null,                 dica: 'Virar o traço em forma (VT-24)' },
  // --- medida
  { id: 'regua',    nome: 'Réguas e guias',    atalho: '',  cat: 'Medida',     icone: 'regua',      estado: 'pronta',    via: { acao: 'reguas' },  dica: 'Mostrar ou esconder as réguas (puxe guias delas)' },
  { id: 'grade',    nome: 'Grade',             atalho: '',  cat: 'Medida',     icone: 'grade',      estado: 'pronta',    via: { acao: 'grade' },   dica: 'Ligar ou desligar a grade' },
  { id: 'medir',    nome: 'Medir',             atalho: '',  cat: 'Medida',     icone: 'medir',      estado: 'ideia',     via: null,                 dica: 'Distância entre dois pontos' },
  { id: 'comentario', nome: 'Comentário',      atalho: '',  cat: 'Medida',     icone: 'comentario', estado: 'ideia',     via: null,                 dica: 'Recado para a equipe' },
];
export const porId = Object.fromEntries(CATALOGO.map((f) => [f.id, f]));
export const CATS = [...new Set(CATALOGO.map((f) => f.cat))];
export const prontas = () => CATALOGO.filter((f) => f.estado === 'pronta');

// ---------- configuração ----------
export const FERR_V = 1;
export const TAMANHOS = [32, 38, 46];
export const ANCORAS = ['livre', 'esquerda', 'direita', 'topo', 'base'];
export const MARGEM = 30;                         // distância da borda do palco quando a barra está encaixada (passa das réguas de 22 px)
export const SLOTS_MAX = 40;
export const chaveFerramentas = (slug) => `gehrarte.ferramentas.${slug}`;

// O padrão tem as ferramentas que o editor sempre teve, na mesma ordem (e com as mesmas letras): quem não personalizou nada não perde nada.
// As formas ficam no leque do Retângulo, o recorte no da Varinha. Só entra ferramenta que existe de verdade.
export const PADRAO = () => ({
  v: FERR_V,
  barra: {
    slots: [['select'], ['text'], ['shape', 'elipse', 'estrela', 'linha', 'seta'], ['pencil'], ['wand', 'recorte'], ['hand'], ['image']],
    pos: { x: MARGEM, y: MARGEM },                // relativa ao palco
    orient: 'v',                                  // 'v' | 'h'
    tam: 38,                                      // 32 | 38 | 46
    rotulos: false,
    ancora: 'esquerda',                           // 'livre' | 'esquerda' | 'direita' | 'topo' | 'base'
    visivel: true,
  },
  bandeja: { pos: { x: MARGEM + 58, y: MARGEM }, aberta: false, aba: 'ferramentas' },   // `aba`: 'ferramentas' ou o id de um painel guardado no baú (D-0058)
});

const num = (v, d, lo, hi) => (Number.isFinite(+v) && v !== null && v !== '' ? Math.min(hi, Math.max(lo, +v)) : d);
export const clonar = (o) => JSON.parse(JSON.stringify(o));
export const iguais = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Leitura defensiva, no espírito do normalize() do dock-layout.js: entra qualquer coisa, sai SEMPRE uma configuração inteira.
// Id repetido ou que não existe mais some; slot vazio some; número fora da faixa é puxado para a faixa.
export function normalizar(bruto) {
  const p = PADRAO();
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return p;
  const b = bruto.barra && typeof bruto.barra === 'object' ? bruto.barra : {};
  const vistas = new Set();
  const slots = Array.isArray(b.slots)
    ? b.slots.slice(0, SLOTS_MAX)
      .map((s) => (Array.isArray(s) ? s : [s]).filter((id) => typeof id === 'string' && porId[id] && !vistas.has(id) && vistas.add(id)))
      .filter((s) => s.length)
    : null;
  const bj = bruto.bandeja && typeof bruto.bandeja === 'object' ? bruto.bandeja : {};
  return {
    v: FERR_V,
    barra: {
      slots: slots || p.barra.slots,                // lista (até vazia) vale; qualquer outra coisa volta ao padrão
      pos: { x: num(b.pos?.x, p.barra.pos.x, -2000, 4000), y: num(b.pos?.y, p.barra.pos.y, -2000, 4000) },
      orient: b.orient === 'h' ? 'h' : 'v',
      tam: TAMANHOS.includes(b.tam) ? b.tam : 38,
      rotulos: !!b.rotulos,
      ancora: ANCORAS.includes(b.ancora) ? b.ancora : 'livre',
      visivel: b.visivel !== false,
    },
    bandeja: { pos: { x: num(bj.pos?.x, p.bandeja.pos.x, -2000, 4000), y: num(bj.pos?.y, p.bandeja.pos.y, -2000, 4000) }, aberta: !!bj.aberta, aba: typeof bj.aba === 'string' && /^[a-z]{1,12}$/.test(bj.aba) ? bj.aba : 'ferramentas' },
  };
}

// ---------- operações sobre a barra (mexem em `cfg` no lugar; devolvem se mudaram algo) ----------
export const naBarra = (cfg, id) => cfg.barra.slots.some((s) => s.includes(id));
export const slotDe = (cfg, id) => cfg.barra.slots.findIndex((s) => s.includes(id));

// Põe a ferramenta numa vaga da barra. `alvo`: { tipo:'entre', idx } (um botão novo ANTES do slot idx; idx = nº de slots põe no fim) ou
// { tipo:'dentro', slot } (entra no leque do slot). Os índices valem para a lista de slots como está ANTES de tirar a ferramenta de
// onde estava (se já estava na barra, ela é movida, não duplicada).
export function colocar(cfg, id, alvo) {
  if (!porId[id] || !alvo) return false;
  const S = cfg.barra.slots, n = S.length;
  let destino = alvo.tipo === 'dentro' ? alvo.slot : alvo.idx;
  if (!Number.isInteger(destino) || destino < 0 || destino > n || (alvo.tipo === 'dentro' && destino === n)) return false;
  const de = slotDe(cfg, id);
  if (alvo.tipo === 'dentro' && de === destino) return false;                       // já está nesse leque
  if (de < 0 && n >= SLOTS_MAX && alvo.tipo === 'entre') return false;
  if (de >= 0) {
    S[de] = S[de].filter((x) => x !== id);
    if (!S[de].length) { S.splice(de, 1); if (destino > de) destino--; }
  }
  if (alvo.tipo === 'dentro') S[destino] = [...S[destino], id]; else S.splice(destino, 0, [id]);
  return true;
}

// Tira da barra (continua no catálogo/bandeja). O slot que ficar vazio some.
export function tirar(cfg, id) {
  const de = slotDe(cfg, id);
  if (de < 0) return false;
  const S = cfg.barra.slots;
  S[de] = S[de].filter((x) => x !== id);
  if (!S[de].length) S.splice(de, 1);
  return true;
}

// A ferramenta escolhida vira a cara do slot (como no Affinity: a última usada fica à mostra).
export function trazerAFrente(cfg, id) {
  const i = slotDe(cfg, id);
  if (i < 0 || cfg.barra.slots[i][0] === id) return false;
  cfg.barra.slots[i] = [id, ...cfg.barra.slots[i].filter((x) => x !== id)];
  return true;
}

// Cada ferramenta do leque vira um botão próprio.
export function separar(cfg, i) {
  const s = cfg.barra.slots[i];
  if (!s || s.length < 2) return false;
  cfg.barra.slots.splice(i, 1, ...s.map((id) => [id]));
  return true;
}

// A letra de atalho só vale se a ferramenta estiver NA BARRA (a barra é a seleção rápida da pessoa). Devolve o id ou null.
export function ferramentaDoAtalho(cfg, tecla) {
  const k = String(tecla || '').toUpperCase();
  if (k.length !== 1) return null;
  for (const slot of cfg.barra.slots) for (const id of slot) if (porId[id].atalho === k) return id;
  return null;
}
