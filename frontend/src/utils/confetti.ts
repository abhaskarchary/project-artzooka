// Lightweight confetti without dependencies
export function fireConfetti(durationMs = 1200, count = 28) {
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.inset = '0'
  container.style.pointerEvents = 'none'
  container.style.overflow = 'hidden'
  document.body.appendChild(container)

  const colors = ['#60a5fa', '#f87171', '#fbbf24', '#34d399', '#a78bfa', '#f472b6']
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('span')
    piece.style.position = 'absolute'
    piece.style.left = Math.random() * 100 + 'vw'
    piece.style.top = '-10px'
    piece.style.width = '8px'
    piece.style.height = '14px'
    piece.style.background = colors[Math.floor(Math.random() * colors.length)]
    piece.style.transform = `rotate(${Math.random() * 360}deg)`
    piece.style.opacity = '0.9'
    piece.style.borderRadius = '2px'
    piece.style.transition = `transform ${durationMs}ms ease-out, top ${durationMs}ms ease-out, opacity ${durationMs}ms ease`
    container.appendChild(piece)
    requestAnimationFrame(() => {
      piece.style.top = '110vh'
      piece.style.transform = `translateX(${(Math.random() - 0.5) * 120}px) rotate(${Math.random() * 720}deg)`
      piece.style.opacity = '0.8'
    })
  }
  setTimeout(() => container.remove(), durationMs + 200)
}

export function playChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'triangle'
    o.frequency.value = 880
    o.connect(g)
    g.connect(ctx.destination)
    g.gain.setValueAtTime(0.0001, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35)
    o.start()
    o.stop(ctx.currentTime + 0.4)
  } catch {}
}


