// Catálogo de folhas de design que vem junto com o ArtAtk. Só DADOS: a lógica está em core/folhas.js.
//
// A folha do MUVVI (Museu Virtual do Vale do Ivaí) nasce do MESMO tema do modelo de site do museu — modelos/muvvi-site/spec.json,
// chave `tema` — para cor e fonte não terem duas verdades. Ao mudar o tema lá, mude aqui: o tema está repetido de propósito (o
// editor não busca o spec na rede só para desenhar o painel), e tests/folhas.test.mjs confere que os dois continuam iguais.
import { folhaDoTema, normalizarFolha } from './folhas.js';
import { FOLHAS_INTERFACE } from './folhas-interface.js';

// cópia do `tema` de modelos/muvvi-site/spec.json
export const TEMA_MUVVI = {
  fundo: '#fcfbf6', texto: '#1b1b18', suave: '#55574f', escuro: '#0e3e20', sobreEscuro: '#ffffff',
  acento: '#86a3fc', sobreAcento: '#0e3e20', superficie: '#efeadb',
  fonteTitulo: 'Libre Caslon Text', fonteTexto: 'Andika', raio: 14,
};

const V = { escuro: '#0e3e20', mata: '#1f6b3a', folha: '#3aa675', creme: '#fcfbf6', superficie: '#efeadb', acento: '#86a3fc', suave: '#55574f' };

// Desenhos da identidade do museu: o rio que dá nome ao vale, o relevo, a mata, o losango que separa as cidades no roteiro,
// o selo e a moldura do acervo. Sem texto (fonte não viaja dentro de SVG) e sem script — entram pelo sanitizador do editor.
const SVGS_MUVVI = [
  { nome: 'Rio Ivaí', code: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 120"><path fill="${V.escuro}" fill-opacity=".28" d="M0 64C48 40 96 88 160 64S272 40 320 64v56H0Z"><animate attributeName="d" dur="9s" repeatCount="indefinite" values="M0 64C48 40 96 88 160 64S272 40 320 64v56H0Z;M0 64C48 88 96 40 160 64S272 88 320 64v56H0Z;M0 64C48 40 96 88 160 64S272 40 320 64v56H0Z"/></path><path fill="${V.mata}" d="M0 78C52 56 104 100 160 78S268 56 320 78v42H0Z"><animate attributeName="d" dur="6.5s" repeatCount="indefinite" values="M0 78C52 56 104 100 160 78S268 56 320 78v42H0Z;M0 78C52 100 104 56 160 78S268 100 320 78v42H0Z;M0 78C52 56 104 100 160 78S268 56 320 78v42H0Z"/></path></svg>` },
  { nome: 'Serra do vale', code: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 160"><path fill="${V.folha}" fill-opacity=".45" d="M0 132 88 52l54 52 44-36 60 64 74-44v44Z"/><path fill="${V.mata}" d="M0 160 70 86l58 50 48-30 62 54H0Z"/><path fill="${V.escuro}" d="M0 160 96 112l54 26 56-18 114 40Z"/></svg>` },
  { nome: 'Mata ciliar', code: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><g fill="none" stroke="${V.escuro}" stroke-width="5" stroke-linecap="round"><path d="M80 150V46"/><path d="M80 104c-26 0-40-16-44-40 26-4 42 10 44 40Z" fill="${V.folha}" stroke-width="4"/><path d="M80 78c24-2 38-18 40-42-26-2-40 12-40 42Z" fill="${V.mata}" stroke-width="4"/><path d="M80 134c-20 0-32-12-36-30 20-4 34 6 36 30Z" fill="${V.folha}" fill-opacity=".7" stroke-width="4"/></g></svg>` },
  { nome: 'Separador ◆', code: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 24"><g fill="none" stroke="${V.suave}" stroke-width="1.5"><path d="M8 12h108M204 12h108"/></g><g fill="${V.escuro}"><path d="M136 12l10-9 10 9-10 9z"/><path d="M160 12l10-9 10 9-10 9z" fill="${V.acento}"/><path d="M184 12l10-9 10 9-10 9z"/></g></svg>` },
  { nome: 'Selo do museu', code: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><circle cx="60" cy="60" r="56" fill="${V.escuro}"/><circle cx="60" cy="60" r="46" fill="none" stroke="${V.creme}" stroke-opacity=".5" stroke-width="1.5"/><path d="M60 28l26 32-26 32-26-32z" fill="${V.acento}"/><path d="M60 44l14 16-14 16-14-16z" fill="${V.escuro}"/></svg>` },
  { nome: 'Moldura de acervo', code: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150"><rect x="3" y="3" width="194" height="144" rx="6" fill="${V.superficie}" stroke="${V.escuro}" stroke-width="2"/><g fill="none" stroke="${V.escuro}" stroke-width="3"><path d="M20 20h22M20 20v18M180 20h-22M180 20v18M20 130h22M20 130v-18M180 130h-22M180 130v-18"/></g><circle cx="100" cy="66" r="18" fill="none" stroke="${V.mata}" stroke-width="3"/><path d="M60 110l28-26 20 18 16-14 24 22" fill="none" stroke="${V.mata}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>` },
  { nome: 'Névoa do vale', bg: true, code: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice"><defs><filter id="nv" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="90"/></filter></defs><rect width="1200" height="800" fill="${V.creme}"/><g filter="url(#nv)"><circle r="300" cx="260" cy="620" fill="${V.folha}" opacity=".35"><animate attributeName="cy" values="620;520;620" dur="18s" repeatCount="indefinite"/></circle><circle r="260" cx="940" cy="220" fill="${V.acento}" opacity=".35"><animate attributeName="cx" values="940;760;940" dur="22s" repeatCount="indefinite"/></circle><circle r="220" cx="620" cy="420" fill="${V.superficie}" opacity=".8"/></g></svg>` },
];

// Aves do Vale — desenhos GERADOS, base e prova de conceito (2026-10-10).
//
// LEIA ANTES DE USAR NUMA PÁGINA PUBLICADA:
//   - não são identificação científica. A silhueta é genérica e não representa plumagem, medida
//     nem proporção de nenhuma espécie em particular;
//   - a lista de aves do Vale do Ivaí ainda NÃO foi levantada — isso é parte do Eixo 1 do Roteiro
//     Curatorial ("paisagens e biodiversidade: fauna, flora e áreas de preservação");
//   - antes de publicar, ou a curadoria confirma espécie por espécie com fonte, ou o setor de
//     design refaz os desenhos a partir de referência fotográfica creditada.
// O sufixo "(gerada)" no nome existe para que isso apareça no painel, e não só aqui no código.
const avesEm = (tinta, claro) => [
  { nome: 'Ave pousada (gerada)', code: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="Desenho gerado: silhueta de ave pousada num galho, vista de perfil"> <g fill="${tinta}"> <path d="M70 40c16 0 28 12 28 27 0 16-14 28-32 28-14 0-24-6-29-16l-9 3 7-9c-2-4-3-8-3-12 0-12 8-21 19-21Z"/> <circle cx="48" cy="44" r="15"/> <path d="M34 44 12 49l22 7Z"/> <path d="M92 60 118 48l-8 22Z"/> </g> <circle cx="43" cy="41" r="3" fill="${claro}"/> <g fill="none" stroke="${tinta}" stroke-width="3" stroke-linecap="round"> <path d="M62 95v12M76 94v13"/> <path d="M18 108h88"/> </g> <path d="M60 58c14-2 24 4 28 16-12 6-23 4-30-5Z" fill="${claro}" fill-opacity=".22"/> </svg>` },
  { nome: 'Ave em voo (gerada)', code: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 110" role="img" aria-label="Desenho gerado: silhueta de ave em voo, de perfil, com uma asa para cima e outra para baixo"> <g fill="${tinta}"> <path d="M70 55c0-9 10-16 25-16 14 0 26 6 35 14l28 4-28 4c-9 8-21 14-35 14-15 0-25-7-25-16 0-1 0-3 0-4Z"/> <path d="M88 44C74 26 52 14 22 10c14 16 25 29 32 42Z"/> <path d="M88 66c-14 18-36 30-66 34 14-16 25-29 32-42Z"/> <path d="M70 46 44 40l6 15-6 15 26-6Z"/> </g> <circle cx="120" cy="51" r="3" fill="${claro}"/> </svg>` },
  { nome: 'Ave pernalta (gerada)', code: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 150" role="img" aria-label="Desenho gerado: silhueta de ave pernalta de pescoço longo, parada na beira da água"> <g fill="${tinta}"> <path d="M44 76c18 0 32 10 32 22 0 13-13 22-31 22-16 0-28-9-28-21 0-13 11-23 27-23Z"/> <path d="M62 80c-6-10-8-21-4-31 4-11 14-16 22-13 7 3 9 11 5 17-3 5-9 7-12 4 4 7 3 16-3 23Z"/> <path d="M86 42 112 36 88 54Z"/> <path d="M18 92c-6 10-14 16-18 18 8 2 18 0 26-6Z"/> </g> <circle cx="83" cy="42" r="2.6" fill="${claro}"/> <g fill="none" stroke="${tinta}" stroke-width="3.5" stroke-linecap="round"> <path d="M42 120v22M58 120v22"/> <path d="M34 142h16M50 142h16"/> </g> </svg>` },
  { nome: 'Ave pescadora (gerada)', code: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 130" role="img" aria-label="Desenho gerado: silhueta de ave de bico longo pousada num poleiro sobre a água"> <g fill="${tinta}"> <path d="M72 38c15 0 26 12 26 28 0 18-12 32-29 32-13 0-22-8-22-20 0-6 2-12 5-17-4-6-5-14-2-20 4-2 9-2 13 0 3-2 6-3 9-3Z"/> <path d="M50 40 8 34l42 12Z"/> <path d="M94 66c12 2 22 10 28 22-12 2-23-2-31-12Z"/> </g> <circle cx="66" cy="38" r="3" fill="${claro}"/> <g fill="none" stroke="${tinta}" stroke-width="3" stroke-linecap="round"> <path d="M66 98v10M80 97v11"/> <path d="M26 108h84"/> </g> <g fill="none" stroke="${tinta}" stroke-width="2.5" stroke-linecap="round" opacity=".55"> <path d="M14 120c12-5 24 5 36 0s24 5 36 0 24 5 30 0"/> </g> </svg>` },
  { nome: 'Ave cantando (gerada)', code: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 120" role="img" aria-label="Desenho gerado: silhueta de ave com o bico aberto, cantando"> <g fill="${tinta}"> <path d="M78 42c17 0 29 13 29 29 0 17-14 29-33 29-15 0-25-7-29-18l-9 3 7-9c-2-4-2-8-2-12 0-13 10-22 23-22Z"/> <circle cx="56" cy="44" r="15"/> <path d="M42 40 20 36l22 9Z"/> <path d="M42 50 20 58l22-3Z"/> <path d="M100 62 128 50l-8 23Z"/> </g> <circle cx="51" cy="41" r="3" fill="${claro}"/> <g fill="none" stroke="${tinta}" stroke-width="2.5" stroke-linecap="round" opacity=".7"> <path d="M12 26c-4 6-4 14 0 20M4 18c-7 10-7 26 0 36"/> </g> <g fill="none" stroke="${tinta}" stroke-width="3" stroke-linecap="round"> <path d="M70 100v10M84 99v11"/> <path d="M30 110h84"/> </g> </svg>` },
  { nome: 'Par no galho (gerada)', code: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 110" role="img" aria-label="Desenho gerado: silhuetas de duas aves pousadas no mesmo galho"> <g fill="${tinta}"> <path d="M48 34c12 0 21 9 21 21 0 12-10 21-24 21-11 0-18-5-21-13l-7 2 5-7c-1-3-2-6-2-9 0-9 7-15 15-15Z"/> <circle cx="33" cy="37" r="11"/> <path d="M22 37 6 41l16 5Z"/> <path d="M65 48 86 39l-6 17Z"/> <path d="M132 40c12 0 21 9 21 21 0 12-10 21-24 21-11 0-18-5-21-13l-7 2 5-7c-1-3-2-6-2-9 0-9 7-15 15-15Z"/> <circle cx="117" cy="43" r="11"/> <path d="M106 43 90 47l16 5Z"/> <path d="M149 54 170 45l-6 17Z"/> </g> <circle cx="30" cy="35" r="2.2" fill="${claro}"/> <circle cx="114" cy="41" r="2.2" fill="${claro}"/> <g fill="none" stroke="${tinta}" stroke-width="2.6" stroke-linecap="round"> <path d="M42 76v9M54 75v10M126 82v7M138 81v8"/> <path d="M10 90h160"/> </g> </svg>` },];

// ---------------------------------------------------------------------------------------------
// O MATERIAL REAL do museu (2026-10-12): a logomarca e os cinco ícones de eixo, entregues pelo
// artista. Entram como `imagens` da folha — arquivo servido pelo site, não SVG embutido: eles
// chegaram em WebP/PNG e embutir meio megabyte de base64 no código seria absurdo. O editor busca o
// arquivo na hora de inserir, e o que vai para o projeto é a imagem embutida como qualquer outra.
//
// Relação com os desenhos de ave de avesEm(): aquelas são GERADAS e genéricas, e continuam aqui
// como rascunho de composição — estas são a identidade de verdade. Quando a curadoria decidir que
// as aves saem, é só parar de passá-las em `svgs`; nada mais depende delas.
//
// Os ícones são a versão recortada em círculo (640 px), a mesma que os projetos do museu usam: o
// arquivo original traz a arte num disco sobre fundo preto, que viraria moldura escura sobre o
// papel creme. A logomarca é PNG com transparência real (1031 × 299, proporção 3,45 : 1) — ainda
// são 544 KB, porque esta máquina não tem conversor de imagem; vale regerar em WebP quando houver.
const IMAGENS_MUVVI = [
  { nome: 'Logomarca', src: 'assets/marca/muvvi/logo-muvvi.png',
    alt: 'Logomarca do MUVVI — Museu Virtual do Vale do Ivaí',
    nota: 'Deitada, 3,45 : 1. No topo das páginas ela dispensa o nome escrito ao lado.' },
  { nome: 'Abertura — ave sobre o rio', src: 'assets/marca/muvvi/abertura-ave-sobre-o-rio.webp',
    alt: 'Arte de abertura do museu: uma ave sobre o rio', nota: 'A arte de capa, recortada em círculo.' },
  { nome: 'Ícone — Patrimônio Natural', src: 'assets/marca/muvvi/icone-natural.webp',
    alt: 'Ícone do eixo de patrimônio natural', nota: 'Eixo 1 · O Rio que dá nome ao Vale.' },
  { nome: 'Ícone — Patrimônio Arqueológico', src: 'assets/marca/muvvi/icone-arqueologico.webp',
    alt: 'Ícone do eixo de patrimônio arqueológico', nota: 'Eixo 2 · Vestígios do Tempo.' },
  { nome: 'Ícone — Patrimônio Arquitetônico', src: 'assets/marca/muvvi/icone-arquitetonico.webp',
    alt: 'Ícone do eixo de patrimônio arquitetônico', nota: 'Eixo 3 · Arquiteturas da Memória.' },
  { nome: 'Ícone — Patrimônio Histórico', src: 'assets/marca/muvvi/icone-historico.webp',
    alt: 'Ícone do eixo de patrimônio histórico', nota: 'Eixo 4 · Coleções, Memórias e Cotidianos.' },
  { nome: 'Ícone — Patrimônio Imaterial', src: 'assets/marca/muvvi/icone-imaterial.webp',
    alt: 'Ícone do eixo de patrimônio imaterial', nota: 'Eixo 5 · Saberes, Fazeres e Festas. É dele que saíram as paletas.' },
];

// Formas já no estilo da casa: inseridas com o preenchimento, o traço e o raio certos, sem passar pelo painel de propriedades.
const FORMAS_MUVVI = [
  { nome: 'Cartão', shape: 'rect', s: { fill: TEMA_MUVVI.superficie, stroke: null, radius: TEMA_MUVVI.raio } },
  { nome: 'Faixa escura', shape: 'rect', s: { fill: TEMA_MUVVI.escuro, stroke: null, radius: TEMA_MUVVI.raio } },
  { nome: 'Contorno', shape: 'rect', s: { fill: null, stroke: TEMA_MUVVI.escuro, sw: 2, radius: TEMA_MUVVI.raio } },
  { nome: 'Pílula de acento', shape: 'rect', s: { fill: TEMA_MUVVI.acento, stroke: null, radius: 9999 } },
  { nome: 'Divisória', shape: 'line', s: { fill: null, stroke: TEMA_MUVVI.suave, sw: 1.5 } },
  { nome: 'Losango', shape: 'diamond', s: { fill: TEMA_MUVVI.escuro, stroke: null } },
];

export const FOLHA_MUVVI = normalizarFolha({
  ...folhaDoTema(TEMA_MUVVI, {
    id: 'muvvi',
    nome: 'MUVVI — Museu Virtual do Vale do Ivaí',
    descricao: 'Verde do vale, creme de papel e azul de acento; Libre Caslon Text nos títulos e Andika no texto. Vem do modelo de site do museu.',
  }),
  formas: FORMAS_MUVVI,
  svgs: [...SVGS_MUVVI, ...avesEm(V.escuro, V.creme)],
  imagens: IMAGENS_MUVVI,
});

// A casa: as cores e as fontes do próprio Gehrarte, para quem edita o blog e as páginas do site.
export const FOLHA_GEHRARTE = normalizarFolha({
  id: 'gehrarte',
  nome: 'Gehrarte — blog e site',
  descricao: 'Laranja da marca, roxo de apoio e o cinza-escuro do texto; Space Grotesk nos títulos e Inter no texto.',
  raio: 12,
  cores: [
    { id: 'fundo', nome: 'Fundo', valor: '#ffffff', papel: 'fundo' },
    { id: 'papel', nome: 'Papel', valor: '#f4f2fa', papel: 'superficie' },
    { id: 'tinta', nome: 'Tinta', valor: '#17161d', papel: 'texto' },
    { id: 'suave', nome: 'Texto suave', valor: '#5d5a6b', papel: 'suave' },
    { id: 'laranja', nome: 'Laranja Gehrarte', valor: '#e4572e', papel: 'marca' },
    { id: 'roxo', nome: 'Roxo', valor: '#7b5cff', papel: 'acento' },
    { id: 'ouro', nome: 'Ouro', valor: '#ffb703', papel: 'acento' },
    { id: 'claro', nome: 'Sobre a marca', valor: '#ffffff', papel: 'sobre' },
  ],
  fontes: [{ nome: 'Space Grotesk', uso: 'Títulos' }, { nome: 'Inter', uso: 'Texto' }],
  formas: [
    { nome: 'Cartão', shape: 'rect', s: { fill: '#f4f2fa', stroke: null, radius: 12 } },
    { nome: 'Botão', shape: 'rect', s: { fill: '#e4572e', stroke: null, radius: 9999 } },
    { nome: 'Contorno', shape: 'rect', s: { fill: null, stroke: '#17161d', sw: 2, radius: 12 } },
    { nome: 'Divisória', shape: 'line', s: { fill: null, stroke: '#5d5a6b', sw: 1.5 } },
  ],
  svgs: [
    { nome: 'Sublinhado', code: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 40"><style>.u{fill:none;stroke:#e4572e;stroke-width:6;stroke-linecap:round;stroke-dasharray:320;stroke-dashoffset:320;animation:u 1.4s .2s ease-out forwards}@keyframes u{to{stroke-dashoffset:0}}</style><path class="u" d="M8 26C60 10 120 34 170 18S260 10 292 22"/></svg>' },
    { nome: 'Estrela da casa', code: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="#ffb703" d="M50-0Q50 50 100 50Q50 50 50 100Q50 50 0 50Q50 50 50 0Z" transform="translate(0 0)"/></svg>' },
  ],
});

// ---------------------------------------------------------------------------------------------
// As paletas do museu tiradas do ÍCONE DE PATRIMÔNIO IMATERIAL (2026-10-10)
//
// O artista entregou o ícone do Eixo 5 — a ave sobre o rio. As cores abaixo foram AMOSTRADAS do
// arquivo, região por região, e não escolhidas de cabeça: vermelho #ba291a (as letras da logo e o
// corpo da ave), verde #48a920 (os raios do fundo), verde escuro #34620e (o contorno do círculo),
// verde-água #2d8e82 e azul #37a0ba (o rio), limão #9eba1a (o olho). Da amostra para a paleta de
// interface houve um passo só: escurecer ou clarear cada cor o mínimo necessário para ela passar em
// contraste AA sobre o fundo — por isso o #ba291a das letras aparece aqui como #a8230f.
//
// São cinco: a do ícone e quatro variações de clima, todas com os mesmos papéis, para o museu
// escolher. A folha "MUVVI" original (acima) continua vindo do tema do modelo de site e não muda.
//
// O desenho de ave vem de avesEm(): o mesmo traço, pintado na cor de cada paleta. São desenhos
// GERADOS — leia o aviso na definição de avesEm antes de publicar qualquer um deles.
// Fonte da paleta e a conta de contraste de cada par: muvvi › museu/folha-de-design.html
const PALETAS_DO_ICONE = [
  {
    id: 'muvvi-xilogravura', nome: 'MUVVI — Xilogravura do Ivaí',
    descricao: 'Tirada do ícone de patrimônio imaterial: vermelho das letras sobre papel de gravura, com o verde-água do rio no acento.',
    fundo: '#fbf6ec', superficie: '#f1e6d3', texto: '#1d1a14', suave: '#5a5146',
    marca: '#a8230f', sobreMarca: '#ffffff', acento: '#1f6f66', sobreAcento: '#ffffff',
    extras: [['mata', 'Verde da mata', '#2f5c10'], ['limao', 'Limão do olho', '#8a6a0c']],
  },
  {
    id: 'muvvi-mata', nome: 'MUVVI — Mata ciliar',
    descricao: 'Os verdes do ícone no comando e o vermelho reservado para o acento. Clima de mata, não de barro.',
    fundo: '#f7faf2', superficie: '#e6efdc', texto: '#15200f', suave: '#4c5a42',
    marca: '#2f5c10', sobreMarca: '#ffffff', acento: '#a8230f', sobreAcento: '#ffffff',
    extras: [['rio', 'Verde-água', '#1f6f66'], ['limao', 'Limão', '#5c6b0e']],
  },
  {
    id: 'muvvi-rio-fundo', nome: 'MUVVI — Rio fundo (escura)',
    descricao: 'Versão noturna, feita para o mapa e para telas que ficam muito tempo abertas.',
    fundo: '#0d1714', superficie: '#15241f', texto: '#eef5ef', suave: '#a9bdb4',
    marca: '#55c06f', sobreMarca: '#07120d', acento: '#43b3c9', sobreAcento: '#06161b',
    extras: [['barro', 'Vermelho', '#e4553c'], ['limao', 'Limão', '#c9c23f']],
  },
  {
    id: 'muvvi-barranco', nome: 'MUVVI — Barranco',
    descricao: 'Terra quente: o vermelho do ícone puxado para o ocre do barranco, com verde de mata no acento.',
    fundo: '#fdf3e8', superficie: '#f6e2cc', texto: '#241509', suave: '#6a4a32',
    marca: '#9e2b12', sobreMarca: '#ffffff', acento: '#2b6b3f', sobreAcento: '#ffffff',
    extras: [['ouro', 'Ouro', '#8a5a07'], ['rio', 'Verde-água', '#1f6f66']],
  },
  {
    id: 'muvvi-arquivo', nome: 'MUVVI — Papel de arquivo',
    descricao: 'Neutra, para leitura longa de documento e de acervo: sobra o verde institucional e a cor sai da frente do conteúdo.',
    fundo: '#faf9f5', superficie: '#ecebe4', texto: '#1c1c1a', suave: '#565650',
    marca: '#0e3e20', sobreMarca: '#ffffff', acento: '#a8230f', sobreAcento: '#ffffff',
    extras: [['rio', 'Verde-água', '#1f6f66'], ['cinza', 'Cinza quente', '#6b6252']],
  },
];

// Monta a folha inteira a partir de uma paleta: cores com papel, as duas fontes do museu, as formas
// no estilo da casa e os desenhos de ave já na cor da paleta.
const folhaDoIcone = (p) => normalizarFolha({
  id: p.id, nome: p.nome, descricao: p.descricao, raio: 14,
  cores: [
    { id: 'fundo', nome: 'Fundo', valor: p.fundo, papel: 'fundo' },
    { id: 'superficie', nome: 'Superfície', valor: p.superficie, papel: 'superficie' },
    { id: 'texto', nome: 'Texto', valor: p.texto, papel: 'texto' },
    { id: 'suave', nome: 'Texto suave', valor: p.suave, papel: 'suave' },
    { id: 'marca', nome: 'Marca', valor: p.marca, papel: 'marca' },
    { id: 'sobre-marca', nome: 'Sobre a marca', valor: p.sobreMarca, papel: 'sobre' },
    { id: 'acento', nome: 'Acento', valor: p.acento, papel: 'acento' },
    { id: 'sobre-acento', nome: 'Sobre o acento', valor: p.sobreAcento, papel: 'sobre' },
    ...p.extras.map(([id, nome, valor]) => ({ id, nome, valor, papel: 'acento' })),
  ],
  fontes: [{ nome: 'Libre Caslon Text', uso: 'Títulos' }, { nome: 'Andika', uso: 'Texto' }],
  formas: [
    { nome: 'Cartão', shape: 'rect', s: { fill: p.superficie, stroke: null, radius: 14 } },
    { nome: 'Faixa da marca', shape: 'rect', s: { fill: p.marca, stroke: null, radius: 14 } },
    { nome: 'Contorno', shape: 'rect', s: { fill: null, stroke: p.texto, sw: 2, radius: 14 } },
    { nome: 'Pílula de acento', shape: 'rect', s: { fill: p.acento, stroke: null, radius: 9999 } },
    { nome: 'Divisória', shape: 'line', s: { fill: null, stroke: p.suave, sw: 1.5 } },
    { nome: 'Losango', shape: 'diamond', s: { fill: p.marca, stroke: null } },
  ],
  svgs: avesEm(p.marca, p.fundo),
  imagens: IMAGENS_MUVVI,   // o material é do museu, não da paleta: as cinco folhas mostram o mesmo
});

export const FOLHAS_DO_ICONE = PALETAS_DO_ICONE.map(folhaDoIcone);

// A ordem é a do seletor: primeiro os projetos da casa, depois os kits de uso geral (interface e jogos).
export const FOLHAS = [FOLHA_MUVVI, ...FOLHAS_DO_ICONE, FOLHA_GEHRARTE, ...FOLHAS_INTERFACE];
export const folhaPorId = (id) => FOLHAS.find((f) => f.id === id) || null;
