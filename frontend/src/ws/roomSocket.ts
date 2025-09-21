import SockJS from 'sockjs-client'
import { Client } from '@stomp/stompjs'
import type { IMessage } from '@stomp/stompjs'
import { useRoomStore } from '../store/useRoomStore'

let client: Client | null = null

export function connectRoomTopic(roomCode: string) {
	const url = (import.meta as any).env.VITE_API_BASE || 'http://localhost:8080'
	client = new Client({
		webSocketFactory: () => new SockJS(`${url}/ws`) as any,
		reconnectDelay: 2000,
		debug: () => {}
	})
	client.onConnect = () => {
		client?.subscribe(`/topic/rooms/${roomCode}`, (msg: IMessage) => {
			try {
				const payload = JSON.parse(msg.body) as { type: string; [k: string]: any }
				if (payload.type === 'PLAYER_JOINED') {
					fetch(`${url}/api/rooms/${roomCode}`)
						.then((r) => r.json())
						.then((state) => useRoomStore.getState().setPlayers(state.players))
				}
				if (payload.type === 'GAME_STARTED') {
					useRoomStore.getState().setPromptCommon(payload.promptCommon)
					// reset voted for a new round
					useRoomStore.getState().setVoted(false)
				}
				if (payload.type === 'DRAWING_UPLOADED') {
					useRoomStore.getState().bumpDrawingsVersion()
				}
				if (payload.type === 'SHOW_RESULTS') {
					useRoomStore.getState().setView('results')
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
