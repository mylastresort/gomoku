"use client"

import * as React from "react"
import { Cell } from "./Cell"
import type { Stone, Move } from "@/lib/gomoku/types"

interface BoardProps {
  board: Stone[][]
  lastMove: Move | null
  hintCell?: { row: number; col: number } | null
  currentPlayer: "black" | "white"
  showCoordinates: boolean
  onCellClick: (row: number, col: number) => void
  disabled?: boolean
  forbiddenMoves?: Array<[number, number]>
}

type IndexedForbiddenCell = Record<0 | 1, number>

export function Board({
  board,
  lastMove,
  hintCell = null,
  currentPlayer,
  showCoordinates,
  onCellClick,
  disabled = false,
  forbiddenMoves = [],
}: BoardProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 })
  const [hoveredCell, setHoveredCell] = React.useState<{
    row: number
    col: number
  } | null>(null)

  React.useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      setContainerSize({ width: Math.floor(rect.width), height: Math.floor(rect.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  React.useEffect(() => {
    console.log("Forbidden moves updated:", forbiddenMoves)
    console.log("Forbidden moves length:", forbiddenMoves?.length)
    if (forbiddenMoves && forbiddenMoves.length > 0) {
      console.log("Forbidden cells:", forbiddenMoves)
    }
  }, [forbiddenMoves])

  // Check if a cell is in the forbidden moves list
  const isCellForbidden = React.useCallback(
    (row: number, col: number): boolean => {
      if (!forbiddenMoves || forbiddenMoves.length === 0) {
        return false
      }
      
      const result = forbiddenMoves.some((cell) => {
        // Handle both array [x, y] and object {0: x, 1: y} formats
        if (Array.isArray(cell)) {
          const [x, y] = cell
          const matches = x === col && y === row
          if (matches) {
            console.log(`Cell [${row}, ${col}] is forbidden! Matched [${x}, ${y}]`)
          }
          return matches
        } else if (typeof cell === "object" && cell !== null) {
          const indexedCell = cell as IndexedForbiddenCell
          const x = indexedCell[0]
          const y = indexedCell[1]
          const matches = x === col && y === row
          if (matches) {
            console.log(`Cell [${row}, ${col}] is forbidden! Matched object [${x}, ${y}]`)
          }
          return matches
        }
        console.warn("Invalid forbidden cell format:", cell)
        return false
      })
      
      return result
    },
    [forbiddenMoves]
  )

  const handleCellHover = React.useCallback(
    (row: number, col: number) => {
      if (disabled || row < 0 || col < 0) {
        setHoveredCell(null)
        return
      }
      // Don't allow hover on forbidden cells
      if (isCellForbidden(row, col)) {
        setHoveredCell(null)
        return
      }
      if (board[row]?.[col] === null) {
        setHoveredCell({ row, col })
      } else {
        setHoveredCell(null)
      }
    },
    [board, disabled, isCellForbidden]
  )

  const size = board.length
  const viewportHeight =
    typeof window === "undefined" ? 720 : Math.max(480, window.innerHeight - 160)
  const effectiveHeight = Math.max(containerSize.height || 0, viewportHeight)
  const maxSize = Math.max(
    240,
    Math.min(
      (containerSize.width || 720) - 32,
      effectiveHeight - 32
    )
  )
  const cellSize = Math.floor(maxSize / size)

  return (
    <div ref={containerRef} className="flex w-full h-full min-h-[320px] items-center justify-center p-2 sm:p-4">
      <div
        className="grid gap-0 rounded-xl border border-black/10 dark:border-white/10 bg-linear-to-br from-[#f1d7a6] via-[#e8c78e] to-[#dbb46e] dark:from-[#2a241a] dark:via-[#241f18] dark:to-[#1a1712] p-2 shadow-lg shadow-black/10"
        style={{
          gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
          width: `${cellSize * size + 16}px`,
          maxWidth: "100%",
        }}
      >
        {board.map((row, rowIndex) =>
          row.map((stone, colIndex) => (
            <Cell
              key={`${rowIndex}-${colIndex}`}
              stone={stone}
              row={rowIndex}
              col={colIndex}
              isLastMove={
                lastMove?.row === rowIndex && lastMove?.col === colIndex
              }
              isHint={
                hintCell?.row === rowIndex && hintCell?.col === colIndex
              }
              showCoordinates={showCoordinates}
              onCellClick={onCellClick}
              onCellHover={handleCellHover}
              disabled={disabled}
              hoverStone={
                hoveredCell?.row === rowIndex && hoveredCell?.col === colIndex
                  ? currentPlayer
                  : null
              }
              isForbidden={isCellForbidden(rowIndex, colIndex)}
            />
          ))
        )}
      </div>
    </div>
  )
}

