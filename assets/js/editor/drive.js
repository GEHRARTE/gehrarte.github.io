// Aba "Drive" da biblioteca: os materiais da pessoa, na pasta "Gehrarte — materiais" do Google Drive dela.
// Enviar (botão ou arrastar), ver, inserir imagem na página, importar projeto (.json) e abrir o resto no Drive.
//
// Duas coisas que a tela garante, e que valem a leitura antes de mexer:
//
// 1. **Projetos e materiais aparecem separados** (D-0046). As subpastas "Projetos" e "Materiais"
//    organizam o Drive de verdade (é para lá que o envio vai), mas a SEPARAÇÃO DA TELA é por tipo
//    de arquivo, não por pasta — assim ela vale também na pasta da equipe, que vem organizada do
//    jeito de quem a montou.
// 2. **A pasta da equipe é outra conexão** (D-0047). Ver a pasta que outra pessoa compartilhou exige
//    o escopo de leitura, que só é pedido quando alguém clica em "Abrir uma pasta da equipe" — nunca
//    na abertura da aba.
import { h } from '../core/dom.js';
import { S } from './state.js';
import { btn, toast } from './ui.js';
import { icon } from './icons.js';
import { getDrive, uploadAll } from '../core/drive-ui.js';
import { FOLDER_NAME, SUB_PROJETOS, SUB_MATERIAIS, folderUrl, humanSize, isImage, isProject } from '../core/drive.js';
import { loadUsers, hashEmail } from '../core/auth.js';
import { insertImageFile } from './tools.js';
import { importProject } from './publish.js';
import { NOME_ARQUIVO } from '../core/preferencias.js';

const fmtQuota = (c) => (c.limite ? `${humanSize(c.usado)} de ${humanSize(c.limite)} usados no seu Drive` : `${humanSize(c.usado)} usados no seu Drive`);

// O arquivo de preferências (disposição dos painéis) não é material de ninguém.
const semPreferencias = (fs) => fs.filter((f) => f.name !== NOME_ARQUIVO);

// A separação que o editor mostra: projeto é .json, o resto é material.
const separar = (fs) => ({ projetos: fs.filter(isProject), materiais: fs.filter((f) => !isProject(f)) });

export function driveTab(body) {
  const view = h('div', { class: 'drv' });
  body.append(view);
  let drive = null, info = null, folder = null;
  let meus = { projetos: [], materiais: [] };
  let eq = null;         // pasta da equipe aberta: { raiz, caminho: [{id,name}], pastas, projetos, materiais }
  let eqPastas = null;   // lista de pastas compartilhadas, na hora de escolher
  let acessos = null;    // quem já tem acesso à minha pasta (painel de compartilhar)
  const uploads = new Map();   // índice -> estado de cada arquivo em envio
  let alive = true;

  const fail = (e) => { if (alive) view.replaceChildren(h('p', { class: 'hint bad pad' }, e.message || String(e)), btn({ label: 'Tentar de novo', cls: 'sm', onClick: boot })); };
  const erroDeConexao = (e) => e.reason === 'expired' || e.reason === 'noToken';

  async function connect() {
    try {
      info = await drive.connectAs();
      await load();
    } catch (e) { disconnected(e.message); }
  }

  function disconnected(erro) {
    view.replaceChildren(
      h('div', { class: 'pad drv-intro' },
        h('p', {}, h('b', {}, 'Seus materiais, sempre à mão.'), ' Imagens, fontes, PSD e PDF ficam no ', h('b', {}, 'seu Google Drive institucional'), `, na pasta “${FOLDER_NAME}” — e aparecem aqui enquanto você edita.`),
        h('p', { class: 'hint' }, 'O Gehrarte só enxerga o que for enviado por aqui. O resto do seu Drive continua invisível para o site.'),
        erro ? h('p', { class: 'hint bad' }, erro) : null,
        btn({ label: drive?.wasConnected() ? 'Reconectar ao Drive' : 'Conectar ao Google Drive', ic: 'cloud', cls: 'primary', onClick: connect })));
  }

  // Lê a minha pasta inteira: as duas subpastas e a raiz (onde ficou o que foi enviado antes da separação).
  async function load() {
    view.replaceChildren(h('p', { class: 'hint pad' }, 'Abrindo o seu Drive…'));
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
  // `daEquipe` troca o token usado no download (a pasta da equipe é lida com o escopo de leitura).
  async function use(f, daEquipe = false) {
    const baixar = () => (daEquipe ? drive.baixarDaEquipe(f.id) : drive.download(f.id));
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

  // ---------- pasta da equipe ----------

  async function abrirEquipe() {
    try {
      if (!drive.equipeConectada()) await drive.conectarEquipe();
      eqPastas = await drive.pastasCompartilhadas();
      if (!eqPastas.length) toast('Ninguém compartilhou pasta com você ainda.', 'err');
      paint();
    } catch (e) { toast(e.message, 'err'); }
  }

  async function entrarNaPasta(p, { raiz = false } = {}) {
    const deRaiz = raiz || !eq;
    try {
      view.replaceChildren(h('p', { class: 'hint pad' }, `Abrindo “${p.name}”…`));
      const r = await drive.listarPasta(p.id);
      const caminho = deRaiz ? [p] : [...eq.caminho, p];
      eq = { raiz: deRaiz ? p : eq.raiz, caminho, pastas: r.pastas, ...separar(semPreferencias(r.arquivos)) };
      if (deRaiz) drive.lembrarPastaEquipe(p);   // só a pasta de entrada vale lembrar
      eqPastas = null;
      paint();
    } catch (e) {
      if (e.reason === 'expiredEquipe') eq = null;
      toast(e.message, 'err');
      paint();
    }
  }

  async function voltarPara(i) {
    const alvo = eq.caminho[i];
    eq = { ...eq, caminho: eq.caminho.slice(0, i) };   // entrarNaPasta reempilha o alvo
    await entrarNaPasta(alvo, { raiz: i === 0 });
  }

  function fecharEquipe() { drive.desconectarEquipe(); eq = null; eqPastas = null; paint(); }

  // ---------- compartilhar a minha pasta ----------

  async function abrirCompartilhar() {
    try {
      acessos = await drive.compartilhamentos(folder);
      paint();
    } catch (e) { toast(e.message, 'err'); }
  }

  async function compartilhar(email, papel) {
    const alvo = String(email || '').trim();
    if (!alvo) return toast('Escreva o e-mail de quem vai receber.', 'err');
    try {
      // users.json guarda só o hash do e-mail (o arquivo é público), então o nome vem da conferência.
      const [users, hash] = await Promise.all([loadUsers(), hashEmail(alvo)]);
      const quem = users.find((u) => u.emailHash === hash);
      await drive.compartilhar(folder, alvo, papel);
      toast(quem ? `Pasta compartilhada com ${quem.nome}.` : `Pasta compartilhada com ${alvo} — essa conta não é da equipe do site.`, 'ok');
      acessos = await drive.compartilhamentos(folder);
      paint();
    } catch (e) { toast(e.message, 'err'); }
  }

  // ---------- desenho ----------

  const upBox = h('div', { class: 'drv-ups' });
  function paintUploads() {
    upBox.replaceChildren(...[...uploads.values()].map((u) => h('div', { class: `drv-up ${u.estado}` },
      h('span', {}, u.nome),
      u.estado === 'erro' ? h('em', {}, u.erro) : h('i', { style: { width: Math.round(u.progresso * 100) + '%' } }))));
  }

  function card(f, daEquipe = false) {
    const act = isImage(f.mimeType) ? 'Inserir na página' : isProject(f) ? 'Importar projeto' : 'Abrir no Drive';
    const thumb = h('div', { class: 'drv-th' });
    if (f.thumbnailLink) thumb.append(h('img', { src: f.thumbnailLink, alt: '', referrerpolicy: 'no-referrer', loading: 'lazy', onerror: (e) => e.target.replaceWith(h('span', { html: icon('image', 22) })) }));
    else thumb.append(h('span', { html: icon(isProject(f) ? 'stack' : 'download', 22) }));
    return h('button', { class: 'drv-file', title: `${f.name} — ${act}`, onclick: () => use(f, daEquipe) }, thumb,
      h('b', {}, f.name), h('small', {}, [humanSize(f.size), act].filter(Boolean).join(' · ')));
  }

  // Uma seção com título e contagem; quando vazia, explica o que colocar nela.
  function secao(titulo, arquivos, vazio, daEquipe = false) {
    return h('section', { class: 'drv-sec' },
      h('h4', { class: 'pad' }, titulo, arquivos.length ? h('span', { class: 'drv-n' }, String(arquivos.length)) : null),
      arquivos.length
        ? h('div', { class: 'drv-grid' }, arquivos.map((f) => card(f, daEquipe)))
        : h('p', { class: 'hint pad' }, vazio));
  }

  function pastaBotao(p) {
    return h('button', { class: 'drv-folder', title: `Abrir “${p.name}”`, onclick: () => entrarNaPasta(p) },
      h('span', { html: icon('folder', 20) }), h('b', {}, p.name));
  }

  function blocoEquipe() {
    // 1. nem conectado: só o convite, com o aviso do que o botão vai pedir
    if (!eq && !eqPastas) {
      return h('section', { class: 'drv-sec drv-equipe' },
        h('h4', { class: 'pad' }, 'Pasta da equipe'),
        h('p', { class: 'hint pad' }, 'Para abrir uma pasta que outra pessoa compartilhou com você, o Google exige uma permissão de leitura à parte — ela é pedida só quando você clica aqui, e vale apenas para ver.'),
        h('div', { class: 'pad' }, btn({ label: 'Abrir uma pasta da equipe', ic: 'cloud', cls: 'sm', onClick: abrirEquipe })));
    }
    // 2. conectado, escolhendo qual pasta
    if (eqPastas) {
      return h('section', { class: 'drv-sec drv-equipe' },
        h('h4', { class: 'pad' }, 'Pastas compartilhadas com você'),
        eqPastas.length
          ? h('div', { class: 'drv-folders' }, eqPastas.map((p) => h('button', { class: 'drv-folder', onclick: () => entrarNaPasta(p, { raiz: true }) },
            h('span', { html: icon('folder', 20) }),
            h('b', {}, p.name),
            h('small', {}, `de ${p.owners?.[0]?.displayName || p.owners?.[0]?.emailAddress || 'alguém da equipe'}`))))
          : h('p', { class: 'hint pad' }, 'Nada compartilhado com você por enquanto.'),
        h('div', { class: 'pad' }, btn({ label: 'Cancelar', cls: 'sm', onClick: () => { eqPastas = null; paint(); } })));
    }
    // 3. pasta aberta: caminho, subpastas e o conteúdo separado
    return h('section', { class: 'drv-sec drv-equipe' },
      h('div', { class: 'pad drv-head' },
        h('b', {}, 'Pasta da equipe'),
        h('span', { class: 'drv-sp' }),
        btn({ label: 'Trocar', cls: 'sm', onClick: abrirEquipe }),
        btn({ ic: 'x', title: 'Fechar a pasta da equipe e dispensar a permissão de leitura', cls: 'icon sm', onClick: fecharEquipe })),
      h('p', { class: 'hint pad drv-caminho' }, ...eq.caminho.map((p, i) => i === eq.caminho.length - 1
        ? h('b', {}, p.name)
        : h('span', {}, h('a', { href: '#', onclick: (e) => { e.preventDefault(); voltarPara(i); } }, p.name), ' / '))),
      eq.pastas.length ? h('div', { class: 'drv-folders' }, eq.pastas.map(pastaBotao)) : null,
      eq.projetos.length ? secao('Projetos', eq.projetos, '', true) : null,
      eq.materiais.length ? secao('Materiais', eq.materiais, '', true) : null,
      !eq.pastas.length && !eq.projetos.length && !eq.materiais.length ? h('p', { class: 'hint pad' }, 'Esta pasta está vazia.') : null);
  }

  function blocoCompartilhar() {
    if (!acessos) return null;
    const inp = h('input', { type: 'email', class: 'drv-email', placeholder: 'nome@uem.br', onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); compartilhar(inp.value, sel.value); } } });
    const sel = h('select', { class: 'drv-papel' }, h('option', { value: 'reader' }, 'pode ver'), h('option', { value: 'writer' }, 'pode ver e mexer'));
    const outros = acessos.filter((p) => p.role !== 'owner');
    return h('section', { class: 'drv-sec drv-share' },
      h('h4', { class: 'pad' }, 'Compartilhar a pasta'),
      h('p', { class: 'hint pad' }, 'Quem receber vê esta pasta no Drive e pode abri-la aqui no ArtAtk, em “Pasta da equipe”.'),
      h('div', { class: 'pad drv-share-form' }, inp, sel, btn({ label: 'Compartilhar', cls: 'primary sm', onClick: () => compartilhar(inp.value, sel.value) })),
      outros.length
        ? h('ul', { class: 'drv-acessos pad' }, outros.map((p) => h('li', {}, p.emailAddress || p.type, h('small', {}, p.role === 'writer' ? ' · pode mexer' : ' · pode ver'))))
        : h('p', { class: 'hint pad' }, 'Ninguém além de você tem acesso ainda.'),
      h('div', { class: 'pad' }, btn({ label: 'Fechar', cls: 'sm', onClick: () => { acessos = null; paint(); } })));
  }

  function paint() {
    const pick = h('input', { type: 'file', multiple: true, hidden: true, onchange: () => { send(pick.files); pick.value = ''; } });
    const vazia = !meus.projetos.length && !meus.materiais.length;
    view.replaceChildren(
      h('div', { class: 'pad drv-head' },
        h('b', {}, info?.email || 'Google Drive'),
        h('span', { class: 'drv-sp' }),
        btn({ ic: 'reset', title: 'Atualizar a lista', cls: 'icon sm', onClick: () => load() }),
        btn({ ic: 'x', title: 'Desconectar o Drive neste navegador', cls: 'icon sm', onClick: () => { drive.disconnect(); info = null; folder = null; eq = null; eqPastas = null; acessos = null; disconnected(); } })),
      info?.cota ? h('p', { class: 'hint pad' }, fmtQuota(info.cota)) : null,
      h('div', { class: 'pad drv-acoes' },
        btn({ label: 'Enviar arquivos', ic: 'upload', cls: 'primary', onClick: () => pick.click() }), pick,
        btn({ label: 'Compartilhar…', ic: 'cloud', cls: 'sm', onClick: abrirCompartilhar })),
      h('p', { class: 'hint pad' }, 'Ou arraste arquivos para cá — projeto vai para “Projetos”, o resto para “Materiais”. ',
        h('a', { href: folder ? folderUrl(folder) : '#', target: '_blank', rel: 'noopener' }, 'Abrir a pasta no Drive ↗')),
      upBox,
      blocoCompartilhar(),
      vazia
        ? h('p', { class: 'hint pad' }, 'A pasta ainda está vazia. Envie os materiais que você vai usar nas suas páginas.')
        : h('div', {},
          secao('Projetos', meus.projetos, 'Nenhum projeto aqui. Envie um .json do ArtAtk, ou use “Salvar cópia no Drive” no menu ⋯.'),
          secao('Materiais', meus.materiais, 'Nenhum material ainda. Envie imagens, fontes, PSD ou PDF.')),
      blocoEquipe());
    paintUploads();
  }

  // arrastar arquivos para a aba
  body.addEventListener('dragover', (e) => { if (drive?.isConnected() && e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); body.classList.add('drop'); } });
  body.addEventListener('dragleave', () => body.classList.remove('drop'));
  body.addEventListener('drop', (e) => { body.classList.remove('drop'); if (drive?.isConnected() && e.dataTransfer?.files?.length) { e.preventDefault(); send(e.dataTransfer.files); } });

  async function boot() {
    view.replaceChildren(h('p', { class: 'hint pad' }, 'Carregando…'));
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
