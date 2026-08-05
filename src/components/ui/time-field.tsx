"use client"

import * as React from "react"
import { Clock } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"))

function minuteOptions(step: number) {
  const opts: string[] = []
  for (let m = 0; m < 60; m += step) opts.push(String(m).padStart(2, "0"))
  return opts
}

/**
 * בורר שעה: שעה משמאל, דקות מימין — כיוון קבוע (LTR) ללא תלות בכיוון העמוד,
 * לפי סגנון "Aurora" שאושר. מחליף input type="time". התפריטים תמיד נפתחים
 * כלפי מטה (side="bottom") כדי שלא "יקפצו" למעלה כשאין מקום מתחת.
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
      <Select
        value={hour}
        onValueChange={(v) => v && onChange(`${v}:${minute}`)}
      >
        <SelectTrigger id={id} aria-label="שעה" size="sm" className="flex-1 min-w-0 justify-center border-none bg-transparent px-1 shadow-none">
          <span>{hour}</span>
        </SelectTrigger>
        <SelectContent
          side="bottom"
          align="center"
          alignItemWithTrigger={false}
          collisionAvoidance={{ side: "none", align: "none" }}
          className="min-w-16"
        >
          {HOURS.map((h) => (
            <SelectItem key={h} value={h} className="justify-center">
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-muted-foreground">:</span>
      <Select
        value={minute}
        onValueChange={(v) => v && onChange(`${hour}:${v}`)}
      >
        <SelectTrigger aria-label="דקות" size="sm" className="flex-1 min-w-0 justify-center border-none bg-transparent px-1 shadow-none">
          <span>{minute}</span>
        </SelectTrigger>
        <SelectContent
          side="bottom"
          align="center"
          alignItemWithTrigger={false}
          collisionAvoidance={{ side: "none", align: "none" }}
          className="min-w-16"
        >
          {minutes.map((m) => (
            <SelectItem key={m} value={m} className="justify-center">
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Clock className="size-3.5 shrink-0 text-primary" />
    </div>
  )
}

export { TimeField }
