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
  activeGameStatus?: 'DRAWING' | 'VOTING' | 'RESULTS'
  activeGameEndTime?: number
  activeGamePlayers?: string[] // Player IDs currently in the active game
  setRoom: (code: string, id: string) => void
  setSelf: (playerId: string, token: string) => void
  setPlayers: (players: Player[]) => void
  setSettings: (s: { drawSeconds?: number; voteSeconds?: number; maxPlayers?: number }) => void
  setCountdown: (startAt: number, seconds: number) => void
  clearCountdown: () => void
  setNextGame: (payload: any) => void
  setPromptCommon: (p: string | undefined) => void
  setCurrentGameId: (gameId: string) => void
  setView: (v: View) => void
  bumpDrawingsVersion: () => void
  setVoted: (v: boolean) => void
  setTimers: (t: TimersState) => void
  setVoteTally: (tally: Record<string, number>) => void
  setActiveGameStatus: (status?: 'DRAWING' | 'VOTING' | 'RESULTS', endTime?: number, activePlayers?: string[]) => void
  removeActiveGamePlayer: (playerId: string) => void
  addNotification: (message: string) => void
  removeNotification: (id: string) => void
  clearNotifications: () => void
  notifications: Array<{ id: string; message: string; timestamp: number }>
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
  currentGameId: undefined,
  view: 'menu',
  drawingsVersion: 0,
  voted: false,
  timers: {},
  voteTally: {},
  activeGameStatus: undefined,
  activeGameEndTime: undefined,
  activeGamePlayers: undefined,
  notifications: [],
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
  setCurrentGameId: (gameId) => set({ currentGameId: gameId }),
  setView: (v) => set({ view: v }),
  bumpDrawingsVersion: () => set((s) => ({ drawingsVersion: s.drawingsVersion + 1 })),
  setVoted: (v) => set({ voted: v }),
  setTimers: (t) => set({ timers: t }),
  setVoteTally: (tally) => set({ voteTally: tally }),
  setActiveGameStatus: (status, endTime, activePlayers) => set((state) => {
    console.log('🎮 setActiveGameStatus called:', { 
      oldStatus: state.activeGameStatus, 
      newStatus: status, 
      oldActivePlayers: state.activeGamePlayers, 
      newActivePlayers: activePlayers 
    })
    return { activeGameStatus: status, activeGameEndTime: endTime, activeGamePlayers: activePlayers }
  }),
  removeActiveGamePlayer: (playerId) => set((state) => {
    const newActivePlayers = state.activeGamePlayers?.filter(id => id !== playerId) || []
    
    // Don't clear activeGameStatus just because activeGamePlayers is empty
    // The game status should only be cleared by explicit events (GAME_ENDED, ROOM_RESET)
    // or timer expiration in the Lobby component
    return { activeGamePlayers: newActivePlayers }
  }),
  addNotification: (message) => set((state) => {
    // Check if a similar notification already exists (within last 5 seconds)
    const now = Date.now()
    const recentSimilar = state.notifications.find(n => 
      n.message === message && (now - n.timestamp) < 5000
    )
    
    if (recentSimilar) {
      return state // Don't add duplicate
    }
    
    const newNotification = {
      id: `${now}-${Math.random()}`,
      message,
      timestamp: now
    }
    
    return { 
      notifications: [...state.notifications, newNotification] 
    }
  }),
  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter(n => n.id !== id)
  })),
  clearNotifications: () => set({ notifications: [] }),
  reset: () => set({ roomCode: null, roomId: null, playerId: null, sessionToken: null, players: [], drawSeconds: 120, voteSeconds: 60, maxPlayers: 8, countdownStartAt: undefined, countdownSeconds: undefined, nextGame: undefined, promptCommon: undefined, currentGameId: undefined, view: 'menu', drawingsVersion: 0, voted: false, timers: {}, voteTally: {}, activeGameStatus: undefined, activeGameEndTime: undefined, activeGamePlayers: undefined, notifications: [] })
}))
