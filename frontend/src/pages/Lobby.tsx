import { useEffect, useMemo, useState } from 'react'
import { useRoomStore } from '../store/useRoomStore'
import { http } from '../api/http'
import { connectRoomTopic } from '../ws/roomSocket'
import { Avatar } from '../components/Avatar'

export default function Lobby() {
  const { roomCode, players, setPlayers, sessionToken, playerId } = useRoomStore()
  const [copyMsg, setCopyMsg] = useState<string>('')

  const canStart = useMemo(() => players.length >= 3, [players])
  const isAdmin = useMemo(() => players.find(p => p.id === playerId)?.isAdmin ?? false, [players, playerId])

  useEffect(() => {
    if (!roomCode) return
    connectRoomTopic(roomCode)
    ;(async () => {
      const state = await http.get(`/api/rooms/${roomCode}`)
      setPlayers(state.data.players)
    })()
  }, [roomCode, setPlayers])

  const start = async () => {
    if (!roomCode || !isAdmin) return
    await http.post(`/api/rooms/${roomCode}/start`)
  }

  const copyRoomCode = async () => {
    if (!roomCode) return
    await navigator.clipboard.writeText(roomCode)
    setCopyMsg('Room code copied!')
    setTimeout(() => setCopyMsg(''), 1500)
  }

  const copyInvite = async () => {
    if (!roomCode) return
    const origin = (window as any).location?.origin || ''
    const invite = `${origin}?room=${roomCode}`
    await navigator.clipboard.writeText(invite)
    setCopyMsg('Invite link copied!')
    setTimeout(() => setCopyMsg(''), 1500)
  }

  return (
    <div style={{ maxWidth: 720, margin: '3rem auto', padding: '0 8px' }}>
      <h2 style={{ marginBottom: 8 }}>Room {roomCode}</h2>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <button onClick={copyRoomCode}>Copy code</button>
        <button onClick={copyInvite}>Copy invite link</button>
        <span style={{ color: '#9ca3af' }}>{copyMsg}</span>
      </div>

      <div>
        <strong>Players ({players.length}):</strong>
        <ul>
          {players.map((p) => (
            <li key={p.id} style={{ display:'flex', alignItems:'center', gap:8 }}>
              <Avatar avatar={p.avatar} />
              <span>{p.name}{p.isAdmin ? ' (host)' : ''}</span>
            </li>
          ))}
        </ul>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
        {isAdmin ? (
          <button onClick={start} disabled={!canStart}>Start Game</button>
        ) : (
          <span style={{ color: '#9ca3af' }}>Waiting for host to start…</span>
        )}
        {!canStart && (
          <span style={{ color: '#9ca3af' }}>Need at least 3 players</span>
        )}
      </div>
    </div>
  )
}

