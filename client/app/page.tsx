"use client"

import * as React from "react"
import { Header } from "@/components/gomoku/Header"
import { Board } from "@/components/gomoku/Board"
import { RightPanel } from "@/components/gomoku/RightPanel"
import { SettingsDialog } from "@/components/gomoku/SettingsDialog"
import { EndgameDialog } from "@/components/gomoku/EndgameDialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { gameClient, type BoardCellPayload, type ConnectionStatus, type GameStartedPayload, type GameTurnPayload } from "@/lib/adapters/gameClient"
import {
  createBoard,
  placeMove,
  checkWin,
  createMove,
  undoMove,
} from "@/lib/gomoku/game"
import type {
  GameState,
  GameMode,
  GameSettings,
  Stone,
} from "@/lib/gomoku/types"

const defaultSettings: GameSettings = {
  boardSize: 19,
  showCoordinates: false,
  soundEnabled: false,
  aiDifficulty: 3,
}

const localPlayers = {
  black: { id: "1", name: "Player 1", color: "black" as const },
  white: { id: "2", name: "Player 2", color: "white" as const },
}

const aiPlayers = {
  black: localPlayers.black,
  white: { id: "ai", name: "AI", color: "white" as const },
}

function getPlayers(mode: GameMode) {
  return mode === "ai" ? aiPlayers : localPlayers
}

type AiLogEntry = {
  id: number
  message: string
  timestamp: string
}

type AiMetrics = {
  moveCount: number
  lastMoveMs: number | null
  averageMoveMs: number | null
  lastServerMs: number | null
  logs: AiLogEntry[]
}

const HUMAN_PLAYER = "black" as const
const AI_PLAYER = "white" as const

function isForbiddenMove(
  row: number,
  col: number,
  forbiddenMoves: Array<[number, number]>
) {
  return forbiddenMoves.some(([x, y]) => x === col && y === row)
}

export default function Home() {
  const { toast } = useToast()
  const [settings, setSettings] = React.useState<GameSettings>(defaultSettings)
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [connectionStatus, setConnectionStatus] =
    React.useState<ConnectionStatus>("offline")
  const [mode, setMode] = React.useState<GameMode>("local")
  const [aiThinking, setAiThinking] = React.useState(false)
  const [aiError, setAiError] = React.useState<string | null>(null)
  const [startingAiGame, setStartingAiGame] = React.useState(false)
  const [aiMetrics, setAiMetrics] = React.useState<AiMetrics>({
    moveCount: 0,
    lastMoveMs: null,
    averageMoveMs: null,
    lastServerMs: null,
    logs: [],
  })
  const modeRef = React.useRef<GameMode>("local")
  const aiLogIdRef = React.useRef(0)
  const aiTurnStartedAtRef = React.useRef<number | null>(null)
  const [gameState, setGameState] = React.useState<GameState>(() => ({
    board: createBoard(defaultSettings.boardSize),
    currentPlayer: "black",
    moves: [],
    lastMove: null,
    status: "waiting",
    winner: null,
    boardSize: defaultSettings.boardSize,
    mode: "local",
    players: getPlayers("local"),
    forbiddenMoves: [],
  }))

  React.useEffect(() => {
    modeRef.current = mode
  }, [mode])

  const addAiLog = React.useCallback((message: string) => {
    aiLogIdRef.current += 1
    const id = aiLogIdRef.current

    setAiMetrics((prev) => ({
      ...prev,
      logs: [
        {
          id,
          message,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev.logs,
      ].slice(0, 8),
    }))
  }, [])

  const resetAiMetrics = React.useCallback(() => {
    setAiMetrics({
      moveCount: 0,
      lastMoveMs: null,
      averageMoveMs: null,
      lastServerMs: null,
      logs: [],
    })
    aiTurnStartedAtRef.current = null
    aiLogIdRef.current = 0
  }, [])

  // Setup connection status listener
  React.useEffect(() => {
    const unsubscribe = gameClient.onStatusChange(setConnectionStatus)
    return unsubscribe
  }, [])

  React.useEffect(() => {
    console.log("Attempting to connect to WebSocket server...")
    gameClient.connect().then(() => {
      console.log("Connection successful")
    }).catch((error) => {
      console.error("Failed to connect:", error)
      // Only show toast if it's a real error, not SSR
      if (error.message !== "Cannot connect on server side") {
        toast("Failed to connect to server", "destructive")
      }
    })

    return () => {
      console.log("Disconnecting from server")
      gameClient.disconnect()
    }
  }, [toast])

  // Setup WebSocket event handlers
  React.useEffect(() => {
    gameClient.setEventHandlers({
      onGameStarted: (payload: GameStartedPayload) => {
        console.log("Game started in room:", payload.room)
        setStartingAiGame(false)
        setAiError(null)
        setAiThinking(false)
        toast("Game started!", "default")
        
        // Now show the game board
        setGameState((prev) => ({
          ...prev,
          status: "playing",
        }))
      },
      onBoardCell: (payload: BoardCellPayload) => {
        console.log("Received board cell update:", payload)

        if (
          payload.y < 0 ||
          payload.y >= defaultSettings.boardSize ||
          payload.x < 0 ||
          payload.x >= defaultSettings.boardSize
        ) {
          console.warn("Ignoring out-of-bounds board-cell payload:", payload)
          return
        }
        
        // Convert backend player format to frontend format
        const playerColor: Stone = payload.player_id === "Black" ? "black" : 
                                   payload.player_id === "White" ? "white" : null

        if (modeRef.current === "ai") {
          if (playerColor === HUMAN_PLAYER) {
            aiTurnStartedAtRef.current = performance.now()
            setAiThinking(true)
            addAiLog(`Human played ${String.fromCharCode(65 + payload.x)}${payload.y + 1}`)
            addAiLog("Waiting for backend Python AI")
          } else if (playerColor === AI_PLAYER) {
            const finishedAt = performance.now()
            const totalMs = aiTurnStartedAtRef.current
              ? Math.round(finishedAt - aiTurnStartedAtRef.current)
              : null

            if (totalMs !== null) {
              setAiMetrics((prev) => {
                const moveCount = prev.moveCount + 1
                const previousTotal = (prev.averageMoveMs ?? 0) * prev.moveCount
                return {
                  ...prev,
                  moveCount,
                  lastMoveMs: totalMs,
                  averageMoveMs: Math.round((previousTotal + totalMs) / moveCount),
                  lastServerMs: totalMs,
                }
              })
              addAiLog(
                `AI played ${String.fromCharCode(65 + payload.x)}${payload.y + 1} in ${totalMs}ms`
              )
            }

            setAiThinking(false)
            setAiError(null)
            aiTurnStartedAtRef.current = null
          }
        }
        
        // Update the board with the move (or clear it if playerColor is null)
        setGameState((prev) => {
          const newBoard = prev.board.map((row) => [...row])

          if (playerColor !== null && newBoard[payload.y][payload.x] === playerColor) {
            return prev
          }

          newBoard[payload.y][payload.x] = playerColor
          
          let newMoves = [...prev.moves]
          let lastMove = prev.lastMove
          const hasWon = false
          
          if (playerColor !== null) {
            // Adding a move
            const move = createMove(payload.y, payload.x, playerColor)
            newMoves = [...prev.moves, move]
            lastMove = move
            
          } else {
            // Removing a move (undo) - remove moves at this position
            newMoves = prev.moves.filter(m => !(m.row === payload.y && m.col === payload.x))
            lastMove = newMoves.length > 0 ? newMoves[newMoves.length - 1] : null
          }
          
          return {
            ...prev,
            board: newBoard,
            moves: newMoves,
            lastMove: lastMove,
            currentPlayer: playerColor === null
              ? (newMoves.length % 2 === 0 ? "black" : "white")
              : (playerColor === "black" ? "white" : "black"),
            winner: hasWon ? playerColor : null,
            status: hasWon ? "finished" : "playing",
          }
        })
      },
      onGameTurn: (payload: GameTurnPayload) => {
        console.log("Game turn update:", payload)
        console.log("Forbidden sequences type:", typeof payload.forbiddenSequences)
        console.log("Forbidden sequences:", JSON.stringify(payload.forbiddenSequences, null, 2))
        
        // Convert backend player format to frontend format
        const currentPlayer: "black" | "white" = payload.currentPlayer === "Black" ? "black" : "white"
        
        if (modeRef.current === "ai") {
          setGameState((prev) => ({
            ...prev,
            forbiddenMoves: payload.forbiddenSequences,
          }))
        } else {
          setGameState((prev) => ({
            ...prev,
            currentPlayer,
            forbiddenMoves: payload.forbiddenSequences,
          }))
        }
        
        // Log forbidden sequences
        if (payload.forbiddenSequences.length > 0) {
          console.log("Forbidden move sequences:", payload.forbiddenSequences)
        }
      },
      onGameWin: (payload) => {
        console.log("Game won:", payload)
        const winner: Stone = payload.player_id === "Black" ? "black" : "white"
        const winnerName = winner === "black" ? "Black" : "White"
        const winMessage = payload.is_by_five === false
          ? `${winnerName} player wins by captures!`
          : `${winnerName} player wins by 5 in a row!`
        
        setGameState((prev) => ({
          ...prev,
          winner,
          status: "finished",
        }))

        setAiThinking(false)
        setStartingAiGame(false)
        
        toast(winMessage, "default")
      },
      onGameEnded: (payload) => {
        console.log("Game ended:", payload.message)
        toast(payload.message, "default")
        
        setGameState((prev) => ({
          ...prev,
          status: "finished",
        }))

        setAiThinking(false)
        setStartingAiGame(false)
      },
      onPlayerLeave: () => {
        console.log("Player left the game")
        toast("Opponent has left the game", "destructive")
        
        setGameState((prev) => ({
          ...prev,
          status: "finished",
        }))

        setAiThinking(false)
        setStartingAiGame(false)
      },
      onEventError: (error: string) => {
        console.error("Event error:", error)
        setAiThinking(false)
        setStartingAiGame(false)
        setAiError(error)
        addAiLog(`AI error: ${error}`)
        toast(`Error: ${error}`, "destructive")
      },
      onRoomError: (error: string) => {
        console.error("Room error:", error)
        setAiThinking(false)
        setStartingAiGame(false)
        setAiError(error)
        addAiLog(`Room error: ${error}`)
        toast(`Room error: ${error}`, "destructive")
      },
      onConnect: () => {
        console.log("Connected to server")
        toast("Connected to server", "default")
      },
      onDisconnect: () => {
        console.log("Disconnected from server")
        setAiThinking(false)
        setStartingAiGame(false)
        addAiLog("AI server disconnected")
        toast("Disconnected from server", "destructive")
      },
    })
  }, [addAiLog, toast])



  const ensureAiConnection = React.useCallback(async () => {
    if (gameClient.isConnected()) {
      return true
    }

    try {
      await gameClient.connect()
      return true
    } catch (error) {
      console.error("Failed to connect to AI server:", error)
      toast("AI server is not connected", "destructive")
      return false
    }
  }, [toast])

  const resetGame = React.useCallback(async (nextMode = mode) => {
    if (nextMode === "ai" && !(await ensureAiConnection())) {
      return
    }

    setAiError(null)
    setAiThinking(false)
    if (nextMode === "ai") {
      resetAiMetrics()
    }

    setGameState({
      board: createBoard(settings.boardSize),
      currentPlayer: "black",
      moves: [],
      lastMove: null,
      status: "playing",
      winner: null,
      boardSize: settings.boardSize,
      mode: nextMode,
      players: getPlayers(nextMode),
      forbiddenMoves: [],
    })

    if (nextMode === "ai") {
      try {
        setStartingAiGame(true)
        await gameClient.startGame(settings.boardSize, nextMode)
      } catch (error) {
        console.error("Failed to start game:", error)
        setStartingAiGame(false)
        setAiError("Failed to start AI game")
        toast(`Failed to start game: ${error}`, "destructive")
      }
    }
  }, [ensureAiConnection, resetAiMetrics, settings.boardSize, mode, toast])

  const startAiGame = React.useCallback(async () => {
    setStartingAiGame(true)
    setAiError(null)

    if (!(await ensureAiConnection())) {
      setStartingAiGame(false)
      return
    }

    setMode("ai")
    setAiThinking(false)
    resetAiMetrics()
    addAiLog("Starting AI game")
    setGameState({
      board: createBoard(settings.boardSize),
      currentPlayer: HUMAN_PLAYER,
      moves: [],
      lastMove: null,
      status: "waiting",
      winner: null,
      boardSize: settings.boardSize,
      mode: "ai",
      players: getPlayers("ai"),
      forbiddenMoves: [],
    })

    try {
      await gameClient.startGame(settings.boardSize, "ai")
    } catch (error) {
      console.error("Failed to start AI game:", error)
      setStartingAiGame(false)
      setAiError("Failed to start AI game")
      toast(`Failed to start AI game: ${error}`, "destructive")
    }
  }, [addAiLog, ensureAiConnection, resetAiMetrics, settings.boardSize, toast])

  React.useEffect(() => {
    if (settings.boardSize !== gameState.boardSize) {
      resetGame()
    }
  }, [settings.boardSize, gameState.boardSize, resetGame])

  const handleCellClick = React.useCallback(
    async (row: number, col: number) => {
      if (gameState.status !== "playing") {
        return
      }

      if (mode === "ai" && gameState.currentPlayer !== HUMAN_PLAYER) {
        toast("Wait for the AI move", "destructive")
        return
      }

      if (mode === "ai" && (aiThinking || startingAiGame)) {
        return
      }

      if (gameState.board[row][col] !== null) {
        toast("Invalid move: Cell is already occupied", "destructive")
        return
      }

      if (isForbiddenMove(row, col, gameState.forbiddenMoves)) {
        toast("Invalid move: forbidden position", "destructive")
        return
      }

      if (mode === "ai" && gameClient.isConnected()) {
        try {
          setAiError(null)
          setAiThinking(true)
          await gameClient.makeMove(col, row) // Backend uses x=col, y=row
          // Server will respond with board-cell event to update the board
        } catch (error) {
          console.error("Failed to make move:", error)
          setAiThinking(false)
          setAiError("Failed to make move")
          toast(`Failed to make move: ${error}`, "destructive")
        }
        return
      }

      if (mode === "ai") {
        toast("AI server is not connected", "destructive")
        return
      }

      // For local mode, handle move locally
      const result = placeMove(
        gameState.board,
        row,
        col,
        gameState.currentPlayer
      )

      if (!result.success) {
        toast("Invalid move", "destructive")
        return
      }

      const move = createMove(row, col, gameState.currentPlayer)
      const newMoves = [...gameState.moves, move]
      const hasWon = checkWin(result.board, row, col, gameState.currentPlayer)

      setGameState((prev) => ({
        ...prev,
        board: result.board,
        currentPlayer: prev.currentPlayer === "black" ? "white" : "black",
        moves: newMoves,
        lastMove: move,
        winner: hasWon ? prev.currentPlayer : null,
        status: hasWon ? "finished" : "playing",
      }))
    },
    [aiThinking, gameState, mode, startingAiGame, toast]
  )

  const handleUndo = React.useCallback(async () => {
    if (gameState.moves.length === 0) {
      return
    }

    if (mode === "ai" && (aiThinking || gameState.currentPlayer !== HUMAN_PLAYER)) {
      toast("Wait for the AI move before undoing", "destructive")
      return
    }

    if (mode === "ai" && gameState.moves.length < 2) {
      toast("Play a full turn before undoing", "destructive")
      return
    }

    if (mode === "ai" && gameClient.isConnected()) {
      try {
        setAiError(null)
        await gameClient.requestUndo()
        await gameClient.requestUndo()
      } catch (error) {
        console.error("Failed to undo:", error)
        setAiError("Failed to undo")
        toast(`Failed to undo: ${error}`, "destructive")
      }
      return
    }

    if (mode === "ai") {
      toast("AI server is not connected", "destructive")
      return
    }

    // For local mode, handle undo locally
    const { board: newBoard, newMoves } = undoMove(
      gameState.board,
      gameState.moves
    )

    setGameState((prev) => ({
      ...prev,
      board: newBoard,
      moves: newMoves,
      lastMove: newMoves.length > 0 ? newMoves[newMoves.length - 1] : null,
      currentPlayer:
        newMoves.length % 2 === 0 ? "black" : "white",
      status: "playing",
      winner: null,
    }))
  }, [aiThinking, gameState, mode, toast])

  const handleRestart = React.useCallback(() => {
    resetGame()
  }, [resetGame])

  const handleResign = React.useCallback(async () => {
    if (mode === "ai" && gameClient.isConnected()) {
      try {
        await gameClient.leaveGame()
      } catch (error) {
        console.error("Failed to leave game:", error)
      }
    } else if (mode === "ai") {
      toast("AI server is not connected", "destructive")
      return
    }
    
    setGameState((prev) => ({
      ...prev,
      status: "finished",
      winner: prev.currentPlayer === "black" ? "white" : "black",
    }))
  }, [mode, toast])

  const handleModeChange = React.useCallback(async (newMode: GameMode) => {
    if (newMode === "ai" && !(await ensureAiConnection())) {
      return
    }

    setMode(newMode)
    await resetGame(newMode)
  }, [ensureAiConnection, resetGame])

  const handleSettingsChange = React.useCallback(
    (newSettings: Partial<GameSettings>) => {
      setSettings((prev) => ({ ...prev, ...newSettings }))
    },
    []
  )

  const showEndgameDialog =
    gameState.status === "finished" && gameState.winner !== null
  const isAiMode = mode === "ai"
  const isHumanTurn = gameState.currentPlayer === HUMAN_PLAYER
  const boardDisabled =
    gameState.status !== "playing" ||
    (isAiMode &&
      (startingAiGame ||
        aiThinking ||
        !isHumanTurn ||
        connectionStatus !== "connected"))
  const aiStatus = !isAiMode
    ? null
    : aiError ??
      (connectionStatus !== "connected"
        ? "AI server offline"
        : startingAiGame
          ? "Starting AI game"
          : aiThinking
            ? "AI thinking..."
            : isHumanTurn
              ? "Your turn"
              : "Waiting for AI")

  console.log("Current game status:", gameState.status)

  if (gameState.status === "waiting") {
    console.log("Rendering waiting screen with mode selection buttons")
    return (
      <div className="flex flex-col min-h-screen">
        <Header
          connectionStatus={connectionStatus}
          onSettingsClick={() => setSettingsOpen(true)}
        />
        <main className="flex-1 container mx-auto w-full px-4 py-8">
          <div className="mx-auto grid w-full max-w-5xl items-center gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-emerald-500/70" />
                Modern Gomoku
              </div>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Start a match
              </h2>
              <p className="text-sm text-muted-foreground sm:text-base">
                Pick a mode, place stones, and play for five-in-a-row. AI mode
                requires a live server connection.
              </p>

              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  onClick={() => {
                    setMode("local")
                    setGameState((prev) => ({
                      ...prev,
                      status: "playing",
                      mode: "local",
                      players: getPlayers("local"),
                    }))
                  }}
                >
                  1v1 Local
                </Button>
                <Button
                  variant="outline"
                  onClick={startAiGame}
                  disabled={startingAiGame || connectionStatus !== "connected"}
                >
                  {startingAiGame ? "Starting AI..." : "vs AI"}
                </Button>
              </div>

              <div className="mt-3 grid gap-2">
                <div className="rounded-lg border bg-card/60 px-4 py-3">
                  <div className="text-sm font-medium">AI connection</div>
                  <div className="text-sm text-muted-foreground">
                    {connectionStatus === "connected"
                      ? "Ready"
                      : connectionStatus === "connecting"
                        ? "Connecting..."
                        : "Offline"}
                  </div>
                </div>
                {connectionStatus !== "connected" && (
                  <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                    If AI mode is unavailable, start a local match or run the
                    server, then reload.
                  </div>
                )}
              </div>
            </div>

            <Card className="overflow-hidden">
              <CardHeader className="pb-4">
                <CardTitle>Quick rules</CardTitle>
                <CardDescription>
                  Five in a row wins. In AI mode, forbidden positions are marked.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="grid gap-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Board</span>
                    <span className="font-medium">{settings.boardSize}×{settings.boardSize}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Turn order</span>
                    <span className="font-medium">Black starts</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Undo</span>
                    <span className="font-medium">Available during play</span>
                  </div>
                </div>
                <div className="rounded-xl border bg-linear-to-br from-[#f1d7a6] via-[#e8c78e] to-[#dbb46e] dark:from-[#2a241a] dark:via-[#241f18] dark:to-[#1a1712] p-5">
                  <div className="grid grid-cols-9 gap-1">
                    {Array.from({ length: 81 }).map((_, i) => (
                      <div
                        key={i}
                        className="aspect-square rounded-[4px] border border-black/10 dark:border-white/10 bg-white/10"
                      />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
        <SettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          settings={settings}
          onSettingsChange={handleSettingsChange}
          mode={mode}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        connectionStatus={connectionStatus}
        onSettingsClick={() => setSettingsOpen(true)}
      />
      <main className="flex-1 container mx-auto w-full px-4 py-4">
        <div className="grid min-h-[calc(100vh-3.5rem)] grid-cols-1 gap-4 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-stretch">
          <div className="min-h-0">
            <RightPanel
              gameState={gameState}
              mode={mode}
              onModeChange={handleModeChange}
              onUndo={handleUndo}
              onRestart={handleRestart}
              onResign={handleResign}
              aiStatus={aiStatus}
              aiMetrics={isAiMode ? aiMetrics : null}
              actionsDisabled={startingAiGame || aiThinking}
            />
          </div>
          <div className="flex min-h-[60vh] items-center justify-center lg:min-h-0 lg:justify-end">
            <Board
              board={gameState.board}
              lastMove={gameState.lastMove}
              currentPlayer={gameState.currentPlayer}
              showCoordinates={settings.showCoordinates}
              onCellClick={handleCellClick}
              disabled={boardDisabled}
              forbiddenMoves={gameState.forbiddenMoves}
            />
          </div>
        </div>
      </main>
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onSettingsChange={handleSettingsChange}
        mode={mode}
      />
      <EndgameDialog
        open={showEndgameDialog}
        onOpenChange={(open) => {
          if (!open) {
            setGameState((prev) => ({ ...prev, status: "waiting" }))
          }
        }}
        gameState={gameState}
        onNewGame={() => {
          resetGame()
        }}
      />
    </div>
  )
}
