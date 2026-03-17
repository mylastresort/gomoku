"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

function Spinner() {
  return (
    <div
      className="h-6 w-6 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin"
      aria-label="Loading"
    />
  )
}

export function LoadingModal({
  open,
  title,
  description,
}: {
  open: boolean
  title: string
  description?: string
}) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="flex items-center justify-center py-2">
          <Spinner />
        </div>
      </DialogContent>
    </Dialog>
  )
}

