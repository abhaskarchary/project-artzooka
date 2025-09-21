import { create } from 'zustand'

type View = 'menu' | 'lobby' | 'draw' | 'discuss' | 'results'

interface Player { id: string; name: string; isAdmin: boolean; avatar?: string }

interface TimersState { serverTime?: number; drawSeconds?: number; voteSeconds?: number; voteStartTime?: number }

interface RoomState {
  roomCode: string | null
  roomId: string | null
  playerId: string | null
  sessionToken: string | null
  players: Player[]
  drawSeconds: number
  voteSeconds: number
  maxPlayers: number
  // pre-start countdown
  countdownStartAt?: number
  countdownSeconds?: number
  nextGame?: any
  promptCommon?: string
  view: View
  drawingsVersion: number
  voted: boolean
  timers: TimersState
  voteTally: Record<string, number>
  setRoom: (code: string, id: string) => void
  setSelf: (playerId: string, token: string) => void
  setPlayers: (players: Player[]) => void
  setSettings: (s: { drawSeconds?: number; voteSeconds?: number; maxPlayers?: number }) => void
  setCountdown: (startAt: number, seconds: number) => void
  clearCountdown: () => void
  setNextGame: (payload: any) => void
  setPromptCommon: (p: string) => void
  setView: (v: View) => void
  bumpDrawingsVersion: () => void
  setVoted: (v: boolean) => void
  setTimers: (t: TimersState) => void
  setVoteTally: (tally: Record<string, number>) => void
  reset: () => void
}

export const useRoomStore = create<RoomState>((set) => ({
  roomCode: null,
  roomId: null,
  playerId: null,
  sessionToken: null,
  players: [],
  drawSeconds: 120,
  voteSeconds: 60,
  maxPlayers: 8,
  countdownStartAt: undefined,
  countdownSeconds: undefined,
  nextGame: undefined,
  view: 'menu',
  drawingsVersion: 0,
  voted: false,
  timers: {},
  voteTally: {},
  setRoom: (code, id) => set({ roomCode: code, roomId: id }),
  setSelf: (playerId, token) => set({ playerId, sessionToken: token }),
  setPlayers: (players) => set({ players }),
  setSettings: (s) => set((curr) => ({
    drawSeconds: s.drawSeconds ?? curr.drawSeconds,
    voteSeconds: s.voteSeconds ?? curr.voteSeconds,
    maxPlayers: s.maxPlayers ?? curr.maxPlayers,
  })),
  setCountdown: (startAt, seconds) => set({ countdownStartAt: startAt, countdownSeconds: seconds }),
  clearCountdown: () => set({ countdownStartAt: undefined, countdownSeconds: undefined }),
  setNextGame: (payload) => set({ nextGame: payload }),
  setPromptCommon: (p) => set({ promptCommon: p, view: 'draw' }),
  setView: (v) => set({ view: v }),
  bumpDrawingsVersion: () => set((s) => ({ drawingsVersion: s.drawingsVersion + 1 })),
  setVoted: (v) => set({ voted: v }),
  setTimers: (t) => set({ timers: t }),
  setVoteTally: (tally) => set({ voteTally: tally }),
  reset: () => set({ roomCode: null, roomId: null, playerId: null, sessionToken: null, players: [], drawSeconds: 120, voteSeconds: 60, maxPlayers: 8, countdownStartAt: undefined, countdownSeconds: undefined, nextGame: undefined, promptCommon: undefined, view: 'menu', drawingsVersion: 0, voted: false, timers: {}, voteTally: {} })
}))
