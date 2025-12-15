import React, { useState, useRef, useEffect } from 'react'

// Debug helper to silence verbose logs; toggle flag to true when needed
const debugLog = (..._args) => {
  // Set to true for local debugging
  if (false) {
    // eslint-disable-next-line no-console
    console.log(..._args)
  }
}

const DateTimePicker = ({ 
  value = { date: '', time: '' }, 
  onChange, 
  maxDate = null,
  disabled = false 
}) => {
  const timePickerRef = useRef(null)
  const dateInputRef = useRef(null)

  // Parse date from DD/MM/YYYY format
  const parseDate = (dateString) => {
    if (!dateString) return null
    // Try DD/MM/YYYY format first
    const parts = dateString.split('/')
    if (parts.length === 3) {
      const [day, month, year] = parts
      if (day && month && year) {
        return new Date(year, month - 1, day)
      }
    }
    // Try YYYY-MM-DD format (for maxDate prop)
    const parts2 = dateString.split('-')
    if (parts2.length === 3) {
      const [year, month, day] = parts2
      if (day && month && year) {
        return new Date(year, month - 1, day)
      }
    }
    return null
  }

  // Format date to DD/MM/YYYY
  const formatDate = (date) => {
    if (!date) return ''
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  // Parse time from HH:MM AM/PM format
  const parseTime = (timeString) => {
    debugLog('[DateTimePicker] parseTime() called with:', timeString)
    if (!timeString) {
      debugLog('[DateTimePicker] parseTime() - empty timeString, returning default')
      return { hour: '', minute: '', ampm: 'AM' }
    }
    const match = timeString.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
    if (match) {
      // Normalize hour: remove leading zeros to match dropdown format (1-12, not 01-12)
      const hourNum = parseInt(match[1], 10)
      const hour = hourNum.toString()
      // Normalize minute: remove leading zeros to match dropdown format
      const minuteNum = parseInt(match[2], 10)
      const minute = minuteNum.toString()
      const result = {
        hour: hour,
        minute: minute,
        ampm: match[3].toUpperCase()
      }
      debugLog('[DateTimePicker] parseTime() - match found:', { match, result })
      return result
    }
    debugLog('[DateTimePicker] parseTime() - no match, returning default')
    return { hour: '', minute: '', ampm: 'AM' }
  }

  // Format time to HH:MM AM/PM
  const formatTime = (hour, minute, ampm) => {
    if (!hour || !minute) return ''
    const h = hour.toString().padStart(2, '0')
    const m = minute.toString().padStart(2, '0')
    return `${h}:${m} ${ampm}`
  }

  // Format date string (DD/MM/YYYY or YYYY-MM-DD) to native input format YYYY-MM-DD
  const formatDateForInput = (dateString) => {
    const date = parseDate(dateString)
    if (!date) return ''
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    return `${year}-${month}-${day}`
  }

  // Helper function to get current time
  const getCurrentTime = () => {
    const now = new Date()
    const hours12 = (now.getHours() % 12 || 12).toString()
    // Round minutes to nearest 5 (since minutes dropdown has 5-minute increments)
    const minutesRaw = now.getMinutes()
    // Cap at 55 to ensure it matches an available option
    const minutesRounded = Math.min(55, Math.round(minutesRaw / 5) * 5)
    const minutes = minutesRounded.toString()
    const ampm = now.getHours() >= 12 ? 'PM' : 'AM'
    const result = { hour: hours12, minute: minutes, ampm }
    debugLog('[DateTimePicker] getCurrentTime() called:', {
      now: now.toLocaleTimeString(),
      hours12,
      minutesRaw,
      minutesRounded,
      minutes,
      ampm,
      result
    })
    return result
  }

  const [showTimePicker, setShowTimePicker] = useState(false)
  
  const [timeInput, setTimeInput] = useState(() => {
    debugLog('[DateTimePicker] Initial state setup - value.time:', value.time)
    // Initialize with current time if no value.time, otherwise parse the value
    if (value.time) {
      const parsed = parseTime(value.time)
      debugLog('[DateTimePicker] Initial state - parsed from value.time:', parsed)
      if (parsed.hour) {
        // Check if minute is valid for dropdown
        const minuteNum = parseInt(parsed.minute)
        const validMinutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]
        if (!validMinutes.includes(minuteNum)) {
          const roundedMinute = validMinutes.reduce((prev, curr) => 
            Math.abs(curr - minuteNum) < Math.abs(prev - minuteNum) ? curr : prev
          )
          debugLog('[DateTimePicker] Initial state - minute', minuteNum, 'not valid, rounding to:', roundedMinute)
          parsed.minute = roundedMinute.toString()
        }
        debugLog('[DateTimePicker] Initial state - returning parsed:', parsed)
        return parsed
      } else {
        const currentTime = getCurrentTime()
        debugLog('[DateTimePicker] Initial state - parsed.hour empty, returning current time:', currentTime)
        return currentTime
      }
    }
    const currentTime = getCurrentTime()
    debugLog('[DateTimePicker] Initial state - no value.time, returning current time:', currentTime)
    return currentTime
  })

  // Initialize time input from value prop
  useEffect(() => {
    debugLog('[DateTimePicker] useEffect [value.time] triggered:', { 'value.time': value.time })
    if (value.time) {
      const parsed = parseTime(value.time)
      // Check if minute is valid for dropdown and round if needed
      const minuteNum = parseInt(parsed.minute)
      const validMinutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]
      if (!validMinutes.includes(minuteNum)) {
        const roundedMinute = validMinutes.reduce((prev, curr) => 
          Math.abs(curr - minuteNum) < Math.abs(prev - minuteNum) ? curr : prev
        )
        debugLog('[DateTimePicker] useEffect [value.time] - minute', minuteNum, 'not valid, rounding to:', roundedMinute)
        parsed.minute = roundedMinute.toString()
      }
      debugLog('[DateTimePicker] useEffect [value.time] - setting timeInput to parsed:', parsed)
      setTimeInput(parsed)
    } else {
      // If no time value, initialize to current time
      const currentTime = getCurrentTime()
      debugLog('[DateTimePicker] useEffect [value.time] - no value.time, setting to current time:', currentTime)
      setTimeInput(currentTime)
    }
  }, [value.time])

  // Initialize time input when time picker opens (use current time from value or exact current time)
  useEffect(() => {
    debugLog('[DateTimePicker] useEffect [showTimePicker] triggered:', { showTimePicker, 'value.time': value.time })
    if (!showTimePicker) {
      debugLog('[DateTimePicker] useEffect [showTimePicker] - picker not open, returning')
      return
    }
    // If there's a time value displayed outside, use it; otherwise use exact current time
    if (value.time) {
      const parsed = parseTime(value.time)
      debugLog('[DateTimePicker] useEffect [showTimePicker] - value.time exists, parsed result:', parsed)
      // Check if parsed minute exists in dropdown options (0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55)
      const minuteNum = parseInt(parsed.minute)
      const validMinutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]
      if (!validMinutes.includes(minuteNum)) {
        // Round to nearest valid minute
        const roundedMinute = validMinutes.reduce((prev, curr) => 
          Math.abs(curr - minuteNum) < Math.abs(prev - minuteNum) ? curr : prev
        )
        debugLog('[DateTimePicker] useEffect [showTimePicker] - minute', minuteNum, 'not in valid options, rounding to:', roundedMinute)
        parsed.minute = roundedMinute.toString()
      }
      debugLog('[DateTimePicker] useEffect [showTimePicker] - setting timeInput to:', parsed)
      setTimeInput(parsed)
    } else {
      // If no time value, initialize to exact current time
      const currentTime = getCurrentTime()
      debugLog('[DateTimePicker] useEffect [showTimePicker] - no value.time, setting to current time:', currentTime)
      setTimeInput(currentTime)
    }
  }, [showTimePicker])

  // Get today's date
  const getToday = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return today
  }

  // Handle native date change (input type="date")
  const handleNativeDateChange = (e) => {
    const val = e.target.value // YYYY-MM-DD from native input
    if (!val) {
      onChange({ date: '', time: value.time || '' })
      return
    }
    const date = parseDate(val)
    if (date) {
      const formatted = formatDate(date) // convert to DD/MM/YYYY for parent value
      onChange({ date: formatted, time: value.time || '' })
    }
  }


  // Handle time input change
  const handleTimeInputChange = (field, val) => {
    if (field === 'hour') {
      const num = parseInt(val)
      if (val === '' || (num >= 1 && num <= 12)) {
        setTimeInput(prev => ({ ...prev, hour: val }))
      }
    } else if (field === 'minute') {
      const num = parseInt(val)
      if (val === '' || (num >= 0 && num <= 59)) {
        setTimeInput(prev => ({ ...prev, minute: val }))
      }
    } else if (field === 'ampm') {
      setTimeInput(prev => ({ ...prev, ampm: val }))
    }
  }

  // No-op effect retained for dependency consistency after removing scroll syncing
  useEffect(() => {}, [showTimePicker, timeInput.hour, timeInput.minute])

  // Handle time set
  const handleTimeSet = () => {
    if (timeInput.hour && timeInput.minute) {
      const formattedTime = formatTime(timeInput.hour, timeInput.minute, timeInput.ampm)
      onChange({ date: value.date || '', time: formattedTime })
      setShowTimePicker(false)
    }
  }

  // Handle time reset to current time
  const handleTimeReset = () => {
    setTimeInput(getCurrentTime())
  }

  // Close time picker on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (timePickerRef.current && !timePickerRef.current.contains(event.target)) {
        setShowTimePicker(false)
      }
    }
    
    if (showTimePicker) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [showTimePicker])


  return (
    <>
      <style>{`
        .dt-picker-container {
          background: #FFFFFF;
          border-radius: 6px;
          padding: 8px 12px;
          border: 2px solid #87CEEB;
          width: 100%;
          max-width: 300px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        @media (max-width: 768px) {
          .dt-picker-container {
            max-width: 100%;
          }
        }

        .dt-picker-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .dt-picker-row.date-row {
          position: relative;
        }

        .dt-picker-row:last-child {
          margin-bottom: 0;
        }

        .dt-picker-label {
          font-size: 14px;
          font-weight: 600;
          color: #333;
          min-width: 45px;
        }

        .dt-picker-input {
          flex: 1;
          width: 91%;
          border: 1px solid #D3D3D3;
          border-radius: 4px;
          outline: none;
          font-size: 14px;
          color: #333;
          background: #FFFFFF;
          cursor: pointer;
          padding: 6px 10px;
          text-align: center;
        }

        /* Responsive label and input sizes */
        @media (max-width: 1200px) {
          .dt-picker-label {
            font-size: 14px;
          }

          .dt-picker-input {
            font-size: 14px;
            width: 91%;
          }
        }

        @media (minwidth: 768px) and (max-width:1100px) {
          .dt-picker-label {
            font-size: 14px;
          }

          .dt-picker-input {
            font-size: 14px;
            width: 91%;
          }
        }

        @media (max-width: 768px) {
          .dt-picker-label {
            font-size: 12px;
            min-width: 40px;
          }

          .dt-picker-input {
            font-size: 12px;
            width: 96%;
            padding: 6px 8px;
          }
        }

        @media (max-width: 480px) {
          .dt-picker-label {
            font-size: 12px;
            min-width: 35px;
          }

          .dt-picker-input {
            font-size: 12px;
            width: 96%;
            padding: 5px 6px;
          }
        }

        @media (max-width: 360px) {
          .dt-picker-label {
            font-size: 11px;
            min-width: 30px;
          }

          .dt-picker-input {
            font-size: 11px;
            width: 94%;
            padding: 4px 5px;
          }
        }

        .dt-picker-input::placeholder {
          color: #999;
        }

        .dt-picker-input:focus {
          outline: none;
          border-color: #87CEEB;
        }

        .dt-picker-input:hover {
          border-color: #B0B0B0;
        }

        .dt-picker-input-wrapper {
          position: relative;
          flex: 1;
          width: 100%;
          display: block;
        }

        .dt-picker-native {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100%;
          min-width: 100%;
          max-width: 100%;
          height: 100%;
          min-height: 100%;
          max-height: 100%;
          display: block;
          opacity: 0;
          cursor: pointer;
          appearance: none;
          border: none;
          padding: 0;
          margin: 0;
          box-sizing: border-box;
          background: transparent;
          pointer-events: auto;
          z-index: 2;
        }

        .dt-picker-native::-webkit-inner-spin-button,
        .dt-picker-native::-webkit-calendar-picker-indicator {
          display: none;
          appearance: none;
        }


        /* Time Picker Modal */
        .dt-time-picker-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          padding: 20px;
        }

        .dt-time-picker-modal {
          background: #FFFFFF;
          border-radius: 8px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
          min-width: 300px;
          max-width: 400px;
          width: 100%;
          overflow: hidden;
        }

        .dt-time-picker-header {
          background: #1976d2;
          color: #FFFFFF;
          padding: 16px;
          font-size: 18px;
          font-weight: 600;
          border-radius: 8px 8px 0 0;
        }

        .dt-time-picker-body {
          padding: 24px;
        }

        .dt-time-picker-instruction {
          font-size: 14px;
          color: #666;
          margin-bottom: 20px;
        }

        .dt-time-picker-inputs {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 20px;
        }

        .dt-time-picker-input-group {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .dt-time-picker-select {
          width: 70px;
          padding: 8px;
          font-size: 16px;
          font-weight: 500;
          text-align: center;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: #fff;
          outline: none;
          appearance: none;
        }

        .dt-time-picker-select:focus {
          border-color: #1976d2;
          box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
        }

        .dt-time-picker-select option,
        .dt-time-picker-ampm-select option {
          font-size: 16px;
          font-weight: 500;
        }

        .dt-time-picker-scroll-item.selected {
          background-color: #1976d2;
          color: #FFFFFF;
          font-weight: 600;
        }

        .dt-time-picker-separator {
          font-size: 24px;
          font-weight: 500;
          color: #333;
          align-self: flex-start;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 34px;
          line-height: 1;
          margin-top: 0;
          padding: 0;
          position: relative;
          top: -1px;
        }

        .dt-time-picker-label {
          font-size: 12px;
          color: #666;
          margin-top: 4px;
          font-weight: 500;
        }

        .dt-time-picker-ampm {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .dt-time-picker-ampm-select {
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 8px 12px;
          font-size: 14px;
          cursor: pointer;
          background: #FFFFFF;
          color: #333;
          outline: none;
        }

        .dt-time-picker-ampm-select:focus {
          border-color: #1976d2;
        }

        .dt-time-picker-clock-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 8px;
          color: #666;
        }

        .dt-time-picker-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 24px;
        }

        .dt-time-picker-action-btn {
          background: none;
          border: none;
          color: #1976d2;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          padding: 8px 16px;
        }

        .dt-time-picker-action-btn:hover {
          text-decoration: underline;
        }

        .dt-time-picker-action-btn.set {
          color: #1976d2;
        }

        .dt-time-picker-action-btn.clear {
          color: #d32f2f;
        }

        .dt-time-picker-action-btn.clear:hover {
          color: #c62828;
        }
      `}</style>

      <div className="dt-picker-container" style={{ position: 'relative' }}>
        {/* Date Row - native date input hidden, display as DD/MM/YYYY */}
        <div className="dt-picker-row date-row">
          <label className="dt-picker-label">Date:</label>
          <div
            className="dt-picker-input-wrapper"
            onClick={() => {
              if (disabled) return
              if (dateInputRef.current) {
                try {
                  dateInputRef.current.showPicker?.()
                } catch (_) {
                  // showPicker may not be supported; focus instead
                }
                dateInputRef.current.focus()
              }
            }}
          >
            <input
              type="text"
              className="dt-picker-input"
              value={value.date ? (() => { const d = parseDate(value.date); return d ? formatDate(d) : '' })() : ''}
              placeholder="DD/MM/YYYY"
              readOnly
              disabled={disabled}
            />
            <input
              ref={dateInputRef}
              type="date"
              className="dt-picker-native"
              value={formatDateForInput(value.date)}
              max={maxDate || formatDateForInput(getToday())}
              onChange={handleNativeDateChange}
              disabled={disabled}
            />
          </div>
        </div>

        {/* Time Row */}
        <div className="dt-picker-row">
          <label className="dt-picker-label">Time:</label>
          <input
            type="text"
            className="dt-picker-input"
            value={value.time || ''}
            placeholder="HH:MM AM / PM"
            onClick={() => !disabled && setShowTimePicker(true)}
            readOnly
            disabled={disabled}
          />
        </div>

        {/* Date Picker Modal removed - using native date input */}

        {/* Time Picker Modal */}
        {showTimePicker && (
          <div className="dt-time-picker-overlay">
            <div className="dt-time-picker-modal" ref={timePickerRef}>
              <div className="dt-time-picker-header">Set time</div>
              <div className="dt-time-picker-body">
                {(() => {
                  debugLog('[DateTimePicker] Time picker modal rendering - timeInput state:', timeInput)
                  debugLog('[DateTimePicker] Time picker modal rendering - value.time:', value.time)
                  return null
                })()}
                <div className="dt-time-picker-instruction">Type in time</div>
                
                <div className="dt-time-picker-inputs">
                  <div className="dt-time-picker-input-group">
                    {(() => {
                      debugLog('[DateTimePicker] Rendering hours select - timeInput.hour:', timeInput.hour)
                      const hourOptions = Array.from({ length: 12 }, (_, i) => i + 1)
                      debugLog('[DateTimePicker] Available hour options:', hourOptions.map(h => h.toString()))
                      const hourValue = timeInput.hour || ''
                      const hourExists = hourOptions.some(h => h.toString() === hourValue)
                      debugLog('[DateTimePicker] Hour value exists in options?', hourExists, 'value:', hourValue)
                      return null
                    })()}
                    <select
                      className="dt-time-picker-select"
                      value={timeInput.hour || ''}
                      onChange={(e) => handleTimeInputChange('hour', e.target.value)}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(hour => (
                        <option key={hour} value={hour.toString()}>
                          {hour.toString().padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                    <div className="dt-time-picker-label">Hours</div>
                  </div>
                  
                  <div className="dt-time-picker-separator">:</div>
                  
                  <div className="dt-time-picker-input-group">
                    {(() => {
                      debugLog('[DateTimePicker] Rendering minutes select - timeInput.minute:', timeInput.minute)
                      const minuteOptions = Array.from({ length: 12 }, (_, i) => i * 5)
                      debugLog('[DateTimePicker] Available minute options:', minuteOptions.map(m => m.toString()))
                      const minuteValue = timeInput.minute || ''
                      const minuteExists = minuteOptions.some(m => m.toString() === minuteValue)
                      debugLog('[DateTimePicker] Minute value exists in options?', minuteExists, 'value:', minuteValue)
                      return null
                    })()}
                    <select
                      className="dt-time-picker-select"
                      value={timeInput.minute || ''}
                      onChange={(e) => handleTimeInputChange('minute', e.target.value)}
                    >
                      {Array.from({ length: 12 }, (_, i) => i * 5).map(minute => (
                        <option key={minute} value={minute.toString()}>
                          {minute.toString().padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                    <div className="dt-time-picker-label">Minutes</div>
                  </div>
                  
                  <div className="dt-time-picker-input-group">
                    <select
                      className="dt-time-picker-ampm-select dt-time-picker-select"
                      value={timeInput.ampm}
                      onChange={(e) => handleTimeInputChange('ampm', e.target.value)}
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                    <div className="dt-time-picker-label">AM / PM</div>
                  </div>
                </div>

                <div className="dt-time-picker-actions">
                  <button
                    className="dt-time-picker-action-btn clear"
                    onClick={handleTimeReset}
                    type="button"
                  >
                    Reset
                  </button>
                  <button
                    className="dt-time-picker-action-btn"
                    onClick={() => setShowTimePicker(false)}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="dt-time-picker-action-btn set"
                    onClick={handleTimeSet}
                    type="button"
                    disabled={!timeInput.hour || !timeInput.minute}
                    style={{ opacity: (!timeInput.hour || !timeInput.minute) ? 0.5 : 1, cursor: (!timeInput.hour || !timeInput.minute) ? 'not-allowed' : 'pointer' }}
                  >
                    Set
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default DateTimePicker

