import { onUnmounted, watch } from 'vue'
import { useSettingsStore } from '../stores/settings'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  rotation: number
  rotationSpeed: number
  life: number
  maxLife: number
  shape: 'star' | 'circle' | 'ring'
}

const COLORS = [
  '#FFD700', // gold
  '#FFA500', // orange
  '#FF69B4', // hot pink
  '#A78BFA', // violet
  '#6366F1', // indigo
  '#FB923C', // amber
  '#F472B6', // pink
  '#FBBF24', // yellow
  '#34D399', // emerald
]

const PARTICLE_COUNT = 55
const DURATION = 1800

function createParticles(cx: number, cy: number): Particle[] {
  const particles: Particle[] = []
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = (Math.PI * 2 * i) / PARTICLE_COUNT + (Math.random() - 0.5) * 0.5
    const speed = 2 + Math.random() * 6
    const shapes: Particle['shape'][] = ['star', 'circle', 'ring']
    particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2, // bias upward
      size: 3 + Math.random() * 5,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.3,
      life: 0,
      maxLife: DURATION * (0.6 + Math.random() * 0.4),
      shape: shapes[Math.floor(Math.random() * shapes.length)],
    })
  }
  return particles
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number) {
  const spikes = 5
  const outerR = size
  const innerR = size * 0.4
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.beginPath()
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR
    const angle = (Math.PI / spikes) * i - Math.PI / 2
    if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r)
    else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r)
  }
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

export function configureCelebrationCanvas(
  canvas: HTMLCanvasElement,
  dpr: number,
  viewportWidth = window.innerWidth,
  viewportHeight = window.innerHeight,
): CanvasRenderingContext2D {
  canvas.width = viewportWidth * dpr
  canvas.height = viewportHeight * dpr
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:999999'

  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  return ctx
}

function runAnimation(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, cx: number, cy: number) {
  const particles = createParticles(cx, cy)
  const start = performance.now()

  function frame(now: number) {
    const elapsed = now - start
    if (elapsed > DURATION) {
      canvas.remove()
      return
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    for (const p of particles) {
      p.life = elapsed
      if (p.life > p.maxLife) continue

      p.x += p.vx
      p.y += p.vy
      p.vy += 0.12 // gravity
      p.vx *= 0.985 // drag
      p.rotation += p.rotationSpeed

      const alpha = 1 - p.life / p.maxLife
      ctx.globalAlpha = alpha

      ctx.fillStyle = p.color
      ctx.strokeStyle = p.color
      ctx.lineWidth = 1.5

      if (p.shape === 'star') {
        drawStar(ctx, p.x, p.y, p.size, p.rotation)
      } else if (p.shape === 'circle') {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * 0.6, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * 0.7, 0, Math.PI * 2)
        ctx.stroke()
      }
    }

    ctx.globalAlpha = 1
    requestAnimationFrame(frame)
  }

  requestAnimationFrame(frame)
}

function celebrate(button: HTMLElement) {
  const rect = button.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2

  const canvas = document.createElement('canvas')
  const dpr = window.devicePixelRatio || 1
  const ctx = configureCelebrationCanvas(canvas, dpr)
  document.body.appendChild(canvas)

  runAnimation(ctx, canvas, cx, cy)
}

export function useStarCelebration() {
  const settings = useSettingsStore()

  function handleClick(e: Event) {
    const target = e.target as HTMLElement
    if (!target) return

    // Find the closest form — GitHub star is always a form submission
    const form = target.closest('form') as HTMLFormElement | null
    if (!form) return

    const action = form.getAttribute('action') || ''
    // Match /{owner}/{repo}/star (starring action, not unstar)
    if (!/\/[^/]+\/[^/]+\/star$/.test(action)) return

    // Find the button for positioning
    const btn = target.closest('button') || form.querySelector('button')
    if (btn) celebrate(btn)
  }

  watch(
    () => settings.celebrateStar,
    (enabled) => {
      if (enabled) {
        document.addEventListener('click', handleClick, true)
        return
      }
      document.removeEventListener('click', handleClick, true)
    },
    { immediate: true },
  )

  onUnmounted(() => {
    document.removeEventListener('click', handleClick, true)
  })
}
