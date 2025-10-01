import SockJS from 'sockjs-client'
import { Client } from '@stomp/stompjs'
import type { IMessage } from '@stomp/stompjs'
import { useRoomStore } from '../store/useRoomStore'
import { log } from '../utils/logger'

let client: Client | null = null

export function connectRoomTopic(roomCode: string) {
	const url = (import.meta as any).env.VITE_API_BASE || 'http://localhost:8080'
	client = new Client({
		webSocketFactory: () => new SockJS(`${url}/ws`) as any,
    reconnectDelay: 2000,
    debug: (m) => log.info('WS', m)
	})
	client.onConnect = () => {
    log.info('WS connected to room', roomCode)
		client?.subscribe(`/topic/rooms/${roomCode}`, (msg: IMessage) => {
			try {
				const payload = JSON.parse(msg.body) as { type: string; [k: string]: any }
        log.info('WS message', payload.type, payload)
        console.log('🔧 WebSocket handler called for:', payload.type)
        if (payload.type === 'PLAYER_JOINED') {
          console.log('🔵 PLAYER_JOINED event:', {
            newPlayerName: payload.playerName,
            currentActiveGameStatus: useRoomStore.getState().activeGameStatus,
            currentActiveGamePlayers: useRoomStore.getState().activeGamePlayers
          })
					fetch(`${url}/api/rooms/${roomCode}`)
						.then((r) => r.json())
            .then((state) => { 
              console.log('🔵 PLAYER_JOINED - Room state fetched:', {
                players: state.players?.map((p: any) => p.name),
                activeGameParticipants: state.activeGameParticipants,
                roomStatus: state.status
              })
              
              const store = useRoomStore.getState()
              store.setPlayers(state.players)
              store.setSettings({ drawSeconds: state.drawSeconds, voteSeconds: state.voteSeconds, maxPlayers: state.maxPlayers })
              
              // If there's an active game, update activeGamePlayers with current participants
              if (state.status === 'DRAWING' || state.status === 'VOTING' || state.status === 'RESULTS') {
                if (state.activeGameParticipants && state.activeGameParticipants.length > 0) {
                  console.log('🔵 PLAYER_JOINED - Updating activeGamePlayers:', state.activeGameParticipants)
                  // Calculate estimated end time based on game status
                  let estimatedEndTime: number | undefined
                  if (state.status === 'DRAWING') {
                    estimatedEndTime = Date.now() + (state.drawSeconds * 1000) + (state.voteSeconds * 1000)
                  } else if (state.status === 'VOTING') {
                    estimatedEndTime = Date.now() + (state.voteSeconds * 1000)
                  } else if (state.status === 'RESULTS') {
                    estimatedEndTime = Date.now() + (30 * 1000) // 30 seconds for results
                  }
                  store.setActiveGameStatus(state.status as 'DRAWING' | 'VOTING' | 'RESULTS', estimatedEndTime, state.activeGameParticipants)
                }
              }
            })
          // soft join sound
          try {
            const ctx = new (window as any).AudioContext()
            const o = ctx.createOscillator(); const g = ctx.createGain();
            o.type='sine'; o.frequency.value=880; g.gain.value=0.001; o.connect(g); g.connect(ctx.destination); o.start();
            g.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.15); o.stop(ctx.currentTime + 0.16)
          } catch {}
				}
        if (payload.type === 'AVATAR_UPDATED') {
          fetch(`${url}/api/rooms/${roomCode}`)
            .then((r) => r.json())
            .then((state) => { useRoomStore.getState().setPlayers(state.players); useRoomStore.getState().setSettings({ drawSeconds: state.drawSeconds, voteSeconds: state.voteSeconds, maxPlayers: state.maxPlayers }) })
        }
        if (payload.type === 'PLAYER_LEFT') {
          const state = useRoomStore.getState()
          // if I was kicked, return to menu
          if (payload.playerId === state.playerId) {
            state.setView('menu')
          } else {
            fetch(`${url}/api/rooms/${roomCode}`)
              .then((r) => r.json())
              .then((s) => { useRoomStore.getState().setPlayers(s.players); useRoomStore.getState().setSettings({ drawSeconds: s.drawSeconds, voteSeconds: s.voteSeconds, maxPlayers: s.maxPlayers }) })
          }
          // leave sound
          try {
            const ctx = new (window as any).AudioContext()
            const o = ctx.createOscillator(); const g = ctx.createGain();
            o.type='sawtooth'; o.frequency.value=220; g.gain.value=0.001; o.connect(g); g.connect(ctx.destination); o.start();
            g.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.2); o.stop(ctx.currentTime + 0.21)
          } catch {}
        }
        if (payload.type === 'PLAYER_LEFT_GAME') {
          // Player left the active game but is still in the room
          // Remove them from active game players list
          const store = useRoomStore.getState()
          store.removeActiveGamePlayer(payload.playerId)
          store.addNotification(`${payload.playerName} left the game`)
        }
        if (payload.type === 'GAME_STARTED') {
          const now = Date.now()
          const delayMs = Math.max(0, payload.serverTime - now)
          if (delayMs > 200) {
            // show synced countdown and schedule the start
            const secs = Math.ceil(delayMs / 1000)
            useRoomStore.getState().setCountdown(now, secs)
            useRoomStore.getState().setNextGame(payload)
            setTimeout(() => {
              const s = useRoomStore.getState()
              s.clearCountdown()
              s.setPromptCommon(payload.promptCommon)
              s.setVoted(false)
              s.setTimers({
                serverTime: payload.serverTime,
                drawSeconds: payload.drawSeconds,
                voteSeconds: payload.voteSeconds,
                voteStartTime: payload.voteStartTime
              })
              // Set active game status when game starts
              const endTime = payload.voteStartTime + (payload.voteSeconds * 1000)
              const activePlayerIds = payload.activeGameParticipants || s.players.map(p => p.id)
              s.setActiveGameStatus('DRAWING', endTime, activePlayerIds)
            }, delayMs)
          } else {
            const s = useRoomStore.getState()
            s.setPromptCommon(payload.promptCommon)
            s.setVoted(false)
            s.setTimers({
              serverTime: payload.serverTime,
              drawSeconds: payload.drawSeconds,
              voteSeconds: payload.voteSeconds,
              voteStartTime: payload.voteStartTime
            })
            // Set active game status when game starts (immediate)
            const endTime = payload.voteStartTime + (payload.voteSeconds * 1000)
            const activePlayerIds = payload.activeGameParticipants || s.players.map(p => p.id)
            s.setActiveGameStatus('DRAWING', endTime, activePlayerIds)
          }
        }
				if (payload.type === 'DISCUSS_STARTED') {
					const s = useRoomStore.getState()
					console.log('🗳️ DISCUSS_STARTED received - all players moving to discussion')
					console.log('🗳️ Current view before transition:', s.view)
					
					// All players go to discussion when DISCUSS_STARTED is received
					// Backend only sends this when all active participants have submitted
					console.log('🗳️ ✅ Moving to discuss view')
					// Clear promptCommon to prevent App.tsx auto-redirect back to draw
					s.setPromptCommon(undefined)
					s.setView('discuss')
					console.log('🗳️ Successfully transitioned to discuss view')
					
					// Always update timers and game status for lobby display
					s.setTimers({
						serverTime: payload.serverTime,
						voteSeconds: payload.voteSeconds,
						// When DISCUSS_STARTED is sent, voting begins immediately
						voteStartTime: payload.serverTime,
					})
					// Update active game status to VOTING
					const endTime = payload.serverTime + (payload.voteSeconds * 1000)
					s.setActiveGameStatus('VOTING', endTime, s.activeGamePlayers)
				}
				if (payload.type === 'VOTE_UPDATE') {
					useRoomStore.getState().setVoteTally(payload.tally)
				}
        if (payload.type === 'REACTION') {
          // bubble a one-off browser event so UI can animate the reaction
          const ev = new CustomEvent('artzooka:reaction', { detail: payload })
          window.dispatchEvent(ev)
        }
				if (payload.type === 'DRAWING_UPLOADED') {
					useRoomStore.getState().bumpDrawingsVersion()
				}
				if (payload.type === 'SHOW_RESULTS') {
					const s = useRoomStore.getState()
					console.log('🏆 SHOW_RESULTS received - checking if player is in active game')
					console.log('🏆 Current playerId:', s.playerId)
					console.log('🏆 activeGamePlayers:', s.activeGamePlayers)
					
					// Only change view if the current player is actively participating in the game
					const isPlayerInActiveGame = s.activeGamePlayers && s.playerId && s.activeGamePlayers.includes(s.playerId)
					console.log('🏆 isPlayerInActiveGame:', isPlayerInActiveGame)
					
					if (isPlayerInActiveGame) {
						console.log('🏆 Player is in active game - switching to results view')
						// Clear promptCommon to prevent App.tsx auto-redirect back to draw
						s.setPromptCommon(undefined)
						s.setView('results')
					} else {
						console.log('🏆 Player not in active game - staying in current view')
					}
					
					// Always update active game status for lobby display
					const endTime = Date.now() + (30 * 1000) // 30 seconds for results
					s.setActiveGameStatus('RESULTS', endTime, s.activeGamePlayers)
				}
				if (payload.type === 'ROOM_RESET') {
					// Game ended, clear active game status
					console.log('🔄 ROOM_RESET received - clearing active game status')
					useRoomStore.getState().setActiveGameStatus(undefined, undefined, undefined)
				}
				if (payload.type === 'GAME_ENDED') {
					// Game ended automatically (all players left or timer expired)
					console.log('🔚 GAME_ENDED received - clearing active game status, reason:', payload.reason)
					useRoomStore.getState().setActiveGameStatus(undefined, undefined, undefined)
				}
        if (payload.type === 'GAME_COUNTDOWN') {
          useRoomStore.getState().setCountdown(payload.startAt, payload.seconds)
        }
        if (payload.type === 'SETTINGS_UPDATED') {
          useRoomStore.getState().setSettings({ drawSeconds: payload.drawSeconds, voteSeconds: payload.voteSeconds, maxPlayers: payload.maxPlayers })
        }
			} catch {}
		})
	}
	client.activate()
}

export function disconnectRoomTopic() {
	client?.deactivate()
	client = null
}
