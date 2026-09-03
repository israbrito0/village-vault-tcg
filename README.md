# Village & Vault TCG — Fase 1 (vitrine)

Site da loja: home, catálogo com filtros por jogo/categoria, busca e página de
produto. Os produtos ainda são dados de exemplo (`lib/mock-data.ts`) — na Fase 2
conectamos isso ao Supabase (banco de dados real, com seu estoque).

## O que já funciona
- Home com banner, "mais vendidos", "produtos selados" e "colecionáveis"
- Menu com todos os jogos e subcategorias (cartas avulsas, graduadas, selados,
  colecionáveis, antigos e raros, códigos digitais)
- Catálogo com filtro por jogo, categoria e busca por nome
- Página de produto individual
- Botão flutuante do WhatsApp (troque o número em `components/WhatsAppButton.tsx`)

## O que ainda não faz (vem nas próximas fases)
- Carrinho e checkout de verdade (o botão "Adicionar ao carrinho" ainda não tem
  ação — isso é a Fase 2)
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

### Passo 3 — (quando quiser) conectar seu domínio próprio
No painel do projeto na Vercel, vá em **Settings → Domains** e siga as
instruções para apontar o domínio que você comprar (ex: villageandvault.com.br).

---

Qualquer erro que aparecer no build da Vercel, me manda o print da mensagem de
erro que eu te digo exatamente o que corrigir.
