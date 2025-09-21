import { useEffect, useMemo, useRef, useState } from 'react'
import { useRoomStore } from '../store/useRoomStore'
import { http } from '../api/http'
import { connectRoomTopic } from '../ws/roomSocket'
import { Avatar } from '../components/Avatar'
import { fireConfetti, playChime } from '../utils/confetti'

export default function Lobby() {
  const { roomCode, players, setPlayers, sessionToken, playerId, setView, drawSeconds, voteSeconds, setSettings } = useRoomStore()
  const [copyMsg, setCopyMsg] = useState<string>('')

  const canStart = useMemo(() => players.length >= 3, [players])
  const isAdmin = useMemo(() => players.find(p => p.id === playerId)?.isAdmin ?? false, [players, playerId])

  useEffect(() => {
    if (!roomCode) return
    connectRoomTopic(roomCode)
    ;(async () => {
      const state = await http.get(`/api/rooms/${roomCode}`)
      setPlayers(state.data.players)
      setSettings({ drawSeconds: state.data.drawSeconds, voteSeconds: state.data.voteSeconds, maxPlayers: state.data.maxPlayers })
    })()
  }, [roomCode, setPlayers])
  // Celebrate when room becomes ready (>=3)
  useEffect(() => {
    if (players.length >= 3) {
      fireConfetti()
      playChime()
    }
  }, [players.length])

  const { setCountdown } = useRoomStore()
  const start = async () => {
    if (!roomCode || !isAdmin) return
    // optimistic local countdown; server event will correct timings
    try { setCountdown(Date.now() + 1000, 3) } catch {}
    await http.post(`/api/rooms/${roomCode}/start`)
  }
  const leave = async () => {
    if (!roomCode || !sessionToken) return
    await http.post(`/api/rooms/${roomCode}/leave`, null, { params: { token: sessionToken } })
    setView('menu')
  }

  const kick = async (kickPlayerId: string) => {
    if (!roomCode || !sessionToken) return
    await http.delete(`/api/rooms/${roomCode}/players/${kickPlayerId}`, { params: { token: sessionToken } })
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

  const origin = (window as any).location?.origin || ''
  const inviteURL = roomCode ? `${origin}?room=${roomCode}` : ''
  const minPlayers = 3
  const progressPct = Math.min(1, players.length / minPlayers) * 100

  // rotating fun messages / warmups for waiting time
  const messages = [
    'Tip: Use a bold color for outlines, lighter color to fill.',
    'Warm‑up: Draw a tiny rocket in 3 lines.',
    'Poll: Pineapple on pizza? 🍍🍕 Yes/No',
    'Trivia: How many colors in a rainbow? 🌈',
    'Warm‑up: Draw a fish wearing a hat.',
    'Tip: The bucket tool can fill shapes; try rounded rectangles.'
  ]
  const [msgIdx, setMsgIdx] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setMsgIdx((i) => (i + 1) % messages.length), 4500)
    return () => clearInterval(id)
  }, [])

  // countdown overlay synced for all clients
  const { countdownStartAt, countdownSeconds } = useRoomStore()
  const [countdownLeft, setCountdownLeft] = useState<number | null>(null)
  useEffect(() => {
    if (!countdownStartAt || !countdownSeconds) { setCountdownLeft(null); return }
    const end = countdownStartAt + countdownSeconds * 1000
    const tick = () => {
      const now = Date.now()
      const rem = Math.max(0, Math.ceil((end - now) / 1000))
      setCountdownLeft(rem)
    }
    tick()
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [countdownStartAt, countdownSeconds])

  // slider controls with gentle debounce
  const [drawLocal, setDrawLocal] = useState(drawSeconds)
  const [voteLocal, setVoteLocal] = useState(voteSeconds)
  useEffect(() => setDrawLocal(drawSeconds), [drawSeconds])
  useEffect(() => setVoteLocal(voteSeconds), [voteSeconds])
  const drawTimerRef = useRef<number | null>(null)
  const voteTimerRef = useRef<number | null>(null)
  const commitDraw = (val: number) => {
    setDrawLocal(val)
    if (!roomCode || !sessionToken) return
    if (drawTimerRef.current) window.clearTimeout(drawTimerRef.current)
    drawTimerRef.current = window.setTimeout(async () => {
      await http.post(`/api/rooms/${roomCode}/settings`, { drawSeconds: val }, { params: { token: sessionToken } })
    }, 250)
  }
  const commitVote = (val: number) => {
    setVoteLocal(val)
    if (!roomCode || !sessionToken) return
    if (voteTimerRef.current) window.clearTimeout(voteTimerRef.current)
    voteTimerRef.current = window.setTimeout(async () => {
      await http.post(`/api/rooms/${roomCode}/settings`, { voteSeconds: val }, { params: { token: sessionToken } })
    }, 250)
  }

  // Simple circular ready ring with avatars and n/8 label
  function ReadyRing() {
    const size = 130
    const radius = 52
    const cx = size / 2
    const cy = size / 2
    const max = 8
    const shown = Math.min(players.length, max)
    return (
      <div style={{ position:'relative', width:size, height:size }}>
        {/* ring background */}
        <div style={{ position:'absolute', inset:0, borderRadius:999, border:'2px solid #2f2f35', boxShadow:'inset 0 2px 8px rgba(0,0,0,0.4)' }} />
        {players.slice(0, max).map((p, idx) => {
          const angle = (Math.PI * 2 * idx) / Math.max(1, shown)
          const x = cx + radius * Math.cos(angle) - 12
          const y = cy + radius * Math.sin(angle) - 12
          return (
            <div key={p.id} style={{ position:'absolute', left:x, top:y }}>
              <Avatar avatar={p.avatar} size={24} />
            </div>
          )
        })}
        <div style={{ position:'absolute', left:0, top:0, width:size, height:size, display:'flex', alignItems:'center', justifyContent:'center', color:'#c9d1d9', fontWeight:700 }}>{players.length}/8</div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 900, margin: '3rem auto', padding: '0 12px' }}>
      <h2 style={{ marginBottom: 8 }}>Room <span className="title-glow">{roomCode}</span></h2>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap:'wrap', justifyContent:'space-between' }}>
        <div style={{ display:'inline-flex', gap:12, alignItems:'center' }}>
          <button onClick={copyRoomCode}>Copy code</button>
          <button onClick={copyInvite}>Copy invite link</button>
          <span style={{ color: '#9ca3af' }}>{copyMsg}</span>
        </div>
        {inviteURL && (
          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=96x96&data=${encodeURIComponent(inviteURL)}`} alt="QR" style={{ border:'1px solid #333', borderRadius: 8 }} />
        )}
      </div>

      {/* Ready ring + friendly microcopy */}
      <div style={{ display:'flex', gap:16, alignItems:'center', marginBottom:12, flexWrap:'wrap' }}>
        <ReadyRing />
        <div style={{ color:'#9ca3af' }}>Waiting for friends… grab a coffee or doodle something.</div>
      </div>

      {/* Animated hint */}
      <div style={{ color:'#9ca3af', fontSize:12, marginBottom:8 }}>
        {messages[msgIdx]}
      </div>

      {/* Progress to start */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ color:'#9ca3af', marginBottom:4 }}>Players ready: {Math.min(players.length, minPlayers)} / {minPlayers}{players.length>minPlayers?` (+${players.length-minPlayers} extra)`:''}</div>
        <div style={{ height:10, background:'#1f1f22', border:'1px solid #333', borderRadius:999, overflow:'hidden', boxShadow:'inset 0 2px 6px rgba(0,0,0,0.4)' }}>
          <div style={{ width:`${progressPct}%`, height:'100%', background:'linear-gradient(90deg, #60a5fa, #a78bfa)', transition:'width 400ms ease' }} />
        </div>
      </div>

      <div style={{ border:'1px solid #3a3a40', background:'#151517', borderRadius:12, padding:12 }}>
        <strong>Players ({players.length}):</strong>
        <ul style={{ listStyle:'none', padding:0, margin:'8px 0', display:'grid', gap:8 }}>
          {players.map((p) => (
            <li key={p.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 8px', borderBottom:'1px solid #2f2f35' }}>
              <span style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
                <Avatar avatar={p.avatar} />
                <span>{p.name}{p.isAdmin ? ' (host)' : ''}</span>
              </span>
              <span style={{ display:'inline-flex', gap:8, alignItems:'center' }}>
                <span style={{ color:'#34d399', fontSize:12, padding:'2px 8px', border:'1px solid #1f3d2b', background:'#132a1e', borderRadius:999 }}>ready</span>
                {isAdmin && !p.isAdmin && (
                  <button onClick={() => kick(p.id)} style={{ padding:'4px 8px', border:'1px solid #3a2020', background:'#2a1515', color:'#fca5a5', borderRadius:6 }}>Kick</button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Host settings */}
      {isAdmin && (
        <div style={{ marginTop:12, border:'1px solid #3a3a40', background:'#151517', borderRadius:12, padding:12, display:'grid', gap:16 }}>
          <strong>Settings (host only)</strong>
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span>Draw timer</span>
              <span style={{ color:'#9ca3af' }}>{drawLocal}s</span>
            </div>
            <input type="range" min={15} max={300} step={15} value={drawLocal} onChange={(e)=>commitDraw(parseInt(e.target.value))} style={{ width:'100%' }} />
          </div>
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span>Vote timer</span>
              <span style={{ color:'#9ca3af' }}>{voteLocal}s</span>
            </div>
            <input type="range" min={15} max={180} step={15} value={voteLocal} onChange={(e)=>commitVote(parseInt(e.target.value))} style={{ width:'100%' }} />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12, flexWrap:'wrap', justifyContent:'space-between' }}>
        {isAdmin ? (
          <button onClick={start} disabled={!canStart} className={`btn-primary btn-pulse-when-ready ${canStart ? 'ready' : ''}`}>Start Game</button>
        ) : (
          <span style={{ color: '#9ca3af' }}>Waiting for host to start…</span>
        )}
        <div style={{ display:'inline-flex', gap:12, alignItems:'center' }}>
          {!canStart && (
            <span style={{ color: '#9ca3af' }}>Need at least 3 players</span>
          )}
          <button onClick={leave}>Back to Menu</button>
        </div>
      </div>
    {countdownLeft !== null && (
      <div className="modal-overlay" style={{ background:'rgba(0,0,0,0.7)' }}>
        <div className="modal-card" style={{ textAlign:'center', width:360 }}>
          <div className="countdown-num" style={{ fontSize:64, fontWeight:800, margin:'16px 0' }}>{countdownLeft}</div>
          <div style={{ color:'#9ca3af' }}>Get ready! The round is starting…</div>
        </div>
      </div>
    )}
    </div>
  )
}

