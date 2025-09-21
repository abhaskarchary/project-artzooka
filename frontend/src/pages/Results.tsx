import { useEffect, useMemo, useState } from 'react'
import { useRoomStore } from '../store/useRoomStore'
import { http } from '../api/http'
import { Avatar } from '../components/Avatar'
import { fireConfetti, playChime } from '../utils/confetti'

export default function Results({ onExitToMenu, onBackToRoom }: { onExitToMenu: () => void, onBackToRoom: () => void }) {
  const { roomCode, players } = useRoomStore()
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string>('')

  // fire celebratory effects once results are available
  useEffect(() => {
    if (!data) return
    fireConfetti(1400, 40)
    playChime()
  }, [data?.winner])

  useEffect(() => {
    if (!roomCode) return
    ;(async () => {
      try {
        const res = await http.get(`/api/rooms/${roomCode}/votes/result`)
        setData(res.data)
        // if players list is empty (page refresh), fetch room state for names
        if (!players || players.length === 0) {
          try {
            const state = await http.get(`/api/rooms/${roomCode}`)
            // We don't have a setter for names here, but names function already falls back to id
          } catch {}
        }
      } catch (e: any) {
        setError(e?.response?.data?.error || 'Failed to load results')
        console.error('Results error', e)
      }
    })()
  }, [roomCode])

  const name = (id?: string) => players.find(p => p.id === id)?.name || id
  const imposterPlayer = useMemo(() => players.find(p => p.id === data?.imposterId), [players, data])
  const votedOutPlayer = useMemo(() => players.find(p => p.id === data?.votedOutId), [players, data])
  // avoid extra complexity for now

  if (error) return <div style={{ maxWidth: 720, margin: '2rem auto' }}>Error: {error}</div>
  if (!data) return <div style={{ maxWidth: 720, margin: '2rem auto' }}>Loading...</div>

  const winnerIsArtists = data.winner === 'ARTISTS'


  const copyInvite = async () => {
    if (!roomCode) return
    const origin = (window as any).location?.origin || ''
    const invite = `${origin}?room=${roomCode}`
    await navigator.clipboard.writeText(invite)
  }

  return (
    <div style={{ maxWidth: 820, margin: '2.2rem auto' }}>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>Results</h2>
      </div>

      <div style={{ border: '1px solid #303038', background:'linear-gradient(180deg,#121214,#0f0f10)', borderRadius: 14, padding: 22, boxShadow:'0 10px 24px rgba(0,0,0,0.35)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontSize: 18, color:'#c9d1d9' }}>Winner</div>
          <div style={{ padding: '6px 12px', borderRadius: 999, background: winnerIsArtists ? '#163a2b' : '#3a1c1c', color: winnerIsArtists ? '#b7f4de' : '#ffd1d1', fontWeight: 800, letterSpacing: 1 }}>
            {data.winner}
          </div>
        </div>

        <div style={{ marginTop: 16, display:'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ border:'1px solid #2a2a30', borderRadius: 12, padding: 16, background:'#0f0f10' }}>
            <div style={{ color:'#9ca3af', marginBottom: 6, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span>Imposter</span>
              <span style={{ padding:'4px 10px', borderRadius:999, background:'#3a1c1c', color:'#ffd1d1', fontWeight:700 }}>IMPOSTER</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap: 12 }}>
              <Avatar avatar={imposterPlayer?.avatar} size={40} />
              <strong style={{ fontSize: 18 }}>{name(data.imposterId)}</strong>
            </div>
          </div>
          <div style={{ border:'1px solid #2a2a30', borderRadius: 12, padding: 16, background:'#0f0f10' }}>
            <div style={{ color:'#9ca3af', marginBottom: 6 }}>Voted out</div>
            <div style={{ display:'flex', alignItems:'center', gap: 12 }}>
              {votedOutPlayer ? <Avatar avatar={votedOutPlayer.avatar} size={40} /> : null}
              <strong style={{ fontSize: 18 }}>{name(data.votedOutId) || '—'}</strong>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ color:'#9ca3af', fontSize:12 }}>Share the room to play again.</div>
          <div style={{ display:'inline-flex', gap:8 }}>
            <button onClick={onBackToRoom}>Back to Room</button>
            <button onClick={onExitToMenu}>Exit to Menu</button>
            <button className="btn-primary" onClick={copyInvite}>Copy Room Link</button>
          </div>
        </div>
      </div>
    </div>
  )
}
