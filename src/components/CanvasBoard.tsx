import { PointerEvent, useEffect, useRef, useState } from 'react'
import { clearRoundStrokes, createStrokeId, listenToRoundStrokes, saveStroke } from '../firebase/strokes'
import type { CanvasStroke, StrokePoint } from '../game/types'

type CanvasBoardProps = {
  roomCode: string
  roundId: string
  currentArtistId?: string
  currentUserId?: string
}

const CANVAS_BG = '#fbfaf7'
const DEFAULT_COLOR = '#101827'
const DEFAULT_WIDTH = 5
const FIREBASE_SYNC_MS = 55
const COLORS = ['#101827', '#d93d4f', '#308de4', '#25a85a', '#ffd447', '#7c3aed']

type CanvasTool = 'brush' | 'eraser' | 'fill'

export function CanvasBoard({
  roomCode,
  roundId,
  currentArtistId,
  currentUserId,
}: CanvasBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const strokesRef = useRef<CanvasStroke[]>([])
  const activeStrokeRef = useRef<CanvasStroke | null>(null)
  const activeStrokeIdRef = useRef<string | null>(null)
  const lastSyncRef = useRef(0)
  const originalBodyOverflowRef = useRef<string | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [tool, setTool] = useState<CanvasTool>('brush')
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [width, setWidth] = useState(DEFAULT_WIDTH)

  const canDraw = Boolean(currentUserId && currentUserId === currentArtistId)

  useEffect(() => {
    const unsubscribe = listenToRoundStrokes(roomCode, roundId, (strokes) => {
      strokesRef.current = strokes
      redrawCanvas()
    })

    return unsubscribe
  }, [roomCode, roundId])

  useEffect(() => {
    const handleResize = () => redrawCanvas()
    window.addEventListener('resize', handleResize)
    redrawCanvas()

    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    return () => unlockPageScroll()
  }, [])

  function redrawCanvas(extraStroke?: CanvasStroke | null) {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const rect = canvas.getBoundingClientRect()
    const scale = window.devicePixelRatio || 1

    if (canvas.width !== Math.floor(rect.width * scale) || canvas.height !== Math.floor(rect.height * scale)) {
      canvas.width = Math.floor(rect.width * scale)
      canvas.height = Math.floor(rect.height * scale)
    }

    context.setTransform(scale, 0, 0, scale, 0, 0)
    context.clearRect(0, 0, rect.width, rect.height)
    context.fillStyle = CANVAS_BG
    context.fillRect(0, 0, rect.width, rect.height)

    for (const stroke of strokesRef.current) {
      drawStroke(context, stroke, rect.width, rect.height)
    }

    if (extraStroke) {
      drawStroke(context, extraStroke, rect.width, rect.height)
    }
  }

  function getCanvasPoint(event: PointerEvent<HTMLCanvasElement>): StrokePoint {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: clamp((event.clientX - rect.left) / rect.width),
      y: clamp((event.clientY - rect.top) / rect.height),
    }
  }

  async function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (!canDraw || !currentUserId) return

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    lockPageScroll(event.pointerType)

    const strokeId = createStrokeId(roomCode, roundId)
    if (!strokeId) return

    if (tool === 'fill') {
      const fillStroke: CanvasStroke = {
        uid: currentUserId,
        kind: 'fill',
        points: [],
        color,
        width,
        createdAt: Date.now(),
      }

      redrawCanvas(fillStroke)
      await saveStroke(roomCode, roundId, strokeId, fillStroke)
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      unlockPageScroll()
      return
    }

    const stroke: CanvasStroke = {
      uid: currentUserId,
      kind: 'stroke',
      points: [getCanvasPoint(event)],
      color: tool === 'eraser' ? CANVAS_BG : color,
      width: tool === 'eraser' ? Math.max(12, width * 2) : width,
      createdAt: Date.now(),
    }

    activeStrokeIdRef.current = strokeId
    activeStrokeRef.current = stroke
    lastSyncRef.current = Date.now()
    setIsDrawing(true)
    redrawCanvas(stroke)
    await saveStroke(roomCode, roundId, strokeId, stroke)
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (!canDraw || !isDrawing || !activeStrokeRef.current || !activeStrokeIdRef.current) return

    event.preventDefault()
    const nextPoint = getCanvasPoint(event)
    const activeStroke = activeStrokeRef.current
    const previousPoint = activeStroke.points[activeStroke.points.length - 1]

    if (previousPoint && distanceBetween(previousPoint, nextPoint) < 0.003) return

    activeStroke.points = [...activeStroke.points, nextPoint]
    redrawCanvas(activeStroke)

    const now = Date.now()
    if (now - lastSyncRef.current >= FIREBASE_SYNC_MS) {
      lastSyncRef.current = now
      void saveStroke(roomCode, roundId, activeStrokeIdRef.current, activeStroke)
    }
  }

  async function finishStroke(event?: PointerEvent<HTMLCanvasElement>) {
    if (event && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const strokeId = activeStrokeIdRef.current
    const stroke = activeStrokeRef.current

    setIsDrawing(false)
    activeStrokeIdRef.current = null
    activeStrokeRef.current = null
    unlockPageScroll()

    if (strokeId && stroke && stroke.points.length > 1) {
      await saveStroke(roomCode, roundId, strokeId, stroke)
    }
  }

  async function handleClearCanvas() {
    if (!canDraw) return
    await clearRoundStrokes(roomCode, roundId)
  }

  function lockPageScroll(pointerType: string) {
    if (pointerType !== 'touch') return
    if (originalBodyOverflowRef.current !== null) return
    originalBodyOverflowRef.current = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }

  function unlockPageScroll() {
    if (originalBodyOverflowRef.current === null) return
    document.body.style.overflow = originalBodyOverflowRef.current
    originalBodyOverflowRef.current = null
  }

  return (
    <section className="canvas-board" aria-label="Drawing canvas">
      <div className="canvas-toolbar">
        <div>
          <p className="section-label">Canvas</p>
          <span>{canDraw ? 'Your turn to draw' : 'Watch the artist draw'}</span>
        </div>
        {canDraw ? (
          <button type="button" onClick={handleClearCanvas}>
            Clear
          </button>
        ) : null}
      </div>
      {canDraw ? (
        <div className="canvas-tools" aria-label="Drawing tools">
          <div className="tool-button-group" role="group" aria-label="Tool">
            <button
              type="button"
              className={tool === 'brush' ? 'tool-button tool-button--active' : 'tool-button'}
              onClick={() => setTool('brush')}
            >
              Brush
            </button>
            <button
              type="button"
              className={tool === 'eraser' ? 'tool-button tool-button--active' : 'tool-button'}
              onClick={() => setTool('eraser')}
            >
              Eraser
            </button>
            <button
              type="button"
              className={tool === 'fill' ? 'tool-button tool-button--active' : 'tool-button'}
              onClick={() => setTool('fill')}
            >
              Fill
            </button>
          </div>
          <div className="color-swatches" aria-label="Brush color">
            {COLORS.map((swatch) => (
              <button
                key={swatch}
                type="button"
                className={color === swatch ? 'color-swatch color-swatch--active' : 'color-swatch'}
                style={{ backgroundColor: swatch }}
                aria-label={`Use color ${swatch}`}
                onClick={() => {
                  setColor(swatch)
                  if (tool === 'eraser') setTool('brush')
                }}
              />
            ))}
            <input
              className="color-picker"
              type="color"
              value={color}
              aria-label="Custom color"
              onChange={(event) => {
                setColor(event.target.value)
                if (tool === 'eraser') setTool('brush')
              }}
            />
          </div>
          <label className="width-control">
            Width
            <input
              type="range"
              min="2"
              max="18"
              value={width}
              onChange={(event) => setWidth(Number(event.target.value))}
            />
          </label>
        </div>
      ) : null}
      <canvas
        ref={canvasRef}
        className={canDraw ? 'drawing-canvas drawing-canvas--active' : 'drawing-canvas'}
        aria-label={canDraw ? 'Draw on canvas' : 'Live drawing canvas'}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
      />
    </section>
  )
}

function drawStroke(
  context: CanvasRenderingContext2D,
  stroke: CanvasStroke,
  canvasWidth: number,
  canvasHeight: number,
) {
  if (stroke.kind === 'fill') {
    context.fillStyle = stroke.color
    context.fillRect(0, 0, canvasWidth, canvasHeight)
    return
  }

  const points = stroke.points
  if (points.length === 0) return

  context.strokeStyle = stroke.color
  context.fillStyle = stroke.color
  context.lineWidth = stroke.width
  context.lineCap = 'round'
  context.lineJoin = 'round'

  if (points.length === 1) {
    context.beginPath()
    context.arc(points[0].x * canvasWidth, points[0].y * canvasHeight, stroke.width / 2, 0, Math.PI * 2)
    context.fill()
    return
  }

  context.beginPath()
  context.moveTo(points[0].x * canvasWidth, points[0].y * canvasHeight)

  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index]
    const next = points[index + 1]
    const midX = ((current.x + next.x) / 2) * canvasWidth
    const midY = ((current.y + next.y) / 2) * canvasHeight
    context.quadraticCurveTo(current.x * canvasWidth, current.y * canvasHeight, midX, midY)
  }

  const last = points[points.length - 1]
  context.lineTo(last.x * canvasWidth, last.y * canvasHeight)
  context.stroke()
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value))
}

function distanceBetween(a: StrokePoint, b: StrokePoint) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}
