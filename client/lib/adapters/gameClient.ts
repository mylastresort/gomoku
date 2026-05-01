import { io, Socket } from "socket.io-client"
import type { GameMode } from "../gomoku/types"

export type ConnectionStatus = "connecting" | "connected" | "offline"

// Event payloads from backend
export interface GameStartPayload {
  board_size: number
  mode: "PvP" | "PvE" | "EvE"
}

export interface PlayerMovePayload {
  x: number
  y: number
}

export interface BoardCellPayload {
  x: number
  y: number
  player_id: "White" | "Black" | null
}

export interface GameStartedPayload {
  room: string
}

export interface GameWinPayload {
  player_id: "White" | "Black"
  seq: Array<[number, number]> | null
  is_by_five?: boolean
}

export interface GameEndedPayload {
  message: string
}

export interface GameTurnPayload {
  currentPlayer: "White" | "Black"
  forbiddenSequences: Array<[number, number]>
  turn: number
}

export interface EventErrorPayload {
  message: string
}

export interface RoomErrorPayload {
  message: string
}

export interface MoveHintPayload {
  x: number
  y: number
  player_id: "White" | "Black"
}

// Event handlers type
export interface GameEventHandlers {
  onGameStarted?: (payload: GameStartedPayload) => void
  onBoardCell?: (payload: BoardCellPayload) => void
  onGameTurn?: (payload: GameTurnPayload) => void
  onGameWin?: (payload: GameWinPayload) => void
  onGameEnded?: (payload: GameEndedPayload) => void
  onMoveHint?: (payload: MoveHintPayload) => void
  onPlayerLeave?: () => void
  onEventError?: (error: string) => void
  onRoomError?: (error: string) => void
  onConnect?: () => void
  onDisconnect?: () => void
}

class GameClient {
  private socket: Socket | null = null
  private status: ConnectionStatus = "offline"
  private statusListeners: ((status: ConnectionStatus) => void)[] = []
  private eventHandlers: GameEventHandlers = {}
  private serverUrl: string

  constructor() {
    // NEXT_PUBLIC_ env vars are available on both server and client
    this.serverUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:8000"
  }

  /**
   * Connect to the game server via WebSocket
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Only connect in browser environment
      if (typeof window === "undefined") {
        console.log("Skipping connection - server side render")
        reject(new Error("Cannot connect on server side"))
        return
      }

      if (this.socket?.connected) {
        console.log("Already connected")
        resolve()
        return
      }

      console.log("Initiating connection to:", this.serverUrl)
      this.status = "connecting"
      this.notifyStatusListeners()

      this.socket = io(this.serverUrl, {
        transports: ["websocket"],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      })

      // Connection event handlers
      this.socket.on("connect", () => {
        console.log("✓ Connected to game server")
        this.status = "connected"
        this.notifyStatusListeners()
        this.eventHandlers.onConnect?.()
        
        // Test event emission
        console.log("Sending test event to verify connection...")
        this.socket?.emit("test-event", { test: "data" })
        
        resolve()
      })

      this.socket.on("disconnect", () => {
        console.log("✗ Disconnected from game server")
        this.status = "offline"
        this.notifyStatusListeners()
        this.eventHandlers.onDisconnect?.()
      })

      this.socket.on("connect_error", (error) => {
        console.error("✗ Connection error:", error)
        this.status = "offline"
        this.notifyStatusListeners()
        reject(error)
      })

      // Register game event handlers
      this.registerGameEvents()
    })
  }

  /**
   * Register all game-specific event handlers
   */
  private registerGameEvents(): void {
    if (!this.socket) return

    // game-started event
    this.socket.on("game-started", (payload: GameStartedPayload) => {
      console.log("Game started:", payload)
      this.eventHandlers.onGameStarted?.(payload)
    })

    // board-cell event - when a move is made
    this.socket.on("board-cell", (payload: BoardCellPayload) => {
      console.log("Board cell update:", payload)
      this.eventHandlers.onBoardCell?.(payload)
    })

    // game-turn event - when turn changes
    this.socket.on("game-turn", (payload: GameTurnPayload) => {
      console.log("Game turn:", payload)
      this.eventHandlers.onGameTurn?.(payload)
    })

    // game-win event - when a player wins
    this.socket.on("game-win", (payload: GameWinPayload) => {
      console.log("Game win:", payload)
      this.eventHandlers.onGameWin?.(payload)
    })

    // game-ended event - when the game ends
    this.socket.on("game-ended", (payload: string) => {
      console.log("Game ended:", payload)
      this.eventHandlers.onGameEnded?.({ message: payload })
    })

    // move-hint event - AI suggested move for current turn
    this.socket.on("move-hint", (payload: MoveHintPayload) => {
      console.log("Move hint:", payload)
      this.eventHandlers.onMoveHint?.(payload)
    })

    // player-leave event - when a player leaves
    this.socket.on("player-leave", () => {
      console.log("Player left")
      this.eventHandlers.onPlayerLeave?.()
    })

    // event-error event - errors from event processing
    this.socket.on("event-error", (error: string) => {
      console.error("Event error:", error)
      this.eventHandlers.onEventError?.(error)
    })

    // room-error event - errors from room operations
    this.socket.on("room-error", (error: string) => {
      console.error("Room error:", error)
      this.eventHandlers.onRoomError?.(error)
    })
  }

  /**
   * Disconnect from the game server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.status = "offline"
    this.notifyStatusListeners()
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return this.status
  }

  /**
   * Subscribe to connection status changes
   */
  onStatusChange(callback: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.push(callback)
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== callback)
    }
  }

  /**
   * Set event handlers for game events
   */
  setEventHandlers(handlers: GameEventHandlers): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers }
  }

  private notifyStatusListeners(): void {
    this.statusListeners.forEach((listener) => listener(this.status))
  }

  /**
   * Start a new game
   */
  async startGame(boardSize: number, mode: GameMode): Promise<void> {
    if (!this.socket?.connected) {
      throw new Error("Not connected to server")
    }

    const backendMode: GameStartPayload["mode"] =
      mode === "ai" ? "PvE" : "PvP"

    const payload = {
      board_size: boardSize,
      mode: backendMode,
    } as GameStartPayload

    console.log("Sending game-start event:", payload)
    
    // Emit without acknowledgment callback
    this.socket.emit("game-start", payload)
    console.log("game-start event emitted")
  }

  /**
   * Make a move in the game
   */
  async makeMove(x: number, y: number): Promise<void> {
    if (!this.socket?.connected) {
      throw new Error("Not connected to server")
    }

    const payload = {
      x,
      y,
    } as PlayerMovePayload

    console.log("Sending player-move event:", payload)
    
    // Emit without acknowledgment callback
    this.socket.emit("player-move", payload)
    console.log("player-move event emitted")
  }

  /**
   * Request to undo the last move
   */
  async requestUndo(): Promise<void> {
    if (!this.socket?.connected) {
      throw new Error("Not connected to server")
    }

    this.socket.emit("undo", {})
  }

  /**
   * Request a move hint for the current player's turn
   */
  async requestMoveHint(): Promise<void> {
    if (!this.socket?.connected) {
      throw new Error("Not connected to server")
    }

    this.socket.emit("move-hint-request", {})
  }

  /**
   * Leave the current game
   */
  async leaveGame(): Promise<void> {
    if (!this.socket?.connected) {
      throw new Error("Not connected to server")
    }

    this.socket.emit("player-leave", {})
  }

  /**
   *    (response: any) => {
          if (response?.error) {
            reject(new Error(response.error))
          } else {
            resolve()
          }
        }
      )
    })
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false
  }
}

export const gameClient = new GameClient()

