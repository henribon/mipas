# Mipas

## O que é

Mipas é uma rede social baseada em mapas. A ideia central: cada pessoa
explora o mundo real como se fosse um mapa de game, e vai "pinando" (criando
pins/markers) os lugares que visita ou conhece — bares, restaurantes, pontos
turísticos, festas etc.

Cada pin é um lugar real (endereço, ex: "Rua Silva, 24") ao qual o usuário dá
um nome próprio (ex: "BAR DO ZÉ") e enriquece com:
- Foto(s) do lugar
- Descrição
- Endereço

## Conceito de listas

Pins são organizados em **listas** criadas pelo usuário (ex: "Bares que eu
curto", "Roteiro de viagem SP"). Listas podem ser:
- **Privadas** — só o dono vê, é o "mapa pessoal" de game dele.
- **Públicas** — outras pessoas podem visualizar, servindo como guia de
  lugares legais pra visitar.

## Eventos (feature futura)

Dentro de listas **públicas**, será possível criar eventos associados a pins
(ex: um pin de bar vira palco de um evento específico numa data). Ainda não
implementado — é direção de produto, não escopo atual.

## Status atual do projeto

O Mipas é hoje um site estático (React no navegador) + Supabase, sem backend
próprio — roda inteiramente no free tier, só pro dono + amigos:

- **Site estático** na pasta [`/docs`](docs/), publicado via **GitHub Pages**
  direto da branch `main` (Settings → Pages → Folder `/docs`), sem build step,
  sem GitHub Actions.
- **Supabase** (Postgres gerenciado + API REST automática + Auth + Storage,
  free tier) como backend. Schema, políticas de Row Level Security e bucket
  de fotos em [`docs/supabase-schema.sql`](docs/supabase-schema.sql) —
  mudanças de schema entram como bloco de migração incremental idempotente no
  fim desse arquivo, pra rodar no SQL Editor do dashboard.
- React rodando via Babel Standalone direto no navegador (zero bundler/npm),
  carregado via CDN — ver `docs/index.html` pra ordem de carregamento dos
  módulos. Módulos se comunicam pelo namespace global `window.Mipas`.
- Autenticação: só o dono loga (email/senha, criado manualmente no dashboard
  do Supabase); amigos só visualizam listas marcadas como públicas via link
  (`?list=<uuid>`), sem precisar de conta.

## Histórico: backend Java (arquivado)

O projeto começou como um backend Java/Spring Boot + PostgreSQL
autogerenciado, mas hospedar Postgres + servidor Java 24/7 sem custo não era
viável e o projeto pivotou pra stack acima. Esse código Java **não vive mais
na `main`** — está guardado na branch [`java-backend-archive`](https://github.com/henribon/mipas/tree/java-backend-archive),
caso o produto um dia cresça e precise de backend próprio de novo.

## Convenções e decisões

- **Todo o código é em inglês** — nomes de variáveis, funções, tabelas/colunas
  do banco, commits, comentários etc. Português fica só para conversas com o
  usuário, textos da interface e documentação de produto como este arquivo.
- Campos opcionais de um lugar (categoria, nota, descrição, valor médio,
  fotos) nunca aparecem na visualização pública quando vazios.
- Dados privados do dono (ex: tabela `user_home`, o ponto "casa" usado pra
  ordenar por distância) nunca ganham policy de leitura pra `anon`.
