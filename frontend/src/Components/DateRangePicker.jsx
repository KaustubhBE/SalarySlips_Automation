import React, { useState, useRef, useEffect } from 'react'
import './DateRangePicker.css'

const DateRangePicker = ({ startDate, endDate, onStartDateChange, onEndDateChange }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectingStart, setSelectingStart] = useState(true)
  const calendarRef = useRef(null)
  const clickTimersRef = useRef({})

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const formatDateForInput = (date) => {
    if (!date) return ''
    const d = new Date(date)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const formatDateForDisplay = (date) => {
    if (!date) return ''
    const d = new Date(date)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const getDaysInMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    return { daysInMonth, startingDayOfWeek, year, month }
  }

  const handleDateClick = (day, isDoubleClick = false) => {
    const selectedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    selectedDate.setHours(0, 0, 0, 0)

    // Double click: set both dates to the same date
    if (isDoubleClick) {
      onStartDateChange(formatDateForInput(selectedDate))
      onEndDateChange(formatDateForInput(selectedDate))
      setIsOpen(false)
      setSelectingStart(true)
      return
    }

    // First click or no start date: set as start date
    if (!startDate || selectingStart) {
      onStartDateChange(formatDateForInput(selectedDate))
      onEndDateChange('') // Clear end date when selecting new start
      setSelectingStart(false)
    } else {
      // Second click: set as end date
      const start = new Date(startDate)
      start.setHours(0, 0, 0, 0)
      
      if (selectedDate < start) {
        // If selected date is before start, make it the new start and clear end
        onStartDateChange(formatDateForInput(selectedDate))
        onEndDateChange('')
        setSelectingStart(false)
      } else {
        // Set as end date
        onEndDateChange(formatDateForInput(selectedDate))
        setIsOpen(false)
        setSelectingStart(true)
      }
    }
  }

  const isDateInRange = (day) => {
    if (!startDate && !endDate) return false
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    date.setHours(0, 0, 0, 0)
    
    const start = startDate ? new Date(startDate) : null
    const end = endDate ? new Date(endDate) : null

    if (start && end) {
      start.setHours(0, 0, 0, 0)
      end.setHours(0, 0, 0, 0)
      // Allow same date to be in range
      return date >= start && date <= end
    }
    return false
  }

  const isStartDate = (day) => {
    if (!startDate) return false
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    date.setHours(0, 0, 0, 0)
    const start = new Date(startDate)
    start.setHours(0, 0, 0, 0)
    return date.getTime() === start.getTime()
  }

  const isEndDate = (day) => {
    if (!endDate) return false
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    date.setHours(0, 0, 0, 0)
    const end = new Date(endDate)
    end.setHours(0, 0, 0, 0)
    return date.getTime() === end.getTime()
  }

  const isToday = (day) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    const today = new Date()
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    )
  }

  const handleInputClick = () => {
    setIsOpen(true)
    // If no start date, start selecting; otherwise prepare for end date
    if (!startDate) {
      setSelectingStart(true)
    } else if (!endDate) {
      setSelectingStart(false)
    } else {
      // If both dates exist, reset to start date selection
      setSelectingStart(true)
    }
  }

  const navigateMonth = (direction) => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev)
      newDate.setMonth(prev.getMonth() + direction)
      return newDate
    })
  }

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth)
  const days = []
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  // Add empty cells for days before the first day of the month
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null)
  }

  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day)
  }

  return (
    <div className="os-date-range-picker" ref={calendarRef}>
      <div className="os-date-range-inputs">
        <div className="os-date-input-wrapper">
          <label className="os-date-label">Start Date</label>
          <input
            type="text"
            value={formatDateForDisplay(startDate)}
            placeholder="Start Date"
            readOnly
            onClick={handleInputClick}
            className="os-date-range-input"
          />
        </div>
        <div className="os-date-separator">-</div>
        <div className="os-date-input-wrapper">
          <label className="os-date-label">End Date</label>
          <input
            type="text"
            value={formatDateForDisplay(endDate)}
            placeholder="End Date"
            readOnly
            onClick={handleInputClick}
            className="os-date-range-input"
          />
        </div>
      </div>

      {isOpen && (
        <div className="os-calendar-popup">
          <div className="os-calendar-header">
            <button
              type="button"
              onClick={() => navigateMonth(-1)}
              className="os-calendar-nav-btn"
            >
              ‹
            </button>
            <div className="os-calendar-month-year">
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </div>
            <button
              type="button"
              onClick={() => navigateMonth(1)}
              className="os-calendar-nav-btn"
            >
              ›
            </button>
          </div>
          <div className="os-calendar-grid">
            {dayNames.map(day => (
              <div key={day} className="os-calendar-day-name">
                {day}
              </div>
            ))}
            {days.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} className="os-calendar-day empty" />
              }

              const inRange = isDateInRange(day)
              const isStart = isStartDate(day)
              const isEnd = isEndDate(day)
              const today = isToday(day)
              const dayKey = `${currentMonth.getFullYear()}-${currentMonth.getMonth()}-${day}`
              
              return (
                <div
                  key={day}
                  className={`os-calendar-day ${inRange ? 'in-range' : ''} ${isStart ? 'start-date' : ''} ${isEnd ? 'end-date' : ''} ${today ? 'today' : ''}`}
                  onClick={() => {
                    const existingTimer = clickTimersRef.current[dayKey]
                    if (existingTimer) {
                      clearTimeout(existingTimer)
                      delete clickTimersRef.current[dayKey]
                      // Double click detected
                      handleDateClick(day, true)
                    } else {
                      const timer = setTimeout(() => {
                        handleDateClick(day, false)
                        delete clickTimersRef.current[dayKey]
                      }, 300) // 300ms delay to detect double click
                      clickTimersRef.current[dayKey] = timer
                    }
                  }}
                >
                  {day}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default DateRangePicker

