"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/gomoku/Header"
import { Board } from "@/components/gomoku/Board"
import { RightPanel } from "@/components/gomoku/RightPanel"
import { SettingsDialog } from "@/components/gomoku/SettingsDialog"
import { EndgameDialog } from "@/components/gomoku/EndgameDialog"
import { LoadingModal } from "@/components/gomoku/LoadingModal"
import { useToast } from "@/components/ui/toast"
import {
  gameClient,
  type BoardCellPayload,
  type GameEndedPayload,
  type GameStartedPayload,
  type GameTurnPayload,
  type GameWinPayload,
  type MatchFoundPayload,
} from "@/lib/adapters/gameClient"
import { createBoard, createMove, placeMove, checkWin, undoMove } from "@/lib/gomoku/game"
import type { GameMode, GameSettings, GameState, Stone } from "@/lib/gomoku/types"

const defaultSettings: GameSettings = {
  boardSize: 15,
  showCoordinates: false,
  soundEnabled: false,
  aiDifficulty: 3,
}

const defaultPlayers = {
  black: { id: "1", name: "Player 1", color: "black" as const },
  white: { id: "2", name: "Player 2", color: "white" as const },
}

function prettifyServerError(msg: string): string {
  if (!msg) return "Something went wrong."
  if (msg.includes("Not your turn")) return "Not your turn yet."
  return msg.replace(/^Error processing event [^:]+:\s*/, "")
}

export function GamePage({ mode }: { mode: GameMode }) {
  const router = useRouter()
  const { toast } = useToast()

  const [settings, setSettings] = React.useState<GameSettings>(defaultSettings)
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [connectionStatus, setConnectionStatus] =
    React.useState<"connecting" | "online" | "offline">("offline")

  const [onlineSearching, setOnlineSearching] = React.useState(false)
  const [onlineColor, setOnlineColor] = React.useState<"black" | "white" | null>(null)
  const [aiBooting, setAiBooting] = React.useState(mode === "ai")

  const [gameState, setGameState] = React.useState<GameState>(() => ({
    board: createBoard(defaultSettings.boardSize),
    currentPlayer: "black",
    moves: [],
    lastMove: null,
    status: mode === "online" ? "waiting" : "playing",
    winner: null,
    boardSize: defaultSettings.boardSize,
    mode,
    players: defaultPlayers,
    forbiddenMoves: [],
  }))

  React.useEffect(() => {
    const unsubscribe = gameClient.onStatusChange(setConnectionStatus)
    return unsubscribe
  }, [])

  React.useEffect(() => {
    gameClient
      .connect("online")
      .catch((error) => {
        if (error.message !== "Cannot connect on server side") {
          toast("Failed to connect to server", "destructive")
        }
      })

    return () => {
      gameClient.disconnect()
    }
  }, [toast])

  React.useEffect(() => {
    gameClient.setEventHandlers({
      onMatchFound: (payload: MatchFoundPayload) => {
        if (mode !== "online") return
        setOnlineSearching(false)
        setOnlineColor(payload.color === "Black" ? "black" : "white")
        toast(`Match found! You are ${payload.color}.`, "default")

        if (payload.board_size !== settings.boardSize) {
          setSettings((prev) => ({ ...prev, boardSize: payload.board_size }))
        }
      },
      onGameStarted: (payload: GameStartedPayload) => {
        toast(`Game started!`, "default")
        setGameState((prev) => ({ ...prev, status: "playing" }))
      },
      onBoardCell: (payload: BoardCellPayload) => {
        const playerColor: Stone =
          payload.player_id === "Black" ? "black" : payload.player_id === "White" ? "white" : null

        setGameState((prev) => {
          const newBoard = prev.board.map((row) => [...row])
          newBoard[payload.y][payload.x] = playerColor

          let newMoves = [...prev.moves]
          let lastMove = prev.lastMove

          if (playerColor !== null) {
            const move = createMove(payload.y, payload.x, playerColor)
            newMoves = [...prev.moves, move]
            lastMove = move
          } else {
            newMoves = prev.moves.filter((m) => !(m.row === payload.y && m.col === payload.x))
            lastMove = newMoves.length > 0 ? newMoves[newMoves.length - 1] : null
          }

          return {
            ...prev,
            board: newBoard,
            moves: newMoves,
            lastMove,
          }
        })
      },
      onGameTurn: (payload: GameTurnPayload) => {
        const currentPlayer: "black" | "white" = payload.currentPlayer === "Black" ? "black" : "white"
        setGameState((prev) => ({
          ...prev,
          currentPlayer,
          forbiddenMoves: payload.forbiddenSequences,
        }))
      },
      onGameWin: (payload: GameWinPayload) => {
        const winner: Stone = payload.player_id === "Black" ? "black" : "white"
        const winnerName = winner === "black" ? "Black" : "White"
        const winMessage = payload.is_by_five
          ? `${winnerName} player wins by 5 in a row!`
          : `${winnerName} player wins by captures!`

        setGameState((prev) => ({ ...prev, winner, status: "finished" }))
        toast(winMessage, "default")
      },
      onGameEnded: (payload: GameEndedPayload) => {
        toast(payload.message, "default")
        setGameState((prev) => ({ ...prev, status: "finished" }))
      },
      onPlayerLeave: () => {
        toast("Opponent has left the game", "destructive")
        setGameState((prev) => ({ ...prev, status: "finished" }))
      },
      onEventError: (error: string) => toast(prettifyServerError(error), "destructive"),
      onRoomError: (error: string) => toast(`Room error: ${error}`, "destructive"),
      onConnect: () => toast("Connected to server", "default"),
      onDisconnect: () => toast("Disconnected from server", "destructive"),
    })
  }, [mode, settings.boardSize, toast])

  const startOnlineMatch = React.useCallback(() => {
    if (!gameClient.isConnected()) {
      toast("Not connected to server", "destructive")
      return
    }
    setOnlineSearching(true)
    setOnlineColor(null)
    gameClient.findMatch(settings.boardSize).catch((e) => {
      setOnlineSearching(false)
      toast(`Failed to find match: ${e}`, "destructive")
    })
  }, [settings.boardSize, toast])

  React.useEffect(() => {
    // If user lands directly on /online, auto-start matchmaking (unless already playing).
    if (mode === "online") {
      if (gameState.status !== "playing" && !onlineSearching) {
        setGameState((prev) => ({ ...prev, status: "waiting" }))
        startOnlineMatch()
      }
    }

    // AI mode not implemented yet: keep user in a loading modal.
    if (mode === "ai") {
      setAiBooting(true)
      setGameState((prev) => ({ ...prev, status: "waiting" }))
    }
  }, [mode, gameState.status, onlineSearching, startOnlineMatch])

  const handleExit = React.useCallback(async () => {
    setOnlineSearching(false)
    setOnlineColor(null)
    setAiBooting(false)

    if ((mode === "online" || mode === "ai") && gameClient.isConnected()) {
      try {
        await gameClient.leaveGame()
      } catch (e) {
        toast(`Failed to leave game: ${e}`, "destructive")
      }
    }

    router.push("/")
  }, [mode, router, toast])

  const handleCellClick = React.useCallback(
    async (row: number, col: number) => {
      if (gameState.status !== "playing") return
      if (gameState.board[row][col] !== null) {
        toast("Invalid move: Cell is already occupied", "destructive")
        return
      }

      if ((mode === "online" || mode === "ai") && gameClient.isConnected()) {
        if (mode === "online" && onlineColor && onlineColor !== gameState.currentPlayer) {
          toast("Not your turn yet.", "destructive")
          return
        }
        await gameClient.makeMove(col, row)
        return
      }

      const result = placeMove(gameState.board, row, col, gameState.currentPlayer)
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
    [gameState, mode, onlineColor, toast]
  )

  const handleUndo = React.useCallback(async () => {
    if (gameState.moves.length === 0) return

    if ((mode === "online" || mode === "ai") && gameClient.isConnected()) {
      await gameClient.requestUndo()
      return
    }

    const { board: newBoard, newMoves } = undoMove(gameState.board, gameState.moves)
    setGameState((prev) => ({
      ...prev,
      board: newBoard,
      moves: newMoves,
      lastMove: newMoves.length > 0 ? newMoves[newMoves.length - 1] : null,
      currentPlayer: newMoves.length % 2 === 0 ? "black" : "white",
      status: "playing",
      winner: null,
    }))
  }, [gameState.board, gameState.moves, mode])

  const handleRestart = React.useCallback(() => {
    if (mode === "online") {
      toast("Exit the match to start a new online game.", "destructive")
      return
    }
    setGameState((prev) => ({
      ...prev,
      board: createBoard(settings.boardSize),
      moves: [],
      lastMove: null,
      winner: null,
      status: "playing",
    }))
  }, [mode, settings.boardSize, toast])

  const handleResign = React.useCallback(async () => {
    if ((mode === "online" || mode === "ai") && gameClient.isConnected()) {
      await gameClient.leaveGame()
    }
    setGameState((prev) => ({
      ...prev,
      status: "finished",
      winner: prev.currentPlayer === "black" ? "white" : "black",
    }))
  }, [mode])

  const showEndgameDialog = gameState.status === "finished" && gameState.winner !== null

  return (
    <div className="flex flex-col min-h-screen">
      <Header connectionStatus={connectionStatus} onSettingsClick={() => setSettingsOpen(true)} />
      <LoadingModal
        open={mode === "online" && gameState.status !== "playing"}
        title="Finding match"
        description="Waiting for another player to join…"
      />
      <LoadingModal
        open={mode === "ai" && aiBooting}
        title="Starting AI game"
        description="AI mode is not implemented yet."
      />
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 p-4 container mx-auto">
        <div className="flex items-center justify-center min-h-0">
          <Board
            board={gameState.board}
            lastMove={gameState.lastMove}
            currentPlayer={gameState.currentPlayer}
            showCoordinates={settings.showCoordinates}
            onCellClick={handleCellClick}
            disabled={gameState.status !== "playing"}
            forbiddenMoves={gameState.forbiddenMoves}
          />
        </div>
        <div className="lg:flex lg:flex-col lg:items-end">
          <RightPanel
            gameState={gameState}
            mode={mode}
            onUndo={handleUndo}
            onRestart={handleRestart}
            onResign={handleResign}
            onExit={handleExit}
          />
        </div>
      </main>
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onSettingsChange={(s) => setSettings((prev) => ({ ...prev, ...s }))}
        mode={mode}
      />
      <EndgameDialog
        open={showEndgameDialog}
        onOpenChange={() => {}}
        gameState={gameState}
        onNewGame={handleRestart}
      />
    </div>
  )
}

