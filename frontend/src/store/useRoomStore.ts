import { create } from 'zustand'

type View = 'menu' | 'lobby' | 'draw' | 'discuss' | 'results'

interface Player { id: string; name: string; isAdmin: boolean; avatar?: string }

interface RoomState {
  roomCode: string | null
  roomId: string | null
  playerId: string | null
  sessionToken: string | null
  players: Player[]
  promptCommon?: string
  view: View
  drawingsVersion: number
  voted: boolean
  setRoom: (code: string, id: string) => void
  setSelf: (playerId: string, token: string) => void
  setPlayers: (players: Player[]) => void
  setPromptCommon: (p: string) => void
  setView: (v: View) => void
  bumpDrawingsVersion: () => void
  setVoted: (v: boolean) => void
  reset: () => void
}

export const useRoomStore = create<RoomState>((set) => ({
  roomCode: null,
  roomId: null,
  playerId: null,
  sessionToken: null,
  players: [],
  view: 'menu',
  drawingsVersion: 0,
  voted: false,
  setRoom: (code, id) => set({ roomCode: code, roomId: id }),
  setSelf: (playerId, token) => set({ playerId, sessionToken: token }),
  setPlayers: (players) => set({ players }),
  setPromptCommon: (p) => set({ promptCommon: p }),
  setView: (v) => set({ view: v }),
  bumpDrawingsVersion: () => set((s) => ({ drawingsVersion: s.drawingsVersion + 1 })),
  setVoted: (v) => set({ voted: v }),
  reset: () => set({ roomCode: null, roomId: null, playerId: null, sessionToken: null, players: [], promptCommon: undefined, view: 'menu', drawingsVersion: 0, voted: false })
}))
