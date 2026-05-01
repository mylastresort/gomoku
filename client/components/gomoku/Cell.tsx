"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import type { Stone } from "@/lib/gomoku/types"

interface CellProps {
  stone: Stone
  row: number
  col: number
  isLastMove: boolean
  isHint?: boolean
  showCoordinates: boolean
  onCellClick: (row: number, col: number) => void
  onCellHover?: (row: number, col: number) => void
  hoverStone?: Stone | null
  isForbidden?: boolean
  disabled?: boolean
}

export function Cell({
  stone,
  row,
  col,
  isLastMove,
  isHint = false,
  showCoordinates,
  onCellClick,
  onCellHover,
  hoverStone,
  isForbidden = false,
  disabled = false,
}: CellProps) {
  const displayStone = hoverStone || stone

  // log if cell is forbidden
  React.useEffect(() => {
    if (!isForbidden) return;
    console.log(`Cell at [${row}, ${col}] is forbidden.`, row, col);
  }, [col, isForbidden, row]);

  return (
    <button
      className={cn(
        "relative flex items-center justify-center aspect-square transition-all duration-150",
        "border border-black/15 dark:border-white/10",
        "hover:bg-white/15 dark:hover:bg-white/5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isLastMove && "ring-2 ring-primary ring-offset-1 ring-offset-transparent",
        isHint && !stone && "ring-2 ring-amber-500/70 ring-offset-1 ring-offset-transparent",
        isForbidden && !stone && "hover:bg-red-500/10 dark:hover:bg-red-500/10 cursor-not-allowed"
      )}
      onClick={() => onCellClick(row, col)}
      onMouseEnter={() => onCellHover?.(row, col)}
      onMouseLeave={() => {
        if (onCellHover) {
          onCellHover(-1, -1)
        }
      }}
      aria-label={`Cell ${row + 1}, ${col + 1}`}
      disabled={disabled}
    >
      {displayStone && (
        <div
          className={cn(
            "absolute rounded-full transition-all",
            "shadow-[0_10px_25px_-12px_rgba(0,0,0,0.55)]",
            displayStone === "black"
              ? "bg-linear-to-br from-neutral-900 via-neutral-800 to-neutral-950 border border-black/40"
              : "bg-linear-to-br from-white via-neutral-50 to-neutral-200 border border-black/10 dark:border-white/10",
            hoverStone && !stone ? "opacity-50 scale-[0.92]" : "scale-100"
          )}
          style={{
            width: "75%",
            height: "75%",
          }}
        />
      )}
      {isForbidden && !stone && (
        <div className="absolute h-2.5 w-2.5 rounded-full bg-red-500/70 dark:bg-red-500/60 select-none pointer-events-none" />
      )}
      {isHint && !stone && (
        <div className="absolute h-4 w-4 rounded-full bg-amber-400/75 dark:bg-amber-300/70 pointer-events-none hint-blink" />
      )}
      {showCoordinates && (
        <span className="absolute text-[0.5rem] text-muted-foreground opacity-30 pointer-events-none">
          {col === 0 && String(row + 1)}
          {row === 0 && String.fromCharCode(65 + col)}
        </span>
      )}
    </button>
  )
}

