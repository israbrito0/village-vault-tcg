# Village & Vault TCG — Fase 1 (vitrine)

Site da loja: home, catálogo com filtros por jogo/categoria, busca e página de
produto. Os produtos ainda são dados de exemplo (`lib/mock-data.ts`) — na Fase 2
conectamos isso ao Supabase (banco de dados real, com seu estoque).

## O que já funciona
- Home com banner, "mais vendidos", "produtos selados" e "colecionáveis"
- Menu com todos os jogos e subcategorias (cartas avulsas, graduadas, selados,
  colecionáveis, antigos e raros, códigos digitais)
- Catálogo com filtro por jogo, categoria e busca por nome
- Página de produto individual, com botão "Comprar pelo WhatsApp" (a mensagem já
  vai com o nome, a condição e o preço da carta)
- Botão flutuante do WhatsApp
- Páginas de perguntas frequentes, trocas e devoluções e torneios

O número do WhatsApp, o email de contato e o desconto do Pix ficam em
`lib/site.ts` — troque lá e vale para o site inteiro.

## Como cadastrar produtos

Todos os produtos ficam na planilha `data/estoque.csv`. Cada linha é um produto.
Depois de salvar no GitHub, o site se atualiza sozinho em cerca de 1 minuto.

**Cartas de Pokémon e Magic:** preencha só o `codigo` (sigla da coleção +
número da carta, como vem impresso nela), além de preço, condição e estoque.
Nome, coleção e imagem aparecem sozinhos.

| jogo    | codigo    | exemplo de carta                    |
|---------|-----------|-------------------------------------|
| pokemon | `DAA 20`  | Charizard VMAX, Darkness Ablaze     |
| pokemon | `MEW 151` | Mew ex, coleção 151                 |
| magic   | `LEA 232` | Black Lotus, Alpha                  |
| magic   | `DOM 1`   | Karn, Dominaria                     |

Com `origem` = `BR`, o site usa o nome e a imagem da carta em português quando
a base tiver.

**Outros produtos** (selados, colecionáveis, Yu-Gi-Oh!, One Piece, Lorcana):
deixe `codigo` vazio e preencha `nome`, `colecao` e, se tiver foto, `imagem`
(coloque a foto em `public/produtos/` e escreva `/produtos/nome-da-foto.jpg`).

| coluna         | o que colocar                                                    |
|----------------|------------------------------------------------------------------|
| `jogo`         | pokemon, magic, yugioh, one-piece, lorcana ou outros             |
| `categoria`    | cartas-avulsas, cartas-graduadas, produtos-selados, colecionaveis, produtos-antigos-raros ou codigos-digitais (vazio = carta avulsa) |
| `condicao`     | NM, SP, MP, HP, Graduada ou Novo                                 |
| `origem`       | BR, US ou JP                                                     |
| `preco`        | `350,00` (o `preco_antigo`, se tiver, aparece riscado)           |
| `estoque`      | quantidade; `0` esconde o produto do site                        |
| `destaque`     | `sim` para aparecer em "Mais vendidos"                           |
| `nome`, `colecao`, `imagem`, `descricao` | opcionais para cartas; preenchidos, substituem o que vem da base |

**Editando no Excel:** abra o arquivo, edite e salve como
**"CSV UTF-8 (delimitado por vírgulas)"** para os acentos não quebrarem.

Se alguma linha tiver erro (preço inválido, código não encontrado), ela aparece
como `aviso` no log do build da Vercel e o resto do site publica normalmente.

## O que ainda não faz (vem nas próximas fases)
- Carrinho e checkout de verdade (por enquanto a compra é finalizada pelo
  WhatsApp — isso é a Fase 2)
- Login de cliente
- Painel administrativo e controle de estoque real (Fase 3)

---

## Como publicar (sem instalar nada no seu computador)

### Passo 1 — Subir o código para o GitHub
1. Extraia o arquivo `.zip` que você baixou.
2. Acesse [github.com/new](https://github.com/new) e crie um repositório:
   - Nome: `village-vault-tcg`
   - Deixe como **Public** ou **Private**, como preferir
   - **Não marque** nenhuma opção de inicializar com README
   - Clique em **Create repository**
3. Na página que abrir, clique no link **uploading an existing file**.
4. Arraste **todas as pastas e arquivos** extraídos do zip para essa área
   (app, components, lib, public, e os arquivos soltos como package.json).
5. Role para baixo e clique em **Commit changes**.

### Passo 2 — Publicar na Vercel
1. Acesse [vercel.com/new](https://vercel.com/new) (entre com a conta do GitHub
   que você já criou).
2. Encontre o repositório `village-vault-tcg` na lista e clique em **Import**.
3. A Vercel já reconhece que é um projeto Next.js — não precisa mudar nada.
4. Clique em **Deploy** e aguarde cerca de 1 minuto.
5. Pronto — você vai receber um link tipo `village-vault-tcg.vercel.app` já no ar.

### Passo 3 — domínio próprio
O site responde em **www.villagetcg.com.br** (quem digita sem `www` é
redirecionado). O domínio foi registrado no Registro.br e usa os servidores DNS
da Vercel (`ns1.vercel-dns.com` e `ns2.vercel-dns.com`); a configuração fica em
**Settings → Domains** no projeto da Vercel.

---

Qualquer erro que aparecer no build da Vercel, me manda o print da mensagem de
erro que eu te digo exatamente o que corrigir.
