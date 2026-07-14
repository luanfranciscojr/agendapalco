# Agendamento do Palco

Aplicação `Next.js` para controlar a agenda semanal do palco da igreja com `MySQL`.

## Regras implementadas

- O sistema trabalha apenas com a semana atual.
- O ministério pode abrir `1` agendamento por semana por padrão.
- O admin pode criar vários agendamentos para o mesmo ministério.
- O horário bloqueia assim que o agendamento é criado.
- Um agendamento `rejeitado` libera o horário e também libera nova tentativa semanal para o ministério.
- O admin aprova ou rejeita o agendamento inteiro.

## Stack

- `Next.js` App Router
- `MySQL`
- `Prisma`
- `Tailwind CSS`
- `Vitest`

## Configuração

1. Copie `.env.example` para `.env`.
   Configure também `APP_BASE_URL`, `PUBLIC_REVIEW_SECRET` e `SMSBARATO_API_KEY` se quiser disparar WhatsApp com links públicos de aprovação.
2. Suba o banco com Docker:

```bash
docker compose up -d
```

3. Instale dependências:

```bash
pnpm install
```

4. Gere o client Prisma:

```bash
pnpm db:generate
```

5. Crie as tabelas:

```bash
pnpm db:push
```

6. Popule os dados iniciais:

```bash
pnpm db:seed
```

7. Rode a aplicação:

```bash
pnpm dev
```

## Docker

- `docker-compose.yml` sobe um `MySQL 8.4` em `localhost:3306`
- `docker-compose.yml` sobe um `MySQL 8.4` em `localhost:3310`
- banco criado automaticamente: `agendamento_palco`
- usuário adicional: `agendamento`
- senha do root: `password`
- senha do usuário adicional: `agendamento123`
- para parar o banco: `docker compose down`
- para apagar também os dados do volume: `docker compose down -v`

## Usuários iniciais

- Admin: `Coordenação do Palco`
- Cada ministério do seed recebe um usuário com senha igual ao próprio `username`
- Exemplos:
  - `louvor / louvor`
  - `teatro / teatro`
  - `acroarte / acroarte`
  - `apoio_tecnico / apoio_tecnico`
  - `bale / bale` (Balé)
- Nenhum usuário recebe telefone padrão no seed
- O usuário do ministério precisa cadastrar o próprio WhatsApp antes da primeira solicitação de agendamento

## WhatsApp

- A integração usa a API da SMS Barato pelo endpoint `sendwa`.
- O disparo acontece quando:
  - um ministério cria uma nova solicitação pendente e o admin é avisado
  - o admin cria um agendamento direto já aprovado
  - um agendamento pendente vira `approved`
  - um agendamento é `rejected`
  - um agendamento é `cancelled` pela coordenação
- Como o template de confirmação é singular, o sistema envia `1` mensagem por agendamento aprovado.
- Template de confirmação:

```txt
Olá, {{1}}! Seu agendamento de palco para o dia {{2}}, às {{3}}, foi confirmado! Em caso de dúvidas, estamos à disposição.
```

- Template de reprovação ou cancelamento:

```txt
Olá, {{1}}! Seu agendamento de palco para o dia {{2}}, às {{3}}, foi reprovado ou cancelado. Em caso de dúvidas, estamos à disposição.
```

- Template para admin em nova solicitação:

```txt
[Palco NIBTB]
Nova solicitação de agendamento de palco. O ministério {{1}} solicitou o uso do palco no dia {{2}}, às {{3}}. Aguardando sua aprovação.
Para aprovar: https://palco.nibtabernaculo.org.br/aprovar?token={{4}}
Para reprovar: https://palco.nibtabernaculo.org.br/reprovar?token={{5}}
Para mais informações acesse: https://palco.nibtabernaculo.org.br
```

- Parâmetros enviados nos templates de confirmação e reprovação:
  - `{{1}}`: nome do líder do ministério
  - `{{2}}`: data em formato `dd/mm`
  - `{{3}}`: hora em formato `HH:00`
- Parâmetros enviados no template do admin:
  - `{{1}}`: nome do ministério
  - `{{2}}`: data em formato `dd/mm`
  - `{{3}}`: hora em formato `HH:00`
  - `{{4}}`: token público de aprovação
  - `{{5}}`: token público de reprovação
- Variáveis de ambiente:
  - `APP_BASE_URL`
  - `PUBLIC_REVIEW_SECRET`
  - `SMSBARATO_API_KEY`
  - `SMSBARATO_BASE_URL`
  - `SMSBARATO_TEMPLATE_APPROVED`
  - `SMSBARATO_TEMPLATE_REJECTED`
  - `SMSBARATO_TEMPLATE_PENDING_ADMIN`
- Templates aprovados em uso:
  - `nibtb_confirmado1`
  - `nibtb_reprovado1`
  - `nibtb_pending1`

## Scripts

- `pnpm dev`: sobe a aplicacao localmente
- `pnpm build`: gera build de produção
- `pnpm lint`: roda o lint
- `pnpm test`: executa os testes
- `pnpm db:generate`: gera o Prisma Client
- `pnpm db:push`: aplica o schema no banco
- `pnpm db:seed`: cria ministérios e configuração inicial
