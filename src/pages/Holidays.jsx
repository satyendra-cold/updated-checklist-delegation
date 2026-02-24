"use client"
import React, { useState, useEffect, useCallback } from 'react'
import { Calendar, Briefcase, Plus, X, Loader2, RefreshCw } from 'lucide-react'
import AdminLayout from '../components/layout/AdminLayout'
import { isSuperAdmin } from '../utils/authUtils'

// Configuration
const CONFIG = {
    SHEET_ID: "1YCLFppf8OrwZjKjhVyVB77s63vFQUylXzEniWLeatW0",
    WORKING_DAY_SHEET: "Working Day Calendar",
    HOLIDAY_SHEET: "Holiday List",
    APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbyGf3LdYk6MPiOs_shPU9_AW7wmRjJZ4QxMk9qYqTScsDMB7IliaWRB1HueYy7w5qxqNw/exec"
}

function Holidays() {
    const [activeTab, setActiveTab] = useState('working-days')
    const [workingDaysData, setWorkingDaysData] = useState([])
    const [holidaysData, setHolidaysData] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [showAddModal, setShowAddModal] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [successMessage, setSuccessMessage] = useState('')

    // Form states for adding new data
    const [newWorkingDay, setNewWorkingDay] = useState({
        workingDate: '',
        day: '',
        weekNum: '',
        month: ''
    })
    const [newHoliday, setNewHoliday] = useState({
        date: '',
        day: '',
        reason: ''
    })

    const canAddData = isSuperAdmin()

    const tabs = [
        { id: 'working-days', label: 'Working Days', icon: Briefcase },
        { id: 'holidays', label: 'Holidays', icon: Calendar },
    ]

    // Format date from Google Sheets format
    const formatDate = (dateValue) => {
        if (!dateValue) return ""
        try {
            // Already in DD/MM/YYYY format
            if (typeof dateValue === "string" && dateValue.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
                return dateValue
            }

            // Google Sheets Date format: Date(2025,11,12)
            if (typeof dateValue === "string" && dateValue.startsWith("Date(")) {
                const match = dateValue.match(/Date\((\d+),(\d+),(\d+)/)
                if (match) {
                    const year = parseInt(match[1], 10)
                    const month = parseInt(match[2], 10) + 1 // 0-indexed
                    const day = parseInt(match[3], 10)
                    return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`
                }
            }

            // Try parsing as date
            const d = new Date(dateValue)
            if (!isNaN(d.getTime())) {
                const dd = String(d.getDate()).padStart(2, "0")
                const mm = String(d.getMonth() + 1).padStart(2, "0")
                const yyyy = d.getFullYear()
                return `${dd}/${mm}/${yyyy}`
            }

            return dateValue
        } catch {
            return dateValue
        }
    }

    // Fetch data from Google Sheets
    const fetchData = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)

            // Dynamic fetch function for different sheets
            const fetchFromSheet = async (sheetName) => {
                const response = await fetch(`${CONFIG.APPS_SCRIPT_URL}?sheet=${encodeURIComponent(sheetName)}&action=fetch`)
                if (!response.ok) throw new Error(`Failed to fetch from ${sheetName}`)

                const responseText = await response.text()
                let parsedData;

                try {
                    parsedData = JSON.parse(responseText)
                } catch (parseError) {
                    const jsonStart = responseText.indexOf("{")
                    const jsonEnd = responseText.lastIndexOf("}")
                    if (jsonStart !== -1 && jsonEnd !== -1) {
                        parsedData = JSON.parse(responseText.substring(jsonStart, jsonEnd + 1))
                    } else {
                        throw new Error(`Invalid JSON response for ${sheetName}`)
                    }
                }

                let rows = []
                if (parsedData.table && parsedData.table.rows) {
                    rows = parsedData.table.rows
                } else if (Array.isArray(parsedData)) {
                    rows = parsedData
                } else if (parsedData.values) {
                    rows = parsedData.values.map(r => ({ c: r.map(v => ({ v: v })) }))
                }
                return rows
            }

            // Fetch both sheets in parallel
            const [workingDayRows, holidayRows] = await Promise.all([
                fetchFromSheet(CONFIG.WORKING_DAY_SHEET),
                fetchFromSheet(CONFIG.HOLIDAY_SHEET)
            ])

            // Process Working Days (Columns A-D: 0-3)
            const workingDays = workingDayRows.slice(1).map((row, index) => {
                let rowValues = []
                if (row.c) {
                    rowValues = row.c.map(cell => cell && cell.v !== undefined ? cell.v : "")
                } else if (Array.isArray(row)) {
                    rowValues = row
                }

                if (rowValues.length === 0) return null

                return {
                    _id: `working_${index}`,
                    _rowIndex: index + 2,
                    workingDate: formatDate(rowValues[0]),
                    day: rowValues[1] || "",
                    weekNum: rowValues[2] || "",
                    month: rowValues[3] || ""
                }
            }).filter(d => d && (d.workingDate || d.day))

            // Process Holidays (Columns A-C: 0-2 from Holiday List sheet)
            const holidays = holidayRows.slice(1).map((row, index) => {
                let rowValues = []
                if (row.c) {
                    rowValues = row.c.map(cell => cell && cell.v !== undefined ? cell.v : "")
                } else if (Array.isArray(row)) {
                    rowValues = row
                }

                if (rowValues.length === 0) return null

                return {
                    _id: `holiday_${index}`,
                    _rowIndex: index + 2,
                    date: formatDate(rowValues[0]),
                    day: rowValues[1] || "",
                    reason: rowValues[2] || ""
                }
            }).filter(h => h && (h.date || h.reason))

            setWorkingDaysData(workingDays)
            setHolidaysData(holidays)

        } catch (err) {
            console.error("Error fetching data:", err)
            setError("Failed to load data. Please check your network or spreadsheet.")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    // Get day name from date
    const getDayName = (dateString) => {
        if (!dateString) return ''
        try {
            const [day, month, year] = dateString.split('/')
            const date = new Date(year, month - 1, day)
            return date.toLocaleDateString('en-US', { weekday: 'short' })
        } catch {
            return ''
        }
    }

    // Get week number from date
    const getWeekNumber = (dateString) => {
        if (!dateString) return ''
        try {
            const [day, month, year] = dateString.split('/')
            const date = new Date(year, month - 1, day)
            const firstDayOfYear = new Date(date.getFullYear(), 0, 1)
            const pastDaysOfYear = (date - firstDayOfYear) / 86400000
            return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)
        } catch {
            return ''
        }
    }

    // Get month name from date
    const getMonthNumber = (dateString) => {
        if (!dateString) return ''
        try {
            const [day, month, year] = dateString.split('/')
            return parseInt(month)
        } catch {
            return ''
        }
    }

    // Handle date input change for working days
    const handleWorkingDateChange = (e) => {
        const inputDate = e.target.value // YYYY-MM-DD format
        if (inputDate) {
            const [year, month, day] = inputDate.split('-')
            const formattedDate = `${day}/${month}/${year}`
            setNewWorkingDay({
                workingDate: formattedDate,
                day: getDayName(formattedDate),
                weekNum: getWeekNumber(formattedDate),
                month: getMonthNumber(formattedDate)
            })
        } else {
            setNewWorkingDay({ workingDate: '', day: '', weekNum: '', month: '' })
        }
    }

    // Handle date input change for holidays
    const handleHolidayDateChange = (e) => {
        const inputDate = e.target.value // YYYY-MM-DD format
        if (inputDate) {
            const [year, month, day] = inputDate.split('-')
            const formattedDate = `${day}/${month}/${year}`
            setNewHoliday(prev => ({
                ...prev,
                date: formattedDate,
                day: getDayName(formattedDate)
            }))
        } else {
            setNewHoliday(prev => ({ ...prev, date: '', day: '' }))
        }
    }

    // Submit new working day
    const handleAddWorkingDay = async () => {
        if (!newWorkingDay.workingDate) {
            alert('Please select a date')
            return
        }

        try {
            setSubmitting(true)

            // Format data as simple array for columns A-D (Working Days)
            const rowData = [
                newWorkingDay.workingDate,     // Column A - Working Date
                newWorkingDay.day,             // Column B - Day
                String(newWorkingDay.weekNum), // Column C - Week Num
                String(newWorkingDay.month)    // Column D - Month
            ]

            const formData = new FormData()
            formData.append('action', 'insertWorkingDay')
            formData.append('sheetName', CONFIG.WORKING_DAY_SHEET)
            formData.append('rowData', JSON.stringify(rowData))

            const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
                method: 'POST',
                body: formData
            })

            const result = await response.json()

            if (result.success) {
                setSuccessMessage('Working day added successfully!')
                setNewWorkingDay({ workingDate: '', day: '', weekNum: '', month: '' })
                setShowAddModal(false)
                fetchData()
                setTimeout(() => setSuccessMessage(''), 3000)
            } else {
                throw new Error(result.error || 'Failed to add working day')
            }
        } catch (err) {
            console.error('Error adding working day:', err)
            alert('Failed to add working day: ' + err.message)
        } finally {
            setSubmitting(false)
        }
    }

    // Submit new holiday
    const handleAddHoliday = async () => {
        if (!newHoliday.date || !newHoliday.reason) {
            alert('Please fill in all required fields')
            return
        }

        try {
            setSubmitting(true)

            // Format data as simple array for columns F-H (Holidays)
            const rowData = [
                newHoliday.date,    // Column F - Date
                newHoliday.day,     // Column G - Day
                newHoliday.reason   // Column H - Holiday Reason
            ]

            const formData = new FormData()
            formData.append('action', 'insertHoliday')
            formData.append('sheetName', CONFIG.HOLIDAY_SHEET)
            formData.append('rowData', JSON.stringify(rowData))

            const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
                method: 'POST',
                body: formData
            })

            const result = await response.json()

            if (result.success) {
                setSuccessMessage('Holiday added successfully!')
                setNewHoliday({ date: '', day: '', reason: '' })
                setShowAddModal(false)
                fetchData()
                setTimeout(() => setSuccessMessage(''), 3000)
            } else {
                throw new Error(result.error || 'Failed to add holiday')
            }
        } catch (err) {
            console.error('Error adding holiday:', err)
            alert('Failed to add holiday: ' + err.message)
        } finally {
            setSubmitting(false)
        }
    }

    // Convert DD/MM/YYYY to YYYY-MM-DD for input
    const toInputDateFormat = (dateStr) => {
        if (!dateStr) return ''
        const [day, month, year] = dateStr.split('/')
        return `${year}-${month}-${day}`
    }

    return (
        <AdminLayout>
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4">
                <div className="max-w-6xl mx-auto">
                    {/* Header with Tabs and Add Button */}
                    <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        {/* Tabs */}
                        <div className="flex gap-2">
                            {tabs.map((tab) => {
                                const Icon = tab.icon
                                const isActive = activeTab === tab.id
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`
                                            flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm
                                            transition-all duration-200 ease-in-out
                                            ${isActive
                                                ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/25'
                                                : 'bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-800 shadow-sm border border-gray-200'
                                            }
                                        `}
                                    >
                                        <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                                        {tab.label}
                                    </button>
                                )
                            })}
                        </div>

                        {/* Add Button & Refresh */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={fetchData}
                                disabled={loading}
                                className="p-2 rounded-lg bg-white text-gray-600 hover:bg-gray-50 shadow-sm border border-gray-200 transition-all"
                                title="Refresh data"
                            >
                                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            </button>

                            {canAddData && (
                                <button
                                    onClick={() => setShowAddModal(true)}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm
                                        bg-gradient-to-r from-green-500 to-emerald-500 text-white 
                                        hover:from-green-600 hover:to-emerald-600 
                                        shadow-lg shadow-green-500/25 transition-all duration-200"
                                >
                                    <Plus className="h-4 w-4" />
                                    Add {activeTab === 'working-days' ? 'Working Day' : 'Holiday'}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Success Message */}
                    {successMessage && (
                        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center justify-between">
                            <span>{successMessage}</span>
                            <button onClick={() => setSuccessMessage('')} className="text-green-500 hover:text-green-700">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    )}

                    {/* Tab Content */}
                    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                        {loading ? (
                            <div className="p-12 text-center">
                                <Loader2 className="h-8 w-8 animate-spin text-purple-500 mx-auto mb-4" />
                                <p className="text-gray-600">Loading data...</p>
                            </div>
                        ) : error ? (
                            <div className="p-12 text-center">
                                <p className="text-red-600 mb-4">{error}</p>
                                <button
                                    onClick={fetchData}
                                    className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                                >
                                    Try Again
                                </button>
                            </div>
                        ) : (
                            <div className="p-6">
                                {activeTab === 'working-days' && (
                                    <div>
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg">
                                                <Briefcase className="h-5 w-5 text-white" />
                                            </div>
                                            <div>
                                                <h2 className="text-xl font-semibold text-gray-800">Working Days</h2>
                                                <p className="text-sm text-gray-500">{workingDaysData.length} records</p>
                                            </div>
                                        </div>

                                        {/* Working Days Table */}
                                        <div className="overflow-auto max-h-[calc(100vh-350px)] border rounded-lg">
                                            <table className="w-full border-separate border-spacing-0">
                                                <thead className="sticky top-0 z-10">
                                                    <tr className="bg-gradient-to-r from-blue-50 to-purple-50">
                                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b bg-inherit">S.No</th>
                                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b bg-inherit">Working Dates</th>
                                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b bg-inherit">Day</th>
                                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b bg-inherit">Week Num</th>
                                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b bg-inherit">Month</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {workingDaysData.length === 0 ? (
                                                        <tr>
                                                            <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                                                                No working days data available
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        workingDaysData.map((row, index) => (
                                                            <tr
                                                                key={row._id}
                                                                className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                                                            >
                                                                <td className="px-4 py-3 text-sm text-gray-600">{index + 1}</td>
                                                                <td className="px-4 py-3 text-sm text-gray-800 font-medium">{row.workingDate}</td>
                                                                <td className="px-4 py-3 text-sm text-gray-600">{row.day}</td>
                                                                <td className="px-4 py-3 text-sm text-gray-600">{row.weekNum}</td>
                                                                <td className="px-4 py-3 text-sm text-gray-600">{row.month}</td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'holidays' && (
                                    <div>
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg">
                                                <Calendar className="h-5 w-5 text-white" />
                                            </div>
                                            <div>
                                                <h2 className="text-xl font-semibold text-gray-800">Holidays</h2>
                                                <p className="text-sm text-gray-500">{holidaysData.length} records</p>
                                            </div>
                                        </div>

                                        {/* Holidays Table */}
                                        <div className="overflow-auto max-h-[calc(100vh-350px)] border rounded-lg">
                                            <table className="w-full border-separate border-spacing-0">
                                                <thead className="sticky top-0 z-10">
                                                    <tr className="bg-gradient-to-r from-blue-50 to-purple-50">
                                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b bg-inherit">S.No</th>
                                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b bg-inherit">Date</th>
                                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b bg-inherit">Day</th>
                                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b bg-inherit">Holiday (Reason)</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {holidaysData.length === 0 ? (
                                                        <tr>
                                                            <td colSpan="4" className="px-4 py-8 text-center text-gray-500">
                                                                No holidays data available
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        holidaysData.map((row, index) => (
                                                            <tr
                                                                key={row._id}
                                                                className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                                                            >
                                                                <td className="px-4 py-3 text-sm text-gray-600">{index + 1}</td>
                                                                <td className="px-4 py-3 text-sm text-gray-800 font-medium">{row.date}</td>
                                                                <td className="px-4 py-3 text-sm text-gray-600">{row.day}</td>
                                                                <td className="px-4 py-3 text-sm text-gray-600">{row.reason}</td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 transform transition-all">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-semibold text-gray-800">
                                Add {activeTab === 'working-days' ? 'Working Day' : 'Holiday'}
                            </h3>
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                                <X className="h-5 w-5 text-gray-500" />
                            </button>
                        </div>

                        {activeTab === 'working-days' ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Date <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={toInputDateFormat(newWorkingDay.workingDate)}
                                        onChange={handleWorkingDateChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Day</label>
                                        <input
                                            type="text"
                                            value={newWorkingDay.day}
                                            readOnly
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Week</label>
                                        <input
                                            type="text"
                                            value={newWorkingDay.weekNum}
                                            readOnly
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                                        <input
                                            type="text"
                                            value={newWorkingDay.month}
                                            readOnly
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={handleAddWorkingDay}
                                    disabled={submitting || !newWorkingDay.workingDate}
                                    className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium rounded-lg
                                        hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed
                                        transition-all duration-200 flex items-center justify-center gap-2"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Adding...
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="h-4 w-4" />
                                            Add Working Day
                                        </>
                                    )}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Date <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={toInputDateFormat(newHoliday.date)}
                                        onChange={handleHolidayDateChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Day</label>
                                    <input
                                        type="text"
                                        value={newHoliday.day}
                                        readOnly
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Holiday Reason <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={newHoliday.reason}
                                        onChange={(e) => setNewHoliday(prev => ({ ...prev, reason: e.target.value }))}
                                        placeholder="e.g., Republic Day, Diwali"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                    />
                                </div>
                                <button
                                    onClick={handleAddHoliday}
                                    disabled={submitting || !newHoliday.date || !newHoliday.reason}
                                    className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium rounded-lg
                                        hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed
                                        transition-all duration-200 flex items-center justify-center gap-2"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Adding...
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="h-4 w-4" />
                                            Add Holiday
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </AdminLayout>
    )
}

export default Holidays