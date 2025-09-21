import { useEffect } from 'react'
import './App.css'
import Menu from './pages/Menu'
import Lobby from './pages/Lobby'
import { useRoomStore } from './store/useRoomStore'
import Drawing from './pages/Drawing'
import Discussion from './pages/Discussion'
import Results from './pages/Results'

function App() {
	const { view, setView, promptCommon } = useRoomStore()
	useEffect(() => {
		if (promptCommon) setView('draw')
	}, [promptCommon, setView])
	return (
		<>
			{view === 'menu' && <Menu onEnterLobby={() => setView('lobby')} />}
			{view === 'lobby' && <Lobby />}
			{view === 'draw' && <Drawing onSubmit={() => setView('discuss')} />}
			{view === 'discuss' && <Discussion onFinishVoting={() => setView('results')} />}
			{view === 'results' && <Results onExitToMenu={() => setView('menu')} onBackToRoom={() => setView('lobby')} />}
		</>
	)
}

export default App
