import { useEffect, useMemo, useState } from 'react'
import { useRoomStore } from '../store/useRoomStore'
import { http } from '../api/http'
import { Avatar } from '../components/Avatar'
import { fireConfetti, playChime } from '../utils/confetti'

interface Item { playerId: string; filePath: string }

export default function Discussion({ onFinishVoting }: { onFinishVoting: () => void }) {
  const { roomCode, players, sessionToken, drawingsVersion, setVoted, voted, playerId, timers, voteTally } = useRoomStore()
  const [items, setItems] = useState<Item[]>([])
  const isAdmin = useMemo(() => players.find(p => p.id === playerId)?.isAdmin ?? false, [players, playerId])
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)

  useEffect(() => {
    if (!roomCode) return
    ;(async () => {
      const res = await http.get(`/api/rooms/${roomCode}/drawings`)
      setItems(res.data)
    })()
  }, [roomCode, drawingsVersion])

  // Start vote timer
  useEffect(() => {
    if (!timers.serverTime || !timers.voteSeconds) return
    const drawMs = (timers.drawSeconds ?? 0) * 1000
    const voteStart = (timers.voteStartTime ?? (timers.serverTime + drawMs))
    const endAt = voteStart + timers.voteSeconds * 1000
    const tick = () => {
      const now = Date.now()
      if (now < voteStart) {
        // Voting hasn't begun yet; show full 60s once it begins
        setSecondsLeft(timers.voteSeconds || 60)
        return
      }
      const remainMs = Math.max(0, endAt - now)
      setSecondsLeft(Math.ceil(remainMs / 1000))
      if (remainMs <= 0 && isAdmin) {
        void http.post(`/api/rooms/${roomCode}/votes/finish`)
      }
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [timers.serverTime, timers.voteSeconds, timers.voteStartTime, timers.drawSeconds, isAdmin, roomCode])

  const vote = async (targetId: string) => {
    if (!roomCode || !sessionToken || voted) return
    await http.post(`/api/rooms/${roomCode}/votes`, null, { params: { token: sessionToken, targetId } })
    setVoted(true)
    setSelectedId(targetId)
    fireConfetti(800, 20)
    playChime()
  }

  const finish = async () => {
    if (!roomCode || !isAdmin) return
    await http.post(`/api/rooms/${roomCode}/votes/finish`)
    // rely on WS for navigation
  }

  const countFor = (pid: string) => voteTally[pid] || 0

  // ephemeral reaction bubbles per card
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { targetId: string; emoji: string }
      const el = document.getElementById(`card-${detail.targetId}`)
      if (!el) return
      const bubble = document.createElement('div')
      bubble.textContent = detail.emoji
      bubble.style.position = 'absolute'
      bubble.style.right = Math.random()*40 + 'px'
      bubble.style.bottom = '8px'
      bubble.style.transition = 'transform 900ms ease, opacity 900ms ease'
      el.appendChild(bubble)
      requestAnimationFrame(() => {
        bubble.style.transform = 'translateY(-60px)'
        bubble.style.opacity = '0'
      })
      setTimeout(() => bubble.remove(), 1000)
    }
    window.addEventListener('artzooka:reaction', handler as EventListener)
    return () => window.removeEventListener('artzooka:reaction', handler as EventListener)
  }, [])

  const now = Date.now()
  const voteStart = (timers.voteStartTime ?? now)
  const endAt = voteStart + (timers.voteSeconds ?? 60) * 1000
  const pct = secondsLeft !== null && endAt > voteStart ? Math.max(0, Math.min(1, (endAt - now) / (endAt - voteStart))) : 0

  return (
    <div style={{ maxWidth: 1200, margin: '2rem auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <h3 style={{ margin:0, letterSpacing:0.2 }}>Discussion & Voting</h3>
        {secondsLeft !== null && (
          <div style={{ position:'relative', width:42, height:42 }}>
            <div style={{ position:'absolute', inset:0, borderRadius:999, background:`conic-gradient(#60a5fa ${pct*360}deg, #2a2a2a 0deg)` }} />
            <div style={{ position:'absolute', inset:4, borderRadius:999, background:'#0f0f10', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>{secondsLeft}s</div>
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
        {items.map((it) => {
          const p = players.find(p => p.id === it.playerId)
          return (
            <div key={it.playerId} id={`card-${it.playerId}`} onMouseEnter={()=>setHoverId(it.playerId)} onMouseLeave={()=>setHoverId(null)} style={{ border: '1px solid #2f2f35', padding: 12, borderRadius: 14, background:'linear-gradient(180deg,#121214,#0f0f10)', position:'relative', transition:'transform 180ms ease, box-shadow 180ms ease', transform: hoverId===it.playerId?'translateY(-2px) scale(1.01)':'none', boxShadow: hoverId===it.playerId?'0 12px 24px rgba(0,0,0,0.35)':'0 8px 20px rgba(0,0,0,0.25)' }}>
              <div style={{ position:'relative' }}>
                <img src={it.filePath} style={{ width: '100%', background: '#1b1b1f', border:'1px solid #2a2a2f', borderRadius:12, boxShadow:'inset 0 1px 0 rgba(255,255,255,0.03)' }} />
                {selectedId === it.playerId && (
                  <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.35)', borderRadius:12 }}>
                    <div style={{ padding:'6px 10px', background:'#132a1e', color:'#a7f3d0', border:'1px solid #1f3d2b', borderRadius:999 }}>You voted ✓</div>
                  </div>
                )}
                <div style={{ position:'absolute', right:10, bottom:10, padding:'2px 8px', borderRadius:999, background:'#1f1f22', color:'#c9d1d9', border:'1px solid #333', boxShadow:'0 2px 6px rgba(0,0,0,0.3)' }}>{countFor(it.playerId)}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems:'center', marginTop: 12 }}>
                <span style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
                  <Avatar avatar={p?.avatar} />
                  <strong>{p?.name ?? it.playerId}</strong>
                </span>
                <button className="btn-primary" onClick={() => vote(it.playerId)} disabled={voted}>
                  {voted ? 'Voted' : 'Vote'}
                </button>
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
