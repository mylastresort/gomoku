"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { MoveList } from "./MoveList"
import type { GameState, GameMode } from "@/lib/gomoku/types"
import { RotateCcw, RefreshCw, Flag, LogOut } from "lucide-react"

interface RightPanelProps {
  gameState: GameState
  mode: GameMode
  onUndo: () => void
  onRestart: () => void
  onResign: () => void
  onExit: () => void
}

export function RightPanel({
  gameState,
  mode,
  onUndo,
  onRestart,
  onResign,
  onExit,
}: RightPanelProps) {
  const canUndo = gameState.moves.length > 0

  return (
    <div className="flex flex-col gap-4 w-full max-w-sm">
      <Card>
        <CardHeader>
          <CardTitle>Match</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Badge variant="outline">
              {mode === "local" && "Local"}
              {mode === "ai" && "vs AI"}
              {mode === "online" && "Online"}
            </Badge>
            <Button variant="outline" size="sm" onClick={onExit}>
              <LogOut className="h-4 w-4 mr-2" />
              Exit
            </Button>
          </div>

          <Separator />

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-black dark:bg-gray-900 flex items-center justify-center text-white text-xs font-bold">
                  {gameState.players.black.name[0].toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {gameState.players.black.name}
                  </span>
                  <span className="text-xs text-muted-foreground">Black</span>
                </div>
              </div>
              {gameState.currentPlayer === "black" && (
                <Badge variant="default">Turn</Badge>
              )}
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-white dark:bg-gray-100 border-2 border-gray-300 dark:border-gray-700 flex items-center justify-center text-black text-xs font-bold">
                  {gameState.players.white.name[0].toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {gameState.players.white.name}
                  </span>
                  <span className="text-xs text-muted-foreground">White</span>
                </div>
              </div>
              {gameState.currentPlayer === "white" && (
                <Badge variant="default">Turn</Badge>
              )}
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onUndo}
              disabled={!canUndo}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Undo
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onRestart}
                className="flex-1"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Restart
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onResign}
                className="flex-1"
              >
                <Flag className="h-4 w-4 mr-2" />
                Resign
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Moves</CardTitle>
        </CardHeader>
        <CardContent>
          <MoveList moves={gameState.moves} lastMove={gameState.lastMove} />
        </CardContent>
      </Card>

      {mode === "online" && (
        <Card>
          <CardHeader>
            <CardTitle>Chat</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-4">
              Chat feature coming soon
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

