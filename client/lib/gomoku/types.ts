export type Stone = "black" | "white" | null

export type GameMode = "local" | "ai" | "eve"

export type GameStatus = "waiting" | "playing" | "finished"

export type Player = {
  id: string
  name: string
  color: "black" | "white"
  avatar?: string
}

export type Move = {
  row: number
  col: number
  player: "black" | "white"
  timestamp: number
}

export type GameState = {
  board: Stone[][]
  currentPlayer: "black" | "white"
  moves: Move[]
  lastMove: Move | null
  status: GameStatus
  winner: "black" | "white" | null
  boardSize: number
  mode: GameMode
  players: {
    black: Player
    white: Player
  }
  forbiddenMoves: Array<[number, number]>
  captures: {
    black: number
    white: number
  }
}

export type GameSettings = {
  boardSize: 19
  showCoordinates: boolean
  soundEnabled: boolean
  aiDifficulty: number
}

