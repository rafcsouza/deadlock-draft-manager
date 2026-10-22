<div align="center">

# Tatinuanga Draft

**Pick & ban em tempo real para partidas personalizadas de Deadlock**

Monte os times, faça o draft de heróis com timer e guarde o histórico e o ranking do seu grupo.

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=nextdotjs)
![React](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?logo=tailwindcss&logoColor=white)
![Licença MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-green)

</div>

---

Projeto **open source** feito para um grupo que joga partidas personalizadas (6v6) de [Deadlock](https://store.steampowered.com/app/1422450/Deadlock/). Uma pessoa cria a sala, manda o link, e todo mundo acompanha o draft ao vivo: capitães, escolha de jogadores, bans e picks de heróis. Depois da partida, o ID do jogo traz os stats completos pela [Deadlock API](https://deadlock-api.com) e alimenta o histórico e o leaderboard.

## Funcionalidades

**Sala de draft ao vivo**
- Link compartilhável: quem abre escolhe um nome e já entra (como visitante ou com conta).
- Capitães escolhidos na mão ou sorteados, moeda para decidir quem começa e escolha de jogadores na ordem 1-2-2-2-2-1, com opção de desfazer a última escolha.
- Draft de heróis com bans e picks alternados, timer configurável (30 a 180 s) e escolha automática quando o tempo acaba.
- Destaque visual de "sua vez" (vermelho para banir, verde para escolher), confirmação em dois cliques e aviso na aba do navegador.
- Chat geral e chat do time, guia de uso dentro da sala e jogadores fictícios para testar sozinho.

**Partidas e estatísticas**
- Resultado pelo ID da partida: K/D/A, almas, dano, cura, itens e MVP de cada jogador.
- Importação de partidas antigas pelo ID ou por **print do placar**, lido com OCR local (sem serviço pago).
- Histórico com placar no estilo do jogo, bans de cada time e partidas pendentes de confirmação.

**Leaderboard e perfis**
- Pontuação simples (vitória, derrota, sequência e MVP), setas de subida e queda, sequências 🔥/🧊 e herói mais jogado.
- Página de cada jogador com médias, heróis e todas as partidas.
- Contas com senha, pergunta de segurança, avatar e SteamID opcional, ou acesso rápido como visitante.

## Como rodar

Requisitos: **Node.js 22.13 ou mais novo** (o banco usa o SQLite embutido do Node; recomendado o 24).

```bash
git clone https://github.com/rafcsouza/deadlock-draft-manager.git
cd deadlock-draft-manager
npm install
npm run dev
```

Abra `http://localhost:3000`. O banco é criado sozinho em `data/app.db`.

Para produção:

```bash
npm run build
npm start
```

### Configuração (opcional)

Copie `.env.example` para `.env.local`. Nada é obrigatório:

| Variável | Para que serve |
|---|---|
| `DEADLOCK_API_KEY` | Chave da Deadlock API: aumenta o limite de partidas buscadas na Steam. |
| `DATABASE_PATH` | Onde guardar o banco SQLite (padrão `data/app.db`). |
| `DEADLOCK_INGEST_PATH` | Caminho do [deadlock-api-ingest](https://github.com/deadlock-api/deadlock-api-ingest), se não estiver no lugar padrão. |
| `HEROES_API_URL` | Outra fonte para a lista de heróis. |

## Buscando partidas sem esperar

A Deadlock API só busca na Steam um número limitado de partidas novas por hora. Para evitar esse limite, rode o **[deadlock-api-ingest](https://github.com/deadlock-api/deadlock-api-ingest)** no PC onde o Deadlock está instalado: ele envia para a API os dados das partidas que já estão no seu jogo. Se o site rodar no mesmo PC, ele chama o ingest na hora quando a API ainda não tem a partida pedida.

A pasta [`ferramentas/`](ferramentas) tem um script para Windows que lista as partidas personalizadas guardadas no PC de cada jogador, útil para recuperar partidas antigas do grupo.

## Hospedagem

A pasta [`deploy/`](deploy) tem scripts para um servidor Ubuntu (testados no plano Always Free da Oracle Cloud):

- `setup.sh`: instala Node e Caddy, configura o firewall, sobe o site como serviço com HTTPS automático e agenda um backup diário do banco.
- `update.sh`: atualiza o site com a versão mais recente do repositório.
- `backup.sh`: copia o banco todo dia (localmente e, se configurado, para um bucket de armazenamento).

## Como o draft funciona

| Fase | O que acontece |
|---|---|
| Capitães | Cada time precisa de um capitão. O dono da sala pode sortear. |
| Moeda | Decide qual time escolhe jogador primeiro. |
| Jogadores | Os capitães escolhem da sala de espera, na ordem 1-2-2-2-2-1. |
| Heróis | Começa o time que **não** escolheu jogador primeiro. Ordem: ban, ban, pick 1, pick 2, pick 2, pick 1, ban, ban, pick 1, pick 2, pick 2, pick 1. |
| Resultado | Depois de jogar, alguém informa o ID da partida; os stats ficam salvos no histórico. |

## Estrutura

```
src/
  app/          páginas (sala, histórico, leaderboard, perfis, conta) e rotas da API das salas
  components/   interface (sala de draft, placares, formulários)
  lib/          regras do draft, salas em tempo real, banco, Deadlock API, OCR e pontuação
deploy/         scripts de instalação, atualização e backup no servidor
ferramentas/    script para listar partidas personalizadas no PC dos jogadores
```

As salas vivem na memória do servidor e chegam aos navegadores por Server-Sent Events (com consulta periódica como alternativa). Contas, partidas e ranking ficam no SQLite.

## Créditos

- Inspirado no draft da comunidade [Deadlock PRO BR](https://github.com/deadlockprobr).
- Heróis, itens e estatísticas pela [Deadlock API](https://deadlock-api.com).
- OCR dos prints com [Tesseract.js](https://github.com/naptha/tesseract.js).

Projeto de fã, sem ligação com a Valve. Deadlock e os heróis são marcas da Valve Corporation.

## Licença

[MIT](LICENSE): use, modifique e distribua à vontade.
