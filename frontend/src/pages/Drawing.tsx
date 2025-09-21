import { useEffect, useMemo, useRef, useState } from 'react'
import { useRoomStore } from '../store/useRoomStore'
import { http } from '../api/http'
import { Avatar } from '../components/Avatar'


type Tool = 'pen' | 'line' | 'rect' | 'circle' | 'eraser' | 'bucket'

const PRESET_COLORS = ['#ffffff', '#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6', '#fef08a']

export default function Drawing({ onSubmit }: { onSubmit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement|null>(null)
  const containerRef = useRef<HTMLDivElement|null>(null)
  const ctxRef = useRef<CanvasRenderingContext2D|null>(null)
  const drawingRef = useRef(false)
  const startRef = useRef<{x:number;y:number}|null>(null)
  const snapshotRef = useRef<ImageData|null>(null)
  const historyRef = useRef<ImageData[]>([])

  const { roomCode, sessionToken, players, drawingsVersion } = useRoomStore()

  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState<string>('#ffffff')
  const [size, setSize] = useState<number>(8)
  const [fill, setFill] = useState<boolean>(false)

  const [submitting, setSubmitting] = useState(false)
  const [myPrompt, setMyPrompt] = useState<string>('')
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set())

  const CANVAS_WIDTH = 800
  const CANVAS_HEIGHT = 500

  const ensureContext = () => {
    const canvas = canvasRef.current!
    let ctx = ctxRef.current
    if (!ctx) {
      ctx = canvas.getContext('2d')!
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctxRef.current = ctx
      // Initialize history (blank)
      saveHistory()
    }
    return ctx
  }

  const saveHistory = () => {
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    if (!canvas || !ctx) return
    try {
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
      historyRef.current.push(img)
      if (historyRef.current.length > 50) historyRef.current.shift()
    } catch {}
  }

  const restoreSnapshot = (img: ImageData|null) => {
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    if (!canvas || !ctx || !img) return
    ctx.putImageData(img, 0, 0)
  }

  const beginStroke = (x: number, y: number) => {
    const ctx = ensureContext()
    drawingRef.current = true
    startRef.current = { x, y }

    // styling
    ctx.lineWidth = size
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over'

    if (tool === 'pen' || tool === 'eraser') {
      ctx.beginPath()
      ctx.moveTo(x, y)
    } else {
      // snapshot for shape preview
      const canvas = canvasRef.current!
      try {
        snapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
      } catch {
        snapshotRef.current = null
      }
    }
  }

  const drawStroke = (x: number, y: number) => {
    if (!drawingRef.current) return
    const ctx = ctxRef.current!
    const start = startRef.current!

    if (tool === 'pen' || tool === 'eraser') {
      ctx.lineTo(x, y)
      ctx.stroke()
      return
    }

    // restore snapshot for shape preview
    restoreSnapshot(snapshotRef.current)
    ctx.lineWidth = size
    ctx.strokeStyle = color
    ctx.fillStyle = color

    if (tool === 'line') {
      ctx.beginPath()
      ctx.moveTo(start.x, start.y)
      ctx.lineTo(x, y)
      ctx.stroke()
      return
    }

    if (tool === 'rect') {
      const w = x - start.x
      const h = y - start.y
      if (fill) {
        ctx.fillRect(start.x, start.y, w, h)
      } else {
        ctx.strokeRect(start.x, start.y, w, h)
      }
      return
    }

    if (tool === 'circle') {
      const w = x - start.x
      const h = y - start.y
      const rx = Math.abs(w) / 2
      const ry = Math.abs(h) / 2
      const cx = start.x + w / 2
      const cy = start.y + h / 2
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      if (fill) {
        ctx.fill()
      } else {
        ctx.stroke()
      }
      return
    }
  }

  const endStroke = () => {
    if (!drawingRef.current) return
    drawingRef.current = false
    startRef.current = null
    snapshotRef.current = null
    // save final image to history for undo
    saveHistory()
  }

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    return { x, y }
  }

  // Flood fill using BFS
  const floodFill = (sx: number, sy: number) => {
    const canvas = canvasRef.current!
    const ctx = ensureContext()
    const w = canvas.width
    const h = canvas.height
    const img = ctx.getImageData(0, 0, w, h)
    const data = img.data

    const toIndex = (x:number, y:number) => (y * w + x) * 4

    const startIdx = toIndex(Math.floor(sx), Math.floor(sy))
    const target = [data[startIdx], data[startIdx+1], data[startIdx+2], data[startIdx+3]] as const

    // new color
    const hex = color.replace('#','')
    const nr = parseInt(hex.substring(0,2),16)
    const ng = parseInt(hex.substring(2,4),16)
    const nb = parseInt(hex.substring(4,6),16)
    const na = 255

    // if same as target, skip
    if (target[0] === nr && target[1] === ng && target[2] === nb && target[3] === na) return

    const q: [number, number][] = []
    const visited = new Uint8Array(w * h)
    const match = (x:number,y:number) => {
      if (x<0 || y<0 || x>=w || y>=h) return false
      const idx = toIndex(x,y)
      return data[idx]===target[0] && data[idx+1]===target[1] && data[idx+2]===target[2] && data[idx+3]===target[3]
    }
    const setColor = (x:number,y:number) => {
      const idx = toIndex(x,y)
      data[idx]=nr; data[idx+1]=ng; data[idx+2]=nb; data[idx+3]=na
    }

    q.push([Math.floor(sx), Math.floor(sy)])
    while (q.length) {
      const [x,y] = q.shift()!
      const vi = y * w + x
      if (visited[vi]) continue
      visited[vi] = 1
      if (!match(x,y)) continue
      setColor(x,y)
      q.push([x+1,y])
      q.push([x-1,y])
      q.push([x,y+1])
      q.push([x,y-1])
    }

    ctx.putImageData(img, 0, 0)
    saveHistory()
  }

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getPos(e)
    if (tool === 'bucket') {
      floodFill(x, y)
      return
    }
    beginStroke(x, y)
  }

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return
    const { x, y } = getPos(e)
    drawStroke(x, y)
  }

  const onMouseUp = () => endStroke()
  const onMouseLeave = () => endStroke()

  const undo = () => {
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    if (!canvas || !ctx) return
    if (historyRef.current.length <= 1) return
    // remove current state
    historyRef.current.pop()
    const prev = historyRef.current[historyRef.current.length - 1]
    restoreSnapshot(prev)
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    saveHistory()
  }

  const savePngBlob = async (): Promise<Blob> => {
    const canvas = canvasRef.current!
    return await new Promise((res) => canvas.toBlob((b) => res(b!), 'image/png'))
  }

  const upload = async () => {
    if (!roomCode || !sessionToken) return
    setSubmitting(true)
    try {
      const blob = await savePngBlob()
      const form = new FormData()
      form.append('file', blob, 'drawing.png')
      const url = `/api/rooms/${roomCode}/drawings?token=${encodeURIComponent(sessionToken)}`
      await http.post(url, form, { headers: { 'Content-Type': 'multipart/form-data' } })
      // ensure voting state is reset for the discussion phase
      try { (useRoomStore.getState().setVoted as any)?.(false) } catch {}
      onSubmit()
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    canvas.width = CANVAS_WIDTH
    canvas.height = CANVAS_HEIGHT
    canvas.style.width = `${CANVAS_WIDTH}px`
    canvas.style.height = `${CANVAS_HEIGHT}px`

    const ctx = ensureContext()
    // draw dark background as default
    ctx.fillStyle = '#222222'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = color
    saveHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch my prompt (per-player)
  useEffect(() => {
    if (!roomCode || !sessionToken) return
    ;(async () => {
      try {
        const res = await http.get(`/api/rooms/${roomCode}/prompt`, { params: { token: sessionToken } })
        setMyPrompt(res.data.prompt)
      } catch {}
    })()
  }, [roomCode, sessionToken])

  // Fetch submitted drawings list for green ticks
  useEffect(() => {
    if (!roomCode) return
    ;(async () => {
      try {
        const res = await http.get(`/api/rooms/${roomCode}/drawings`)
        const ids = new Set<string>((res.data as Array<{playerId:string}>).map(d => d.playerId))
        setSubmittedIds(ids)
      } catch {}
    })()
  }, [roomCode, drawingsVersion])

  // Build a cursor that reflects tool and size
  const cursorStyle = useMemo(() => {
    if (tool === 'pen' || tool === 'eraser') {
      const d = Math.max(2, Math.min(48, size))
      const canvas = document.createElement('canvas')
      const pad = 2
      canvas.width = d + pad * 2
      canvas.height = d + pad * 2
      const c = canvas.getContext('2d')!
      const r = d / 2
      const cx = pad + r
      const cy = pad + r
      c.clearRect(0,0,canvas.width,canvas.height)
      // outline
      c.beginPath()
      c.arc(cx, cy, r, 0, Math.PI*2)
      c.strokeStyle = tool === 'eraser' ? '#ffffff' : '#000000'
      c.lineWidth = 1
      c.stroke()
      // inner fill (semi transparent) for pen
      if (tool === 'pen') {
        c.beginPath()
        c.arc(cx, cy, r-1, 0, Math.PI*2)
        c.fillStyle = '#00000022'
        c.fill()
      }
      const url = canvas.toDataURL('image/png')
      const hotspot = `${Math.round(cx)} ${Math.round(cy)}`
      return `url(${url}) ${hotspot}, crosshair`
    }
    // shapes and bucket
    return 'crosshair'
  }, [tool, size])

  return (
    <div ref={containerRef} style={{ maxWidth: 1200, margin: '1.5rem auto' }}>
      {/* Top: Prompt */}
      <div style={{ marginBottom: 10, padding: '10px 12px', border: '1px solid #3a3a40', background: '#151517', borderRadius: 8 }}>
        <strong>Prompt:</strong> <em>{myPrompt || '...'}</em>
      </div>

      {/* Main grid: left players, center canvas, right tools */}
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 260px', gap: 12, alignItems: 'start' }}>
        {/* Left: players and status */}
        <div style={{ border: '1px solid #3a3a40', background:'#151517', padding: 10, borderRadius: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Players</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {players.map((p) => (
              <li key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 2px' }}>
                <span style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
                  <Avatar avatar={p.avatar} />
                  {p.name}
                </span>
                {submittedIds.has(p.id) ? (
                  <span title="Submitted" style={{ color: '#34d399', display: 'inline-flex', alignItems: 'center', fontSize: 18 }}>✓</span>
                ) : (
                  <span title="Pending" style={{ color: '#888', fontSize: 18 }}>•</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Center: canvas and submit button */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ border: '1px solid #3a3a40', background:'#111', padding: 8, borderRadius: 8 }}>
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseLeave}
              style={{ border: '1px solid #666', background: '#222', cursor: cursorStyle as any }}
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <button onClick={upload} disabled={submitting}>Submit</button>
          </div>
        </div>

        {/* Right: tools */}
        <div style={{ border: '1px solid #3a3a40', background:'#151517', padding: 10, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Tools</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              <button title="Pen" onClick={() => setTool('pen')} aria-pressed={tool==='pen'} style={{ padding: 6, border: tool==='pen'?'2px solid #fff':'1px solid #444', background:'#222', borderRadius: 6 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 2 2-7 7-3 1 1-3z"/><path d="M18 13l-4-4"/></svg>
              </button>
              <button title="Line" onClick={() => setTool('line')} aria-pressed={tool==='line'} style={{ padding: 6, border: tool==='line'?'2px solid #fff':'1px solid #444', background:'#222', borderRadius: 6 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20L20 4"/></svg>
              </button>
              <button title="Rectangle" onClick={() => setTool('rect')} aria-pressed={tool==='rect'} style={{ padding: 6, border: tool==='rect'?'2px solid #fff':'1px solid #444', background:'#222', borderRadius: 6 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="1"/></svg>
              </button>
              <button title="Circle" onClick={() => setTool('circle')} aria-pressed={tool==='circle'} style={{ padding: 6, border: tool==='circle'?'2px solid #fff':'1px solid #444', background:'#222', borderRadius: 6 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8"/></svg>
              </button>
              <button title="Eraser" onClick={() => setTool('eraser')} aria-pressed={tool==='eraser'} style={{ padding: 6, border: tool==='eraser'?'2px solid #fff':'1px solid #444', background:'#222', borderRadius: 6 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l6-6 8 8H7z"/><path d="M14 7l3 3"/></svg>
              </button>
              <button title="Bucket" onClick={() => setTool('bucket')} aria-pressed={tool==='bucket'} style={{ padding: 6, border: tool==='bucket'?'2px solid #fff':'1px solid #444', background:'#222', borderRadius: 6 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l8 8-6 10H10L4 10z"/><path d="M14 14c0 1.1-.9 2-2 2s-2-.9-2-2"/></svg>
              </button>
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Color</div>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
            <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4 }}>
              {PRESET_COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} style={{ width: 18, height: 18, background: c, border: '1px solid #333', borderRadius: 4 }} />
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Size</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {[4,8,12,16].map((s) => (
                <button key={s} onClick={() => setSize(s)} style={{ padding: '6px 6px', border: size===s?'2px solid #fff':'1px solid #444', background:'#222', color:'#fff', borderRadius: 6 }}>{s}px</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={fill} onChange={(e) => setFill(e.target.checked)} /> Fill shapes
            </label>
          </div>
          <div style={{ display: 'inline-flex', gap: 6 }}>
            <button onClick={undo}>Undo</button>
            <button onClick={clearCanvas}>Clear</button>
          </div>
        </div>
      </div>
    </div>
  )
}
