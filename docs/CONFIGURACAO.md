# Configuração inicial

Siga este guia na primeira execução, depois de baixar o projeto e instalar as dependências. Execute os comandos na pasta `labsafe-backend`.

Você precisa do PostgreSQL em execução, do comando `psql` e dos dados de um serviço de e-mail SMTP com suporte a TLS.

## 1. Configurar o .env

Crie um arquivo `.env` na mesma pasta do `package.json`:

```env
PORT=3000
DATABASE_URL="postgresql://postgres:sua_senha@localhost:5432/labsafe?schema=public"
JWT_SECRET="cole_a_chave_gerada_aqui"
FRONTEND_URL="http://localhost:5173"

SMTP_HOST="smtp.seu-provedor.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="seu_usuario_smtp"
SMTP_PASS="sua_senha_smtp"
MAIL_FROM="LabSafe <seu_email@exemplo.com>"
```

Troque `sua_senha` pela senha do PostgreSQL e preencha os dados de e-mail fornecidos pelo seu serviço. Todas as variáveis SMTP são obrigatórias para iniciar a API. Para a porta `465`, use `SMTP_SECURE=true`; para `587`, use `false`.

Gere a chave de autenticação:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copie o resultado para `JWT_SECRET`. Não compartilhe o arquivo `.env`.

## 2. Preparar o banco

No terminal, conecte-se ao PostgreSQL e informe sua senha:

```bash
psql -h localhost -U postgres -d postgres
```

Dentro do `psql`, execute os comandos abaixo para criar um banco novo e suas tabelas:

```sql
CREATE DATABASE labsafe;
\connect labsafe
\set ON_ERROR_STOP on
\i prisma/migrations/001_initial_schema.sql
\i prisma/migrations/002_create_conteudo.sql
\i prisma/migrations/003_create_quiz.sql
\i prisma/migrations/004_create_question.sql
\i prisma/migrations/005_add_quiz_teacher.sql
\i prisma/migrations/006_create_alternative.sql
\i prisma/migrations/007_create_attempt.sql
\i prisma/migrations/008_create_answer.sql
\i prisma/migrations/009_add_user_invitation.sql
\i prisma/migrations/010_allow_user_without_password.sql
\i prisma/migrations/011_add_user_password_reset.sql
\i prisma/migrations/012_add_attempt_counts.sql
\i prisma/migrations/013_cascade_user_deletion.sql
\q
```

Faça essa preparação uma única vez, na ordem indicada. Se aparecer um erro, corrija antes de continuar.

Os exemplos usam o usuário `postgres` e a porta `5432`. Se forem diferentes na sua instalação, ajuste os comandos e a `DATABASE_URL`.

## 3. Gerar o Prisma e iniciar

De volta ao terminal, execute:

```bash
npx prisma generate --config prisma7.config.ts
npm start
```

A API estará em **http://localhost:3000**. Mantenha o terminal aberto e pressione `Ctrl+C` para parar.

Para conferir se está respondendo, abra **http://localhost:3000/auth/me** no navegador. Sem login, a resposta esperada é `401` (acesso não autorizado).

## Cadastrar pelo Postman, Insomnia ou Thunder Client

O cadastro exige uma conta de administrador já existente. A versão atual não permite criar o primeiro administrador por esses aplicativos.

Com a API em execução, abra o aplicativo de sua preferência. Em cada requisição, selecione o método, informe o endereço e escolha o corpo no formato **JSON**. No Postman, essa opção fica em **Body → raw → JSON**.

### 1. Fazer login como administrador

Envie `POST http://localhost:3000/auth/login`:

```json
{
  "email": "admin@exemplo.com",
  "password": "senha_do_administrador"
}
```

Use os dados de uma conta existente. Copie o valor de `token` retornado na resposta.

### 2. Cadastrar o usuário

Crie outra requisição: `POST http://localhost:3000/api/users`.

Na aba **Headers**, adicione:

```text
Authorization: Bearer COLE_O_TOKEN_DO_ADMINISTRADOR
Content-Type: application/json
```

No corpo JSON, envie:

```json
{
  "name": "Maria Silva",
  "email": "email_do_usuario@exemplo.com",
  "role": "Aluno(a)"
}
```

Troque o nome e o e-mail pelos dados do usuário. No campo `role`, use `Aluno(a)`, `Professor(a)` ou `Admin`.

O cadastro retorna status `201`. A senha será criada no próximo passo, pelo convite enviado ao e-mail informado.

### 3. Criar a senha

Abra o e-mail de convite e copie apenas o valor depois de `token=` no link recebido. O convite vale por cinco minutos.

No aplicativo, envie `POST http://localhost:3000/auth/new-password`, com o corpo JSON:

```json
{
  "token": "COLE_O_TOKEN_DO_CONVITE",
  "password": "SuaSenhaForte123",
  "confirmPassword": "SuaSenhaForte123"
}
```

Essa requisição usa o token do convite no corpo e não precisa do cabeçalho `Authorization`. Escolha uma senha com pelo menos oito caracteres e repita o mesmo valor nos dois campos.

O sistema transforma a senha em hash antes de salvar. Você não precisa gerar o hash nem editar o banco.

Se o e-mail não chegar e a resposta do cadastro mostrar `invitationSent: false`, confira as configurações de e-mail. Depois, reenvie o convite com `POST http://localhost:3000/api/users/ID_DO_USUARIO/invitations/resend`, usando o token do administrador no cabeçalho `Authorization`. O mesmo comando permite gerar outro convite se o anterior expirar.

### 4. Entrar com a nova conta

Envie novamente `POST http://localhost:3000/auth/login`, agora com o e-mail cadastrado e a senha criada no passo anterior.

## Usar a interface

A interface do sistema é executada em outro projeto. O endereço permitido no navegador é `http://localhost:5173`; se mudar, ajuste `FRONTEND_URL` e a opção `origin` em `src/app.ts`.

[Voltar ao README](../README.md)
