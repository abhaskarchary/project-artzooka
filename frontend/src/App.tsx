import { useEffect, useState } from 'react'
import './App.css'
import Menu from './pages/Menu'
import Lobby from './pages/Lobby'
import { useRoomStore } from './store/useRoomStore'
import Drawing from './pages/Drawing'
import Discussion from './pages/Discussion'
import Results from './pages/Results'
import { http } from './api/http'
import { connectRoomTopic } from './ws/roomSocket'
import { SessionManager } from './utils/sessionManager'

function App() {
	const { view, setView, promptCommon, setPromptCommon, setRoom, setSelf, reset, setActiveGameStatus } = useRoomStore()
	const [resuming, setResuming] = useState(true)

	// Room persistence logic on app load
	useEffect(() => {
		const attemptRoomResume = async () => {
			try {
				// Check for valid session data
				const session = SessionManager.getValidSession()
				if (!session) {
					console.log('No valid session found, staying on menu')
					setResuming(false)
					return
				}

				console.log('Found valid session, attempting to resume room...', { roomCode: session.roomCode })

				// Verify the room still exists and player is still in it
				const roomState = await http.get(`/api/rooms/${session.roomCode}`)
				if (!roomState.data) {
					throw new Error('Room not found')
				}

				// Check if player is still in the room
				const playerExists = roomState.data.players.find((p: any) => p.id === session.playerId)
				if (!playerExists) {
					throw new Error('Player no longer in room')
				}

				// Restore room and player data
				setRoom(session.roomCode, session.roomId)
				setSelf(session.playerId, session.sessionToken)

				// Connect to WebSocket
				connectRoomTopic(session.roomCode)

				// Check if there's an active game
				const gameStatus = roomState.data.status
				console.log('Room status:', gameStatus)

				if (gameStatus === 'DRAWING' || gameStatus === 'VOTING' || gameStatus === 'RESULTS') {
					// There's an active game - kick player out of game but keep in room
					console.log('Active game detected, player kicked from game but staying in room')
					
					// Calculate estimated end time based on game status and timers
					let estimatedEndTime: number | undefined
					if (gameStatus === 'DRAWING') {
						estimatedEndTime = Date.now() + (roomState.data.drawSeconds * 1000) + (roomState.data.voteSeconds * 1000)
					} else if (gameStatus === 'VOTING') {
						estimatedEndTime = Date.now() + (roomState.data.voteSeconds * 1000)
					} else if (gameStatus === 'RESULTS') {
						estimatedEndTime = Date.now() + (30 * 1000) // Assume 30 seconds for results
					}
					
					// Set active game status with actual active game participants from backend
					const activePlayerIds = roomState.data.activeGameParticipants || []
					setActiveGameStatus(gameStatus as 'DRAWING' | 'VOTING' | 'RESULTS', estimatedEndTime, activePlayerIds)
					
					// Notify backend that player left the active game (but stays in room)
					console.log('🔄 App.tsx - Calling /leave-game API for player who refreshed during active game')
					try {
						const response = await http.post(`/api/rooms/${session.roomCode}/leave-game`, null, { 
							params: { token: session.sessionToken } 
						})
						console.log('🔄 App.tsx - /leave-game API call successful:', response.status)
					} catch (e) {
						console.warn('🔄 App.tsx - Failed to notify backend about leaving game:', e)
					}

					// Go to lobby and show active game status
					setView('lobby')
				} else {
					// No active game, resume to lobby normally
					console.log('No active game, resuming to lobby')
					setActiveGameStatus(undefined, undefined, undefined)
					setView('lobby')
				}

			} catch (error) {
				console.error('Failed to resume room session:', error)
				// Clear invalid session data
				SessionManager.clear()
				reset()
				setView('menu')
			} finally {
				setResuming(false)
			}
		}

		attemptRoomResume()
	}, [setRoom, setSelf, setView, reset])

	// Auto-navigate to draw when prompt is received
	useEffect(() => {
		if (promptCommon && view !== 'draw') {
			console.log('🔄 App.tsx - promptCommon auto-redirect:', { promptCommon, currentView: view, redirectingTo: 'draw' })
			setView('draw')
		}
	}, [promptCommon, setView, view])

	// Show loading screen while resuming
	if (resuming) {
		return (
			<div style={{ 
				display: 'flex', 
				alignItems: 'center', 
				justifyContent: 'center', 
				minHeight: '100vh',
				background: '#0f1115',
				color: '#e6e6e6'
			}}>
				<div style={{ textAlign: 'center' }}>
					<div style={{ 
						width: 40, 
						height: 40, 
						border: '3px solid #333', 
						borderTop: '3px solid #60a5fa',
						borderRadius: '50%',
						animation: 'spin 1s linear infinite',
						margin: '0 auto 16px'
					}} />
					<div>Checking room status...</div>
				</div>
			</div>
		)
	}

	return (
		<>
			{view === 'menu' && <Menu onEnterLobby={() => setView('lobby')} />}
			{view === 'lobby' && <Lobby />}
			{view === 'draw' && <Drawing onSubmit={() => {
				console.log('🔄 App.tsx - Drawing onSubmit called - clearing promptCommon and switching to discuss')
				setPromptCommon(undefined)
				setView('discuss')
			}} />}
			{view === 'discuss' && <Discussion onFinishVoting={() => setView('results')} />}
			{view === 'results' && <Results onExitToMenu={() => setView('menu')} onBackToRoom={async () => {
				// Clear active game status when returning to lobby from results
				const store = useRoomStore.getState()
				store.setActiveGameStatus(undefined, undefined, undefined)
				
				// If this is the host, also reset the room on the backend to notify all players
				const isHost = store.players.find(p => p.id === store.playerId)?.isAdmin
				if (isHost && store.roomCode && store.sessionToken) {
					try {
						await fetch(`http://localhost:8080/api/rooms/${store.roomCode}/reset?token=${store.sessionToken}`, {
							method: 'POST'
						})
						console.log('🏁 Host returned to lobby, sent room reset to backend')
					} catch (error) {
						console.error('Failed to reset room:', error)
					}
				}
				
				setView('lobby')
			}} />}
		</>
	)
}

export default App
