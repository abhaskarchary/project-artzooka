export function Avatar({ avatar, size = 24 }: { avatar?: string; size?: number }) {
  try {
    if (!avatar) return null
    const parsed = JSON.parse(avatar) as { color?: string; eyes?: string; mouth?: string }
    const color = parsed.color || '#60a5fa'
    return (
      <svg width={size} height={size} viewBox="0 0 80 80" style={{ borderRadius: '50%', flex: '0 0 auto' }}>
        <circle cx={40} cy={40} r={32} fill={color} />
        {/* simple default face; can expand to variants later */}
        <circle cx={28} cy={35} r={3} fill="#111" />
        <circle cx={52} cy={35} r={3} fill="#111" />
        <line x1={30} y1={52} x2={50} y2={52} stroke="#111" strokeWidth={3} />
      </svg>
    )
  } catch {
    return null
  }
}


