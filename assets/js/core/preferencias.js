// Preferências do editor guardadas na CONTA da pessoa (hoje: a disposição dos painéis) — lógica PURA, sem DOM nem rede.
// O lugar onde elas ficam é do `host` (core/host.js › preferencias): no Gehrarte, o Google Drive da própria pessoa (um arquivo
// pequeno na pasta de materiais); no MUVVI, o que o museu decidir. Aqui: o formato do arquivo, quem vence e a sincronização.
//
// Regra: **o mais novo vence** (carimbo `t` em milissegundos, gravado a cada mudança feita pela pessoa). Um aparelho que nunca
// personalizou nada não tem carimbo e sempre adota o da conta; a conta nunca é apagada por um aparelho com a disposição de fábrica.
// O relógio de cada aparelho é quem carimba: relógios muito diferentes podem fazer o "mais novo" errar (raro; exportar/importar resolve).

export const FORMATO = 'artatk-preferencias';
// v2 = o envelope ganhou a chave `ferramentas` (a barra montada pela pessoa, D-0055) ao lado de `layout`. Um ArtAtk antigo lendo um
// arquivo v2 continua achando o `layout` (`ler()` aceita v >= 1) e só ignora o que não conhece; um arquivo v1 lido aqui vem sem barra.
export const PREF_V = 2;
export const NOME_ARQUIVO = 'artatk-preferencias.json';
export const ESPERA_ENVIO_MS = 2500;                 // junta várias mudanças seguidas num só envio

export const montar = (layout, t, ferramentas = null) => ({ format: FORMATO, v: PREF_V, t, layout, ...(ferramentas ? { ferramentas } : {}) });

// Texto do arquivo → { t, layout, ferramentas } ou null (vazio, corrompido, de outro formato ou de uma versão que não entendemos).
// `ferramentas` é opcional (não existe em arquivo v1) e vai cru: quem normaliza é editor/ferramentas-catalogo.js.
export function ler(texto) {
  if (typeof texto !== 'string' || !texto.trim()) return null;
  let o;
  try { o = JSON.parse(texto); } catch { return null; }
  if (!o || typeof o !== 'object' || o.format !== FORMATO || !(o.v >= 1)) return null;
  if (!Number.isFinite(o.t) || o.t <= 0) return null;
  if (!o.layout || typeof o.layout !== 'object' || Array.isArray(o.layout) || !o.layout.docks) return null;
  const ferramentas = o.ferramentas && typeof o.ferramentas === 'object' && !Array.isArray(o.ferramentas) ? o.ferramentas : null;
  return { t: o.t, layout: o.layout, ferramentas };
}

// O que fazer com o carimbo daqui (`localT`, undefined = nunca personalizou) e o da conta (`remotoT`, undefined = não há cópia).
export function decidir(localT, remotoT) {
  const l = Number(localT) > 0 ? Number(localT) : 0, r = Number(remotoT) > 0 ? Number(remotoT) : 0;
  if (!r) return l ? 'enviar' : 'nada';
  if (!l || r > l) return 'adotar';
  return l > r ? 'enviar' : 'nada';
}

// backend = host.preferencias: { disponivel(ctx), ler(ctx), gravar(ctx, texto) } (todos podem ser async); ctx = { slug }.
// lerLocal() → { t, layout, ferramentas? } | null · aoAdotar(layout, t, ferramentas) aplica o que veio da conta · ligada() → a pessoa quer sincronizar?
export function criarSincronia({ backend, ctx = {}, lerLocal, aoAdotar, ligada = () => true, aoFalhar = () => {}, esperaMs = ESPERA_ENVIO_MS, setT = setTimeout, clearT = clearTimeout }) {
  let timer = null, fila = Promise.resolve();
  const emFila = (fn) => (fila = fila.then(fn, fn));        // uma operação por vez: nunca duas gravações se atropelando
  const pronto = async () => !!backend && ligada() && !!(await backend.disponivel(ctx));
  const falhou = (e) => { try { aoFalhar(e); } catch { /* quem ouve não pode derrubar a sincronia */ } return { estado: 'erro', erro: e }; };

  // Compara com a conta e faz o que couber: adota, envia ou nada.
  const puxar = () => emFila(async () => {
    try {
      if (!(await pronto())) return { estado: 'indisponivel' };
      const remoto = ler(await backend.ler(ctx)), local = lerLocal();
      const d = decidir(local?.t, remoto?.t);
      if (d === 'adotar') { aoAdotar(remoto.layout, remoto.t, remoto.ferramentas); return { estado: 'adotado', t: remoto.t }; }
      if (d === 'enviar') { await backend.gravar(ctx, JSON.stringify(montar(local.layout, local.t, local.ferramentas))); return { estado: 'enviado', t: local.t }; }
      return { estado: 'igual' };
    } catch (e) { return falhou(e); }
  });

  // Mudança feita aqui: envia depois de um instante (a última vence; mudanças seguidas viram um envio só).
  function agendar(layout, t, ferramentas = null) {
    clearT(timer); timer = null;
    if (!backend || !ligada()) return;
    timer = setT(() => {
      timer = null;
      emFila(async () => { try { if (await pronto()) await backend.gravar(ctx, JSON.stringify(montar(layout, t, ferramentas))); } catch (e) { falhou(e); } });
    }, esperaMs);
  }
  return { puxar, agendar, cancelar: () => { clearT(timer); timer = null; }, pendente: () => timer !== null, aguardar: () => fila };
}
