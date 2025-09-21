import { useEffect, useMemo, useState, useRef } from 'react'
import { http } from '../api/http'
import { useRoomStore } from '../store/useRoomStore'

interface Avatar {
  color: string
  eyes: 'dot' | 'happy' | 'wink' | 'star' | 'sleepy' | 'angry' | 'hearts' | 'cross' | 'glasses' | 'squint' | 'surprised' | 'shades'
  mouth: 'line' | 'smile' | 'open' | 'frown' | 'o' | 'tongue' | 'mustache' | 'grin' | 'smirk' | 'robot' | 'zigzag' | 'beard'
}

const defaultAvatar: Avatar = { color: '#60a5fa', eyes: 'dot', mouth: 'line' }
const PRESET_COLORS = ['#60a5fa','#f87171','#fbbf24','#34d399','#a78bfa','#f472b6','#fef08a','#9ca3af']
const EYE_OPTIONS: Avatar['eyes'][] = ['dot','happy','wink','star','sleepy','angry','hearts','cross','glasses','squint','surprised','shades']
const MOUTH_OPTIONS: Avatar['mouth'][] = ['line','smile','open','frown','o','tongue','mustache','grin','smirk','robot','zigzag','beard']
const FUNNY_NAMES = [
  'Scribble Goblin',
  'Doodle Noodle',
  'Captain Crayon',
  'Sir Squiggles',
  'Princess Pixel',
  'Artzilla',
  'Brushy McBrushface',
  'Wobbly Lines',
  'Chaos Canvas',
  'The Sneaky Eraser'
]

export default function Menu({ onEnterLobby }: { onEnterLobby: () => void }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [showCode] = useState(true)
  const [avatar, setAvatar] = useState<Avatar>(defaultAvatar)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>('')
  const { setRoom, setSelf } = useRoomStore()
  const [showPlayground, setShowPlayground] = useState(false)

  // Load name from localStorage and check invite link
  useEffect(() => {
    const savedName = localStorage.getItem('artzooka_name')
    if (savedName) setName(savedName)

    const params = new URLSearchParams(window.location.search)
    const c = params.get('room')
    if (c) setCode(c.toUpperCase())
  }, [])

  // Persist name as user types
  useEffect(() => {
    if (name) localStorage.setItem('artzooka_name', name)
  }, [name])

  const maskedCode = useMemo(() => (showCode ? code : code.replace(/./g, '•')), [code, showCode])

  const saveAvatar = async (token: string) => {
    try {
      await http.post('/api/player/avatar', { avatar: JSON.stringify(avatar) }, { params: { token } })
    } catch {}
  }

  const createRoom = async () => {
    console.log('createRoom: start')
    if (busy) return
    setBusy(true)
    setError('')
    // show full screen loading overlay
    const overlay = document.createElement('div')
    overlay.id = 'menu-loading'
    overlay.style.position = 'fixed'
    overlay.style.inset = '0'
    overlay.style.background = 'rgba(0,0,0,0.55)'
    overlay.style.display = 'flex'
    overlay.style.alignItems = 'center'
    overlay.style.justifyContent = 'center'
    overlay.style.zIndex = '999'
    overlay.innerHTML = '<div style="border:1px solid #3a3a40;background:#151517;padding:14px 18px;border-radius:10px;display:flex;align-items:center;gap:10px"><span class="spinner" style="width:16px;height:16px;border:2px solid #444;border-top-color:#9ac5ff;border-radius:999;display:inline-block;animation:spin 1s linear infinite"></span>Creating room…</div>'
    document.body.appendChild(overlay)
    try {
      const resp = await http.post('/api/rooms')
      const { code: roomCode, id } = resp.data
      setRoom(roomCode, id)
      const join = await http.post(`/api/rooms/${roomCode}/join`, { name: name || 'Player' })
      setSelf(join.data.playerId, join.data.sessionToken)
      await saveAvatar(join.data.sessionToken)
      onEnterLobby()
    } catch (e: any) {
      console.error('createRoom error', e)
      setError(e?.response?.data?.error || 'Failed to create room')
    } finally {
      setBusy(false)
      document.getElementById('menu-loading')?.remove()
    }
  }

  const joinRoom = async () => {
    console.log('joinRoom: start')
    if (busy) return
    setError('')
    const roomCode = code.trim().toUpperCase()
    if (!roomCode) {
      setError('Enter room code')
      return
    }
    setBusy(true)
    const overlay = document.createElement('div')
    overlay.id = 'menu-loading'
    overlay.style.position = 'fixed'
    overlay.style.inset = '0'
    overlay.style.background = 'rgba(0,0,0,0.55)'
    overlay.style.display = 'flex'
    overlay.style.alignItems = 'center'
    overlay.style.justifyContent = 'center'
    overlay.style.zIndex = '999'
    overlay.innerHTML = '<div style="border:1px solid #3a3a40;background:#151517;padding:14px 18px;border-radius:10px;display:flex;align-items:center;gap:10px"><span class="spinner" style="width:16px;height:16px;border:2px solid #444;border-top-color:#9ac5ff;border-radius:999;display:inline-block;animation:spin 1s linear infinite"></span>Joining room…</div>'
    document.body.appendChild(overlay)
    // verify room exists and fetch id
    try {
      const state = await http.get(`/api/rooms/${roomCode}`)
      setRoom(roomCode, state.data.id)
      const join = await http.post(`/api/rooms/${roomCode}/join`, { name: name || 'Player' })
      setSelf(join.data.playerId, join.data.sessionToken)
      await saveAvatar(join.data.sessionToken)
      onEnterLobby()
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to join room')
    } finally {
      setBusy(false)
      document.getElementById('menu-loading')?.remove()
    }
  }

  const pasteCode = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) setCode(text.toUpperCase().replace(/\s/g,''))
    } catch {}
  }

  // Recent rooms chip list
  function RecentRooms({ onPick }: { onPick: (code: string) => void }) {
    const [recent, setRecent] = useState<string[]>([])
    useEffect(() => {
      try {
        const raw = localStorage.getItem('artzooka_recent_rooms')
        if (raw) setRecent(JSON.parse(raw))
      } catch {}
      // clipboard suggestion
      ;(async () => {
        try {
          const clip = await navigator.clipboard.readText()
          if (clip && /^[A-Z0-9]{4,8}$/.test(clip.trim().toUpperCase())) {
            // show as a suggested chip at index 0 if not already present
            setRecent((r) => {
              const c = clip.trim().toUpperCase()
              return r.includes(c) ? r : [c, ...r].slice(0, 5)
            })
          }
        } catch {}
      })()
    }, [])
    if (!recent.length) return null
    return (
      <div style={{ marginTop: 8, display:'flex', gap:8, flexWrap:'wrap' }}>
        {recent.map((c) => (
          <button key={c} className="chip" onClick={() => onPick(c)} title="Use this room code">{c}</button>
        ))}
      </div>
    )
  }

  // Rotating tip carousel
  function TipCarousel() {
    const tips = [
      'Warm‑up: Draw your avatar in 10 seconds.',
      'Tip: Use bucket + rectangle for fast comic panels.',
      'Warm‑up: One‑line doodle challenge!',
      'Tip: Share the invite link for phone play.',
      'Trivia: The first doodle was probably medieval margin art.',
      'Trivia: The word “doodle” spiked during WWII telephone doodles.',
      'Funny: Draw a cat that looks suspiciously like a potato.',
      'Funny: Can you draw a rocket in 3 lines and 1 circle?',
    ]
    const [i, setI] = useState(Math.floor(Math.random()*tips.length))
    useEffect(() => {
      const id = setInterval(() => setI((x) => (x + 1) % tips.length), 4000)
      return () => clearInterval(id)
    }, [])
    return <div style={{ marginTop: 10, color:'#9ca3af' }}>💡 {tips[i]}</div>
  }

  // Randomized funny trivia that rotates automatically
  function RandomTrivia() {
    const trivia = [
      'Fun: 90% of doodles during meetings are abstract masterpieces.',
      'Trivia: Leonardo da Vinci doodled flying machines in his notes.',
      'Funny: Try drawing a cat that looks like a potato — it counts.',
      'Trivia: NASA astronauts doodle in space. Zero‑G lines are wild.',
      'Fun: The average sticky note sketch lasts 12 seconds.',
      'Trivia: Ancient Greeks doodled hoplites on pottery margins.',
      'Funny: Draw a dragon, but it’s late for work and carries coffee.',
      'Trivia: Phone‑call doodles spike when the call says “hold please…”.',
      'Fun: Circles are the world’s most doodled shape.',
      'Funny: Penguin wearing sunglasses = instant masterpiece.',
    ]
    const [i, setI] = useState(Math.floor(Math.random() * trivia.length))
    useEffect(() => {
      const id = setInterval(() => setI((x) => (x + 1) % trivia.length), 5000)
      return () => clearInterval(id)
    }, [])
    return <div style={{ marginTop: 8, color:'#9ca3af' }}>🎲 {trivia[i]}</div>
  }

  const AvatarPreview = () => {
    // simple SVG avatar
    return (
      <svg width={96} height={96} viewBox="0 0 80 80" style={{ background: 'transparent', filter:'drop-shadow(0 4px 12px rgba(0,0,0,0.35))', cursor:'pointer' }} onClick={randomizeAvatar} title="Surprise me!">
        <defs>
          <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={avatar.color} />
            <stop offset="100%" stopColor="#9ca3af" />
          </linearGradient>
        </defs>
        <circle cx={40} cy={40} r={32} fill="url(#grad)" />
        {/* eyes */}
        {avatar.eyes === 'dot' && (<>
          <circle cx={28} cy={35} r={3} fill="#111" />
          <circle cx={52} cy={35} r={3} fill="#111" />
        </>)}
        {avatar.eyes === 'happy' && (<>
          <path d="M22 35 q6 -6 12 0" stroke="#111" strokeWidth={3} fill="none" />
          <path d="M46 35 q6 -6 12 0" stroke="#111" strokeWidth={3} fill="none" />
        </>)}
        {avatar.eyes === 'wink' && (<>
          <line x1={24} y1={35} x2={34} y2={35} stroke="#111" strokeWidth={3} />
          <circle cx={52} cy={35} r={3} fill="#111" />
        </>)}
        {avatar.eyes === 'star' && (<>
          <path d="M28 33 l2 6 -6 -4h8l-6 4z" fill="#111" />
          <path d="M52 33 l2 6 -6 -4h8l-6 4z" fill="#111" />
        </>)}
        {avatar.eyes === 'sleepy' && (<>
          <path d="M24 35 q5 3 10 0" stroke="#111" strokeWidth={3} fill="none" />
          <path d="M46 35 q5 3 10 0" stroke="#111" strokeWidth={3} fill="none" />
        </>)}
        {avatar.eyes === 'angry' && (<>
          <line x1={24} y1={33} x2={32} y2={37} stroke="#111" strokeWidth={3} />
          <line x1={56} y1={33} x2={48} y2={37} stroke="#111" strokeWidth={3} />
        </>)}
        {avatar.eyes === 'hearts' && (<>
          <path d="M26 34 q2 -3 4 0 q2 -3 4 0 q-4 4 -4 4 q-4 -4 -4 -4" fill="#111" />
          <path d="M50 34 q2 -3 4 0 q2 -3 4 0 q-4 4 -4 4 q-4 -4 -4 -4" fill="#111" />
        </>)}
        {avatar.eyes === 'cross' && (<>
          <line x1={26} y1={33} x2={32} y2={39} stroke="#111" strokeWidth={3} />
          <line x1={32} y1={33} x2={26} y2={39} stroke="#111" strokeWidth={3} />
          <line x1={48} y1={33} x2={54} y2={39} stroke="#111" strokeWidth={3} />
          <line x1={54} y1={33} x2={48} y2={39} stroke="#111" strokeWidth={3} />
        </>)}
        {avatar.eyes === 'glasses' && (<>
          <circle cx={28} cy={35} r={6} stroke="#111" strokeWidth={3} fill="none" />
          <circle cx={52} cy={35} r={6} stroke="#111" strokeWidth={3} fill="none" />
          <line x1={34} y1={35} x2={46} y2={35} stroke="#111" strokeWidth={3} />
        </>)}
        {avatar.eyes === 'squint' && (<>
          <path d="M24 36 q5 -2 10 0" stroke="#111" strokeWidth={3} fill="none" />
          <path d="M46 36 q5 -2 10 0" stroke="#111" strokeWidth={3} fill="none" />
        </>)}
        {avatar.eyes === 'surprised' && (<>
          <circle cx={28} cy={35} r={4} stroke="#111" strokeWidth={3} fill="none" />
          <circle cx={52} cy={35} r={4} stroke="#111" strokeWidth={3} fill="none" />
        </>)}
        {avatar.eyes === 'shades' && (<>
          <rect x={22} y={32} width={36} height={8} fill="#111" rx={2} />
        </>)}
        {/* mouth */}
        {avatar.mouth === 'line' && (<line x1={30} y1={52} x2={50} y2={52} stroke="#111" strokeWidth={3} />)}
        {avatar.mouth === 'smile' && (<path d="M30 50 q10 10 20 0" stroke="#111" strokeWidth={3} fill="none" />)}
        {avatar.mouth === 'open' && (<circle cx={40} cy={52} r={5} fill="#111" />)}
        {avatar.mouth === 'frown' && (<path d="M30 56 q10 -10 20 0" stroke="#111" strokeWidth={3} fill="none" />)}
        {avatar.mouth === 'o' && (<circle cx={40} cy={52} r={4} stroke="#111" strokeWidth={3} fill="none" />)}
        {avatar.mouth === 'tongue' && (<>
          <path d="M32 50 q8 6 16 0" stroke="#111" strokeWidth={3} fill="none" />
          <path d="M36 50 q4 6 8 0" fill="#f87171" />
        </>)}
        {avatar.mouth === 'mustache' && (<>
          <path d="M32 50 q4 -4 8 0" stroke="#111" strokeWidth={3} fill="none" />
          <path d="M48 50 q-4 -4 -8 0" stroke="#111" strokeWidth={3} fill="none" />
        </>)}
        {avatar.mouth === 'grin' && (<path d="M28 50 q12 14 24 0" stroke="#111" strokeWidth={3} fill="none" />)}
        {avatar.mouth === 'smirk' && (<path d="M40 53 q10 -4 10 -1" stroke="#111" strokeWidth={3} fill="none" />)}
        {avatar.mouth === 'robot' && (<>
          <rect x={32} y={48} width={16} height={8} stroke="#111" strokeWidth={3} fill="none" />
          <line x1={36} y1={48} x2={36} y2={56} stroke="#111" strokeWidth={2} />
          <line x1={40} y1={48} x2={40} y2={56} stroke="#111" strokeWidth={2} />
          <line x1={44} y1={48} x2={44} y2={56} stroke="#111" strokeWidth={2} />
        </>)}
        {avatar.mouth === 'zigzag' && (<path d="M30 52 l6 4 l6 -4 l6 4" stroke="#111" strokeWidth={3} fill="none" />)}
        {avatar.mouth === 'beard' && (<path d="M28 52 q12 18 24 0" stroke="#111" strokeWidth={3} fill="none" />)}
      </svg>
    )
  }

  const randomizeAvatar = () => {
    const rand = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random()*arr.length)]
    setAvatar({ color: rand(PRESET_COLORS as readonly string[]), eyes: rand(EYE_OPTIONS), mouth: rand(MOUTH_OPTIONS) })
    setName(rand(FUNNY_NAMES as readonly string[]))
  }

  const cycleEyes = (dir: 1 | -1) => {
    const idx = EYE_OPTIONS.indexOf(avatar.eyes)
    const next = (idx + dir + EYE_OPTIONS.length) % EYE_OPTIONS.length
    setAvatar({ ...avatar, eyes: EYE_OPTIONS[next] })
  }
  const cycleMouth = (dir: 1 | -1) => {
    const idx = MOUTH_OPTIONS.indexOf(avatar.mouth)
    const next = (idx + dir + MOUTH_OPTIONS.length) % MOUTH_OPTIONS.length
    setAvatar({ ...avatar, mouth: MOUTH_OPTIONS[next] })
  }

  return (
    <div style={{ maxWidth: 1100, margin: '3rem auto', position:'relative' }}>
      {/* animated background orbs */}
      <div aria-hidden="true" style={{ position:'absolute', inset: -80, zIndex:0 }}>
        <div className="bg-orb float-a" style={{ left:-40, top:-20, width:260, height:260, background:'radial-gradient(circle, #60a5fa, transparent 60%)' }} />
        <div className="bg-orb float-b" style={{ right:-60, bottom:-60, width:320, height:320, background:'radial-gradient(circle, #a78bfa, transparent 60%)' }} />
        <div className="bg-orb float-c" style={{ left:240, bottom:-60, width:260, height:260, background:'radial-gradient(circle, #34d399, transparent 60%)' }} />
      </div>
      <h1 className="title-glow" style={{ marginBottom: 6, letterSpacing: 1, fontSize: 48, position:'relative', zIndex:1 }}>Artzooka</h1>
      <div style={{ color:'#9ca3af', marginBottom: 18, position:'relative', zIndex:1 }}>Draw, bluff, vote — who’s the imposter artist?</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, position:'relative', zIndex:1 }}>
        {/* Profile */}
        <div className="glass" style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 8, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span>Profile</span>
            <span style={{ color:'#9ca3af', fontSize:12 }}>Make your avatar yours</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 16, alignItems: 'center' }}>
            <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <button aria-label="Previous eyes" onClick={() => cycleEyes(-1)} style={{ position:'absolute', left:-10, top:26, width:28, height:28, borderRadius:999, border:'1px solid #3a3a40', background:'linear-gradient(180deg,#1f1f22,#141416)', color:'#e6e6e6', boxShadow:'0 2px 6px rgba(0,0,0,0.4)' }}>‹</button>
              <div className="pulse-ring" style={{ position:'absolute', inset:-10, borderRadius:999, background:'radial-gradient(closest-side, rgba(96,165,250,0.25), transparent 70%)' }} />
              <AvatarPreview />
              <button aria-label="Next eyes" onClick={() => cycleEyes(1)} style={{ position:'absolute', right:-10, top:26, width:28, height:28, borderRadius:999, border:'1px solid #3a3a40', background:'linear-gradient(180deg,#1f1f22,#141416)', color:'#e6e6e6', boxShadow:'0 2px 6px rgba(0,0,0,0.4)' }}>›</button>
              <button aria-label="Previous mouth" onClick={() => cycleMouth(-1)} style={{ position:'absolute', left:-10, bottom:8, width:28, height:28, borderRadius:999, border:'1px solid #3a3a40', background:'linear-gradient(180deg,#1f1f22,#141416)', color:'#e6e6e6', boxShadow:'0 2px 6px rgba(0,0,0,0.4)' }}>‹</button>
              <button aria-label="Next mouth" onClick={() => cycleMouth(1)} style={{ position:'absolute', right:-10, bottom:8, width:28, height:28, borderRadius:999, border:'1px solid #3a3a40', background:'linear-gradient(180deg,#1f1f22,#141416)', color:'#e6e6e6', boxShadow:'0 2px 6px rgba(0,0,0,0.4)' }}>›</button>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <input className="input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label>Color:</label>
                <input className="input" type="color" value={avatar.color} onChange={(e) => setAvatar({ ...avatar, color: e.target.value })} />
                <div style={{ display:'inline-flex', gap:6, marginLeft:8 }}>
                  {PRESET_COLORS.map(c => (
                    <button key={c} title={c} onClick={() => setAvatar({ ...avatar, color: c })} style={{ width:18, height:18, background:c, border:'1px solid #333', borderRadius:4 }} />
                  ))}
                </div>
              </div>
              {/* Eyes/Mouth lists removed in favor of cyclers for a cleaner, skRIBBL-like UX */}
              <div style={{ display:'flex', gap:8, marginTop:4 }}>
                <button type="button" onMouseDown={(e)=>{
                  const id = setInterval(() => randomizeAvatar(), 120)
                  ;(e.currentTarget as any)._spinId = id
                }} onMouseUp={(e)=>{
                  const id = (e.currentTarget as any)._spinId; if (id) clearInterval(id)
                }} onMouseLeave={(e)=>{
                  const id = (e.currentTarget as any)._spinId; if (id) clearInterval(id)
                }}
                className="btn-primary"
                onClick={randomizeAvatar}>Surprise me 🎲</button>
                <button type="button" onClick={() => setAvatar(defaultAvatar)}>Reset</button>
              </div>
            </div>
          </div>
        </div>

        {/* Play */}
        <div className="glass" style={{ padding: 16, display: 'grid', gap: 16, position:'relative', overflow:'hidden' }}>
          <div style={{ fontWeight: 600, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span>Play</span>
            <span style={{ color:'#9ca3af', fontSize:12 }}>Tip: share the code or paste an invite to join</span>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn-primary btn-pulse" onClick={createRoom} disabled={busy}>Create room</button>
            <span style={{ color: '#9ca3af' }}>Create and share the code with friends</span>
          </div>

          <div>
            <div style={{ marginBottom: 6 }}>Join room</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'center' }}>
              <input className="input" placeholder="Room code" value={maskedCode} type={showCode ? 'text' : 'password'} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g,''))} />
              <button type="button" title="Paste" onClick={pasteCode}>Paste</button>
              <button type="button" onClick={joinRoom} disabled={busy}>Join</button>
            </div>
            {/* recent rooms + clipboard detect */}
            <RecentRooms onPick={(c) => setCode(c)} />
            <div style={{ marginTop:8, color:'#9ca3af', fontSize:12 }}>Hint: If the link was shared, just paste and Join. Otherwise ask the host to share the code.</div>
            {error && <div style={{ marginTop: 8, color: '#f87171' }}>{error}</div>}
          </div>

          <div>
            <div style={{ fontWeight: 600, marginTop: 6 }}>Playground</div>
            <div style={{ color:'#9ca3af', fontSize:12, marginBottom: 6 }}>Try tools before joining a room.</div>
            <button onClick={() => setShowPlayground(true)}>Open canvas playground</button>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="glass" style={{ marginTop: 16, padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>About</div>
        <div style={{ color:'#c9d1d9', marginBottom: 8 }}>
          How it works: Create a room, share the code or QR, draw for 120s, discuss and vote for 60s, then see results. Minimum 3 players, maximum 8 in a lobby.
        </div>
        <RandomTrivia />
      </div>

      {/* Footer */}
      <footer style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop: 16, color:'#9ca3af', fontSize: 12 }}>
        <div>© 2025 Artzooka • v0.1.0</div>
        <div style={{ display:'inline-flex', gap:10 }}>
          <span className="chip" title="Coming soon">Terms</span>
          <span className="chip" title="Coming soon">Privacy</span>
          <span className="chip" title="Contact">Support</span>
        </div>
      </footer>
      {showPlayground && <PlaygroundModal onClose={() => setShowPlayground(false)} />}
    </div>
  )
}

function PlaygroundModal({ onClose }: { onClose: () => void }) {
  const [tool, setTool] = useState<'pen'|'line'|'rect'|'circle'|'eraser'|'bucket'>('pen')
  const [color, setColor] = useState('#ffffff')
  const [size, setSize] = useState(6)
  const canvasRef = useRef<HTMLCanvasElement|null>(null)
  const ctxRef = useRef<CanvasRenderingContext2D|null>(null)
  const drawing = useRef(false)
  const start = useRef<{x:number;y:number}|null>(null)
  const snapshot = useRef<ImageData|null>(null)

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    c.width = 560; c.height = 320
    const ctx = (ctxRef.current = c.getContext('2d')!)
    ctx.fillStyle = '#202024'; ctx.fillRect(0,0,c.width,c.height)
  }, [])

  const begin = (x:number,y:number) => {
    const ctx = ctxRef.current!
    drawing.current = true
    start.current = {x,y}
    ctx.lineWidth = size
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.globalCompositeOperation = tool==='eraser'? 'destination-out':'source-over'
    if (tool==='pen' || tool==='eraser') { ctx.beginPath(); ctx.moveTo(x,y) }
    else { const c = canvasRef.current!; try { snapshot.current = ctx.getImageData(0,0,c.width,c.height) } catch { snapshot.current=null } }
  }
  const move = (x:number,y:number) => {
    if (!drawing.current) return
    const ctx = ctxRef.current!
    const st = start.current!
    if (tool==='pen' || tool==='eraser') { ctx.lineTo(x,y); ctx.stroke(); return }
    const c = canvasRef.current!
    if (snapshot.current) ctx.putImageData(snapshot.current,0,0)
    ctx.lineWidth = size; ctx.strokeStyle=color; ctx.fillStyle=color
    if (tool==='line') { ctx.beginPath(); ctx.moveTo(st.x,st.y); ctx.lineTo(x,y); ctx.stroke(); return }
    if (tool==='rect') { const w=x-st.x, h=y-st.y; ctx.strokeRect(st.x,st.y,w,h); return }
    if (tool==='circle') { const w=x-st.x, h=y-st.y; const rx=Math.abs(w)/2, ry=Math.abs(h)/2; const cx=st.x+w/2, cy=st.y+h/2; ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2); ctx.stroke(); return }
  }
  const end = () => { drawing.current=false; start.current=null; snapshot.current=null }
  const get = (e:React.MouseEvent<HTMLCanvasElement>) => { const r=(e.target as HTMLCanvasElement).getBoundingClientRect(); return {x:e.clientX-r.left, y:e.clientY-r.top} }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e)=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <strong>Canvas playground</strong>
          <button onClick={onClose}>Close</button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:10 }}>
          <canvas ref={canvasRef} onMouseDown={(e)=>{const p=get(e); begin(p.x,p.y)}} onMouseMove={(e)=>{const p=get(e); move(p.x,p.y)}} onMouseUp={end} onMouseLeave={end} style={{ width:'100%', height:320, border:'1px solid #2a2a2f', borderRadius:8, background:'#202024' }} />
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:6 }}>
              {['pen','line','rect','circle','eraser','bucket'].map((t) => (
                <button key={t} onClick={()=>setTool(t as any)} aria-pressed={tool===t} style={{ padding:6, border: tool===t?'2px solid #fff':'1px solid #444', background:'#222', borderRadius:6, textTransform:'capitalize' }}>{t}</button>
              ))}
            </div>
            <input className="input" type="color" value={color} onChange={(e)=>setColor(e.target.value)} />
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6 }}>
              {[4,6,10,16].map((s)=>(<button key={s} onClick={()=>setSize(s)} style={{ padding:6, border:size===s?'2px solid #fff':'1px solid #444', background:'#222', borderRadius:6 }}>{s}px</button>))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
