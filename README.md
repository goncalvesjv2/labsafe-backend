# LabSafe

Aplicação para treinamento em segurança nos laboratórios. O objetivo é ajudar os alunos a aprender e avaliar seus conhecimentos antes de entrar no laboratório.

**Tecnologias:** Node.js, Fastify e TypeScript.

## Antes de começar

Tenha instalado:

- Git.
- Node.js 24 com npm.
- PostgreSQL.

## Como executar

### 1. Baixar o projeto

Abra o terminal e execute:

```bash
git clone https://github.com/goncalvesjv2/labsafe-backend.git
cd labsafe-backend
```

### 2. Instalar as dependências

Dentro da pasta do projeto, execute:

```bash
npm install
```

### 3. Configurar o projeto

Na primeira vez, siga o [guia de configuração](docs/CONFIGURACAO.md) para preencher o arquivo `.env` e preparar o banco de dados.

Se o projeto já estiver configurado, siga para o próximo passo.

### 4. Iniciar

Com o PostgreSQL em execução, rode:

```bash
npm start
```

O servidor estará disponível em **http://localhost:3000**. As telas do sistema são executadas em um projeto separado.

Mantenha o terminal aberto enquanto estiver usando o projeto. Para encerrar, pressione `Ctrl + C`.

Nas próximas vezes, basta iniciar o PostgreSQL, abrir o terminal na pasta do projeto e executar `npm start`.

## Cadastrar usuários

Use o Postman, Insomnia ou Thunder Client seguindo o [passo a passo de cadastro](docs/CONFIGURACAO.md#cadastrar-pelo-postman-insomnia-ou-thunder-client).

É necessário entrar com uma conta de administrador existente. O novo usuário recebe um convite por e-mail para criar sua senha, que o sistema salva como hash automaticamente.
