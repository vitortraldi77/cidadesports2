# Reserva de Espaços — Cidade Sports

Aplicação para solicitar e gerenciar o uso da quadra society, da quadra de vôlei
de areia e do campo de futebol do Cidade Sports (Igreja da Cidade). Substitui o
Google Forms manual, com checagem automática de conflito de horário e painel de
gestão.

- **Formulário público** (`/`) — qualquer pessoa envia um pedido, sem login.
- **Painel do admin** (`/admin`) — duas abas:
  - **Lista** — pedidos com filtros, detalhes e as ações de aprovar, rejeitar,
    confirmar e cancelar.
  - **Calendário** (`/admin/calendario`) — visão semanal com eixo de horas, que
    é onde conflitos e horários livres ficam visíveis de relance.

## Como rodar

```bash
npm install
cp .env.example .env    # preencha SESSION_SECRET e ADMIN_SENHA
npm run db:migrate      # cria o banco SQLite e aplica as migrations
npm run db:seed         # cria o admin e 9 reservas de exemplo
npm run dev
```

`SESSION_SECRET` precisa ter no mínimo 32 caracteres. Gere um com:

```bash
openssl rand -base64 32
```

### Scripts

| Script | O que faz |
| --- | --- |
| `npm run dev` | Sobe o servidor de desenvolvimento |
| `npm test` | Roda os testes das regras de negócio e do calendário (51 casos) |
| `npm run typecheck` | Verifica os tipos |
| `npm run db:migrate` | Cria/aplica migrations |
| `npm run db:seed` | Popula com dados de exemplo (idempotente) |
| `npm run db:reset` | Apaga o banco e refaz tudo |
| `npm run db:studio` | Abre o Prisma Studio para inspecionar o banco |

## As regras do processo

Todas as regras são revalidadas no servidor. O que existe no cliente é apenas
antecipação de feedback — nenhuma validação depende do navegador.

| Regra | Onde vive |
| --- | --- |
| Antecedência mínima de 3 dias úteis | `src/lib/regras/antecedencia.ts` |
| Duração máxima de 2 horas | `src/lib/regras/duracao.ts` |
| Conflito de horário no mesmo espaço | `src/lib/regras/conflito.ts` |
| 1 reserva por responsável por dia | `src/lib/regras/conflito.ts` |
| Formato e obrigatoriedade dos campos | `src/lib/schemas.ts` |
| Transições de status válidas | `src/lib/dominio.ts` |

### Detalhes que valem saber

**Dias úteis ignoram feriados.** A contagem considera apenas segunda a sexta.
Numa semana com feriado, a antecedência real fica menor que 3 dias de
expediente. Para mudar, o ponto único é `ehDiaUtil` em `src/lib/datas.ts`.

**Reservas encostadas não conflitam.** Uma reserva das 10h às 12h e outra das
12h às 14h coexistem: o espaço vaga exatamente no horário de término.

**Rejeitar e cancelar liberam o horário automaticamente.** Não há rotina de
liberação. A checagem de conflito só considera os status listados em
`STATUS_QUE_OCUPAM` (pendente, aprovado, confirmado), então tirar a reserva
desse conjunto já basta.

**O calendário mostra os três espaços numa coluna só por dia.** Duas reservas
podem ocupar o mesmo horário sem conflito algum — vôlei às 19h e campo às 19h
são válidos. Empilhadas, uma esconderia a outra, então blocos simultâneos são
distribuídos em faixas lado a lado (`src/lib/calendario.ts`). A largura é
calculada por grupo de sobreposição, e não por dia: uma única simultaneidade
pela manhã não estreita as reservas da tarde.

**Datas e horas são strings, não `DateTime`.** Uma reserva é um compromisso no
calendário de parede da igreja, não um instante absoluto no tempo. Guardá-la
como `DateTime` obriga a escolher um fuso e abre a porta para o clássico "a
reserva do dia 10 aparece como dia 9". Como `"YYYY-MM-DD"` e `"HH:mm"`, o valor
que entra é o valor que sai — e a ordenação lexicográfica coincide com a
cronológica, então a busca de sobreposição roda direto no SQL.

## Estrutura

```
prisma/
  schema.prisma          modelo de dados
  migrations/            histórico versionado
  seed.ts                admin + reservas de exemplo
src/
  app/
    page.tsx             formulário público
    sucesso/             confirmação com protocolo
    admin/
      login/             tela de login (fora do guard)
      (painel)/          com guard de sessão
        page.tsx         aba Lista: filtros e ações
        calendario/      aba Calendário: visão semanal
    actions/             Server Actions
  components/
    form/                formulário público
    admin/               painel (abas, lista, calendário)
    ui/                  etiqueta de status
  lib/
    dominio.ts           enums, rótulos, transições, constantes das regras
    calendario.ts        layout da grade semanal (faixas lado a lado)
    datas.ts             datas e horas como string, sem fuso
    schemas.ts           validação Zod
    auth.ts              sessão em cookie + bcrypt
    whatsapp.ts          links wa.me com mensagem pronta
    regras/              regras de negócio isoladas
tests/                   testes das regras
```

## Fluxo de status

```
                  ┌──────────► REJEITADO
                  │
PENDENTE ─────────┼──────────► APROVADO ─────► CONFIRMADO
                  │                │                │
                  │                └────────────────┴──► CANCELADO
```

`REJEITADO` e `CANCELADO` são estados finais e não ocupam o espaço.
O contato com o solicitante acontece por WhatsApp, fora do sistema: o painel
oferece um link `wa.me` com a mensagem já escrita, que o Vitor revisa antes de
enviar. O sistema nunca envia nada sozinho.

## Migração para o Supabase (produção)

O schema foi escrito para ser portável. Os passos:

1. **Trocar o provider** em `prisma/schema.prisma`:

   ```prisma
   datasource db {
     provider = "postgresql"
   }
   ```

2. **Trocar o driver adapter** em `src/lib/db.ts` e em `prisma/seed.ts`:

   ```bash
   npm install @prisma/adapter-pg
   npm uninstall @prisma/adapter-better-sqlite3
   ```

   ```ts
   import { PrismaPg } from '@prisma/adapter-pg'
   new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })
   ```

3. **Apontar `DATABASE_URL`** para a connection string do projeto Supabase.

4. **Recriar as migrations** (`rm -rf prisma/migrations && npm run db:migrate`),
   já que o SQL gerado é específico do banco.

5. **Adicionar a trava anti-conflito no banco**, que o SQLite não suporta.
   Hoje a garantia contra duas reservas simultâneas para o mesmo horário está
   na transação da Server Action. Ela reduz muito a janela, mas quem fecha de
   vez é uma *exclusion constraint* do Postgres:

   ```sql
   CREATE EXTENSION IF NOT EXISTS btree_gist;

   ALTER TABLE "Reserva" ADD CONSTRAINT sem_sobreposicao
     EXCLUDE USING gist (
       espaco WITH =,
       data WITH =,
       tsrange(
         (data || ' ' || "horaInicio")::timestamp,
         (data || ' ' || "horaFim")::timestamp
       ) WITH &&
     ) WHERE (status IN ('PENDENTE', 'APROVADO', 'CONFIRMADO'));
   ```

   Com isso, um conflito passa a ser impossível no nível do banco, e não apenas
   improvável no nível da aplicação.

6. **Considerar CHECK constraints** para os campos que hoje são texto livre
   (`status`, `espaco`, `tipoVinculo`), ou convertê-los em enums nativos do
   Postgres. Os valores válidos estão em `src/lib/dominio.ts`.

> **Atenção ao plano gratuito do Supabase:** projetos com pouca atividade são
> pausados após alguns dias sem acesso ao banco. Uma aplicação de reservas com
> poucos pedidos por semana pode cair nisso. A solução usual é uma rotina diária
> que escreva uma linha em uma tabela de "pulso".

## Segurança

- Senha do admin guardada como hash bcrypt (custo 12), nunca em texto.
- Sessão em cookie `httpOnly`, `sameSite=lax`, assinado com HS256, válido por
  12 horas.
- Login com resposta genérica e tempo de resposta constante, para não revelar
  quais usuários existem.
- O guard de layout protege a navegação; **cada Server Action de escrita
  revalida a sessão por conta própria** — um layout protege o que é renderizado,
  não o que é executado.
- O formulário público não expõe nenhum dado de outras reservas: a mensagem de
  conflito informa apenas o horário ocupado, nunca de quem é.

## Testes

```bash
npm test
```

Cobrem as regras de negócio, incluindo os casos de borda que causam erro na
prática: contagem de dias úteis atravessando o fim de semana, duração de
exatamente 2 horas versus 2h01, reservas encostadas que não devem conflitar,
liberação do horário por rejeição ou cancelamento, e a exigência condicional do
código de membresia. A checagem de conflito é testada contra um SQLite real,
criado a partir das próprias migrations do projeto — testá-la com objetos em
memória validaria a coisa errada, já que a sobreposição é resolvida em SQL.
