"use client"

import Link from "next/link"
import { Header } from "@/components/gomoku/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header connectionStatus="offline" onSettingsClick={() => {}} />
      <main className="container mx-auto w-full px-4 py-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-emerald-500/70" />
                Project info
              </div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                About Gomoku
              </h1>
              <p className="text-sm text-muted-foreground sm:text-base">
                Tech stack, credits, and game rules.
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/">Back to game</Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Tech stack</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Rust</Badge>
                  <Badge variant="secondary">Axum</Badge>
                  <Badge variant="secondary">Tokio</Badge>
                  <Badge variant="secondary">Socket.IO</Badge>
                  <Badge variant="secondary">Python</Badge>
                  <Badge variant="secondary">Next.js</Badge>
                  <Badge variant="secondary">React</Badge>
                  <Badge variant="secondary">TypeScript</Badge>
                  <Badge variant="secondary">Tailwind CSS</Badge>
                  <Badge variant="secondary">shadcn/ui</Badge>
                </div>
                <Separator />
                <div className="grid gap-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Backend</span>
                    <span className="font-medium">Rust server + rules</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">AI</span>
                    <span className="font-medium">Python minimax + heuristics</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Frontend</span>
                    <span className="font-medium">Next.js client UI</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Transport</span>
                    <span className="font-medium">WebSocket events (Socket.IO)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Credits</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="grid gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">Abdelhamid Bouazi</div>
                      <div className="text-sm text-muted-foreground">abouaz</div>
                    </div>
                    <Badge variant="outline">Contributor</Badge>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">Samy Tamim</div>
                      <div className="text-sm text-muted-foreground">stamim</div>
                    </div>
                    <Badge variant="outline">Contributor</Badge>
                  </div>
                </div>
                <Separator />
                <p className="text-sm text-muted-foreground">
                  Built as a modern full‑stack Gomoku with a Python AI.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Rules</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2 text-sm">
                <div className="font-medium">Goal</div>
                <p className="text-muted-foreground">
                  Be the first player to create a continuous line of five stones
                  horizontally, vertically, or diagonally.
                </p>
              </div>

              <div className="grid gap-2 text-sm">
                <div className="font-medium">Turns</div>
                <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                  <li>Black plays first.</li>
                  <li>Players alternate turns by placing one stone on an empty intersection.</li>
                  <li>You can undo during play (AI mode may require a full turn before undo).</li>
                </ul>
              </div>

              <div className="grid gap-2 text-sm">
                <div className="font-medium">Forbidden positions (AI mode)</div>
                <p className="text-muted-foreground">
                  Some moves are marked as forbidden and cannot be played. These
                  are shown directly on the board when playing vs AI.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

