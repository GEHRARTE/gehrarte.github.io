# Modelos da galeria

Cada pasta daqui é um modelo: `spec.json` é a **fonte** (uma descrição declarativa de seções) e
`modelo.json` é o que o editor consome. Nunca edite o `modelo.json` à mão — ele é gerado.

```bash
node tools/gerar-modelos.mjs             # escreve os modelo.json e o índice modelos.json
node tools/gerar-modelos.mjs --verifica   # só confere se estão em dia (sai 1 se não)
```

O mesmo gerador roda dentro do editor, em **Modelos › Gerar modelo**, com a mesma especificação.

## O site do MUVVI

`muvvi-site/` é o modelo de base do site do Museu Virtual do Vale do Ivaí, feito para a equipe de
arte continuar. Nove abas: Início, Sobre, os cinco eixos de patrimônio (Natural, Arqueológico,
Arquitetônico, Histórico e Imaterial), **Material da equipe** e Contato.

O texto é de **Leilane Patricia de Lima** — versão experimental escrita para apresentar o museu no
XIV SAB Sul, em novembro de 2026. A fonte fica no repositório do museu, em `muvvi/material/`.

Três coisas que valem saber antes de mexer:

- **O tema do `spec.json` é a folha "MUVVI" do editor.** `core/folhas-catalogo.js` guarda uma cópia
  dele, e `tests/folhas.test.mjs` recusa se as duas saírem de sincronia. Mudou o tema aqui, atualize
  lá — ou, melhor, mude a paleta pelas variantes (abaixo) em vez de mexer na identidade.
- **Os nomes do Roteiro Curatorial estão na etiqueta de cada eixo** ("Eixo 1 · O Rio que dá nome ao
  Vale"). As abas usam o nome do tipo de patrimônio, que é como a curadoria organizou o conteúdo
  novo; os dois jeitos de nomear convivem de propósito.
- **Nenhuma imagem viaja no modelo** — por definição, um modelo não leva arquivo enviado. Cada
  retângulo cinza é um lugar de imagem, com o rótulo do que vai ali.

### Trocar a paleta do site inteiro

As cinco paletas do museu (nascidas do ícone do artista, em `core/folhas-catalogo.js`) viram cinco
variantes do mesmo site, com conteúdo idêntico:

```bash
node tools/gerar-variantes-muvvi.mjs     # escreve modelos/muvvi-site-<paleta>/spec.json
node tools/gerar-modelos.mjs             # e então os modelo.json
```

> **O primeiro comando ainda não roda neste repositório**, e isso é esperado: ele lê
> `FOLHAS_DO_ICONE` de `core/folhas-catalogo.js`, e as cinco folhas do ícone **ainda não estão
> nesse arquivo na main** — vivem num trabalho em andamento. O programa diz isso e sai com erro,
> em vez de estourar. **As variantes já geradas não dependem dele:** os `spec.json` e os
> `modelo.json` estão versionados e conferidos por `node tools/gerar-modelos.mjs --verifica`.
> Quando as folhas entrarem, o comando volta a funcionar sem nenhuma alteração.

Na galeria, escolher a paleta do site é escolher qual modelo aplicar: `muvvi-site` (verde
institucional), ou as variantes **Xilogravura do Ivaí**, **Mata ciliar**, **Rio fundo** (escura),
**Barranco** e **Papel de arquivo**. O conteúdo é gerado do mesmo `muvvi-site/spec.json`, então
texto novo entra em um lugar só: edite a fonte e rode os dois comandos.
