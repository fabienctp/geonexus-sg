
import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "../../lib/utils"
import { buttonVariants } from "./button"
import { Select } from "./select"
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  eachDayOfInterval,
  setMonth,
  setYear,
  getMonth,
  getYear
} from "date-fns"

export type CalendarProps = {
  mode?: "single" | "range" | "multiple"
  selected?: Date | undefined
  onSelect?: (date: Date | undefined) => void
  className?: string
  classNames?: any
  showOutsideDays?: boolean
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  mode = "single",
  selected,
  onSelect,
  ...props
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(selected || new Date())

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart)
  const endDate = endOfWeek(monthEnd)

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate })

  const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  const years = React.useMemo(() => {
      const currentYear = new Date().getFullYear();
      const yrs = [];
      for (let i = currentYear - 100; i <= currentYear + 50; i++) {
          yrs.push(i);
      }
      return yrs;
  }, []);

  const handleDayClick = (day: Date) => {
    if (onSelect) {
      if (mode === "single") {
        // Toggle if same day
        if (selected && isSameDay(day, selected)) {
          onSelect(undefined)
        } else {
          onSelect(day)
          // Also update current month view if clicked date is in another month
          if (!isSameMonth(day, currentMonth)) {
              setCurrentMonth(day);
          }
        }
      }
      // Implement range/multiple if needed later
    }
  }

  const handleMonthChange = (newMonthIndex: string) => {
      setCurrentMonth(setMonth(currentMonth, parseInt(newMonthIndex)));
  };

  const handleYearChange = (newYear: string) => {
      setCurrentMonth(setYear(currentMonth, parseInt(newYear)));
  };

  return (
    <div className={cn("p-3", className)} {...props}>
      <div className="flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0">
        <div className="space-y-4 w-full">
          
          {/* Header */}
          <div className="flex justify-between items-center pt-1 relative gap-1">
            <div className="flex items-center gap-1 flex-1">
               <Select 
                 value={getMonth(currentMonth).toString()}
                 onChange={(e) => handleMonthChange(e.target.value)}
                 className="h-8 text-xs py-1 px-2 w-[110px]"
               >
                  {months.map((m, i) => (
                      <option key={i} value={i}>{m}</option>
                  ))}
               </Select>
               <Select 
                 value={getYear(currentMonth).toString()}
                 onChange={(e) => handleYearChange(e.target.value)}
                 className="h-8 text-xs py-1 px-2 w-[80px]"
               >
                  {years.map(y => (
                      <option key={y} value={y}>{y}</option>
                  ))}
               </Select>
            </div>
            <div className="space-x-1 flex items-center">
               <button 
                 onClick={prevMonth} 
                 className={cn(buttonVariants({ variant: "outline" }), "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100")}
                 type="button"
               >
                 <ChevronLeft className="h-4 w-4" />
               </button>
               <button 
                 onClick={nextMonth} 
                 className={cn(buttonVariants({ variant: "outline" }), "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100")}
                 type="button"
               >
                 <ChevronRight className="h-4 w-4" />
               </button>
            </div>
          </div>

          {/* Grid */}
          <div className="w-full border-collapse space-y-1">
             {/* Weekday Headers */}
             <div className="flex">
               {weekDays.map(day => (
                 <div key={day} className="text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] flex justify-center">
                   {day}
                 </div>
               ))}
             </div>

             {/* Days */}
             <div className="grid grid-cols-7 gap-y-2 mt-2">
                {calendarDays.map((day, idx) => {
                   const isSelected = selected && isSameDay(day, selected)
                   const isToday = isSameDay(day, new Date())
                   const isOutside = !isSameMonth(day, currentMonth)

                   if (isOutside && !showOutsideDays) {
                     return <div key={day.toString()} className="h-9 w-9" />
                   }

                   return (
                     <div key={day.toString()} className="relative p-0 text-center text-sm focus-within:relative focus-within:z-20">
                        <button
                          onClick={() => handleDayClick(day)}
                          type="button"
                          className={cn(
                            buttonVariants({ variant: "ghost" }),
                            "h-9 w-9 p-0 font-normal aria-selected:opacity-100 rounded-md",
                            isSelected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                            !isSelected && isToday && "bg-accent text-accent-foreground",
                            isOutside && "text-muted-foreground opacity-50"
                          )}
                        >
                          <time dateTime={format(day, 'yyyy-MM-dd')}>
                            {format(day, "d")}
                          </time>
                        </button>
                     </div>
                   )
                })}
             </div>
          </div>

        </div>
      </div>
    </div>
  )
}

Calendar.displayName = "Calendar"

export { Calendar }
