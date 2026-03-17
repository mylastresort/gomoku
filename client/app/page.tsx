"use client"

import * as React from "react"
import Link from "next/link"
import { Header } from "@/components/gomoku/Header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SettingsDialog } from "@/components/gomoku/SettingsDialog"
import { gameClient } from "@/lib/adapters/gameClient"
import { useToast } from "@/components/ui/toast"
import type { GameSettings } from "@/lib/gomoku/types"

const defaultSettings: GameSettings = {
  boardSize: 15,
  showCoordinates: false,
  soundEnabled: false,
  aiDifficulty: 3,
}

export default function Home() {
  const { toast } = useToast()
  const [settings, setSettings] = React.useState<GameSettings>(defaultSettings)
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [connectionStatus, setConnectionStatus] =
    React.useState<"connecting" | "online" | "offline">("offline")

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

  return (
    <div className="flex flex-col min-h-screen">
      <Header connectionStatus={connectionStatus} onSettingsClick={() => setSettingsOpen(true)} />
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 text-center">
              <h2 className="text-2xl font-bold">Start a Match</h2>
              <p className="text-muted-foreground">Choose a game mode to begin</p>
              <div className="flex flex-col gap-2 pt-4">
                <Button asChild>
                  <Link href="/local">Local PvP</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/ai">vs AI</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/online">Online</Link>
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
        onSettingsChange={(s) =>
          setSettings((prev: GameSettings) => ({ ...prev, ...s }))
        }
        mode="local"
      />
    </div>
  )
}
