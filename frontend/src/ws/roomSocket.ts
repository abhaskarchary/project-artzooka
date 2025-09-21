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
        if (payload.type === 'PLAYER_JOINED') {
					fetch(`${url}/api/rooms/${roomCode}`)
						.then((r) => r.json())
            .then((state) => { useRoomStore.getState().setPlayers(state.players); useRoomStore.getState().setSettings({ drawSeconds: state.drawSeconds, voteSeconds: state.voteSeconds, maxPlayers: state.maxPlayers }) })
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
            }, delayMs)
          } else {
            useRoomStore.getState().setPromptCommon(payload.promptCommon)
            useRoomStore.getState().setVoted(false)
            useRoomStore.getState().setTimers({
              serverTime: payload.serverTime,
              drawSeconds: payload.drawSeconds,
              voteSeconds: payload.voteSeconds,
              voteStartTime: payload.voteStartTime
            })
          }
        }
				if (payload.type === 'DISCUSS_STARTED') {
					useRoomStore.getState().setView('discuss')
					useRoomStore.getState().setTimers({
						serverTime: payload.serverTime,
						voteSeconds: payload.voteSeconds,
						// When DISCUSS_STARTED is sent, voting begins immediately
						voteStartTime: payload.serverTime,
					})
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
					useRoomStore.getState().setView('results')
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
