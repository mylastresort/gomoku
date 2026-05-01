"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { MoveList } from "./MoveList"
import type { GameState, GameMode } from "@/lib/gomoku/types"
import { RotateCcw, RefreshCw, Flag, Lightbulb } from "lucide-react"

type AiMetrics = {
  moveCount: number
  lastMoveMs: number | null
  averageMoveMs: number | null
  lastServerMs: number | null
  logs: Array<{
    id: number
    message: string
    timestamp: string
  }>
}

interface RightPanelProps {
  gameState: GameState
  mode: GameMode
  onModeChange: (mode: GameMode) => void
  onUndo: () => void
  onRestart: () => void
  onResign: () => void
  onHint: () => void
  aiStatus?: string | null
  aiMetrics?: AiMetrics | null
  actionsDisabled?: boolean
  hintDisabled?: boolean
}

export function RightPanel({
  gameState,
  mode,
  onModeChange,
  onUndo,
  onRestart,
  onResign,
  onHint,
  aiStatus = null,
  aiMetrics = null,
  actionsDisabled = false,
  hintDisabled = false,
}: RightPanelProps) {
  const canUndo = gameState.moves.length > 0
  const isEveMode = mode === "eve"

  return (
    <div className="flex min-h-0 w-full flex-col gap-4 lg:sticky lg:top-20">
      <Card>
        <CardHeader>
          <CardTitle>Match</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Tabs value={mode} onValueChange={(v) => onModeChange(v as GameMode)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="local" disabled={actionsDisabled}>
                1v1 Local
              </TabsTrigger>
              <TabsTrigger value="ai" disabled={actionsDisabled}>
                vs AI
              </TabsTrigger>
              <TabsTrigger value="eve" disabled={actionsDisabled}>
                EvE
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {aiStatus && (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              {aiStatus}
            </div>
          )}

          <Separator />

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-neutral-950 dark:bg-neutral-100 flex items-center justify-center text-white dark:text-neutral-950 text-xs font-bold">
                  {gameState.players.black.name[0].toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium truncate">
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
                <div className="h-8 w-8 rounded-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-neutral-950 dark:text-neutral-50 text-xs font-bold">
                  {gameState.players.white.name[0].toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium truncate">
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
              disabled={isEveMode || !canUndo || actionsDisabled}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Undo
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onHint}
              disabled={hintDisabled || actionsDisabled}
            >
              <Lightbulb className="h-4 w-4 mr-2" />
              Hint
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onRestart}
                className="flex-1"
                disabled={isEveMode || actionsDisabled}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Restart
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onResign}
                className="flex-1"
                disabled={actionsDisabled}
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
        <CardContent className="min-h-0">
          <MoveList moves={gameState.moves} lastMove={gameState.lastMove} />
        </CardContent>
      </Card>

      {aiMetrics && (
        <Card>
          <CardHeader>
            <CardTitle>AI Metrics</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md bg-muted/50 p-2">
                <div className="text-xs text-muted-foreground">Moves</div>
                <div className="font-medium">{aiMetrics.moveCount}</div>
              </div>
              <div className="rounded-md bg-muted/50 p-2">
                <div className="text-xs text-muted-foreground">Last</div>
                <div className="font-medium">
                  {aiMetrics.lastMoveMs === null ? "-" : `${aiMetrics.lastMoveMs}ms`}
                </div>
              </div>
              <div className="rounded-md bg-muted/50 p-2">
                <div className="text-xs text-muted-foreground">Average</div>
                <div className="font-medium">
                  {aiMetrics.averageMoveMs === null ? "-" : `${aiMetrics.averageMoveMs}ms`}
                </div>
              </div>
              <div className="rounded-md bg-muted/50 p-2">
                <div className="text-xs text-muted-foreground">Server</div>
                <div className="font-medium">
                  {aiMetrics.lastServerMs === null ? "-" : `${aiMetrics.lastServerMs}ms`}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="text-xs font-medium text-muted-foreground">AI Log</div>
              {aiMetrics.logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No AI moves yet</p>
              ) : (
                <div className="flex max-h-40 flex-col gap-1 overflow-y-auto pr-1">
                  {aiMetrics.logs.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-md border px-2 py-1 text-xs wrap-break-word"
                    >
                      <span className="text-muted-foreground">{entry.timestamp}</span>{" "}
                      {entry.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

