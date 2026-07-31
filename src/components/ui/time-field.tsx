"use client"

import * as React from "react"
import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"))

function minuteOptions(step: number) {
  const opts: string[] = []
  for (let m = 0; m < 60; m += step) opts.push(String(m).padStart(2, "0"))
  return opts
}

/**
 * בורר שעה: שעה משמאל, דקות מימין — כיוון קבוע (LTR) ללא תלות בכיוון העמוד,
 * לפי סגנון "Aurora" שאושר. מחליף input type="time".
 */
function TimeField({
  value,
  onChange,
  minuteStep = 5,
  id,
  className,
}: {
  value: string
  onChange: (value: string) => void
  minuteStep?: number
  id?: string
  className?: string
}) {
  const [hour = "00", minute = "00"] = value ? value.split(":") : []
  const minutes = React.useMemo(() => minuteOptions(minuteStep), [minuteStep])

  return (
    <div
      dir="ltr"
      className={cn(
        "flex items-center gap-1.5 rounded-xl border border-secondary bg-secondary px-2.5 py-1.5",
        className
      )}
    >
      <select
        id={id}
        aria-label="שעה"
        value={hour}
        onChange={(e) => onChange(`${e.target.value}:${minute}`)}
        className="flex-1 rounded-md border-none bg-transparent text-center text-sm text-foreground outline-none"
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="text-muted-foreground">:</span>
      <select
        aria-label="דקות"
        value={minute}
        onChange={(e) => onChange(`${hour}:${e.target.value}`)}
        className="flex-1 rounded-md border-none bg-transparent text-center text-sm text-foreground outline-none"
      >
        {minutes.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <Clock className="size-3.5 shrink-0 text-primary" />
    </div>
  )
}

export { TimeField }
