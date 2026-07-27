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

O projeto começou como um backend Java/Spring Boot + PostgreSQL autogerenciado
(ver seção "Stack técnica (pausada)" abaixo). O usuário percebeu que não tinha
como hospedar um banco Postgres nem manter um servidor Java rodando 24/7 sem
custo, e decidiu pivotar — por enquanto — para algo que roda **inteiramente no
navegador**, sem custo, só pra ele + amigos:

- **Site estático** na pasta [`/docs`](docs/), publicado via **GitHub Pages**
  direto da branch `main` (Settings → Pages → Folder `/docs`), sem build step,
  sem GitHub Actions.
- **Supabase** (Postgres gerenciado + API REST automática + Auth, free tier)
  como backend, no lugar do Postgres autogerenciado. Schema e políticas de
  Row Level Security em [`docs/supabase-schema.sql`](docs/supabase-schema.sql).
- React rodando via Babel Standalone direto no navegador (zero bundler/npm),
  carregado via CDN — ver `docs/index.html` pra ordem de carregamento dos
  módulos.
- Autenticação: só o dono loga (email/senha, criado manualmente no dashboard
  do Supabase); amigos só visualizam listas marcadas como públicas via link
  (`?list=<uuid>`), sem precisar de conta.

O esqueleto Java/Spring Boot abaixo **fica parado no repo, sem ser apagado**,
para uma eventual evolução futura do produto (ex: se o projeto crescer além
do uso pessoal e precisar de um backend próprio outra vez).

## Stack técnica (pausada — não é o caminho ativo hoje)

- **Java 25**
- **Spring Boot 4.1.1-SNAPSHOT** (atenção: é uma versão SNAPSHOT/pré-release,
  por isso o `pom.xml` referencia o repositório `spring-snapshots`)
- **Maven** (usar o wrapper `mvnw` / `mvnw.cmd`)
- **Lombok**
- **PostgreSQL** — banco de dados escolhido (ainda não configurado no
  projeto)
- **Flyway** — versionamento de schema do banco (ainda não configurado no
  projeto)

Grupo Maven: `com.goose`, artifact: `mipas`, pacote raiz:
`com.goose.mipas`.

## Convenções e decisões

- **Todo o código é em inglês** — nomes de classes, métodos, variáveis,
  pacotes, tabelas/colunas do banco, migrations, commits, comentários etc.
  Português fica só para conversas com o usuário e documentação de produto
  como este arquivo.
- Nenhuma decisão de arquitetura de API (REST/GraphQL), autenticação, ou
  modelagem de entidades foi tomada ainda — validar com o usuário antes de
  assumir.
- Ao adicionar Postgres/Flyway, seguir a estrutura padrão de migrations do
  Flyway (`src/main/resources/db/migration`, arquivos `V{n}__descricao.sql`).
