import type { Stone, Move } from "./types"

export function createBoard(size: number): Stone[][] {
  return Array(size)
    .fill(null)
    .map(() => Array(size).fill(null))
}

export function formatCoordinate(row: number, col: number): string {
  const letter = String.fromCharCode(65 + col) // A-O
  const number = row + 1
  return `${letter}${number}`
}

export function placeMove(
  board: Stone[][],
  row: number,
  col: number,
  player: "black" | "white"
): { success: boolean; board: Stone[][] } {
  if (row < 0 || row >= board.length || col < 0 || col >= board[0].length) {
    return { success: false, board }
  }

  if (board[row][col] !== null) {
    return { success: false, board }
  }

  const newBoard = board.map((r) => [...r])
  newBoard[row][col] = player
  return { success: true, board: newBoard }
}

export function checkWin(
  board: Stone[][],
  row: number,
  col: number,
  player: "black" | "white"
): boolean {
  const directions = [
    [0, 1], // horizontal
    [1, 0], // vertical
    [1, 1], // diagonal \
    [1, -1], // diagonal /
  ]

  for (const [dx, dy] of directions) {
    let count = 1

    // Check positive direction
    for (let i = 1; i < 5; i++) {
      const newRow = row + dx * i
      const newCol = col + dy * i
      if (
        newRow >= 0 &&
        newRow < board.length &&
        newCol >= 0 &&
        newCol < board[0].length &&
        board[newRow][newCol] === player
      ) {
        count++
      } else {
        break
      }
    }

    // Check negative direction
    for (let i = 1; i < 5; i++) {
      const newRow = row - dx * i
      const newCol = col - dy * i
      if (
        newRow >= 0 &&
        newRow < board.length &&
        newCol >= 0 &&
        newCol < board[0].length &&
        board[newRow][newCol] === player
      ) {
        count++
      } else {
        break
      }
    }

    if (count >= 5) {
      return true
    }
  }

  return false
}

export function createMove(
  row: number,
  col: number,
  player: "black" | "white"
): Move {
  return {
    row,
    col,
    player,
    timestamp: Date.now(),
  }
}

export function undoMove(
  board: Stone[][],
  moves: Move[]
): { board: Stone[][]; newMoves: Move[] } {
  if (moves.length === 0) {
    return { board, newMoves: [] }
  }

  const newBoard = board.map((r) => [...r])
  const newMoves = [...moves]

  // Undo last move
  const lastMove = newMoves.pop()!
  newBoard[lastMove.row][lastMove.col] = null

  return { board: newBoard, newMoves }
}

