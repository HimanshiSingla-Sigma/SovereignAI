import { wsUrl } from './env'
import type { TelemetryPoint } from '@/types/api'

export type WsStatus = 'connecting' | 'open' | 'closed' | 'error'

type PointListener = (point: TelemetryPoint) => void
type StatusListener = (status: WsStatus) => void

interface Channel {
  socket: WebSocket | null
  status: WsStatus
  points: Set<PointListener>
  statuses: Set<StatusListener>
  retries: number
  retryTimer: number | null
  closing: boolean
}

/**
 * Single WebSocket manager for the whole app.
 *
 * One socket per machine id, shared by every subscriber (Telemetry page, God
 * View beacons, the emergency watcher). The socket opens on the first
 * subscriber and closes on the last, with capped exponential-backoff reconnect
 * so a backend restart on the plant LAN heals without a page reload.
 */
class TelemetrySocketManager {
  private channels = new Map<string, Channel>()

  private channel(machineId: string): Channel {
    let ch = this.channels.get(machineId)
    if (!ch) {
      ch = { socket: null, status: 'closed', points: new Set(), statuses: new Set(), retries: 0, retryTimer: null, closing: false }
      this.channels.set(machineId, ch)
    }
    return ch
  }

  private setStatus(ch: Channel, status: WsStatus) {
    ch.status = status
    ch.statuses.forEach((fn) => fn(status))
  }

  private open(machineId: string) {
    const ch = this.channel(machineId)
    if (ch.socket && (ch.socket.readyState === WebSocket.OPEN || ch.socket.readyState === WebSocket.CONNECTING)) return

    ch.closing = false
    this.setStatus(ch, 'connecting')

    let socket: WebSocket
    try {
      socket = new WebSocket(wsUrl(`/ws/telemetry/${encodeURIComponent(machineId)}`))
    } catch {
      this.setStatus(ch, 'error')
      this.scheduleReconnect(machineId)
      return
    }
    ch.socket = socket

    socket.onopen = () => {
      ch.retries = 0
      this.setStatus(ch, 'open')
    }

    socket.onmessage = (ev) => {
      try {
        const point = JSON.parse(ev.data as string) as TelemetryPoint
        // The simulator returns {} for an unknown machine id.
        if (point && typeof point.temperature === 'number') {
          ch.points.forEach((fn) => fn(point))
        }
      } catch {
        /* a malformed frame must not tear down the stream */
      }
    }

    socket.onerror = () => {
      if (ch.status !== 'open') this.setStatus(ch, 'error')
    }

    socket.onclose = () => {
      ch.socket = null
      if (ch.closing || ch.points.size === 0) {
        this.setStatus(ch, 'closed')
        return
      }
      this.setStatus(ch, 'closed')
      this.scheduleReconnect(machineId)
    }
  }

  private scheduleReconnect(machineId: string) {
    const ch = this.channel(machineId)
    if (ch.retryTimer !== null || ch.points.size === 0) return
    const delay = Math.min(1000 * 2 ** ch.retries, 15_000)
    ch.retries += 1
    ch.retryTimer = window.setTimeout(() => {
      ch.retryTimer = null
      if (ch.points.size > 0) this.open(machineId)
    }, delay)
  }

  /** Subscribe to a machine's live stream. Returns an unsubscribe function. */
  subscribe(machineId: string, onPoint: PointListener, onStatus?: StatusListener): () => void {
    const ch = this.channel(machineId)
    ch.points.add(onPoint)
    if (onStatus) {
      ch.statuses.add(onStatus)
      onStatus(ch.status)
    }
    this.open(machineId)

    return () => {
      ch.points.delete(onPoint)
      if (onStatus) ch.statuses.delete(onStatus)
      if (ch.points.size === 0) {
        ch.closing = true
        if (ch.retryTimer !== null) {
          window.clearTimeout(ch.retryTimer)
          ch.retryTimer = null
        }
        ch.socket?.close()
        ch.socket = null
        ch.retries = 0
      }
    }
  }

  /** Tear every channel down (used on sign-out). */
  closeAll() {
    this.channels.forEach((ch) => {
      ch.closing = true
      ch.points.clear()
      ch.statuses.clear()
      if (ch.retryTimer !== null) window.clearTimeout(ch.retryTimer)
      ch.retryTimer = null
      ch.socket?.close()
      ch.socket = null
    })
    this.channels.clear()
  }
}

export const telemetrySockets = new TelemetrySocketManager()
