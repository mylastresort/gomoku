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
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import type { GameSettings, GameMode } from "@/lib/gomoku/types"

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: GameSettings
  onSettingsChange: (settings: Partial<GameSettings>) => void
  mode: GameMode
}

export function SettingsDialog({
  open,
  onOpenChange,
  settings,
  onSettingsChange,
  mode,
}: SettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogClose onClose={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Customize your game experience
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Show Coordinates</label>
              <p className="text-xs text-muted-foreground">
                Display row and column labels
              </p>
            </div>
            <Switch
              checked={settings.showCoordinates}
              onChange={(e) =>
                onSettingsChange({ showCoordinates: e.target.checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Sound Effects</label>
              <p className="text-xs text-muted-foreground">
                Play sounds for moves
              </p>
            </div>
            <Switch
              checked={settings.soundEnabled}
              onChange={(e) =>
                onSettingsChange({ soundEnabled: e.target.checked })
              }
            />
          </div>

          {(mode === "ai" || mode === "eve") && (
            <>
              <Separator />
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">AI Difficulty</label>
                <Slider
                  min={1}
                  max={5}
                  step={1}
                  value={settings.aiDifficulty}
                  onChange={(e) =>
                    onSettingsChange({
                      aiDifficulty: Number(e.target.value),
                    })
                  }
                  label="Difficulty"
                />
                <p className="text-xs text-muted-foreground">
                  Level {settings.aiDifficulty} of 5
                </p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

