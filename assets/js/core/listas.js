// Blocos de lista de uma página do site: "Artigos", "Páginas da equipe", "Exposições".
//
// Por que existe: a home passou a ser um documento do editor (D-0053), e as listas dela são
// DINÂMICAS — vêm do que a equipe publica, não de elementos desenhados à mão. Então a página guarda
// o LUGAR da lista (um elemento `lista`), e quem tem os dados a preenche: `assets/js/blog.js` no
// site, itens de exemplo no editor. É o mesmo arranjo da barra de abas (`abas` em core/render.js),
// que no editor só mostra e na página publicada navega de verdade.
//
// PURO: sem DOM, sem rede — é o que dá cobertura automática ao recurso, já que o desenho do bloco
// só pode ser verificado em navegador.
import { idSeguro } from './seguranca.js';

export const FONTES = [
  { id: 'artigos', rotulo: 'Artigos', descricao: 'Textos publicados pela equipe, mais recentes primeiro.' },
  { id: 'equipe', rotulo: 'Páginas da equipe', descricao: 'Uma entrada por integrante com página publicada.' },
  { id: 'exposicoes', rotulo: 'Exposições', descricao: 'Exposições com registro fotográfico, da curadoria da equipe.' },
];
export const ehFonte = (id) => FONTES.some((f) => f.id === id);
export const fontePorId = (id) => FONTES.find((f) => f.id === id) || null;

export const LISTA_PADRAO = { fonte: 'artigos', max: 0, colunas: 2 };
const MAX_ITENS = 24;      // teto de segurança: lista de página não é catálogo
const MAX_COLUNAS = 4;

// `max: 0` = todos. Fora da faixa, o valor é corrigido em silêncio, como no resto do model.
export function normalizarLista(cfg) {
  const c = cfg && typeof cfg === 'object' ? cfg : {};
  const n = (v, def, min, max) => {
    const x = Math.round(Number(v));
    return Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : def;
  };
  return {
    fonte: ehFonte(c.fonte) ? c.fonte : LISTA_PADRAO.fonte,
    max: n(c.max, LISTA_PADRAO.max, 0, MAX_ITENS),
    colunas: n(c.colunas, LISTA_PADRAO.colunas, 1, MAX_COLUNAS),
  };
}

// Aplica o teto escolhido a uma lista já pronta. `max: 0` devolve tudo.
export const recortar = (itens, max) => (max > 0 ? (itens || []).slice(0, max) : itens || []);

// Itens PROVISÓRIOS, usados em dois lugares: o editor desenha o bloco com eles (senão o bloco é um
// retângulo vazio e ninguém entende o que vai ali), e o site os mostra enquanto a equipe não
// publicou nada — marcados com `modelo: true`, que é o que põe o aviso "Modelo provisório" na tela.
const EXEMPLOS = {
  artigos: [
    { titulo: 'Título do artigo em destaque', resumo: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer posuere erat a ante venenatis dapibus posuere velit aliquet, maecenas faucibus mollis interdum.', autor: 'Nome da autora ou autor', tags: ['Tema', 'Período'], modelo: true },
    { titulo: 'Segundo artigo, de título um pouco mais longo', resumo: 'Cras mattis consectetur purus sit amet fermentum. Donec ullamcorper nulla non metus auctor fringilla.', autor: 'Nome da autora ou autor', tags: ['Tema'], modelo: true },
    { titulo: 'Terceiro artigo', resumo: 'Vestibulum id ligula porta felis euismod semper. Aenean lacinia bibendum nulla sed consectetur.', autor: 'Nome da autora ou autor', tags: ['Tema'], modelo: true },
  ],
  equipe: [
    { nome: 'Nome da integrante', slug: 'x', modelo: true },
    { nome: 'Nome do integrante', slug: 'x', modelo: true },
    { nome: 'Nome da pesquisadora', slug: 'x', modelo: true },
  ],
  exposicoes: [
    { titulo: 'Título da exposição', local: 'Local', periodo: 'Mês – mês de 2026', descricao: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed posuere consectetur est at lobortis.', fotos: [{}, {}, {}], modelo: true },
  ],
};

export const itensDeExemplo = (fonte, max = 0) => recortar(EXEMPLOS[ehFonte(fonte) ? fonte : LISTA_PADRAO.fonte], max);

// O id que a lista recebe na página publicada, para o sumário poder apontar para ela (#artigos).
// Passa por idSeguro porque vai para o HTML: nada de id vindo de documento importado sem conferir.
// O padrão de idSeguro é 'x'; aqui o que não serve tem de virar VAZIO, para não criar âncora falsa.
export const ancoraDaLista = (el) => idSeguro(el?.ancora, '');
