import "server-only"
import { randomUUID } from "node:crypto"
import { matchExists, saveMatch, toResult } from "@/lib/match-results"
import { fetchMatchStats } from "@/lib/match-stats"
import {
  buildPlayerSteps,
  buildSteps,
  COIN_TOTAL_MS,
  TEAM_SIZE,
  TOTAL_STEPS,
  TURN_MAX,
  TURN_MIN,
  TURN_STEP,
  type ChatMessage,
  type MatchResultView,
  type PlayerView,
  type RoomAction,
  type RoomView,
  type Team,
} from "@/lib/draft-rules"

// Salas de draft em memória, com o servidor como fonte da verdade. Cada jogador
// conectado recebe o estado (visto por ele) a cada mudança.
// As salas vivem enquanto o servidor estiver no ar; uma partida só vai para o banco
// depois que o draft termina, alguém informa o ID da partida e o resultado é confirmado.

type PlayerInfo = { id: string; name: string; avatar: string | null }
type Connection = { userId: string; send: (data: string) => void }

type Room = {
  code: string
  heroIds: number[]
  hostId: string | null
  users: Map<string, PlayerInfo>
  connections: Map<string, Connection>
  // Quem acompanha a sala perguntando o estado (quando a conexão ao vivo não funciona): último pedido.
  pollers: Map<string, number>
  // Jogadores fictícios (para testes): sempre "online" e controlados pelo anfitrião.
  bots: Set<string>
  botCount: number
  teams: Record<Team, string[]>
  playerFirst: Team | null
  playerPicks: number
  playersDone: boolean
  first: Team | null
  coinAt: number | null
  actions: number[]
  turnSeconds: number
  deadline: number | null
  chat: { geral: ChatMessage[]; a: ChatMessage[]; b: ChatMessage[] }
  result: MatchResultView | null
  fetchingResult: boolean
  savedDraftId: string | null
  timer: ReturnType<typeof setTimeout> | null
  emptySince: number | null
}

const CHAT_KEEP = 100
const POLL_ONLINE_MS = 8000
const MAX_BOTS = 20
const CHAT_MAX_LENGTH = 300
const EMPTY_ROOM_TTL = 30 * 60 * 1000

const globalForRooms = globalThis as unknown as { rooms?: Map<string, Room>; roomSweeper?: ReturnType<typeof setInterval> }
const rooms = (globalForRooms.rooms ??= new Map<string, Room>())

// Remove salas que ficaram vazias por muito tempo.
globalForRooms.roomSweeper ??= setInterval(() => {
  for (const [code, room] of rooms) {
    // Sala sem conexões ao vivo e sem ninguém perguntando o estado: começa a contar como vazia.
    const pollingRecently = [...room.pollers.values()].some((at) => Date.now() - at < POLL_ONLINE_MS)
    if (room.connections.size === 0 && !pollingRecently) room.emptySince ??= Date.now()
    if (room.emptySince && Date.now() - room.emptySince > EMPTY_ROOM_TTL) {
      if (room.timer) clearTimeout(room.timer)
      rooms.delete(code)
    }
  }
}, 60 * 1000)

function getRoom(code: string, heroIds: number[]) {
  let room = rooms.get(code)
  if (!room) {
    room = {
      code,
      heroIds,
      hostId: null,
      users: new Map(),
      connections: new Map(),
      pollers: new Map(),
      bots: new Set(),
      botCount: 0,
      teams: { a: [], b: [] },
      playerFirst: null,
      playerPicks: 0,
      playersDone: false,
      first: null,
      coinAt: null,
      actions: [],
      turnSeconds: TURN_MIN,
      deadline: null,
      chat: { geral: [], a: [], b: [] },
      result: null,
      fetchingResult: false,
      savedDraftId: null,
      timer: null,
      emptySince: null,
    }
    rooms.set(code, room)
  }
  return room
}

// ---------- Leitura ----------

const teamOf = (room: Room, userId: string): Team | null =>
  room.teams.a.includes(userId) ? "a" : room.teams.b.includes(userId) ? "b" : null

const captainOf = (room: Room, team: Team) => room.teams[team][0] ?? null
const isCaptain = (room: Room, userId: string) => captainOf(room, "a") === userId || captainOf(room, "b") === userId
const isBot = (room: Room, userId: string) => room.bots.has(userId)

// O jogador age por si; o anfitrião também age pelos jogadores fictícios.
const controls = (room: Room, actorId: string, playerId: string) =>
  actorId === playerId || (isBot(room, playerId) && actorId === room.hostId)

// Quem joga pelo time: o capitão, ou o anfitrião quando o capitão é fictício.
const actsForTeam = (room: Room, actorId: string, team: Team) => {
  const captain = captainOf(room, team)
  return captain !== null && controls(room, actorId, captain)
}

// Anfitrião ou capitães (incluindo o anfitrião pelos capitães fictícios).
const canManage = (room: Room, actorId: string) =>
  room.hostId === actorId || actsForTeam(room, actorId, "a") || actsForTeam(room, actorId, "b")

const other = (team: Team): Team => (team === "a" ? "b" : "a")
// Draft iniciado (moeda jogada): times travados, a não ser pela escolha de jogadores dos capitães.
const started = (room: Room) => room.playerFirst !== null
// Escolha de jogadores em andamento.
const pickingPlayers = (room: Room) => started(room) && !room.playersDone
const lobbyIds = (room: Room) => [...onlineIds(room)].filter((id) => !teamOf(room, id))
const finished = (room: Room) => room.actions.length === TOTAL_STEPS

function onlineIds(room: Room) {
  const now = Date.now()
  const polling = [...room.pollers].filter(([, at]) => now - at < POLL_ONLINE_MS).map(([id]) => id)
  return new Set([...room.connections.values()].map((c) => c.userId).concat(polling, [...room.bots]))
}

function viewFor(room: Room, userId: string): RoomView {
  const online = onlineIds(room)
  const player = (id: string): PlayerView => {
    const info = room.users.get(id)
    return { id, name: info?.name ?? "?", avatar: info?.avatar ?? null, online: online.has(id), bot: isBot(room, id) }
  }
  const myTeam = teamOf(room, userId)
  return {
    code: room.code,
    serverNow: Date.now(),
    hostId: room.hostId,
    lobby: [...online].filter((id) => !teamOf(room, id)).map(player),
    teams: { a: room.teams.a.map(player), b: room.teams.b.map(player) },
    playerFirst: room.playerFirst,
    playerPicks: room.playerPicks,
    playersDone: room.playersDone,
    first: room.first,
    coinAt: room.coinAt,
    actions: room.actions,
    turnSeconds: room.turnSeconds,
    deadline: room.deadline,
    chat: { geral: room.chat.geral, time: myTeam ? room.chat[myTeam] : [] },
    result: room.result,
    fetchingResult: room.fetchingResult,
    savedDraftId: room.savedDraftId,
  }
}

function broadcast(room: Room) {
  for (const conn of room.connections.values()) {
    conn.send(JSON.stringify(viewFor(room, conn.userId)))
  }
}

// ---------- Conexão ----------

// Alternativa à conexão ao vivo: o navegador pergunta o estado a cada segundo.
// Quem para de perguntar sai da sala de espera depois de alguns segundos.
export function pollRoom(code: string, heroIds: number[], user: PlayerInfo) {
  const room = getRoom(code, heroIds)
  const isNew = !room.pollers.has(user.id) || Date.now() - (room.pollers.get(user.id) ?? 0) >= POLL_ONLINE_MS
  room.users.set(user.id, user)
  room.pollers.set(user.id, Date.now())
  room.hostId ??= user.id
  room.emptySince = null
  if (isNew) broadcast(room)
  return viewFor(room, user.id)
}

export function joinRoom(code: string, heroIds: number[], user: PlayerInfo, send: (data: string) => void) {
  const room = getRoom(code, heroIds)
  const connId = randomUUID()
  room.users.set(user.id, user)
  room.connections.set(connId, { userId: user.id, send })
  room.hostId ??= user.id
  room.emptySince = null
  broadcast(room)

  return function leave() {
    room.connections.delete(connId)
    if (room.connections.size === 0 && onlineIds(room).size === room.bots.size) room.emptySince = Date.now()
    broadcast(room)
  }
}

// ---------- Ações ----------

export function applyAction(code: string, userId: string, action: RoomAction): string | null {
  const room = rooms.get(code)
  if (!room) return "Sala não encontrada."
  if (!room.users.has(userId)) return "Você não está nesta sala."

  const error = handle(room, userId, action)
  if (!error) broadcast(room)
  return error
}

function handle(room: Room, userId: string, action: RoomAction): string | null {
  switch (action.type) {
    case "move":
      return move(room, userId, String(action.playerId), action.to)

    case "randomizeCaptains": {
      if (started(room)) return "O draft já começou."
      if (room.hostId !== userId) return "Só o anfitrião pode sortear os capitães."
      const pool = [...onlineIds(room)]
      if (pool.length < 2) return "Precisa de pelo menos 2 jogadores na sala."
      const pick = () => pool.splice(Math.floor(Math.random() * pool.length), 1)[0]
      room.teams = { a: [pick()], b: [pick()] }
      return null
    }

    case "startDraft": {
      if (started(room)) return "O draft já começou."
      if (!captainOf(room, "a") || !captainOf(room, "b")) return "Os dois times precisam de capitão."
      if (!canManage(room, userId)) return "Só o anfitrião ou os capitães podem iniciar o draft."
      // A moeda decide quem escolhe jogador primeiro; o outro time começa nos heróis.
      room.playerFirst = Math.random() < 0.5 ? "a" : "b"
      room.coinAt = Date.now()
      room.playerPicks = 0
      if (lobbyIds(room).length === 0) finishPlayerPicks(room)
      return null
    }

    case "pickPlayer": {
      if (!pickingPlayers(room)) return "Não é hora de escolher jogadores."
      if (Date.now() < (room.coinAt ?? 0) + COIN_TOTAL_MS) return "Espere a moeda cair."
      const team = buildPlayerSteps(room.playerFirst!)[room.playerPicks]
      if (!actsForTeam(room, userId, team)) return "Só o capitão da vez pode escolher."
      const playerId = String(action.playerId)
      if (!lobbyIds(room).includes(playerId)) return "Esse jogador não está na sala de espera."
      room.teams[team].push(playerId)
      room.playerPicks++
      if (room.playerPicks >= buildPlayerSteps(room.playerFirst!).length || lobbyIds(room).length === 0) {
        finishPlayerPicks(room)
      }
      return null
    }

    case "endPlayerPicks": {
      if (!pickingPlayers(room)) return "Não é hora de escolher jogadores."
      if (!canManage(room, userId)) return "Só o anfitrião ou os capitães podem fazer isso."
      finishPlayerPicks(room)
      return null
    }

    case "choose": {
      const step = currentStep(room)
      if (!step) return "Não é hora de escolher."
      if (Date.now() < (room.coinAt ?? 0) + COIN_TOTAL_MS) return "Espere a moeda cair."
      if (!actsForTeam(room, userId, step.team)) return "Só o capitão da vez pode escolher."
      return choose(room, Number(action.heroId))
    }

    case "turnSeconds": {
      if (room.hostId !== userId && !isCaptain(room, userId)) return "Só o anfitrião ou os capitães mudam o tempo."
      if (room.actions.length > 0) return "O draft já começou; o tempo não pode mais ser alterado."
      const seconds = Math.round(Number(action.seconds) / TURN_STEP) * TURN_STEP
      if (!(seconds >= TURN_MIN && seconds <= TURN_MAX)) return "Tempo inválido."
      room.turnSeconds = seconds
      // Draft de heróis já liberado, mas ninguém escolheu ainda: o primeiro turno usa o novo tempo.
      if (room.first) {
        room.deadline = Math.max(Date.now(), (room.coinAt ?? 0) + COIN_TOTAL_MS) + seconds * 1000
        schedule(room)
      }
      return null
    }

    case "restart": {
      if (!finished(room)) return "O draft ainda não terminou."
      if (room.hostId !== userId && !isCaptain(room, userId)) return "Só o anfitrião ou os capitães podem reiniciar."
      // Volta para a fase de capitães, mantendo os capitães; os demais voltam para a sala de espera.
      room.teams = { a: room.teams.a.slice(0, 1), b: room.teams.b.slice(0, 1) }
      room.playerFirst = null
      room.playerPicks = 0
      room.playersDone = false
      room.first = null
      room.coinAt = null
      room.actions = []
      room.deadline = null
      room.result = null
      room.savedDraftId = null
      return null
    }

    case "chat": {
      const text = String(action.text ?? "").trim().slice(0, CHAT_MAX_LENGTH)
      if (!text) return "Mensagem vazia."
      const team = teamOf(room, userId)
      const channel = action.channel === "time" ? team : "geral"
      if (!channel) return "Entre em um time para usar o chat do time."
      const author = room.users.get(userId)?.name ?? "?"
      const list = room.chat[channel]
      list.push({ id: randomUUID(), authorId: userId, author, text, at: Date.now() })
      if (list.length > CHAT_KEEP) list.splice(0, list.length - CHAT_KEEP)
      return null
    }

    case "addBot": {
      if (room.hostId !== userId) return "Só o anfitrião pode adicionar jogadores fictícios."
      if (room.playersDone) return "A escolha de jogadores já terminou."
      if (room.bots.size >= MAX_BOTS) return "Limite de jogadores fictícios atingido."
      room.botCount++
      const id = `bot-${randomUUID().slice(0, 8)}`
      room.bots.add(id)
      room.users.set(id, { id, name: `Fictício ${room.botCount}`, avatar: null })
      return null
    }

    case "confirmResult": {
      if (!room.result) return "Busque a partida pelo ID antes de confirmar."
      if (room.savedDraftId) return "Essa partida já foi salva no histórico."
      if (!canManage(room, userId)) return "Só o anfitrião ou os capitães podem confirmar o resultado."
      if (matchExists(room.result.matchId)) {
        return "Essa partida já foi registrada no histórico."
      }
      room.savedDraftId = saveDraft(room, room.result)
      return null
    }

    case "discardResult": {
      if (room.savedDraftId) return "Essa partida já foi salva no histórico."
      if (!canManage(room, userId)) return "Só o anfitrião ou os capitães podem fazer isso."
      room.result = null
      return null
    }

    default:
      return "Ação desconhecida."
  }
}

// Antes do draft só se escolhem os capitães: cada um entra sozinho na vaga de capitão (o "+")
// ou sai dela. Depois disso, os demais jogadores entram pela escolha dos capitães (pickPlayer).
function move(room: Room, actorId: string, playerId: string, to: Team | "lobby"): string | null {
  if (started(room)) return "Depois de iniciar o draft, os jogadores entram pela escolha dos capitães."
  if (!room.users.has(playerId)) return "Jogador não encontrado."
  if (!controls(room, actorId, playerId)) return "Você só pode mover a si mesmo."
  const from = teamOf(room, playerId)

  if (to === "lobby") {
    if (from) room.teams[from] = room.teams[from].filter((id) => id !== playerId)
    return null
  }
  if (to !== "a" && to !== "b") return "Time inválido."
  if (from === to) return null
  if (room.teams[to].length > 0) return "Esse time já tem capitão."
  if (from) room.teams[from] = room.teams[from].filter((id) => id !== playerId)
  room.teams[to].push(playerId)
  return null
}

// Fim da escolha de jogadores: libera o draft de heróis, começando pelo time que não escolheu jogador primeiro.
function finishPlayerPicks(room: Room) {
  room.playersDone = true
  room.first = other(room.playerFirst!)
  room.deadline = Math.max(Date.now(), (room.coinAt ?? 0) + COIN_TOTAL_MS) + room.turnSeconds * 1000
  schedule(room)
}

function currentStep(room: Room) {
  if (!room.first || finished(room)) return null
  return buildSteps(room.first)[room.actions.length]
}

function choose(room: Room, heroId: number): string | null {
  if (!room.heroIds.includes(heroId)) return "Herói inválido."
  if (room.actions.includes(heroId)) return "Esse herói já foi escolhido ou banido."
  room.actions.push(heroId)
  if (finished(room)) {
    room.deadline = null
    if (room.timer) clearTimeout(room.timer)
  } else {
    room.deadline = Date.now() + room.turnSeconds * 1000
    schedule(room)
  }
  return null
}

// Quando o tempo do turno acaba, o servidor escolhe um herói aleatório pelo time.
function schedule(room: Room) {
  if (room.timer) clearTimeout(room.timer)
  if (!room.deadline) return
  room.timer = setTimeout(() => {
    room.timer = null
    if (!currentStep(room) || !room.deadline || Date.now() < room.deadline - 50) return schedule(room)
    const available = room.heroIds.filter((id) => !room.actions.includes(id))
    if (available.length === 0) return
    choose(room, available[Math.floor(Math.random() * available.length)])
    broadcast(room)
  }, Math.max(0, room.deadline - Date.now()))
}

// ---------- Resultado da partida ----------

// Busca a partida na API pelo ID e deixa o resultado na sala para todos conferirem.
export async function submitMatch(code: string, userId: string, rawId: string): Promise<string | null> {
  const room = rooms.get(code)
  if (!room) return "Sala não encontrada."
  if (!finished(room)) return "Termine o draft antes de informar a partida."
  if (room.savedDraftId) return "Essa partida já foi salva no histórico."
  if (!canManage(room, userId)) return "Só o anfitrião ou os capitães podem informar a partida."
  if (room.fetchingResult) return "Já estamos buscando uma partida."
  const matchId = Number(String(rawId).trim())
  if (!Number.isSafeInteger(matchId) || matchId <= 0) return "ID da partida inválido."
  if (matchExists(matchId)) return "Essa partida já foi registrada no histórico."

  room.fetchingResult = true
  broadcast(room)
  const actionsAtStart = room.actions.join(",")
  try {
    const stats = await fetchMatchStats(matchId)
    // A sala pode ter sido reiniciada enquanto a API respondia.
    if (room.actions.join(",") !== actionsAtStart || !finished(room)) return "O draft foi reiniciado."
    room.result = buildResult(room, stats)
    return null
  } catch (e) {
    return e instanceof Error ? e.message : "Não foi possível buscar a partida."
  } finally {
    room.fetchingResult = false
    broadcast(room)
  }
}

// Liga os times da API (0/1) aos times do draft pelos heróis escolhidos.
function buildResult(room: Room, stats: Awaited<ReturnType<typeof fetchMatchStats>>): MatchResultView {
  const steps = buildSteps(room.first)
  const picks = (team: Team) => new Set(room.actions.filter((_, i) => steps[i].team === team && steps[i].action === "pick"))
  const draftPicks = { a: picks("a"), b: picks("b") }
  const overlap = (apiTeam: 0 | 1, team: Team) =>
    stats.players.filter((p) => p.apiTeam === apiTeam && draftPicks[team].has(p.heroId)).length
  const straight = overlap(0, "a") + overlap(1, "b")
  const swapped = overlap(0, "b") + overlap(1, "a")
  const teamFor = (apiTeam: 0 | 1): Team => ((apiTeam === 0) === straight >= swapped ? "a" : "b")
  return toResult(stats, teamFor, Math.max(straight, swapped))
}

function saveDraft(room: Room, result: MatchResultView) {
  const steps = buildSteps(room.first)
  const players = (team: Team) => room.teams[team].map((uid) => ({ id: uid, name: room.users.get(uid)?.name ?? "?" }))
  return saveMatch(result, {
    roomCode: room.code,
    firstTeam: room.first ?? "a",
    turnSeconds: room.turnSeconds,
    teams: { a: players("a"), b: players("b") },
    steps: room.actions.map((heroId, i) => ({ ...steps[i], heroId })),
  })
}
