import { useEffect, useMemo, useRef, useState } from 'react'
import { useRoomStore } from '../store/useRoomStore'
import { http } from '../api/http'
import { Avatar } from '../components/Avatar'


type Tool = 'pen' | 'line' | 'rect' | 'circle' | 'eraser' | 'bucket' | 'stamp'

const PRESET_COLORS = ['#ffffff', '#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6', '#fef08a']

// Logical canvas size (drawing coordinates). The element can scale visually.
const CANVAS_WIDTH = 900
const CANVAS_HEIGHT = 560

export default function Drawing({ onSubmit }: { onSubmit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement|null>(null)
  const containerRef = useRef<HTMLDivElement|null>(null)
  const leftPanelRef = useRef<HTMLDivElement|null>(null)
  const rightPanelRef = useRef<HTMLDivElement|null>(null)
  const ctxRef = useRef<CanvasRenderingContext2D|null>(null)
  const drawingRef = useRef(false)
  const startRef = useRef<{x:number;y:number}|null>(null)
  const snapshotRef = useRef<ImageData|null>(null)
  const historyRef = useRef<ImageData[]>([])

  const { roomCode, sessionToken, players, drawingsVersion, timers, view, setView, setPromptCommon, activeGameStatus, activeGamePlayers, notifications, removeNotification, clearNotifications } = useRoomStore()
  

  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState<string>('#ffffff')
  const [size, setSize] = useState<number>(8)
  const [fill, setFill] = useState<boolean>(false)
  const [stamp, setStamp] = useState<string>('⭐️')
  const [stampSize, setStampSize] = useState<number>(32)

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const timerExpiredRef = useRef(false) // Prevent multiple timer expirations
  const [canvasBoxHeight, setCanvasBoxHeight] = useState<number>(CANVAS_HEIGHT)
  // pan/zoom
  const [zoom, setZoom] = useState<number>(1)
  const [pan, setPan] = useState<{x:number;y:number}>({ x: 0, y: 0 })
  const [panning, setPanning] = useState(false)
  const spacePressedRef = useRef(false)
  const lastMouseRef = useRef<{x:number;y:number}>({ x: 0, y: 0 })
  const [myPrompt, setMyPrompt] = useState<string>('')
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set())
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  // —

  // Check submission status when component mounts or game changes
  useEffect(() => {
    if (roomCode && sessionToken) {
      checkSubmissionStatus()
    }
  }, [roomCode, sessionToken])

  // Reset timer expired flag when timers change (new game starts)
  useEffect(() => {
    timerExpiredRef.current = false
  }, [timers.serverTime, timers.drawSeconds])

  // Start synchronized countdown based on serverTime and drawSeconds
  useEffect(() => {
    if (!timers.serverTime || !timers.drawSeconds) return
    const now = Date.now()
    const drift = now - timers.serverTime
    const endAt = now + (timers.drawSeconds * 1000 - drift)
    let hasExpired = false

    const tick = () => {
      const remainMs = Math.max(0, endAt - Date.now())
      setSecondsLeft(Math.ceil(remainMs / 1000))
      
      if (remainMs <= 0 && !hasExpired && !timerExpiredRef.current) {
        hasExpired = true // Prevent multiple calls from this timer instance
        timerExpiredRef.current = true // Prevent multiple calls from all timer instances
        
        // Auto-submit user's canvas content when timer expires
        const currentState = useRoomStore.getState()
        console.log('⏰ Drawing timer expired - remainMs:', remainMs, 'voteStartTime:', !!currentState.timers.voteStartTime, 'currentView:', currentState.view)
        
        if (currentState.timers.voteStartTime && currentState.view === 'draw') {
          console.log('⏰ Drawing timer expired - auto-submitting user\'s canvas')
          console.log('⏰ Current submission state - submitting:', submitting, 'submitted:', submitted)
          
          // Only attempt upload if not already submitting or submitted
          if (!submitting && !submitted) {
            console.log('⏰ Timer expired - attempting upload (backend will block if already submitted)')
            upload().then(() => {
              console.log('⏰ Auto-submit completed - calling onSubmit to switch to discuss')
              onSubmit()
            }).catch((error) => {
              console.error('⏰ Auto-submit failed:', error)
              // Still switch to discuss even if auto-submit fails
              onSubmit()
            })
          } else {
            console.log('⏰ Timer expired but already submitting/submitted - just calling onSubmit')
            onSubmit()
          }
        } else if (currentState.timers.voteStartTime && currentState.view !== 'draw') {
          console.log('⏰ Drawing timer expired but view already changed to:', currentState.view, '- not calling onSubmit')
        } else if (!currentState.timers.voteStartTime) {
          console.log('⏰ Drawing timer expired but no voteStartTime set yet')
        }
      } else if (remainMs <= 0 && timerExpiredRef.current) {
        console.log('⏰ Timer expired but already handled by another timer instance - ignoring')
      }
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [timers.serverTime, timers.drawSeconds, onSubmit])

  // If user refreshes mid-round, ensure we fetch current prompt and submissions immediately
  useEffect(() => {
    if (!roomCode || !sessionToken) return
    // force-load prompt and submissions on mount
    ;(async () => {
      try { await http.get(`/api/rooms/${roomCode}/prompt`, { params: { token: sessionToken } }) } catch {}
      try { const res = await http.get(`/api/rooms/${roomCode}/drawings`); setSubmittedIds(new Set((res.data as Array<{playerId:string}>).map(d=>d.playerId))) } catch {}
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    // invert CSS transform (translate+scale)
    const x = (e.clientX - rect.left - pan.x) / zoom
    const y = (e.clientY - rect.top - pan.y) / zoom
    lastMouseRef.current = { x, y }
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
    if (spacePressedRef.current || e.button === 1) {
      setPanning(true)
      return
    }
    const { x, y } = getPos(e)
    if (tool === 'bucket') {
      floodFill(x, y)
      return
    }
    if (tool === 'stamp') {
      const ctx = ensureContext()
      ctx.save()
      ctx.font = `${stampSize}px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(stamp, x, y)
      ctx.restore()
      saveHistory()
      return
    }
    beginStroke(x, y)
  }

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (panning) {
      const rect = (e.target as HTMLCanvasElement).getBoundingClientRect()
      setPan((p) => ({ x: p.x + e.movementX, y: p.y + e.movementY }))
      return
    }
    if (!drawingRef.current) return
    const { x, y } = getPos(e)
    drawStroke(x, y)
  }

  const onMouseUp = () => { endStroke(); setPanning(false) }
  const onMouseLeave = () => { endStroke(); setPanning(false) }

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
    console.log('🎨 Canvas dimensions:', canvas.width, 'x', canvas.height)
    console.log('🎨 Canvas style dimensions:', canvas.style.width, 'x', canvas.style.height)
    
    // Get canvas context and check if there's any content
    const ctx = canvas.getContext('2d')!
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const hasContent = imageData.data.some((_value, index) => {
      // Check if any pixel is not the default dark background (#222222)
      if (index % 4 === 3) return false // Skip alpha channel
      const pixelIndex = Math.floor(index / 4)
      const r = imageData.data[pixelIndex * 4]
      const g = imageData.data[pixelIndex * 4 + 1]
      const b = imageData.data[pixelIndex * 4 + 2]
      // Check if pixel is different from dark background (#222222 = 34, 34, 34)
      return r !== 34 || g !== 34 || b !== 34
    })
    console.log('🎨 Canvas has drawing content:', hasContent)
    
    return await new Promise((res) => {
      canvas.toBlob((blob) => {
        console.log('🎨 Blob created, size:', blob?.size, 'bytes')
        res(blob!)
      }, 'image/png')
    })
  }

  const checkSubmissionStatus = async () => {
    if (!roomCode || !sessionToken) return false
    try {
      const response = await http.get(`/api/rooms/${roomCode}/drawings/status?token=${encodeURIComponent(sessionToken)}`)
      const hasSubmitted = response.data.hasSubmitted
      setSubmitted(hasSubmitted)
      return hasSubmitted
    } catch (error) {
      console.error('Failed to check submission status:', error)
      return false
    }
  }

  const upload = async () => {
    if (!roomCode || !sessionToken) return
    
    // Enhanced protection - check if already submitted or currently submitting
    if (submitting) {
      console.log('⏰ Upload blocked - already submitting')
      return
    }
    
    if (submitted) {
      console.log('⏰ Upload blocked - already submitted')
      return
    }
    
    console.log('🚀 Upload starting - setting submitting to true')
    setSubmitting(true)
    
    // Double-check after setting submitting flag (race condition protection)
    if (submitted) {
      console.log('⏰ Upload blocked - submitted flag changed during setup')
      setSubmitting(false)
      return
    }
    
    try {
      console.log('🚀 Starting upload process...')
      const blob = await savePngBlob()
      console.log('🚀 Blob obtained, creating FormData...')
      const form = new FormData()
      form.append('file', blob, 'drawing.png')
      const url = `/api/rooms/${roomCode}/drawings?token=${encodeURIComponent(sessionToken)}`
      console.log('🚀 Posting to:', url)
      
      await http.post(url, form, { headers: { 'Content-Type': 'multipart/form-data' } })
      console.log('🚀 Upload successful!')
      
      // Mark as submitted
      setSubmitted(true)
      
      // ensure voting state is reset for the discussion phase
      try { (useRoomStore.getState().setVoted as any)?.(false) } catch {}
      // Do not navigate here; wait for either DISCUSS_STARTED or draw timer expiry
    } catch (error: any) {
      console.error('🚀 Upload failed:', error)
      
      // Check if it's a duplicate submission error
      if (error.response?.data?.alreadySubmitted) {
        console.log('🚀 Backend says already submitted - updating local state')
        setSubmitted(true)
      } else {
        // For other errors, allow retry
        throw error
      }
    } finally {
      setSubmitting(false)
    }
  }

  const leaveGame = async () => {
    if (!roomCode || !sessionToken) return
    
    try {
      const response = await fetch(`http://localhost:8080/api/rooms/${roomCode}/leave-game?token=${sessionToken}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        // Clear the prompt to prevent auto-redirect back to draw
        setPromptCommon(undefined)
        // Navigate back to lobby
        setView('lobby')
      } else {
        console.error('Failed to leave game:', response.status)
      }
    } catch (error) {
      console.error('Error leaving game:', error)
    }
  }

  // Auto-dismiss notifications after 4 seconds
  useEffect(() => {
    notifications.forEach(notification => {
      const timeElapsed = Date.now() - notification.timestamp
      const timeRemaining = 4000 - timeElapsed
      
      if (timeRemaining > 0) {
        setTimeout(() => {
          removeNotification(notification.id)
        }, timeRemaining)
      } else {
        // Already expired, remove immediately
        removeNotification(notification.id)
      }
    })
  }, [notifications, removeNotification])

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

  // Keep side panels equal to the rendered canvas height (responsive)
  useEffect(() => {
    const updateHeights = () => {
      const c = canvasRef.current
      const h = c ? c.getBoundingClientRect().height : CANVAS_HEIGHT
      setCanvasBoxHeight(h)
    }
    updateHeights()
    window.addEventListener('resize', updateHeights)
    return () => window.removeEventListener('resize', updateHeights)
  }, [])

  // pan/zoom handlers
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') spacePressedRef.current = true
      if (e.key.toLowerCase() === 'i') {
        // eyedropper at last mouse
        const c = canvasRef.current
        const ctx = ctxRef.current
        if (!c || !ctx) return
        const x = Math.floor(lastMouseRef.current.x)
        const y = Math.floor(lastMouseRef.current.y)
        if (x>=0 && y>=0 && x<c.width && y<c.height) {
          const d = ctx.getImageData(x, y, 1, 1).data
          const hex = `#${[d[0],d[1],d[2]].map(v=>v.toString(16).padStart(2,'0')).join('')}`
          setColor(hex)
        }
      }
    }
    const onKeyUp = (e: KeyboardEvent) => { if (e.code === 'Space') spacePressedRef.current = false }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp) }
  }, [])

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!(e.ctrlKey || e.metaKey)) return
    e.preventDefault()
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect()
    const point = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    setZoom((z) => {
      const newZ = Math.min(3, Math.max(0.5, z * factor))
      // zoom towards pointer: adjust pan so the focus stays under the cursor
      setPan((p) => ({ x: point.x - ((point.x - p.x) * (newZ / z)), y: point.y - ((point.y - p.y) * (newZ / z)) }))
      return newZ
    })
  }

  // touch pinch (basic)
  const pinchRef = useRef<{dist:number; zoom:number; center:{x:number;y:number}}|null>(null)
  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2) {
      const [a,b] = [e.touches[0], e.touches[1]]
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      pinchRef.current = { dist, zoom, center: { x:(a.clientX+b.clientX)/2, y:(a.clientY+b.clientY)/2 } }
    }
  }
  const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const [a,b] = [e.touches[0], e.touches[1]]
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      const factor = dist / pinchRef.current.dist
      const rect = (e.target as HTMLCanvasElement).getBoundingClientRect()
      const point = { x: pinchRef.current.center.x - rect.left, y: pinchRef.current.center.y - rect.top }
      setZoom(() => {
        const newZ = Math.min(3, Math.max(0.5, pinchRef.current!.zoom * factor))
        setPan((p) => ({ x: point.x - ((point.x - p.x) * (newZ / pinchRef.current!.zoom)), y: point.y - ((point.y - p.y) * (newZ / pinchRef.current!.zoom)) }))
        return newZ
      })
    }
  }
  const onTouchEnd = () => { pinchRef.current = null }

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
      <div style={{ marginBottom: 10, padding: '10px 12px', border: '1px solid #3a3a40', background: '#151517', borderRadius: 8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div><strong>Prompt:</strong> <em>{myPrompt || '...'}</em></div>
        {secondsLeft !== null && (
          <div style={{ position:'relative', width:56, height:56 }}>
            <div style={{ position:'absolute', inset:0, borderRadius:999, background:`conic-gradient(#34d399 ${Math.max(0, Math.min(1, (secondsLeft || 0)/(timers.drawSeconds||1)))*360}deg, #2a2a2a 0deg)`, boxShadow:'0 4px 12px rgba(0,0,0,0.35)' }} />
            <div style={{ position:'absolute', inset:6, borderRadius:999, background:'#0f0f10', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800 }}>
              <span style={{ fontSize:16 }}>{secondsLeft}</span>
            </div>
          </div>
        )}
      </div>

      {/* Main grid: left players, center canvas, right tools */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px,300px) minmax(640px,1fr) minmax(240px,320px)', gap: 18, alignItems: 'start' }}>
        {/* Left: players and status */}
        <div ref={leftPanelRef} style={{ border: '1px solid #3a3a40', background:'#151517', padding: 12, borderRadius: 12, minHeight: canvasBoxHeight, boxSizing:'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontWeight: 600 }}>Players</div>
            <button
              onClick={leaveGame}
              style={{
                background: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              Leave Game
            </button>
          </div>
          
          {/* Show notifications */}
          {notifications.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  style={{
                    background: '#ffc107',
                    color: '#000',
                    padding: '6px 8px',
                    borderRadius: 4,
                    fontSize: 12,
                    marginBottom: 4,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    animation: 'slideIn 0.3s ease-out'
                  }}
                >
                  <span>{notification.message}</span>
                  <button
                    onClick={() => removeNotification(notification.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#000',
                      cursor: 'pointer',
                      fontSize: 14,
                      marginLeft: 8,
                      padding: 0
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              {notifications.length > 1 && (
                <button
                  onClick={clearNotifications}
                  style={{
                    background: 'transparent',
                    color: '#888',
                    border: '1px solid #444',
                    borderRadius: 4,
                    padding: '2px 6px',
                    fontSize: 10,
                    cursor: 'pointer'
                  }}
                >
                  Clear All
                </button>
              )}
            </div>
          )}
          
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(() => {
              const filteredPlayers = players.filter(p => {
                // Debug each player filtering decision
                const shouldShow = (() => {
                  // If there's no active game, show all players
                  if (!activeGameStatus) {
                    return true
                  }
                  // If there's an active game but no activeGamePlayers array, fallback to showing all players
                  if (!activeGamePlayers) {
                    return true
                  }
                  // If there's an active game with participants (even if empty), only show active participants
                  return activeGamePlayers.includes(p.id)
                })()
                return shouldShow
              })
              
              
              return filteredPlayers.map((p) => (
                <li key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', padding: '6px 4px' }}>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:8, minWidth:0 }}>
                    <Avatar avatar={p.avatar} />
                    <span style={{ overflow:'hidden', textOverflow:'ellipsis' }}>{p.name}</span>
                  </span>
                {submittedIds.has(p.id) ? (
                  <span title="Submitted" style={{ color: '#34d399', display: 'inline-flex', alignItems: 'center', gap:6, fontSize: 12, padding:'2px 8px', border:'1px solid #1f3d2b', background:'#132a1e', borderRadius:999, whiteSpace:'nowrap' }}>Submitted ✓</span>
                ) : (
                  <span title="Pending" style={{ color: '#888', fontSize: 12, padding:'2px 8px', border:'1px solid #2a2a2f', borderRadius:999, whiteSpace:'nowrap' }}>Pending</span>
                )}
                </li>
              ))
            })()}
          </ul>
        </div>

        {/* Center: canvas and submit button + tiny doodle hints */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ border: '1px solid #3a3a40', background:'#0f0f10', padding: 12, borderRadius: 14, boxShadow:'0 10px 26px rgba(0,0,0,0.35)', width:'100%', boxSizing:'border-box', overflow:'hidden' }}>
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseLeave}
              onWheel={onWheel}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              style={{ border: '1px solid #2a2a2f', background: '#1b1b1f', borderRadius:10, cursor: cursorStyle as any, width: '100%', height: 'auto', display:'block', transform:`translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin:'0 0' }}
            />
          </div>
          <div style={{ marginTop: 8, display:'flex', gap:12, alignItems:'center', justifyContent:'center', color:'#9ca3af' }}>
            <span>Zoom: {(zoom*100)|0}%</span>
            <button onClick={() => { setZoom(1); setPan({x:0,y:0}) }}>Reset view</button>
          </div>
          <div style={{ marginTop: 8, display:'flex', gap:8, alignItems:'center', justifyContent:'center' }}>
            {submitted ? (
              <button onClick={async () => {
                if (!roomCode || !sessionToken) return
                setSubmitting(true)
                try {
                  await http.delete(`/api/rooms/${roomCode}/drawings`, { params: { token: sessionToken } })
                  setSubmitted(false)
                } finally { setSubmitting(false) }
              }} disabled={submitting}>
                Edit
              </button>
            ) : (
              <button className="btn-primary" onClick={upload} disabled={submitting || submitted}>{submitting ? 'Submitting…' : submitted ? 'Submitted' : 'Submit'}</button>
            )}
            <button onClick={() => clearCanvas()}>Clear</button>
            <span style={{ color:'#9ca3af', fontSize:12 }}>Pro tip: Try shapes + bucket for quick fills. Surprise the imposter!</span>
          </div>
        </div>

        {/* Right: tools */}
        <div ref={rightPanelRef} style={{ border: '1px solid #3a3a40', background:'#151517', padding: 14, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 12, minHeight: canvasBoxHeight, boxSizing:'border-box' }}>
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
              <button title="Stamp" onClick={() => setTool('stamp')} aria-pressed={tool==='stamp'} style={{ padding: 6, border: tool==='stamp'?'2px solid #fff':'1px solid #444', background:'#222', borderRadius: 6 }}>★</button>
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
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Stamps</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:6 }}>
              {['⭐️','👀','🎩','✨','😂'].map(s => (
                <button key={s} onClick={() => { setStamp(s); setTool('stamp') }} aria-pressed={stamp===s} style={{ padding:6, border: stamp===s?'2px solid #fff':'1px solid #444', background:'#222', borderRadius:6 }}>{s}</button>
              ))}
            </div>
            <div style={{ marginTop:6, display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:6 }}>
              {[24,32,40,56].map(sz => (
                <button key={sz} onClick={() => setStampSize(sz)} aria-pressed={stampSize===sz} style={{ padding:6, border: stampSize===sz?'2px solid #fff':'1px solid #444', background:'#222', borderRadius:6 }}>{sz}px</button>
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
