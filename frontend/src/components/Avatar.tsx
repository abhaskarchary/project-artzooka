export function Avatar({ avatar, size = 24 }: { avatar?: string; size?: number }) {
  try {
    if (!avatar) return null
    const a = JSON.parse(avatar) as { color?: string; eyes?: string; mouth?: string }
    const color = a.color || '#60a5fa'
    const stroke = '#111'
    const sw = 3
    return (
      <svg width={size} height={size} viewBox="0 0 80 80" style={{ borderRadius: '50%', flex: '0 0 auto', boxShadow:'0 2px 6px rgba(0,0,0,0.3)' }}>
        <circle cx={40} cy={40} r={32} fill={color} />
        {/* eyes */}
        {(!a.eyes || a.eyes === 'dot') && (<>
          <circle cx={28} cy={35} r={3} fill={stroke} />
          <circle cx={52} cy={35} r={3} fill={stroke} />
        </>)}
        {a.eyes === 'happy' && (<>
          <path d="M22 35 q6 -6 12 0" stroke={stroke} strokeWidth={sw} fill="none" />
          <path d="M46 35 q6 -6 12 0" stroke={stroke} strokeWidth={sw} fill="none" />
        </>)}
        {a.eyes === 'wink' && (<>
          <line x1={24} y1={35} x2={34} y2={35} stroke={stroke} strokeWidth={sw} />
          <circle cx={52} cy={35} r={3} fill={stroke} />
        </>)}
        {a.eyes === 'star' && (<>
          <path d="M28 33 l2 6 -6 -4h8l-6 4z" fill={stroke} />
          <path d="M52 33 l2 6 -6 -4h8l-6 4z" fill={stroke} />
        </>)}
        {a.eyes === 'sleepy' && (<>
          <path d="M24 35 q5 3 10 0" stroke={stroke} strokeWidth={sw} fill="none" />
          <path d="M46 35 q5 3 10 0" stroke={stroke} strokeWidth={sw} fill="none" />
        </>)}
        {a.eyes === 'angry' && (<>
          <line x1={24} y1={33} x2={32} y2={37} stroke={stroke} strokeWidth={sw} />
          <line x1={56} y1={33} x2={48} y2={37} stroke={stroke} strokeWidth={sw} />
        </>)}
        {a.eyes === 'hearts' && (<>
          <path d="M26 34 q2 -3 4 0 q2 -3 4 0 q-4 4 -4 4 q-4 -4 -4 -4" fill={stroke} />
          <path d="M50 34 q2 -3 4 0 q2 -3 4 0 q-4 4 -4 4 q-4 -4 -4 -4" fill={stroke} />
        </>)}
        {a.eyes === 'cross' && (<>
          <line x1={26} y1={33} x2={32} y2={39} stroke={stroke} strokeWidth={sw} />
          <line x1={32} y1={33} x2={26} y2={39} stroke={stroke} strokeWidth={sw} />
          <line x1={48} y1={33} x2={54} y2={39} stroke={stroke} strokeWidth={sw} />
          <line x1={54} y1={33} x2={48} y2={39} stroke={stroke} strokeWidth={sw} />
        </>)}
        {a.eyes === 'glasses' && (<>
          <circle cx={28} cy={35} r={6} stroke={stroke} strokeWidth={sw} fill="none" />
          <circle cx={52} cy={35} r={6} stroke={stroke} strokeWidth={sw} fill="none" />
          <line x1={34} y1={35} x2={46} y2={35} stroke={stroke} strokeWidth={sw} />
        </>)}
        {a.eyes === 'squint' && (<>
          <path d="M24 36 q5 -2 10 0" stroke={stroke} strokeWidth={sw} fill="none" />
          <path d="M46 36 q5 -2 10 0" stroke={stroke} strokeWidth={sw} fill="none" />
        </>)}
        {a.eyes === 'surprised' && (<>
          <circle cx={28} cy={35} r={4} stroke={stroke} strokeWidth={sw} fill="none" />
          <circle cx={52} cy={35} r={4} stroke={stroke} strokeWidth={sw} fill="none" />
        </>)}
        {a.eyes === 'shades' && (<>
          <rect x={22} y={32} width={36} height={8} fill={stroke} rx={2} />
        </>)}
        {/* mouth */}
        {(!a.mouth || a.mouth === 'line') && (<line x1={30} y1={52} x2={50} y2={52} stroke={stroke} strokeWidth={sw} />)}
        {a.mouth === 'smile' && (<path d="M30 50 q10 10 20 0" stroke={stroke} strokeWidth={sw} fill="none" />)}
        {a.mouth === 'open' && (<circle cx={40} cy={52} r={5} fill={stroke} />)}
        {a.mouth === 'frown' && (<path d="M30 56 q10 -10 20 0" stroke={stroke} strokeWidth={sw} fill="none" />)}
        {a.mouth === 'o' && (<circle cx={40} cy={52} r={4} stroke={stroke} strokeWidth={sw} fill="none" />)}
        {a.mouth === 'tongue' && (<>
          <path d="M32 50 q8 6 16 0" stroke={stroke} strokeWidth={sw} fill="none" />
          <path d="M36 50 q4 6 8 0" fill="#f87171" />
        </>)}
        {a.mouth === 'mustache' && (<>
          <path d="M32 50 q4 -4 8 0" stroke={stroke} strokeWidth={sw} fill="none" />
          <path d="M48 50 q-4 -4 -8 0" stroke={stroke} strokeWidth={sw} fill="none" />
        </>)}
        {a.mouth === 'grin' && (<path d="M28 50 q12 14 24 0" stroke={stroke} strokeWidth={sw} fill="none" />)}
        {a.mouth === 'smirk' && (<path d="M40 53 q10 -4 10 -1" stroke={stroke} strokeWidth={sw} fill="none" />)}
        {a.mouth === 'robot' && (<>
          <rect x={32} y={48} width={16} height={8} stroke={stroke} strokeWidth={sw} fill="none" />
          <line x1={36} y1={48} x2={36} y2={56} stroke={stroke} strokeWidth={2} />
          <line x1={40} y1={48} x2={40} y2={56} stroke={stroke} strokeWidth={2} />
          <line x1={44} y1={48} x2={44} y2={56} stroke={stroke} strokeWidth={2} />
        </>)}
        {a.mouth === 'zigzag' && (<path d="M30 52 l6 4 l6 -4 l6 4" stroke={stroke} strokeWidth={sw} fill="none" />)}
        {a.mouth === 'beard' && (<path d="M28 52 q12 18 24 0" stroke={stroke} strokeWidth={sw} fill="none" />)}
      </svg>
    )
  } catch {
    return null
  }
}


