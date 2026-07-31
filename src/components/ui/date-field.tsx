"use client"

import * as React from "react"
import { CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

function toYMD(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function fromYMD(value: string) {
  if (!value) return undefined
  const [y, m, d] = value.split("-").map(Number)
  if (!y || !m || !d) return undefined
  return new Date(y, m - 1, d)
}

/**
 * בורר תאריך: כפתור עם התאריך הנוכחי שפותח פופאובר עם לוח חודש מלא
 * (דפדוף חודש קודם/הבא, כל שנה) — מחליף input type="date".
 */
function DateField({
  value,
  onChange,
  id,
  placeholder = "בחירת תאריך",
  className,
}: {
  value: string
  onChange: (value: string) => void
  id?: string
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const selected = fromYMD(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn("w-full justify-start gap-2 font-normal", className)}
          />
        }
      >
        <CalendarDays className="size-4 text-primary" />
        {selected
          ? selected.toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" })
          : <span className="text-muted-foreground">{placeholder}</span>}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            if (!date) return
            onChange(toYMD(date))
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

export { DateField }
