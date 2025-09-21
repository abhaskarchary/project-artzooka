import { useEffect, useState } from 'react'
import { useRoomStore } from '../store/useRoomStore'
import { http } from '../api/http'

export default function Results({ onExitToMenu, onBackToRoom }: { onExitToMenu: () => void, onBackToRoom: () => void }) {
  const { roomCode, players } = useRoomStore()
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    if (!roomCode) return
    ;(async () => {
      const res = await http.get(`/api/rooms/${roomCode}/votes/result`)
      setData(res.data)
    })()
  }, [roomCode])

  if (!data) return <div style={{ maxWidth: 640, margin: '2rem auto' }}>Loading...</div>

  const name = (id?: string) => players.find(p => p.id === id)?.name || id

  return (
    <div style={{ maxWidth: 640, margin: '2rem auto' }}>
      <h3>Results</h3>
      <p>Winner: <strong>{data.winner}</strong></p>
      <p>Imposter: <strong>{name(data.imposterId)}</strong></p>
      <p>Voted out: <strong>{name(data.votedOutId)}</strong></p>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={onBackToRoom}>Back to Room</button>
        <button onClick={onExitToMenu}>Exit to Menu</button>
      </div>
    </div>
  )
}
