// Aba "Drive" da biblioteca: os materiais da pessoa, na pasta "Gehrarte — materiais" do Google Drive dela.
// Enviar (botão ou arrastar), ver, inserir imagem na página, importar projeto (.json) e abrir o resto no Drive.
//
// Três coisas que a tela garante, e que valem a leitura antes de mexer:
//
// 1. **Projetos e materiais aparecem separados** (D-0046). As subpastas "Projetos" e "Materiais"
//    organizam o Drive de verdade (é para lá que o envio vai), mas a SEPARAÇÃO DA TELA é por tipo
//    de arquivo, não por pasta — assim ela vale em qualquer pasta que a pessoa abrir, inclusive as
//    que ela organizou do jeito dela, muito antes de existir esta aba.
// 2. **"Abrir uma pasta do Drive" é outra conexão** (D-0047). O escopo do dia a dia (`drive.file`)
//    só enxerga o que ESTE aplicativo criou: arquivo que a pessoa colocou pelo Drive na web é
//    invisível, e é por isso que a pasta podia aparecer vazia tendo coisa dentro. Para ler o que
//    não é do app — pasta própria ou compartilhada por outra pessoa — é preciso o escopo de
//    leitura, pedido só quando alguém clica nesse botão.
// 3. **`replaceChildren` é nativo e não filtra `null`** — ele insere o texto "null" na tela. O
//    `h()` de core/dom.js filtra, o DOM não. Por isso a lista de filhos passa por `visiveis()`.
import { h } from '../core/dom.js';
import { S } from './state.js';
import { btn, toast } from './ui.js';
import { icon } from './icons.js';
import { getDrive, uploadAll } from '../core/drive-ui.js';
import { FOLDER_NAME, SUB_PROJETOS, SUB_MATERIAIS, folderUrl, humanSize, isImage, isProject } from '../core/drive.js';
import { insertImageFile } from './tools.js';
import { importProject } from './publish.js';
import { NOME_ARQUIVO } from '../core/preferencias.js';

// Em conta Workspace (como a da UEM) o que o Google devolve é o POOL DO DOMÍNIO, não o espaço da
// pessoa — na tela isso apareceu como "358 TB de 757 TB usados no seu Drive", o que é mentira.
// Acima de 2 TB o número é institucional: conta de pessoa física não chega lá.
const TETO_PESSOAL = 2 * 1024 ** 4;
const fmtQuota = (c) => {
  if (!c.limite) return `${humanSize(c.usado)} usados no seu Drive`;
  if (c.limite > TETO_PESSOAL) return `${humanSize(c.usado)} de ${humanSize(c.limite)} usados no armazenamento da instituição`;
  return `${humanSize(c.usado)} de ${humanSize(c.limite)} usados no seu Drive`;
};

// `replaceChildren` nativo transforma null no texto "null". Sempre passe os filhos por aqui.
const visiveis = (...kids) => kids.flat(Infinity).filter((k) => k != null && k !== false);

// O arquivo de preferências (disposição dos painéis) não é material de ninguém.
const semPreferencias = (fs) => fs.filter((f) => f.name !== NOME_ARQUIVO);

// A separação que o editor mostra: projeto é .json, o resto é material.
const separar = (fs) => ({ projetos: fs.filter(isProject), materiais: fs.filter((f) => !isProject(f)) });

export function driveTab(body) {
  const view = h('div', { class: 'drv' });
  body.append(view);
  let drive = null, info = null, folder = null;
  let meus = { projetos: [], materiais: [] };
  let aberta = null;      // pasta do Drive aberta: { raiz, caminho: [{id,name}], pastas, projetos, materiais }
  let escolher = null;    // { minhas: [], compartilhadas: [] } enquanto a pessoa escolhe a pasta
  const uploads = new Map();
  let alive = true;

  const pinta = (...kids) => view.replaceChildren(...visiveis(kids));
  const fail = (e) => { if (alive) pinta(h('p', { class: 'hint bad pad' }, e.message || String(e)), btn({ label: 'Tentar de novo', cls: 'sm', onClick: boot })); };
  const erroDeConexao = (e) => e.reason === 'expired' || e.reason === 'noToken';

  async function connect() {
    try {
      info = await drive.connectAs();
      await load();
    } catch (e) { disconnected(e.message); }
  }

  function disconnected(erro) {
    pinta(
      h('div', { class: 'pad drv-intro' },
        h('p', {}, h('b', {}, 'Seus materiais, sempre à mão.'), ' Imagens, fontes, PSD e PDF ficam no ', h('b', {}, 'seu Google Drive institucional'), `, na pasta “${FOLDER_NAME}” — e aparecem aqui enquanto você edita.`),
        h('p', { class: 'hint' }, 'O Gehrarte só enxerga o que for enviado por aqui. O resto do seu Drive continua invisível para o site.'),
        erro ? h('p', { class: 'hint bad' }, erro) : null,
        btn({ label: drive?.wasConnected() ? 'Reconectar ao Drive' : 'Conectar ao Google Drive', ic: 'cloud', cls: 'primary', onClick: connect })));
  }

  // Lê a pasta de materiais: as duas subpastas e a raiz (onde ficou o que foi enviado antes da separação).
  async function load() {
    pinta(h('p', { class: 'hint pad' }, 'Abrindo o seu Drive…'));
    try {
      if (!info) info = await drive.about();
      folder ||= await drive.ensureFolder();
      const [idProj, idMat] = await Promise.all([drive.ensureSubfolder(SUB_PROJETOS), drive.ensureSubfolder(SUB_MATERIAIS)]);
      const partes = await Promise.all([
        drive.list({ parent: idProj, pageSize: 100 }),
        drive.list({ parent: idMat, pageSize: 100 }),
        drive.list({ pageSize: 100 }),
      ]);
      meus = separar(semPreferencias(partes.flatMap((r) => r.files)));
      if (alive) paint();
    } catch (e) {
      if (erroDeConexao(e)) disconnected('A conexão com o Drive expirou. Conecte de novo.');
      else fail(e);
    }
  }

  async function send(list) {
    const arr = [...list];
    if (!arr.length) return;
    uploads.clear();
    paint();
    const ok = await uploadAll(drive, arr, (i, st) => { uploads.set(i, st); paintUploads(); });
    if (ok.length) toast(`${ok.length} arquivo${ok.length > 1 ? 's' : ''} no Drive.`, 'ok');
    uploads.clear();
    await load();
  }

  // Trazer para a página: imagem entra no canvas, projeto é importado, o resto abre no Drive.
  // `lido` = veio de uma pasta aberta com o escopo de leitura, então o download usa aquele token.
  async function use(f, lido = false) {
    const baixar = () => (lido ? drive.baixarDaEquipe(f.id) : drive.download(f.id));
    try {
      if (isImage(f.mimeType)) {
        toast('Trazendo a imagem do Drive…');
        await insertImageFile(new File([await baixar()], f.name, { type: f.mimeType }));
      } else if (isProject(f)) {
        toast('Trazendo o projeto do Drive…');
        await importProject(new File([await baixar()], f.name, { type: 'application/json' }));
      } else if (f.webViewLink) window.open(f.webViewLink, '_blank', 'noopener');
      else toast('Esse arquivo não abre aqui. Veja no Drive.', 'err');
    } catch (e) { toast(e.message, 'err'); }
  }

  // ---------- abrir uma pasta do Drive (escopo de leitura) ----------

  async function abrirEscolha() {
    try {
      if (!drive.equipeConectada()) await drive.conectarEquipe();
      pinta(h('p', { class: 'hint pad' }, 'Procurando as suas pastas…'));
      const [minhas, compartilhadas] = await Promise.all([drive.minhasPastas(), drive.pastasCompartilhadas()]);
      escolher = { minhas, compartilhadas };
      if (!minhas.length && !compartilhadas.length) toast('Não achei pasta nenhuma neste Drive.', 'err');
      paint();
    } catch (e) { toast(e.message, 'err'); paint(); }
  }

  async function entrarNaPasta(p, { raiz = false } = {}) {
    const deRaiz = raiz || !aberta;
    try {
      pinta(h('p', { class: 'hint pad' }, `Abrindo “${p.name}”…`));
      const r = await drive.listarPasta(p.id);
      const caminho = deRaiz ? [p] : [...aberta.caminho, p];
      aberta = { raiz: deRaiz ? p : aberta.raiz, caminho, pastas: r.pastas, ...separar(semPreferencias(r.arquivos)) };
      if (deRaiz) drive.lembrarPastaEquipe(p);
      escolher = null;
      paint();
    } catch (e) {
      if (e.reason === 'expiredEquipe') aberta = null;
      toast(e.message, 'err');
      paint();
    }
  }

  async function voltarPara(i) {
    const alvo = aberta.caminho[i];
    aberta = { ...aberta, caminho: aberta.caminho.slice(0, i) };
    await entrarNaPasta(alvo, { raiz: i === 0 });
  }

  function fecharPasta() { drive.desconectarEquipe(); aberta = null; escolher = null; paint(); }

  // ---------- desenho ----------

  const upBox = h('div', { class: 'drv-ups' });
  function paintUploads() {
    upBox.replaceChildren(...[...uploads.values()].map((u) => h('div', { class: `drv-up ${u.estado}` },
      h('span', {}, u.nome),
      u.estado === 'erro' ? h('em', {}, u.erro) : h('i', { style: { width: Math.round(u.progresso * 100) + '%' } }))));
  }

  function card(f, lido = false) {
    const act = isImage(f.mimeType) ? 'Inserir na página' : isProject(f) ? 'Importar projeto' : 'Abrir no Drive';
    const thumb = h('div', { class: 'drv-th' });
    if (f.thumbnailLink) thumb.append(h('img', { src: f.thumbnailLink, alt: '', referrerpolicy: 'no-referrer', loading: 'lazy', onerror: (e) => e.target.replaceWith(h('span', { html: icon('image', 22) })) }));
    else thumb.append(h('span', { html: icon(isProject(f) ? 'stack' : 'download', 22) }));
    return h('button', { class: 'drv-file', title: `${f.name} — ${act}`, onclick: () => use(f, lido) }, thumb,
      h('b', {}, f.name), h('small', {}, [humanSize(f.size), act].filter(Boolean).join(' · ')));
  }

  function secao(titulo, arquivos, vazio, lido = false) {
    return h('section', { class: 'drv-sec' },
      h('h4', { class: 'pad' }, titulo, arquivos.length ? h('span', { class: 'drv-n' }, String(arquivos.length)) : null),
      arquivos.length
        ? h('div', { class: 'drv-grid' }, arquivos.map((f) => card(f, lido)))
        : (vazio ? h('p', { class: 'hint pad' }, vazio) : null));
  }

  const pastaBotao = (p, extra) => h('button', { class: 'drv-folder', title: `Abrir “${p.name}”`, onclick: () => entrarNaPasta(p, extra) },
    h('span', { html: icon('folder', 20) }), h('b', {}, p.name));

  function blocoPasta() {
    // 1. nem conectado: o convite, dizendo para que serve e o que vai ser pedido
    if (!aberta && !escolher) {
      return h('section', { class: 'drv-sec drv-equipe' },
        h('h4', { class: 'pad' }, 'Abrir uma pasta do Drive'),
        h('p', { class: 'hint pad' }, 'Para carregar um projeto ou material que ', h('b', {}, 'já está no seu Drive'), ' — ou numa pasta que alguém compartilhou com você — o Google exige uma permissão de leitura à parte. Ela é pedida só quando você clica aqui, e vale apenas para ver.'),
        h('p', { class: 'hint pad' }, 'É por aqui que se abre o que você colocou pelo Drive na web: as seções acima mostram só o que foi enviado por este editor.'),
        h('div', { class: 'pad' }, btn({ label: 'Abrir uma pasta do Drive', ic: 'cloud', cls: 'sm', onClick: abrirEscolha })));
    }
    // 2. escolhendo a pasta
    if (escolher) {
      const { minhas, compartilhadas } = escolher;
      return h('section', { class: 'drv-sec drv-equipe' },
        h('h4', { class: 'pad' }, 'Qual pasta?'),
        minhas.length ? h('p', { class: 'hint pad' }, 'Suas pastas') : null,
        minhas.length ? h('div', { class: 'drv-folders' }, minhas.map((p) => pastaBotao(p, { raiz: true }))) : null,
        compartilhadas.length ? h('p', { class: 'hint pad' }, 'Compartilhadas com você') : null,
        compartilhadas.length
          ? h('div', { class: 'drv-folders' }, compartilhadas.map((p) => h('button', { class: 'drv-folder', onclick: () => entrarNaPasta(p, { raiz: true }) },
            h('span', { html: icon('folder', 20) }),
            h('b', {}, p.name),
            h('small', {}, `de ${p.owners?.[0]?.displayName || p.owners?.[0]?.emailAddress || 'alguém da equipe'}`))))
          : null,
        !minhas.length && !compartilhadas.length ? h('p', { class: 'hint pad' }, 'Não achei pasta nenhuma neste Drive.') : null,
        h('div', { class: 'pad' }, btn({ label: 'Cancelar', cls: 'sm', onClick: () => { escolher = null; paint(); } })));
    }
    // 3. pasta aberta: caminho, subpastas e o conteúdo separado
    const nada = !aberta.pastas.length && !aberta.projetos.length && !aberta.materiais.length;
    return h('section', { class: 'drv-sec drv-equipe' },
      h('div', { class: 'pad drv-head' },
        h('b', {}, 'Pasta do Drive'),
        h('span', { class: 'drv-sp' }),
        btn({ label: 'Trocar', cls: 'sm', onClick: abrirEscolha }),
        btn({ ic: 'x', title: 'Fechar e dispensar a permissão de leitura', cls: 'icon sm', onClick: fecharPasta })),
      h('p', { class: 'hint pad drv-caminho' }, ...aberta.caminho.map((p, i) => i === aberta.caminho.length - 1
        ? h('b', {}, p.name)
        : h('span', {}, h('a', { href: '#', onclick: (e) => { e.preventDefault(); voltarPara(i); } }, p.name), ' / '))),
      aberta.pastas.length ? h('div', { class: 'drv-folders' }, aberta.pastas.map((p) => pastaBotao(p))) : null,
      aberta.projetos.length ? secao('Projetos', aberta.projetos, '', true) : null,
      aberta.materiais.length ? secao('Materiais', aberta.materiais, '', true) : null,
      nada ? h('p', { class: 'hint pad' }, 'Esta pasta está vazia.') : null);
  }

  function paint() {
    const pick = h('input', { type: 'file', multiple: true, hidden: true, onchange: () => { send(pick.files); pick.value = ''; } });
    const vazia = !meus.projetos.length && !meus.materiais.length;
    pinta(
      h('div', { class: 'pad drv-head' },
        h('b', {}, info?.email || 'Google Drive'),
        h('span', { class: 'drv-sp' }),
        btn({ ic: 'reset', title: 'Atualizar a lista', cls: 'icon sm', onClick: () => load() }),
        btn({ ic: 'x', title: 'Desconectar o Drive neste navegador', cls: 'icon sm', onClick: () => { drive.disconnect(); info = null; folder = null; aberta = null; escolher = null; disconnected(); } })),
      info?.cota ? h('p', { class: 'hint pad' }, fmtQuota(info.cota)) : null,
      h('div', { class: 'pad drv-acoes' }, btn({ label: 'Enviar arquivos', ic: 'upload', cls: 'primary', onClick: () => pick.click() }), pick),
      h('p', { class: 'hint pad' }, 'Ou arraste arquivos para cá — projeto vai para “Projetos”, o resto para “Materiais”. ',
        h('a', { href: folder ? folderUrl(folder) : '#', target: '_blank', rel: 'noopener' }, 'Abrir a pasta no Drive ↗')),
      upBox,
      vazia
        ? h('p', { class: 'hint pad' }, 'Nada enviado por este editor ainda. O que você colocou pelo Drive na web não aparece aqui — abra pela seção abaixo.')
        : h('div', {},
          secao('Projetos', meus.projetos, 'Nenhum projeto aqui. Envie um .json do ArtAtk, ou use “Salvar cópia no Drive” no menu ⋯.'),
          secao('Materiais', meus.materiais, 'Nenhum material ainda. Envie imagens, fontes, PSD ou PDF.')),
      blocoPasta());
    paintUploads();
  }

  // arrastar arquivos para a aba
  body.addEventListener('dragover', (e) => { if (drive?.isConnected() && e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); body.classList.add('drop'); } });
  body.addEventListener('dragleave', () => body.classList.remove('drop'));
  body.addEventListener('drop', (e) => { body.classList.remove('drop'); if (drive?.isConnected() && e.dataTransfer?.files?.length) { e.preventDefault(); send(e.dataTransfer.files); } });

  async function boot() {
    pinta(h('p', { class: 'hint pad' }, 'Carregando…'));
    try { drive = await getDrive(S.slug); } catch (e) { return fail(e); }
    if (drive.isConnected()) load(); else disconnected();
  }
  boot();
  return () => { alive = false; };   // chamado ao trocar de aba
}

// "Salvar cópia no Drive" (menu ⋯): grava o projeto como gehrarte-<usuário>-<id>.json na subpasta "Projetos".
export async function saveCopyToDrive(project) {
  const drive = await getDrive(S.slug);
  if (!drive.isConnected()) await drive.connectAs();
  const nome = `gehrarte-${S.slug}-${S.doc.id}.json`;
  await drive.saveText(nome, JSON.stringify(project), 'application/json', { pasta: SUB_PROJETOS });
  return nome;
}
