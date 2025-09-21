import { useEffect, useMemo, useState } from 'react'
import { http } from '../api/http'
import { useRoomStore } from '../store/useRoomStore'

interface Avatar {
  color: string
  eyes: 'dot' | 'happy' | 'wink'
  mouth: 'line' | 'smile' | 'open'
}

const defaultAvatar: Avatar = { color: '#60a5fa', eyes: 'dot', mouth: 'line' }

export default function Menu({ onEnterLobby }: { onEnterLobby: () => void }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [showCode, setShowCode] = useState(true)
  const [avatar, setAvatar] = useState<Avatar>(defaultAvatar)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>('')
  const { setRoom, setSelf, sessionToken } = useRoomStore()

  // Autofill room from URL (?room=CODE)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const c = params.get('room')
    if (c) setCode(c.toUpperCase())
  }, [])

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
    }
  }

  const copyCode = async () => {
    if (!code) return
    await navigator.clipboard.writeText(code.toUpperCase())
  }

  const AvatarPreview = () => {
    // simple SVG avatar
    return (
      <svg width={80} height={80} viewBox="0 0 80 80" style={{ background: 'transparent' }}>
        <circle cx={40} cy={40} r={32} fill={avatar.color} />
        {/* eyes */}
        {avatar.eyes === 'dot' && (
          <>
            <circle cx={28} cy={35} r={3} fill="#111" />
            <circle cx={52} cy={35} r={3} fill="#111" />
          </>
        )}
        {avatar.eyes === 'happy' && (
          <>
            <path d="M24 35 q4 -4 8 0" stroke="#111" strokeWidth={3} fill="none" />
            <path d="M48 35 q4 -4 8 0" stroke="#111" strokeWidth={3} fill="none" />
          </>
        )}
        {avatar.eyes === 'wink' && (
          <>
            <line x1={25} y1={35} x2={33} y2={35} stroke="#111" strokeWidth={3} />
            <circle cx={52} cy={35} r={3} fill="#111" />
          </>
        )}
        {/* mouth */}
        {avatar.mouth === 'line' && <line x1={30} y1={52} x2={50} y2={52} stroke="#111" strokeWidth={3} />}
        {avatar.mouth === 'smile' && <path d="M30 50 q10 10 20 0" stroke="#111" strokeWidth={3} fill="none" />}
        {avatar.mouth === 'open' && <circle cx={40} cy={52} r={5} fill="#111" />}
      </svg>
    )
  }

  return (
    <div style={{ maxWidth: 720, margin: '3rem auto', display: 'grid', gap: '1rem' }}>
      <h2 style={{ marginBottom: 0 }}>Artzooka</h2>

      {/* Profile */}
      <div style={{ border: '1px solid #3a3a40', background:'#151517', borderRadius: 8, padding: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Profile</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 12, alignItems: 'center' }}>
          <AvatarPreview />
          <div style={{ display: 'grid', gap: 8 }}>
            <input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label>Color:</label>
              <input type="color" value={avatar.color} onChange={(e) => setAvatar({ ...avatar, color: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label>Eyes:</label>
              {(['dot','happy','wink'] as const).map(e => (
                <button key={e} onClick={() => setAvatar({ ...avatar, eyes: e })} aria-pressed={avatar.eyes===e}>{e}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label>Mouth:</label>
              {(['line','smile','open'] as const).map(m => (
                <button key={m} onClick={() => setAvatar({ ...avatar, mouth: m })} aria-pressed={avatar.mouth===m}>{m}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Play */}
      <div style={{ border: '1px solid #3a3a40', background:'#151517', borderRadius: 8, padding: 12, display: 'grid', gap: 12 }}>
        <div style={{ fontWeight: 600 }}>Play</div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={createRoom} disabled={busy}>Create room</button>
          <span style={{ color: '#9ca3af' }}>Create and share the code with friends</span>
        </div>

        <div>
          <div style={{ marginBottom: 6 }}>Join room</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 8, alignItems: 'center' }}>
            <input placeholder="Room code" value={code} type={showCode ? 'text' : 'password'} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g,''))} />
            <button type="button" title={showCode?'Hide code':'Show code'} onClick={() => setShowCode(!showCode)}>
              {showCode ? '🙈' : '👁️'}
            </button>
            <button type="button" title="Copy" onClick={async () => code && await navigator.clipboard.writeText(code.toUpperCase())}>Copy</button>
            <button type="button" onClick={joinRoom} disabled={busy}>Join</button>
          </div>
          {error && <div style={{ marginTop: 8, color: '#f87171' }}>{error}</div>}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <a href="#" style={{ color: '#9ca3af' }}>Exit</a>
      </div>
    </div>
  )
}
