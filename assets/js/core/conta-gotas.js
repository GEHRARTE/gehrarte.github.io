// Conta-gotas: qual campo de cor de cada tipo de elemento recebe a cor escolhida — lógica PURA (sem DOM).
// O seletor de cor em si é do navegador (`EyeDropper`, editor/tools.js › contaGotas); aqui só se decide ONDE a cor entra.

export const hexValido = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);

// Texto → cor do texto; forma → preenchimento (ou o traço, se a forma é só linha); desenho à mão → traço; barra de abas → cor dos rótulos.
// Imagem e SVG não têm uma cor única para trocar: devolve null.
export function campoDeCor(el) {
  if (!el) return null;
  if (el.t === 'text') return { obj: 's', chave: 'color' };
  if (el.t === 'shape') return el.s?.fill == null && el.s?.stroke ? { obj: 's', chave: 'stroke' } : { obj: 's', chave: 'fill' };
  if (el.t === 'path') return { obj: 's', chave: 'stroke' };
  if (el.t === 'abas') return { obj: 'ls', chave: 'color' };
  return null;
}

// Aplica a cor no campo certo. Devolve se aplicou (imagem/SVG e cor inválida não aplicam nada). Troca o preenchimento por cor lisa: some o degradê.
export function aplicarCor(el, hex) {
  const campo = hexValido(hex) ? campoDeCor(el) : null;
  if (!campo) return false;
  el[campo.obj] = { ...(el[campo.obj] || {}), [campo.chave]: hex.toLowerCase() };
  if (el.t === 'shape' && campo.chave === 'fill') el.s.grad = null;
  return true;
}
