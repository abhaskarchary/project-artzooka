import { useEffect, useMemo, useState } from 'react'
import { useRoomStore } from '../store/useRoomStore'
import { http } from '../api/http'
import { Avatar } from '../components/Avatar'

interface Item { playerId: string; filePath: string }

export default function Discussion({ onFinishVoting }: { onFinishVoting: () => void }) {
  const { roomCode, players, sessionToken, drawingsVersion, setVoted, voted, playerId } = useRoomStore()
  const [items, setItems] = useState<Item[]>([])
  const isAdmin = useMemo(() => players.find(p => p.id === playerId)?.isAdmin ?? false, [players, playerId])

  useEffect(() => {
    if (!roomCode) return
    ;(async () => {
      const res = await http.get(`/api/rooms/${roomCode}/drawings`)
      setItems(res.data)
    })()
  }, [roomCode, drawingsVersion])

  const vote = async (targetId: string) => {
    if (!roomCode || !sessionToken || voted) return
    await http.post(`/api/rooms/${roomCode}/votes`, null, { params: { token: sessionToken, targetId } })
    setVoted(true)
  }

  const finish = async () => {
    if (!roomCode || !isAdmin) return
    await http.post(`/api/rooms/${roomCode}/votes/finish`)
    // Do not navigate locally; rely on SHOW_RESULTS WS event for full sync
  }

  return (
    <div style={{ maxWidth: 1000, margin: '2rem auto' }}>
      <h3>Discussion & Voting</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {items.map((it) => {
          const p = players.find(p => p.id === it.playerId)
          return (
            <div key={it.playerId} style={{ border: '1px solid #444', padding: 8 }}>
              <img src={it.filePath} style={{ width: '100%', background: '#222' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems:'center', marginTop: 6 }}>
                <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                  <Avatar avatar={p?.avatar} />
                  {p?.name ?? it.playerId}
                </span>
                <button onClick={() => vote(it.playerId)} disabled={voted}>Vote</button>
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: 12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ color: voted ? '#34d399' : '#9ca3af' }}>
          {voted ? 'Your vote has been cast.' : 'You have not voted yet.'}
        </div>
        {isAdmin ? (
          <button onClick={finish}>Finish Voting</button>
        ) : (
          <span style={{ color:'#9ca3af' }}>Waiting for host to finish…</span>
        )}
      </div>
    </div>
  )
}
