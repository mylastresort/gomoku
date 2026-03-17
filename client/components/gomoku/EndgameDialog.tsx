"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { GameState } from "@/lib/gomoku/types"

interface EndgameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  gameState: GameState
  onNewGame: () => void
}

export function EndgameDialog({
  open,
  onOpenChange,
  gameState,
  onNewGame,
}: EndgameDialogProps) {
  const winner = gameState.winner
  const winnerName = winner
    ? gameState.players[winner].name
    : "No one"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogClose onClose={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>Game Over</DialogTitle>
          <DialogDescription>
            {winner ? (
              <>
                <span className="font-semibold">{winnerName}</span> wins!
              </>
            ) : (
              "The game ended in a draw."
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 pt-4">
          <Button onClick={onNewGame} className="w-full">
            Restart
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

