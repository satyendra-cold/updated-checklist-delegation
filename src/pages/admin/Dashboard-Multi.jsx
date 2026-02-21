"use client"

import { useState, useEffect } from "react"
import { BarChart3, CheckCircle2, Clock, ListTodo, Users, AlertTriangle, Filter } from "lucide-react"
import AdminLayout from "../../components/layout/AdminLayout.jsx"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"

export default function AdminDashboard() {
  const [dashboardType, setDashboardType] = useState("checklist")
  const [taskView, setTaskView] = useState("recent")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterStaff, setFilterStaff] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("overview")

  // State for Master Sheet dropdown
  const [masterSheetOptions, setMasterSheetOptions] = useState([])
  const [selectedMasterOption, setSelectedMasterOption] = useState("")
  const [isFetchingMaster, setIsFetchingMaster] = useState(false)

  // Cache for improved performance
  const [dataCache, setDataCache] = useState(new Map())

  // Apps Script URL - UPDATE THIS WITH YOUR DEPLOYED APPS SCRIPT URL
  const APPS_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbyGf3LdYk6MPiOs_shPU9_AW7wmRjJZ4QxMk9qYqTScsDMB7IliaWRB1HueYy7w5qxqNw/exec"

  // State for department data
  const [departmentData, setDepartmentData] = useState({
    allTasks: [],
    staffMembers: [],
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    overdueTasks: 0,
    activeStaff: 0,
    completionRate: 0,
    barChartData: [],
    pieChartData: [],
    // Add new counters for delegation mode
    completedRatingOne: 0,
    completedRatingTwo: 0,
    completedRatingThreePlus: 0,
  })

  // Store the current date for overdue calculation
  const [currentDate, setCurrentDate] = useState(new Date())

  // New state for date range filtering
  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: "",
    filtered: false,
  })

  // State to store filtered statistics
  const [filteredDateStats, setFilteredDateStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    overdueTasks: 0,
    completionRate: 0,
  })

  // Helper function to format date from ISO format to DD/MM/YYYY
  const formatLocalDate = (isoDate) => {
    if (!isoDate) return ""
    const date = new Date(isoDate)
    return formatDateToDDMMYYYY(date)
  }

  // Function to filter tasks by date range
  const filterTasksByDateRange = () => {
    // Validate dates
    if (!dateRange.startDate || !dateRange.endDate) {
      alert("Please select both start and end dates")
      return
    }

    const startDate = new Date(dateRange.startDate)
    startDate.setHours(0, 0, 0, 0)

    const endDate = new Date(dateRange.endDate)
    endDate.setHours(23, 59, 59, 999)

    if (startDate > endDate) {
      alert("End Date must be before end date")
      return
    }

    // Filter tasks within the date range
    const filteredTasks = departmentData.allTasks.filter((task) => {
      const taskStartDate = parseDateFromDDMMYYYY(task.taskStartDate)
      if (!taskStartDate) return false

      return taskStartDate >= startDate && taskStartDate <= endDate
    })

    // Count statistics
    const totalTasks = filteredTasks.length
    let completedTasks = 0
    let pendingTasks = 0
    let overdueTasks = 0

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    filteredTasks.forEach((task) => {
      if (task.status === "completed") {
        completedTasks++
      } else {
        // Task is not completed
        pendingTasks++ // All incomplete tasks count as pending

        if (task.status === "overdue") {
          overdueTasks++ // Only past dates (excluding today) count as overdue
        }
      }
    })

    // Calculate completion rate
    const completionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0

    // Update filtered stats
    setFilteredDateStats({
      totalTasks,
      completedTasks,
      pendingTasks,
      overdueTasks,
      completionRate,
    })

    // Set filtered flag to true
    setDateRange((prev) => ({ ...prev, filtered: true }))
  }

  // Format date as DD/MM/YYYY
  const formatDateToDDMMYYYY = (date) => {
    const day = date.getDate().toString().padStart(2, "0")
    const month = (date.getMonth() + 1).toString().padStart(2, "0")
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  // Parse DD/MM/YYYY to Date object
  const parseDateFromDDMMYYYY = (dateStr) => {
    if (!dateStr || typeof dateStr !== "string") return null
    const parts = dateStr.split("/")
    if (parts.length !== 3) return null
    return new Date(parts[2], parts[1] - 1, parts[0])
  }

  // Function to check if a date is in the past
  const isDateInPast = (dateStr) => {
    const date = parseDateFromDDMMYYYY(dateStr)
    if (!date) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date < today
  }

  // Function to check if a date is today
  const isDateToday = (dateStr) => {
    const date = parseDateFromDDMMYYYY(dateStr)
    if (!date) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date.getTime() === today.getTime()
  }

  // Function to check if a date is tomorrow
  const isDateTomorrow = (dateStr) => {
    const date = parseDateFromDDMMYYYY(dateStr)
    if (!date) return false
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    return date.getTime() === tomorrow.getTime()
  }

  // Parse various date formats from Google Sheets - OPTIMIZED
  const parseGoogleSheetsDate = (dateValue) => {
    if (!dateValue) return ""

    // Fast path for Date objects
    if (dateValue instanceof Date && !isNaN(dateValue.getTime())) {
      return formatDateToDDMMYYYY(dateValue)
    }

    // Fast path for strings
    if (typeof dateValue === "string") {
      // Check DD/MM/YYYY format first (most common)
      if (dateValue.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
        const parts = dateValue.split("/")
        return `${parts[0].padStart(2, "0")}/${parts[1].padStart(2, "0")}/${parts[2]}`
      }

      // Google Sheets Date format
      if (dateValue.startsWith("Date(")) {
        const match = /Date$(\d+),(\d+),(\d+)$/.exec(dateValue)
        if (match) {
          const year = Number.parseInt(match[1], 10)
          const month = Number.parseInt(match[2], 10)
          const day = Number.parseInt(match[3], 10)
          return `${day.toString().padStart(2, "0")}/${(month + 1).toString().padStart(2, "0")}/${year}`
        }
      }

      // Try standard date parsing
      try {
        const date = new Date(dateValue)
        if (!isNaN(date.getTime())) {
          return formatDateToDDMMYYYY(date)
        }
      } catch (e) {
        // Silent fail
      }
    }

    // Excel serial date
    if (typeof dateValue === "number") {
      const excelEpoch = new Date(1900, 0, 1)
      const date = new Date(excelEpoch.getTime() + (dateValue - 2) * 24 * 60 * 60 * 1000)
      if (!isNaN(date.getTime())) {
        return formatDateToDDMMYYYY(date)
      }
    }

    return dateValue.toString()
  }

  // Function to fetch data using Apps Script
  const fetchDataFromAppsScript = async (sheetName) => {
    try {
      const response = await fetch(`${APPS_SCRIPT_URL}?sheet=${encodeURIComponent(sheetName)}&action=fetch`)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (!data.success && data.error) {
        throw new Error(data.error)
      }

      return data
    } catch (error) {
      console.error(`Error fetching data from Apps Script for ${sheetName}:`, error)
      throw error
    }
  }

  // Function to fetch master sheet data - OPTIMIZED
  const fetchMasterSheetColumnA = async () => {
    try {
      setIsFetchingMaster(true);

      const data = await fetchDataFromAppsScript("MASTER");

      if (data?.table?.rows) {
        // Extract unique values from column A
        const columnAValues = data.table.rows
          .slice(1)
          .map(row => row?.c?.[0]?.v)
          .filter(value => value !== null && value !== undefined && value !== "");

        // Create a Set to get unique values, then convert back to array
        const uniqueValues = [...new Set(columnAValues)];

        const options = ["Select Department", ...uniqueValues];
        setMasterSheetOptions(options);

        if (!selectedMasterOption) {
          setSelectedMasterOption(options[0]);
        }

        // Count active staff quickly
        const activeStaffCount = data.table.rows
          .slice(1)
          .filter(row => row?.c?.[2]?.v !== null && row?.c?.[2]?.v !== undefined && row?.c?.[2]?.v !== "")
          .length;

        setDepartmentData(prev => ({ ...prev, activeStaff: activeStaffCount }));
        return;
      }

      // Fallback to gviz only if Apps Script completely fails
      const response = await fetch(
        `https://script.google.com/macros/s/AKfycbyGf3LdYk6MPiOs_shPU9_AW7wmRjJZ4QxMk9qYqTScsDMB7IliaWRB1HueYy7w5qxqNw/exec/gviz/tq?tqx=out:json&sheet=MASTER`
      );

      if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);

      const text = await response.text();
      const jsonStart = text.indexOf("{");
      const jsonEnd = text.lastIndexOf("}");
      const jsonString = text.substring(jsonStart, jsonEnd + 1);
      const fallbackData = JSON.parse(jsonString);

      const columnAValues = fallbackData.table.rows
        .slice(1)
        .map(row => row?.c?.[0]?.v)
        .filter(value => value !== null && value !== "");

      // Create a Set to get unique values, then convert back to array
      const uniqueValues = [...new Set(columnAValues)];

      const options = ["Select Department", ...uniqueValues];
      setMasterSheetOptions(options);

      if (!selectedMasterOption) {
        setSelectedMasterOption(options[0]);
      }

      const activeStaffCount = fallbackData.table.rows
        .slice(1)
        .filter(row => row?.c?.[2]?.v !== null && row?.c?.[2]?.v !== "")
        .length;

      setDepartmentData(prev => ({ ...prev, activeStaff: activeStaffCount }));

    } catch (error) {
      setMasterSheetOptions(["Error loading master data"]);
    } finally {
      setIsFetchingMaster(false);
    }
  }

  // SUPER OPTIMIZED fetchDepartmentData function
  const fetchDepartmentData = async (department) => {
    if (!department || department === "Select Department") {
      return
    }

    const sheetName = dashboardType === "delegation" ? "DELEGATION" : department
    const cacheKey = `${sheetName}_${dashboardType}`

    // Check cache first - instant return
    if (dataCache.has(cacheKey)) {
      const cachedData = dataCache.get(cacheKey)
      setDepartmentData(cachedData)
      return
    }

    try {
      // Fetch data without any loading states
      const data = await fetchDataFromAppsScript(sheetName)

      if (!data?.table?.rows) {
        throw new Error("Invalid data structure")
      }

      // Get user info once
      const username = sessionStorage.getItem("username") || "admin"
      const userRole = sessionStorage.getItem("role") || "admin"
      const isAdmin = userRole === "admin" || userRole === "superadmin" || userRole === "super_admin"
      const usernameLower = username.toLowerCase()

      // Pre-calculate date
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayTime = today.getTime()

      // Initialize counters
      let totalTasks = 0, completedTasks = 0, pendingTasks = 0, overdueTasks = 0
      let completedRatingOne = 0, completedRatingTwo = 0, completedRatingThreePlus = 0

      // Initialize data structures
      const monthlyData = {
        Jan: { completed: 0, pending: 0 }, Feb: { completed: 0, pending: 0 }, Mar: { completed: 0, pending: 0 },
        Apr: { completed: 0, pending: 0 }, May: { completed: 0, pending: 0 }, Jun: { completed: 0, pending: 0 },
        Jul: { completed: 0, pending: 0 }, Aug: { completed: 0, pending: 0 }, Sep: { completed: 0, pending: 0 },
        Oct: { completed: 0, pending: 0 }, Nov: { completed: 0, pending: 0 }, Dec: { completed: 0, pending: 0 }
      }
      const statusData = { Completed: 0, Pending: 0, Overdue: 0 }
      const staffMap = new Map()
      const processedRows = []

      // Single ultra-fast loop
      const rows = data.table.rows
      for (let i = 1, len = rows.length; i < len; i++) {
        const row = rows[i]
        if (!row?.c) continue

        const c = row.c

        // Quick user check
        const assignedTo = c[4]?.v || "Unassigned"
        if (!isAdmin && assignedTo.toLowerCase() !== usernameLower) continue

        // Quick task ID check
        const taskId = c[1]?.v
        if (!taskId) continue

        // Quick date check
        const taskStartDateValue = c[6]?.v
        if (!taskStartDateValue) continue

        const taskStartDate = parseGoogleSheetsDate(taskStartDateValue)
        const taskStartDateObj = parseDateFromDDMMYYYY(taskStartDate)
        if (!taskStartDateObj) continue

        // Staff tracking
        if (!staffMap.has(assignedTo)) {
          staffMap.set(assignedTo, { name: assignedTo, totalTasks: 0, completedTasks: 0, pendingTasks: 0, progress: 0 })
        }

        // Completion check
        const completionDateValue = dashboardType === "delegation" ? c[11]?.v : c[10]?.v
        const completionDate = completionDateValue ? parseGoogleSheetsDate(completionDateValue) : ""
        const status = completionDate ? "completed" : (taskStartDateObj.getTime() < todayTime ? "overdue" : "pending")

        // Add to processed rows
        processedRows.push({
          id: String(taskId).trim(),
          title: c[5]?.v || "Untitled Task",
          assignedTo,
          taskStartDate,
          dueDate: taskStartDate,
          status,
          frequency: c[7]?.v || "one-time",
        })

        // Update staff
        const staff = staffMap.get(assignedTo)
        staff.totalTasks++

        // Count only tasks up to today
        if (taskStartDateObj.getTime() <= todayTime) {
          totalTasks++

          if (status === "completed") {
            completedTasks++
            staff.completedTasks++
            statusData.Completed++

            if (dashboardType === "delegation") {
              const rating = c[17]?.v
              if (rating === 1) completedRatingOne++
              else if (rating === 2) completedRatingTwo++
              else if (rating > 2) completedRatingThreePlus++
            }

            if (completionDate) {
              const month = parseDateFromDDMMYYYY(completionDate)
              if (month) {
                const monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month.getMonth()]
                monthlyData[monthName].completed++
              }
            }
          } else {
            staff.pendingTasks++
            if (status === "overdue") {
              overdueTasks++
              statusData.Overdue++
            }
            pendingTasks++
            statusData.Pending++
            const monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][today.getMonth()]
            monthlyData[monthName].pending++
          }
        }
      }

      // Quick data conversion
      const completionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0
      const barChartData = Object.entries(monthlyData).map(([name, data]) => ({ name, ...data }))
      const pieChartData = [
        { name: "Completed", value: statusData.Completed, color: "#22c55e" },
        { name: "Pending", value: statusData.Pending, color: "#facc15" },
        { name: "Overdue", value: statusData.Overdue, color: "#ef4444" },
      ]

      const staffMembers = []
      for (const staff of staffMap.values()) {
        const progress = staff.totalTasks > 0 ? Math.round((staff.completedTasks / staff.totalTasks) * 100) : 0
        staffMembers.push({
          id: staff.name.replace(/\s+/g, "-").toLowerCase(),
          name: staff.name,
          email: `${staff.name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
          totalTasks: staff.totalTasks,
          completedTasks: staff.completedTasks,
          pendingTasks: staff.pendingTasks,
          progress,
        })
      }

      // Final data
      const finalData = {
        allTasks: processedRows,
        staffMembers,
        totalTasks, completedTasks, pendingTasks, overdueTasks,
        activeStaff: departmentData.activeStaff,
        completionRate, barChartData, pieChartData,
        completedRatingOne, completedRatingTwo, completedRatingThreePlus,
      }

      // Cache and set
      setDataCache(prev => new Map(prev).set(cacheKey, finalData))
      setDepartmentData(finalData)

    } catch (error) {
      alert(`Error loading data: ${error.message}`)
    }
  }

  // Optimized useEffect hooks
  useEffect(() => {
    // Clear cache when switching dashboard types for fresh data
    setDataCache(new Map())

    if (dashboardType === "delegation") {
      fetchDepartmentData("DELEGATION")
    } else if (selectedMasterOption && selectedMasterOption !== "Select Department") {
      fetchDepartmentData(selectedMasterOption)
    }
  }, [dashboardType]) // Only depend on dashboardType

  // Separate useEffect for department changes in checklist mode
  useEffect(() => {
    if (dashboardType === "checklist" && selectedMasterOption && selectedMasterOption !== "Select Department") {
      fetchDepartmentData(selectedMasterOption)
    }
  }, [selectedMasterOption])

  useEffect(() => {
    setCurrentDate(new Date())
    fetchMasterSheetColumnA()
  }, [])

  // Filter tasks based on the filter criteria
  const filteredTasks = departmentData.allTasks.filter((task) => {
    if (filterStatus !== "all" && task.status !== filterStatus) return false
    if (filterStaff !== "all" && task.assignedTo !== filterStaff) return false

    if (searchQuery && searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase().trim()
      if (typeof task.title === "string" && task.title.toLowerCase().includes(query)) {
        return true
      }
      if (
        (typeof task.id === "string" && task.id.toLowerCase().includes(query)) ||
        (typeof task.id === "number" && task.id.toString().includes(query))
      ) {
        return true
      }
      if (typeof task.assignedTo === "string" && task.assignedTo.toLowerCase().includes(query)) {
        return true
      }
      return false
    }

    return true
  })

  // MAIN TASK FILTERING FUNCTION - WORKS FOR BOTH MODES
  const getTasksByView = (view) => {
    const viewFilteredTasks = filteredTasks.filter((task) => {
      // Don't show completed tasks in the task lists (except for counting)
      if (task.status === "completed" && view !== "all") return false

      const taskDate = parseDateFromDDMMYYYY(task.taskStartDate)
      if (!taskDate) return false

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      if (view === "recent") {
        // Both modes: Show today's tasks
        return taskDate.getTime() === today.getTime()
      }

      if (view === "upcoming") {
        if (dashboardType === "checklist") {
          // CHECKLIST: Only tomorrow's tasks
          return taskDate.getTime() === tomorrow.getTime()
        } else {
          // DELEGATION: All future tasks (tomorrow and beyond)
          return taskDate > today
        }
      }

      if (view === "overdue") {
        // Both modes: Past due tasks (before today)
        return taskDate < today
      }

      if (view === "all") {
        return true
      }

      return true
    })

    return viewFilteredTasks
  }

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "bg-green-500 hover:bg-green-600 text-white"
      case "pending":
        return "bg-amber-500 hover:bg-amber-600 text-white"
      case "overdue":
        return "bg-red-500 hover:bg-red-600 text-white"
      default:
        return "bg-gray-500 hover:bg-gray-600 text-white"
    }
  }

  const getFrequencyColor = (frequency) => {
    switch (frequency) {
      case "one-time":
        return "bg-gray-500 hover:bg-gray-600 text-white"
      case "daily":
        return "bg-blue-500 hover:bg-blue-600 text-white"
      case "weekly":
        return "bg-purple-500 hover:bg-purple-600 text-white"
      case "fortnightly":
        return "bg-indigo-500 hover:bg-indigo-600 text-white"
      case "monthly":
        return "bg-orange-500 hover:bg-orange-600 text-white"
      case "quarterly":
        return "bg-amber-500 hover:bg-amber-600 text-white"
      case "yearly":
        return "bg-emerald-500 hover:bg-emerald-600 text-white"
      default:
        return "bg-gray-500 hover:bg-gray-600 text-white"
    }
  }

  // Tasks Overview Chart Component
  const TasksOverviewChart = () => {
    return (
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={departmentData.barChartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" fontSize={12} stroke="#888888" tickLine={false} axisLine={false} />
          <YAxis
            fontSize={12}
            stroke="#888888"
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}`}
          />
          <Tooltip />
          <Legend />
          <Bar dataKey="completed" stackId="a" fill="#22c55e" radius={[4, 4, 0, 0]} />
          <Bar dataKey="pending" stackId="a" fill="#f87171" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  // Tasks Completion Chart Component
  const TasksCompletionChart = () => {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={departmentData.pieChartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {departmentData.pieChartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  // Staff Tasks Table Component
  const StaffTasksTable = () => {
    return (
      <div className="rounded-md border border-gray-200 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Progress
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {departmentData.staffMembers.map((staff) => (
              <tr key={staff.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{staff.name}</div>
                    <div className="text-xs text-gray-500">{staff.email}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{staff.totalTasks}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{staff.completedTasks}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{staff.pendingTasks}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="w-[100px] bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${staff.progress}%` }}></div>
                    </div>
                    <span className="text-xs text-gray-500">{staff.progress}%</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {staff.progress >= 80 ? (
                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      Excellent
                    </span>
                  ) : staff.progress >= 60 ? (
                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                      Good
                    </span>
                  ) : (
                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                      Needs Improvement
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <h1 className="text-2xl font-bold tracking-tight text-purple-500">Admin Dashboard</h1>
          <div className="flex items-center gap-2">
            {/* Dashboard Type Selection */}
            <select
              value={dashboardType}
              onChange={(e) => {
                setDashboardType(e.target.value)
              }}
              className="w-[140px] rounded-md border border-purple-200 p-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="checklist">Checklist</option>
              <option value="delegation">Delegation</option>
            </select>

            {/* Department dropdown - disabled for delegation mode */}
            <select
              value={selectedMasterOption}
              onChange={(e) => setSelectedMasterOption(e.target.value)}
              className="w-[180px] rounded-md border border-purple-200 p-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              disabled={dashboardType === "delegation"}
            >
              {dashboardType === "delegation" ? (
                <option>Delegation Mode</option>
              ) : (
                masterSheetOptions.map((option, index) => (
                  <option key={index} value={option}>
                    {option}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-l-4 border-l-blue-500 shadow-md hover:shadow-lg transition-all bg-white">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2 bg-linear-to-r from-blue-50 to-blue-100 rounded-tr-lg p-4">
              <h3 className="text-sm font-medium text-blue-700">Total Tasks</h3>
              <ListTodo className="h-4 w-4 text-blue-500" />
            </div>
            <div className="p-4">
              <div className="text-3xl font-bold text-blue-700">
                {dashboardType === "delegation"
                  ? getTasksByView("recent").length +
                  getTasksByView("upcoming").length +
                  getTasksByView("overdue").length
                  : departmentData.totalTasks}
              </div>
              <p className="text-xs text-blue-600">
                {dashboardType === "delegation"
                  ? "Total tasks in delegation (all categories)"
                  : selectedMasterOption !== "Select Department"
                    ? `Total tasks in ${selectedMasterOption} (up to today)`
                    : "Select a department"}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-l-4 border-l-green-500 shadow-md hover:shadow-lg transition-all bg-white">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2 bg-linear-to-r from-green-50 to-green-100 rounded-tr-lg p-4">
              <h3 className="text-sm font-medium text-green-700">
                {dashboardType === "delegation" ? "Completed" : "Completed Tasks"}
              </h3>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </div>
            <div className="p-4">
              <div className="text-3xl font-bold text-green-700">
                {dashboardType === "delegation" ? departmentData.completedRatingOne : departmentData.completedTasks}
              </div>
              <p className="text-xs text-green-600">
                {dashboardType === "delegation" ? "Task completed once" : "Total completed till date"}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-l-4 border-l-amber-500 shadow-md hover:shadow-lg transition-all bg-white">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2 bg-linear-to-r from-amber-50 to-amber-100 rounded-tr-lg p-4">
              <h3 className="text-sm font-medium text-amber-700">
                {dashboardType === "delegation" ? "Completed" : "Pending Tasks"}
              </h3>
              {dashboardType === "delegation" ? (
                <CheckCircle2 className="h-4 w-4 text-amber-500" />
              ) : (
                <Clock className="h-4 w-4 text-amber-500" />
              )}
            </div>
            <div className="p-4">
              <div className="text-3xl font-bold text-amber-700">
                {dashboardType === "delegation" ? departmentData.completedRatingTwo : departmentData.pendingTasks}
              </div>
              <p className="text-xs text-amber-600">
                {dashboardType === "delegation" ? "Task completed twice" : "Including today + overdue"}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-l-4 border-l-red-500 shadow-md hover:shadow-lg transition-all bg-white">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2 bg-linear-to-r from-red-50 to-red-100 rounded-tr-lg p-4">
              <h3 className="text-sm font-medium text-red-700">
                {dashboardType === "delegation" ? "Completed" : "Overdue Tasks"}
              </h3>
              {dashboardType === "delegation" ? (
                <CheckCircle2 className="h-4 w-4 text-red-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              )}
            </div>
            <div className="p-4">
              <div className="text-3xl font-bold text-red-700">
                {dashboardType === "delegation" ? departmentData.completedRatingThreePlus : departmentData.overdueTasks}
              </div>
              <p className="text-xs text-red-600">
                {dashboardType === "delegation" ? "Task completed more than twice" : "Past due (excluding today)"}
              </p>
            </div>
          </div>
        </div>

        {/* Task Navigation Tabs */}
        <div className="w-full overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="grid grid-cols-3">
            <button
              className={`py-3 text-center font-medium transition-colors ${taskView === "recent" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              onClick={() => setTaskView("recent")}
            >
              Recent Tasks
              <span className="block text-xs mt-1">

              </span>
            </button>
            <button
              className={`py-3 text-center font-medium transition-colors ${taskView === "upcoming" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              onClick={() => setTaskView("upcoming")}
            >
              Upcoming Tasks
              <span className="block text-xs mt-1">
                {dashboardType === "checklist" ? "" : ""}
              </span>
            </button>
            <button
              className={`py-3 text-center font-medium transition-colors ${taskView === "overdue" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              onClick={() => setTaskView("overdue")}
            >
              Overdue Tasks
              <span className="block text-xs mt-1">

              </span>
            </button>
          </div>

          <div className="p-4">
            <div className="flex flex-col gap-4 md:flex-row mb-4">
              <div className="flex-1 space-y-2">
                <label htmlFor="search" className="flex items-center text-purple-700">
                  <Filter className="h-4 w-4 mr-2" />
                  Search Tasks
                </label>
                <input
                  id="search"
                  placeholder="Search by task title or ID"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-md border border-purple-200 p-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
              <div className="space-y-2 md:w-[180px]">
                <label htmlFor="staff-filter" className="flex items-center text-purple-700">
                  <Filter className="h-4 w-4 mr-2" />
                  Filter by Staff
                </label>
                <select
                  id="staff-filter"
                  value={filterStaff}
                  onChange={(e) => setFilterStaff(e.target.value)}
                  className="w-full rounded-md border border-purple-200 p-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="all">All Staff</option>
                  {departmentData.staffMembers.map((staff) => (
                    <option key={staff.id} value={staff.name}>
                      {staff.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {getTasksByView(taskView).length === 0 ? (
              <div className="text-center p-8 text-gray-500">
                <p>No tasks found matching your filters.</p>
                {dashboardType === "checklist" && taskView === "upcoming" && (
                  <p className="text-sm mt-2">Checklist mode shows only tomorrow's tasks in upcoming view.</p>
                )}
                {dashboardType === "delegation" && taskView === "upcoming" && (
                  <p className="text-sm mt-2">Delegation mode shows all future tasks in upcoming view.</p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto" style={{ maxHeight: "400px", overflowY: "auto" }}>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Task ID
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Task Description
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Assigned To
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Task End Date
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Frequency
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {getTasksByView(taskView).map((task) => (
                      <tr key={task.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{task.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{task.title}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{task.assignedTo}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{task.taskStartDate}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getFrequencyColor(task.frequency)}`}
                          >
                            {task.frequency.charAt(0).toUpperCase() + task.frequency.slice(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-l-4 border-l-purple-500 shadow-md hover:shadow-lg transition-all bg-white">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2 bg-linear-to-r from-purple-50 to-purple-100 rounded-tr-lg p-4">
              <h3 className="text-sm font-medium text-purple-700">Active Staff</h3>
              <Users className="h-4 w-4 text-purple-500" />
            </div>
            <div className="p-4">
              <div className="text-3xl font-bold text-purple-700">{departmentData.activeStaff}</div>
              <p className="text-xs text-purple-600">Total staff in Master Sheet Col C</p>
            </div>
          </div>

          <div className="rounded-lg border border-l-4 border-l-indigo-500 shadow-md hover:shadow-lg transition-all lg:col-span-3 bg-white">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2 bg-linear-to-r from-indigo-50 to-indigo-100 rounded-tr-lg p-4">
              <h3 className="text-sm font-medium text-indigo-700">Task Completion Rate</h3>
              <BarChart3 className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-indigo-700">{departmentData.completionRate}%</div>
                <div className="flex items-center space-x-2">
                  <span className="inline-block w-3 h-3 bg-green-500 rounded-full"></span>
                  <span className="text-xs text-gray-600">Completed: {departmentData.completedTasks}</span>
                  <span className="inline-block w-3 h-3 bg-amber-500 rounded-full"></span>
                  <span className="text-xs text-gray-600">Total: {departmentData.totalTasks}</span>
                </div>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full mt-2">
                <div
                  className="h-full bg-linear-to-r from-green-500 to-amber-500 rounded-full"
                  style={{ width: `${departmentData.completionRate}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="space-y-4">
          <div className="bg-purple-100 rounded-md p-1 flex space-x-1">
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex-1 py-2 text-center rounded-md transition-colors ${activeTab === "overview" ? "bg-purple-600 text-white" : "text-purple-700 hover:bg-purple-200"
                }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("mis")}
              className={`flex-1 py-2 text-center rounded-md transition-colors ${activeTab === "mis" ? "bg-purple-600 text-white" : "text-purple-700 hover:bg-purple-200"
                }`}
            >
              MIS Report
            </button>
            <button
              onClick={() => setActiveTab("staff")}
              className={`flex-1 py-2 text-center rounded-md transition-colors ${activeTab === "staff" ? "bg-purple-600 text-white" : "text-purple-700 hover:bg-purple-200"
                }`}
            >
              Staff Performance
            </button>
          </div>

          {activeTab === "overview" && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <div className="lg:col-span-4 rounded-lg border border-purple-200 shadow-md bg-white">
                  <div className="bg-linear-to-r from-purple-50 to-pink-50 border-b border-purple-100 p-4">
                    <h3 className="text-purple-700 font-medium">Tasks Overview</h3>
                    <p className="text-purple-600 text-sm">Task completion rate over time</p>
                  </div>
                  <div className="p-4 pl-2">
                    <TasksOverviewChart />
                  </div>
                </div>
                <div className="lg:col-span-3 rounded-lg border border-purple-200 shadow-md bg-white">
                  <div className="bg-linear-to-r from-purple-50 to-pink-50 border-b border-purple-100 p-4">
                    <h3 className="text-purple-700 font-medium">Task Status</h3>
                    <p className="text-purple-600 text-sm">Distribution of tasks by status</p>
                  </div>
                  <div className="p-4">
                    <TasksCompletionChart />
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-purple-200 shadow-md bg-white">
                <div className="bg-linear-to-r from-purple-50 to-pink-50 border-b border-purple-100 p-4">
                  <h3 className="text-purple-700 font-medium">Staff Task Summary</h3>
                  <p className="text-purple-600 text-sm">Overview of tasks assigned to each staff member</p>
                </div>
                <div className="p-4">
                  <StaffTasksTable />
                </div>
              </div>
            </div>
          )}

          {/* Modified MIS Report section with date range filter */}
          {activeTab === "mis" && (
            <div className="rounded-lg border border-purple-200 shadow-md bg-white">
              <div className="bg-linear-to-r from-purple-50 to-pink-50 border-b border-purple-100 p-4">
                <h3 className="text-purple-700 font-medium">MIS Report</h3>
                <p className="text-purple-600 text-sm">Detailed task analytics and performance metrics</p>
              </div>
              <div className="p-4">
                <div className="space-y-8">
                  {/* Date range selection */}
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
                    <div className="space-y-2 lg:col-span-1">
                      <label htmlFor="start-date" className="flex items-center text-purple-700 text-sm font-medium">
                        End Date
                      </label>
                      <input
                        id="start-date"
                        type="date"
                        value={dateRange.startDate}
                        onChange={(e) => setDateRange((prev) => ({ ...prev, startDate: e.target.value }))}
                        className="w-full rounded-md border border-purple-200 p-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </div>
                    <div className="space-y-2 lg:col-span-1">
                      <label htmlFor="end-date" className="flex items-center text-purple-700 text-sm font-medium">
                        End Date
                      </label>
                      <input
                        id="end-date"
                        type="date"
                        value={dateRange.endDate}
                        onChange={(e) => setDateRange((prev) => ({ ...prev, endDate: e.target.value }))}
                        className="w-full rounded-md border border-purple-200 p-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </div>
                    <div className="space-y-2 lg:col-span-2 flex items-end">
                      <button
                        onClick={filterTasksByDateRange}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded transition-colors"
                      >
                        Apply Filter
                      </button>
                    </div>
                  </div>

                  {/* Overall stats */}
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-purple-600">Total Tasks Assigned</div>
                      <div className="text-3xl font-bold text-purple-700">
                        {dateRange.filtered ? filteredDateStats.totalTasks : departmentData.totalTasks}
                      </div>
                      {dateRange.filtered && (
                        <p className="text-xs text-purple-600">
                          For period: {formatLocalDate(dateRange.startDate)} - {formatLocalDate(dateRange.endDate)}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-purple-600">Tasks Completed</div>
                      <div className="text-3xl font-bold text-purple-700">
                        {dateRange.filtered ? filteredDateStats.completedTasks : departmentData.completedTasks}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-purple-600">Tasks Pending/Overdue</div>
                      <div className="text-3xl font-bold text-purple-700">
                        {dateRange.filtered
                          ? `${filteredDateStats.pendingTasks} / ${filteredDateStats.overdueTasks}`
                          : `${departmentData.pendingTasks} / ${departmentData.overdueTasks}`}
                      </div>
                      <div className="text-xs text-purple-600">
                        Pending (all incomplete) / Overdue (past dates only)
                      </div>
                    </div>
                  </div>

                  {/* Additional breakdown for date period */}
                  {dateRange.filtered && (
                    <div className="rounded-lg border border-purple-100 p-4 bg-gray-50">
                      <h4 className="text-lg font-medium text-purple-700 mb-4">Detailed Date Range Breakdown</h4>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="bg-white p-3 rounded-lg border border-amber-200">
                          <div className="text-2xl font-bold text-amber-600">{filteredDateStats.pendingTasks}</div>
                          <div className="text-xs text-amber-600 mt-1">
                            All incomplete tasks (including overdue + today)
                          </div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-red-200">
                          <div className="text-sm font-medium text-red-700">Overdue Tasks</div>
                          <div className="text-2xl font-bold text-red-600">{filteredDateStats.overdueTasks}</div>
                          <div className="text-xs text-red-600 mt-1">Past due dates only (excluding today)</div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-green-200">
                          <div className="text-sm font-medium text-green-700">Completion Rate</div>
                          <div className="text-2xl font-bold text-green-600">{filteredDateStats.completionRate}%</div>
                          <div className="text-xs text-green-600 mt-1">
                            {filteredDateStats.completedTasks} of {filteredDateStats.totalTasks} tasks completed
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-purple-700">Department Performance</h3>
                    <div className="grid gap-4 md:grid-cols-1">
                      <div className="rounded-lg border border-purple-200 bg-white p-4">
                        <h4 className="text-sm font-medium text-purple-700 mb-2">Completion Rate</h4>
                        <div className="flex items-center gap-4">
                          <div className="text-2xl font-bold text-purple-700">
                            {dateRange.filtered ? filteredDateStats.completionRate : departmentData.completionRate}%
                          </div>
                          <div className="flex-1">
                            <div className="w-full h-6 bg-gray-200 rounded-full">
                              <div
                                className="h-full rounded-full flex items-center justify-end px-3 text-xs font-medium text-white"
                                style={{
                                  width: `${dateRange.filtered ? filteredDateStats.completionRate : departmentData.completionRate}%`,
                                  background: `linear-gradient(to right, #10b981 ${(dateRange.filtered ? filteredDateStats.completionRate : departmentData.completionRate) * 0.8}%, #f59e0b ${(dateRange.filtered ? filteredDateStats.completionRate : departmentData.completionRate) * 0.8}%)`,
                                }}
                              >
                                {dateRange.filtered ? filteredDateStats.completionRate : departmentData.completionRate}%
                              </div>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-purple-600 mt-2">
                          {dashboardType === "delegation"
                            ? `${dateRange.filtered ? filteredDateStats.completedTasks : departmentData.completedTasks} of ${dateRange.filtered ? filteredDateStats.totalTasks : departmentData.totalTasks} tasks completed in delegation mode`
                            : selectedMasterOption !== "Select Department"
                              ? `${dateRange.filtered ? filteredDateStats.completedTasks : departmentData.completedTasks} of ${dateRange.filtered ? filteredDateStats.totalTasks : departmentData.totalTasks} tasks completed in ${selectedMasterOption}`
                              : "Select a department to see completion rate"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "staff" && (
            <div className="rounded-lg border border-purple-200 shadow-md bg-white">
              <div className="bg-linear-to-r from-purple-50 to-pink-50 border-b border-purple-100 p-4">
                <h3 className="text-purple-700 font-medium">Staff Performance</h3>
                <p className="text-purple-600 text-sm">
                  Task completion rates by staff member (tasks up to today only)
                </p>
              </div>
              <div className="p-4">
                <div className="space-y-8">
                  {departmentData.staffMembers.length > 0 ? (
                    <>
                      {(() => {
                        // Sort staff members by performance (high to low)
                        const sortedStaffMembers = [...departmentData.staffMembers]
                          .filter((staff) => staff.totalTasks > 0)
                          .sort((a, b) => b.progress - a.progress)

                        return (
                          <>
                            {/* High performers section (70% or above) */}
                            <div className="rounded-md border border-green-200">
                              <div className="p-4 bg-linear-to-r from-green-50 to-green-100 border-b border-green-200">
                                <h3 className="text-lg font-medium text-green-700">Top Performers</h3>
                                <p className="text-sm text-green-600">
                                  Staff with high task completion rates (tasks up to today only)
                                </p>
                              </div>
                              <div className="p-4">
                                <div className="space-y-4">
                                  {sortedStaffMembers
                                    .filter((staff) => staff.progress >= 70)
                                    .map((staff) => (
                                      <div
                                        key={staff.id}
                                        className="flex items-center justify-between p-3 border border-green-100 rounded-md bg-green-50"
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className="h-10 w-10 rounded-full bg-linear-to-r from-green-500 to-teal-500 flex items-center justify-center">
                                            <span className="text-sm font-medium text-white">
                                              {staff.name.charAt(0)}
                                            </span>
                                          </div>
                                          <div>
                                            <p className="font-medium text-green-700">{staff.name}</p>
                                            <p className="text-xs text-green-600">
                                              {staff.completedTasks} of {staff.totalTasks} tasks completed
                                            </p>
                                          </div>
                                        </div>
                                        <div className="text-lg font-bold text-green-600">{staff.progress}%</div>
                                      </div>
                                    ))}
                                  {sortedStaffMembers.filter((staff) => staff.progress >= 70).length === 0 && (
                                    <div className="text-center p-4 text-gray-500">
                                      <p>No staff members with high completion rates found.</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Mid performers section (40-69%) */}
                            <div className="rounded-md border border-yellow-200">
                              <div className="p-4 bg-linear-to-r from-yellow-50 to-yellow-100 border-b border-yellow-200">
                                <h3 className="text-lg font-medium text-yellow-700">Average Performers</h3>
                                <p className="text-sm text-yellow-600">
                                  Staff with moderate task completion rates (tasks up to today only)
                                </p>
                              </div>
                              <div className="p-4">
                                <div className="space-y-4">
                                  {sortedStaffMembers
                                    .filter((staff) => staff.progress >= 40 && staff.progress < 70)
                                    .map((staff) => (
                                      <div
                                        key={staff.id}
                                        className="flex items-center justify-between p-3 border border-yellow-100 rounded-md bg-yellow-50"
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className="h-10 w-10 rounded-full bg-linear-to-r from-yellow-500 to-amber-500 flex items-center justify-center">
                                            <span className="text-sm font-medium text-white">
                                              {staff.name.charAt(0)}
                                            </span>
                                          </div>
                                          <div>
                                            <p className="font-medium text-yellow-700">{staff.name}</p>
                                            <p className="text-xs text-yellow-600">
                                              {staff.completedTasks} of {staff.totalTasks} tasks completed
                                            </p>
                                          </div>
                                        </div>
                                        <div className="text-lg font-bold text-yellow-600">{staff.progress}%</div>
                                      </div>
                                    ))}
                                  {sortedStaffMembers.filter((staff) => staff.progress >= 40 && staff.progress < 70)
                                    .length === 0 && (
                                      <div className="text-center p-4 text-gray-500">
                                        <p>No staff members with moderate completion rates found.</p>
                                      </div>
                                    )}
                                </div>
                              </div>
                            </div>

                            {/* Low performers section (below 40%) */}
                            <div className="rounded-md border border-red-200">
                              <div className="p-4 bg-linear-to-r from-red-50 to-red-100 border-b border-red-200">
                                <h3 className="text-lg font-medium text-red-700">Needs Improvement</h3>
                                <p className="text-sm text-red-600">
                                  Staff with lower task completion rates (tasks up to today only)
                                </p>
                              </div>
                              <div className="p-4">
                                <div className="space-y-4">
                                  {sortedStaffMembers
                                    .filter((staff) => staff.progress < 40)
                                    .map((staff) => (
                                      <div
                                        key={staff.id}
                                        className="flex items-center justify-between p-3 border border-red-100 rounded-md bg-red-50"
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className="h-10 w-10 rounded-full bg-linear-to-r from-red-500 to-pink-500 flex items-center justify-center">
                                            <span className="text-sm font-medium text-white">
                                              {staff.name.charAt(0)}
                                            </span>
                                          </div>
                                          <div>
                                            <p className="font-medium text-red-700">{staff.name}</p>
                                            <p className="text-xs text-red-600">
                                              {staff.completedTasks} of {staff.totalTasks} tasks completed
                                            </p>
                                          </div>
                                        </div>
                                        <div className="text-lg font-bold text-red-600">{staff.progress}%</div>
                                      </div>
                                    ))}
                                  {sortedStaffMembers.filter((staff) => staff.progress < 40).length === 0 && (
                                    <div className="text-center p-4 text-gray-500">
                                      <p>No staff members with low completion rates found.</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* No assigned tasks section */}
                            {departmentData.staffMembers.filter((staff) => staff.totalTasks === 0).length > 0 && (
                              <div className="rounded-md border border-gray-200">
                                <div className="p-4 bg-linear-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                                  <h3 className="text-lg font-medium text-gray-700">No Tasks Assigned</h3>
                                  <p className="text-sm text-gray-600">
                                    Staff with no tasks assigned for current period
                                  </p>
                                </div>
                                <div className="p-4">
                                  <div className="space-y-4">
                                    {departmentData.staffMembers
                                      .filter((staff) => staff.totalTasks === 0)
                                      .map((staff) => (
                                        <div
                                          key={staff.id}
                                          className="flex items-center justify-between p-3 border border-gray-100 rounded-md bg-gray-50"
                                        >
                                          <div className="flex items-center gap-2">
                                            <div className="h-10 w-10 rounded-full bg-linear-to-r from-gray-500 to-gray-600 flex items-center justify-center">
                                              <span className="text-sm font-medium text-white">
                                                {staff.name.charAt(0)}
                                              </span>
                                            </div>
                                            <div>
                                              <p className="font-medium text-gray-700">{staff.name}</p>
                                              <p className="text-xs text-gray-600">No tasks assigned up to today</p>
                                            </div>
                                          </div>
                                          <div className="text-lg font-bold text-gray-600">N/A</div>
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        )
                      })()}
                    </>
                  ) : (
                    <div className="text-center p-8 text-gray-500">
                      <p>
                        {dashboardType === "delegation"
                          ? "No delegation data available."
                          : "No staff data available. Please select a department from the dropdown."}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
} 