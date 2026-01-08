"use client"

import * as React from "react"
import { Header } from "@/components/gomoku/Header"
import { Board } from "@/components/gomoku/Board"
import { RightPanel } from "@/components/gomoku/RightPanel"
import { SettingsDialog } from "@/components/gomoku/SettingsDialog"
import { EndgameDialog } from "@/components/gomoku/EndgameDialog"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { gameClient, type BoardCellPayload, type GameStartedPayload, type GameWinPayload, type GameEndedPayload } from "@/lib/adapters/gameClient"
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
  Player,
  Stone,
} from "@/lib/gomoku/types"

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

export default function Home() {
  const { toast } = useToast()
  const [settings, setSettings] = React.useState<GameSettings>(defaultSettings)
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [connectionStatus, setConnectionStatus] =
    React.useState<"connecting" | "online" | "offline">("offline")
  const [mode, setMode] = React.useState<GameMode>("local")
  const [gameState, setGameState] = React.useState<GameState>(() => ({
    board: createBoard(defaultSettings.boardSize),
    currentPlayer: "black",
    moves: [],
    lastMove: null,
    status: "waiting",
    winner: null,
    boardSize: defaultSettings.boardSize,
    mode: "local",
    players: defaultPlayers,
  }))

  // Setup connection status listener
  React.useEffect(() => {
    const unsubscribe = gameClient.onStatusChange(setConnectionStatus)
    return unsubscribe
  }, [])

  // Connect to WebSocket server on page load
  React.useEffect(() => {
    console.log("Attempting to connect to WebSocket server...")
    gameClient.connect("online").then(() => {
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
  }, [])

  // Setup WebSocket event handlers
  React.useEffect(() => {
    gameClient.setEventHandlers({
      onGameStarted: (payload: GameStartedPayload) => {
        console.log("Game started in room:", payload.room)
        toast(`Game started!`, "default")
        
        // Now show the game board
        setGameState((prev) => ({
          ...prev,
          status: "playing",
        }))
      },
      onBoardCell: (payload: BoardCellPayload) => {
        console.log("Received board cell update:", payload)
        
        // Convert backend player format to frontend format
        const playerColor: Stone = payload.player_id === "Black" ? "black" : 
                                   payload.player_id === "White" ? "white" : null
        
        // Update the board with the move (or clear it if playerColor is null)
        setGameState((prev) => {
          const newBoard = prev.board.map((row) => [...row])
          newBoard[payload.y][payload.x] = playerColor
          
          let newMoves = [...prev.moves]
          let lastMove = prev.lastMove
          let hasWon = false
          
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
            currentPlayer: playerColor === null ? prev.currentPlayer : 
                          (playerColor === "black" ? "white" : "black"),
            winner: hasWon ? playerColor : null,
            status: hasWon ? "finished" : "playing",
          }
        })
      },
      onGameWin: (payload) => {
        console.log("Game won:", payload)
        const winner: Stone = payload.player_id === "Black" ? "black" : "white"
        
        setGameState((prev) => ({
          ...prev,
          winner,
          status: "finished",
        }))
        
        toast(`${winner === "black" ? "Black" : "White"} player wins!`, "default")
      },
      onGameEnded: (payload) => {
        console.log("Game ended:", payload.message)
        toast(payload.message, "default")
        
        setGameState((prev) => ({
          ...prev,
          status: "finished",
        }))
      },
      onPlayerLeave: () => {
        console.log("Player left the game")
        toast("Opponent has left the game", "destructive")
        
        setGameState((prev) => ({
          ...prev,
          status: "finished",
        }))
      },
      onEventError: (error: string) => {
        console.error("Event error:", error)
        toast(`Error: ${error}`, "destructive")
      },
      onRoomError: (error: string) => {
        console.error("Room error:", error)
        toast(`Room error: ${error}`, "destructive")
      },
      onConnect: () => {
        console.log("Connected to server")
        toast("Connected to server", "default")
      },
      onDisconnect: () => {
        console.log("Disconnected from server")
        toast("Disconnected from server", "destructive")
      },
    })
  }, [toast])



  const resetGame = React.useCallback(async () => {
    setGameState({
      board: createBoard(settings.boardSize),
      currentPlayer: "black",
      moves: [],
      lastMove: null,
      status: "playing",
      winner: null,
      boardSize: settings.boardSize,
      mode,
      players: defaultPlayers,
    })

    // For online/AI modes, notify the server to start a new game
    if ((mode === "online" || mode === "ai") && gameClient.isConnected()) {
      try {
        await gameClient.startGame(settings.boardSize, mode)
      } catch (error) {
        console.error("Failed to start game:", error)
        toast(`Failed to start game: ${error}`, "destructive")
      }
    }
  }, [settings.boardSize, mode, toast])

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

      if (gameState.board[row][col] !== null) {
        toast("Invalid move: Cell is already occupied", "destructive")
        return
      }

      // For online/AI modes, send move to server
      if ((mode === "online" || mode === "ai") && gameClient.isConnected()) {
        try {
          await gameClient.makeMove(col, row) // Backend uses x=col, y=row
          // Server will respond with board-cell event to update the board
        } catch (error) {
          console.error("Failed to make move:", error)
          toast(`Failed to make move: ${error}`, "destructive")
        }
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
    [gameState, toast, mode]
  )

  const handleUndo = React.useCallback(async () => {
    if (gameState.moves.length === 0) {
      return
    }

    // For online/AI modes, request undo from server
    if ((mode === "online" || mode === "ai") && gameClient.isConnected()) {
      try {
        await gameClient.requestUndo()
        // Server will respond with undo event to update the board
      } catch (error) {
        console.error("Failed to undo:", error)
        toast(`Failed to undo: ${error}`, "destructive")
      }
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
  }, [gameState, mode, toast])

  const handleRestart = React.useCallback(() => {
    resetGame()
  }, [resetGame])

  const handleResign = React.useCallback(async () => {
    // For online/AI modes, notify server that we're leaving
    if ((mode === "online" || mode === "ai") && gameClient.isConnected()) {
      try {
        await gameClient.leaveGame()
      } catch (error) {
        console.error("Failed to leave game:", error)
      }
    }
    
    setGameState((prev) => ({
      ...prev,
      status: "finished",
      winner: prev.currentPlayer === "black" ? "white" : "black",
    }))
  }, [mode])

  const handleModeChange = React.useCallback(async (newMode: GameMode) => {
    setMode(newMode)
    await resetGame()
  }, [resetGame])

  const handleSettingsChange = React.useCallback(
    (newSettings: Partial<GameSettings>) => {
      setSettings((prev) => ({ ...prev, ...newSettings }))
    },
    []
  )

  const showEndgameDialog =
    gameState.status === "finished" && gameState.winner !== null

  console.log("Current game status:", gameState.status)

  if (gameState.status === "waiting") {
    console.log("Rendering waiting screen with mode selection buttons")
    return (
      <div className="flex flex-col min-h-screen">
        <Header
          connectionStatus={connectionStatus}
          onSettingsClick={() => setSettingsOpen(true)}
        />
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4 text-center">
                <h2 className="text-2xl font-bold">Start a Match</h2>
                <p className="text-muted-foreground">
                  Choose a game mode to begin
                </p>
                <div className="flex flex-col gap-2 pt-4">
                  <Button
                    onClick={() => {
                      setMode("local")
                      setGameState((prev) => ({ ...prev, status: "playing" }))
                    }}
                  >
                    Local PvP
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      console.log("AI button clicked")
                      setMode("ai")
                      setGameState((prev) => ({ ...prev, mode: "ai" }))
                      
                      // Send game-start to server
                      console.log("Is connected?", gameClient.isConnected())
                      if (gameClient.isConnected()) {
                        try {
                          console.log("Starting AI game with board size:", settings.boardSize)
                          gameClient.startGame(settings.boardSize, "ai")
                        } catch (error) {
                          console.error("Failed to start AI game:", error)
                          toast(`Failed to start AI game: ${error}`, "destructive")
                        }
                      } else {
                        console.log("Not connected - cannot start game")
                        toast("Not connected to server", "destructive")
                      }
                    }}
                  >
                    vs AI
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      console.log("Online button clicked")
                      setMode("online")
                      setGameState((prev) => ({ ...prev, mode: "online" }))
                      
                      // Send game-start to server
                      console.log("Is connected?", gameClient.isConnected())
                      if (gameClient.isConnected()) {
                        try {
                          console.log("Starting online game with board size:", settings.boardSize)
                          gameClient.startGame(settings.boardSize, "online")
                        } catch (error) {
                          console.error("Failed to start online game:", error)
                          toast(`Failed to start online game: ${error}`, "destructive")
                        }
                      } else {
                        console.log("Not connected - cannot start game")
                        toast("Not connected to server", "destructive")
                      }
                    }}
                  >
                    Online
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
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
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 p-4 container mx-auto">
        <div className="flex items-center justify-center min-h-0">
          <Board
            board={gameState.board}
            lastMove={gameState.lastMove}
            currentPlayer={gameState.currentPlayer}
            showCoordinates={settings.showCoordinates}
            onCellClick={handleCellClick}
            disabled={gameState.status !== "playing"}
          />
        </div>
        <div className="lg:flex lg:flex-col lg:items-end">
          <RightPanel
            gameState={gameState}
            mode={mode}
            onModeChange={handleModeChange}
            onUndo={handleUndo}
            onRestart={handleRestart}
            onResign={handleResign}
          />
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
