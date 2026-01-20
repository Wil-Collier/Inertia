import { format, addDays, subDays, parseISO } from "date-fns"
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { getToday } from "@/lib/dateUtils"

interface DateNavigatorProps {
  selectedDate: string
  onDateChange: (date: string) => void
  calendarOpen: boolean
  onCalendarOpenChange: (open: boolean) => void
}

export function DateNavigator({
  selectedDate,
  onDateChange,
  calendarOpen,
  onCalendarOpenChange,
}: DateNavigatorProps) {
  const isToday = selectedDate === getToday()
  const displayDate = isToday
    ? "Today"
    : format(parseISO(selectedDate), "EEE, MMM d")

  const handlePrevDay = () => {
    onDateChange(format(subDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))
  }

  const handleNextDay = () => {
    onDateChange(format(addDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))
  }

  return (
    <div className="flex items-center justify-between">
      <Button variant="ghost" size="icon" onClick={handlePrevDay} aria-label="Previous day">
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <div className="flex flex-col items-center gap-1">
        <Popover open={calendarOpen} onOpenChange={onCalendarOpenChange}>
          <PopoverTrigger
            className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-muted transition-colors"
          >
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-lg font-black tracking-tight">{displayDate}</span>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar
              mode="single"
              selected={parseISO(selectedDate)}
              onSelect={(date) => {
                if (date) {
                  onDateChange(format(date, "yyyy-MM-dd"))
                  onCalendarOpenChange(false)
                }
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        {!isToday && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs text-muted-foreground"
            onClick={() => onDateChange(getToday())}
          >
            Go to today
          </Button>
        )}
      </div>
      <Button variant="ghost" size="icon" onClick={handleNextDay} aria-label="Next day">
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  )
}
