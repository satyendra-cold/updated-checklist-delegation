"use client"

import { useState, useEffect } from "react"
import { BarChart3, CheckCircle2, Clock, ListTodo, Users, AlertTriangle, Filter, X, Search } from 'lucide-react'
import AdminLayout from "../../components/layout/AdminLayout.jsx"
import { getUserRole, getUsername, isAdminUser } from "../../utils/authUtils"
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
  Cell
} from "recharts"

export default function AdminDashboard() {
  const [dashboardType, setDashboardType] = useState("checklist")
  const [taskView, setTaskView] = useState("recent")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterStaff, setFilterStaff] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("overview")
  const [filterDepartment, setFilterDepartment] = useState("all");
  const [filterName, setFilterName] = useState("all");

  // UPDATED: Get actual user role from authUtils
  const [userRole, setUserRole] = useState(getUserRole() || "");
  const [username, setUsername] = useState(getUsername() || "");

  // UPDATED: Use actual admin check
  const isAdmin = isAdminUser();

  const [popupOpen, setPopupOpen] = useState(false);
  const [popupData, setPopupData] = useState([]);
  const [popupType, setPopupType] = useState("");
  const [popupFilters, setPopupFilters] = useState({
    search: "",
    department: "all",
    givenBy: "all",
    name: "all",
  });

  // State for department data
  const [departmentData, setDepartmentData] = useState({
    allTasks: [],
    staffMembers: [],
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    overdueTasks: 0,
    upcomingTasks: 0,
    completionRate: 0,
    barChartData: [],
    pieChartData: [],
    completedRatingOne: 0,
    completedRatingTwo: 0,
    completedRatingThreePlus: 0,
    notDoneTasks: 0,
  });

  const [currentDate, setCurrentDate] = useState(new Date());

  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: "",
    filtered: false,
  });

  const [filteredDateStats, setFilteredDateStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    overdueTasks: 0,
    completionRate: 0,
  });

  // Add this useEffect to reset activeTab to "overview" for non-admin users
  useEffect(() => {
    if (!isAdmin) {
      setActiveTab("overview");
    }
  }, [isAdmin]);

  const handleCardClick = (type) => {
    setPopupType(type);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let filteredTasks = [];

    if (type === 'total') {
      filteredTasks = [...departmentData.allTasks];
    } else if (type === 'completed') {
      filteredTasks = departmentData.allTasks.filter(task =>
        task.status === 'completed'
      );
    } else if (type === 'pending') {
      if (dashboardType === 'delegation') {
        filteredTasks = departmentData.allTasks.filter(task =>
          task.status === 'pending'
        );
      } else {
        filteredTasks = departmentData.allTasks.filter(task =>
          task.status !== 'completed'
        );
      }
    } else if (type === 'overdue') {
      if (dashboardType === 'delegation') {
        filteredTasks = departmentData.allTasks.filter(task =>
          task.status === 'overdue'
        );
      } else {
        filteredTasks = departmentData.allTasks.filter(task => {
          if (task.status === 'completed') return false;
          const taskDate = parseDateFromDDMMYYYY(task.taskStartDate);
          if (!taskDate) return false;
          return taskDate < today;
        });
      }
    } else if (type === 'notDone') {
      filteredTasks = departmentData.allTasks.filter(task => {
        const statusColumnValue = task.notDoneStatus;
        return statusColumnValue === 'Not Done' || statusColumnValue === 'not done';
      });
    } else if (type === 'upcoming') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      console.log("Filtering upcoming tasks:");
      console.log("Today:", today);
      console.log("Tomorrow:", tomorrow);

      filteredTasks = departmentData.allTasks.filter(task => {
        const taskDate = parseDateFromDDMMYYYY(task.taskStartDate);

        const isTargetDate = taskDate && (
          taskDate.getTime() === today.getTime() ||
          taskDate.getTime() === tomorrow.getTime()
        );

        const isIncomplete = task.status !== 'completed';

        console.log("Task ID:", task.id,
          "Date:", task.taskStartDate,
          "Status:", task.status,
          "Is target date:", isTargetDate,
          "Is incomplete:", isIncomplete);

        return isTargetDate && isIncomplete;
      });

      console.log("Filtered upcoming tasks count:", filteredTasks.length);
    }

    // UPDATED: Apply user-based filtering for non-admin users
    if (!isAdmin) {
      filteredTasks = filteredTasks.filter(task =>
        task.assignedTo.toLowerCase() === username.toLowerCase()
      );
    } else {
      filteredTasks = filteredTasks.filter(task => {
        const deptMatch = filterDepartment === "all" || task.department === filterDepartment;
        const nameMatch = filterName === "all" || task.assignedTo === filterName;
        return deptMatch && nameMatch;
      });
    }

    console.log("Final filtered tasks for popup:", filteredTasks.length);
    setPopupData(filteredTasks);

    setPopupFilters({
      search: "",
      department: "all",
      givenBy: "all",
      name: "all",
    });

    setPopupOpen(true);
  };

  const handlePopupFilterChange = (filterType, value) => {
    setPopupFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const getFilteredPopupData = () => {
    return popupData.filter(task => {
      // UPDATED: For non-admin users, only show their tasks
      if (!isAdmin && task.assignedTo.toLowerCase() !== username.toLowerCase()) {
        return false;
      }

      const searchMatch = !popupFilters.search ||
        (task.title && task.title.toLowerCase().includes(popupFilters.search.toLowerCase())) ||
        (task.id && task.id.toString().includes(popupFilters.search));

      const deptMatch = popupFilters.department === "all" || task.department === popupFilters.department;
      const nameMatch = popupFilters.name === "all" || task.assignedTo === popupFilters.name;

      return searchMatch && deptMatch && nameMatch;
    });
  };

  const formatLocalDate = (isoDate) => {
    if (!isoDate) return "";
    const date = new Date(isoDate);
    return formatDateToDDMMYYYY(date);
  };

  const filterTasksByDateRange = () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      alert("Please select both start and end dates");
      return;
    }

    const startDate = new Date(dateRange.startDate);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(dateRange.endDate);
    endDate.setHours(23, 59, 59, 999);

    if (startDate > endDate) {
      alert("End Date must be before end date");
      return;
    }

    let tasksToFilter = departmentData.allTasks;
    if (filterStaff !== "all") {
      tasksToFilter = tasksToFilter.filter(
        (task) => task.assignedTo === filterStaff
      );
    }

    const filteredTasks = tasksToFilter.filter((task) => {
      const taskStartDate = parseDateFromDDMMYYYY(task.taskStartDate);
      if (!taskStartDate) return false;

      return taskStartDate >= startDate && taskStartDate <= endDate;
    });

    let totalTasks = filteredTasks.length;
    let completedTasks = 0;
    let pendingTasks = 0;
    let overdueTasks = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    filteredTasks.forEach((task) => {
      if (task.status === "completed") {
        completedTasks++;
      } else {
        pendingTasks++;

        if (task.status === "overdue") {
          overdueTasks++;
        }
      }
    });

    const completionRate =
      totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0;

    setFilteredDateStats({
      totalTasks,
      completedTasks,
      pendingTasks,
      overdueTasks,
      completionRate,
    });

    setDateRange((prev) => ({ ...prev, filtered: true }));
  };

  // Format date as DD/MM/YYYY
  const formatDateToDDMMYYYY = (date) => {
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  // Parse DD/MM/YYYY to Date object
  const parseDateFromDDMMYYYY = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return null
    const parts = dateStr.split('/')
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

  // Function to check if a date is in the future (from tomorrow onwards)
  const isDateFuture = (dateStr) => {
    const date = parseDateFromDDMMYYYY(dateStr)
    if (!date) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date > today
  }

  // Safe access to cell value
  const getCellValue = (row, index) => {
    if (!row || !row.c || index >= row.c.length) return null
    const cell = row.c[index]
    return cell && 'v' in cell ? cell.v : null
  }

  // Parse Google Sheets Date format into a proper date string
  const parseGoogleSheetsDate = (dateStr) => {
    if (!dateStr) return ''

    if (typeof dateStr === 'string' && dateStr.startsWith('Date(')) {
      const match = /Date\((\d+),(\d+),(\d+)(?:,\d+,\d+,\d+)?\)/.exec(dateStr)
      if (match) {
        const year = parseInt(match[1], 10)
        const month = parseInt(match[2], 10)
        const day = parseInt(match[3], 10)

        const formatted = `${day.toString().padStart(2, '0')}/${(month + 1).toString().padStart(2, '0')}/${year}`;
        return formatted;
      }
    }

    if (typeof dateStr === 'string' && dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
      const parts = dateStr.split('/');
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      const normalized = `${day}/${month}/${year}`;
      return normalized;
    }

    if (dateStr instanceof Date && !isNaN(dateStr.getTime())) {
      const formatted = formatDateToDDMMYYYY(dateStr);
      return formatted;
    }

    try {
      const date = new Date(dateStr)
      if (!isNaN(date.getTime())) {
        const formatted = formatDateToDDMMYYYY(date);
        return formatted;
      }
    } catch (e) {
      console.error("Error parsing date:", e)
    }

    return dateStr
  }

  // Modified fetch function to support both checklist and delegation
  const fetchDepartmentData = async (signal) => {
    const sheetName = dashboardType === "delegation" ? "Delegation" : "Checklist";

    try {
      console.log(`Fetching data for dashboard type: ${dashboardType}, sheet: ${sheetName}`);

      const scriptUrl = 'https://script.google.com/macros/s/AKfycbyGf3LdYk6MPiOs_shPU9_AW7wmRjJZ4QxMk9qYqTScsDMB7IliaWRB1HueYy7w5qxqNw/exec';

      const response = await fetch(`${scriptUrl}?sheet=${sheetName}`, {
        method: 'GET',
        redirect: 'follow',
        signal: signal,
      });

      console.log("Response status:", response.status);

      if (!response.ok) {
        throw new Error(`Failed to fetch ${sheetName} sheet data: ${response.status}`);
      }

      const text = await response.text();
      console.log("Response text:", text.substring(0, 200));

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        const jsonStart = text.indexOf('{');
        const jsonEnd = text.lastIndexOf('}');

        if (jsonStart === -1 || jsonEnd === -1) {
          throw new Error('Invalid response format: No JSON found');
        }

        const jsonString = text.substring(jsonStart, jsonEnd + 1);
        data = JSON.parse(jsonString);
      }

      if (signal && signal.aborted) return;

      if (!data || !data.table || !data.table.rows) {
        throw new Error('Invalid data structure received from Google Sheets');
      }

      console.log("Data parsed successfully, rows:", data.table.rows.length);

      // Initialize counters
      let totalTasks = 0;
      let completedTasks = 0;
      let pendingTasks = 0;
      let overdueTasks = 0;

      let completedRatingOne = 0;
      let completedRatingTwo = 0;
      let completedRatingThreePlus = 0;

      const monthlyData = {
        Jan: { completed: 0, pending: 0 },
        Feb: { completed: 0, pending: 0 },
        Mar: { completed: 0, pending: 0 },
        Apr: { completed: 0, pending: 0 },
        May: { completed: 0, pending: 0 },
        Jun: { completed: 0, pending: 0 },
        Jul: { completed: 0, pending: 0 },
        Aug: { completed: 0, pending: 0 },
        Sep: { completed: 0, pending: 0 },
        Oct: { completed: 0, pending: 0 },
        Nov: { completed: 0, pending: 0 },
        Dec: { completed: 0, pending: 0 }
      };

      const statusData = {
        Completed: 0,
        Pending: 0,
        Overdue: 0
      };

      const staffTrackingMap = new Map();

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      // Process row data
      const processedRows = data.table.rows.map((row, rowIndex) => {
        if (rowIndex === 0) return null;

        const assignedTo = getCellValue(row, 4) || 'Unassigned';

        // UPDATED: For non-admin users, only process their tasks
        if (!isAdmin) {
          if (assignedTo.toLowerCase() !== username.toLowerCase()) {
            return null;
          }
        }

        const taskId = getCellValue(row, 1);

        if (taskId === null || taskId === undefined || taskId === '' ||
          (typeof taskId === 'string' && taskId.trim() === '')) {
          return null;
        }

        const taskIdStr = String(taskId).trim();

        let taskStartDateValue = getCellValue(row, 6);
        const taskStartDate = taskStartDateValue ? parseGoogleSheetsDate(String(taskStartDateValue)) : '';

        if (dashboardType === "delegation") {
          if (!taskId || taskId === null || taskId === undefined || taskId === '' ||
            (typeof taskId === 'string' && taskId.trim() === '')) {
            return null;
          }
        } else {
          const taskStartDateObj = parseDateFromDDMMYYYY(taskStartDate);
          if (!taskStartDateObj || taskStartDateObj > tomorrow) {
            return null;
          }
        }

        let completionDateValue, completionDate;
        if (dashboardType === "delegation") {
          completionDateValue = getCellValue(row, 11);
        } else {
          completionDateValue = getCellValue(row, 10);
        }

        completionDate = completionDateValue ? parseGoogleSheetsDate(String(completionDateValue)) : '';

        // UPDATED: For non-admin users, only track their data
        if (!isAdmin) {
          if (!staffTrackingMap.has(username)) {
            staffTrackingMap.set(username, {
              name: username,
              totalTasks: 0,
              completedTasks: 0,
              pendingTasks: 0,
              progress: 0
            });
          }
        } else {
          if (!staffTrackingMap.has(assignedTo)) {
            staffTrackingMap.set(assignedTo, {
              name: assignedTo,
              totalTasks: 0,
              completedTasks: 0,
              pendingTasks: 0,
              progress: 0
            });
          }
        }

        const taskDescription = getCellValue(row, 5) || 'Untitled Task';
        const frequency = getCellValue(row, 7) || 'one-time';

        const delegationStatusRaw = dashboardType === "delegation" ? String(getCellValue(row, 20) || "").trim() : "";
        const delegationStatus = delegationStatusRaw.toLowerCase();
        let status = 'pending';

        if (dashboardType === "delegation") {
          if (delegationStatus === "done") {
            status = 'completed';
          } else if (delegationStatus === "verify pending") {
            status = 'overdue';
          } else if (delegationStatus === "planned" || delegationStatus === "pending") {
            status = 'pending';
          } else {
            // Fallback to original logic if Column U is empty or has unknown values
            if (completionDate && completionDate !== '') {
              status = 'completed';
            } else if (isDateInPast(taskStartDate) && !isDateToday(taskStartDate)) {
              status = 'overdue';
            } else {
              status = 'pending';
            }
          }
        } else {
          // Standard checklist logic
          if (completionDate && completionDate !== '') {
            status = 'completed';
          } else if (isDateInPast(taskStartDate) && !isDateToday(taskStartDate)) {
            status = 'overdue';
          } else {
            status = 'pending';
          }
        }

        const department = getCellValue(row, 2) || "";

        const taskObj = {
          id: taskIdStr,
          title: taskDescription,
          assignedTo,
          department,
          taskStartDate,
          dueDate: taskStartDate,
          status,
          frequency
        };

        // Update staff member totals
        const staffKey = !isAdmin ? username : assignedTo;
        const staffData = staffTrackingMap.get(staffKey);
        if (staffData) {
          staffData.totalTasks++;
        }

        if (dashboardType === "delegation") {
          totalTasks++;

          // Card counts for Delegation based on Column U (Index 20)
          if (delegationStatus === "done") {
            completedRatingOne++;
          } else if (delegationStatus === "planned" || delegationStatus === "pending") {
            completedRatingTwo++;
          } else if (delegationStatus === "verify pending") {
            completedRatingThreePlus++;
          }

          if (status === 'completed') {
            completedTasks++;
            if (staffData) staffData.completedTasks++;
            statusData.Completed++;

            // Rating-based logic replaced by Column U logic above

            const completedMonth = parseDateFromDDMMYYYY(completionDate);
            if (completedMonth) {
              const monthName = completedMonth.toLocaleString('default', { month: 'short' });
              if (monthlyData[monthName]) {
                monthlyData[monthName].completed++;
              }
            }
          } else {
            if (staffData) staffData.pendingTasks++;

            if (status === 'overdue') {
              overdueTasks++;
              statusData.Overdue++;
            }

            pendingTasks++;
            statusData.Pending++;

            const monthName = new Date().toLocaleString('default', { month: 'short' });
            if (monthlyData[monthName]) {
              monthlyData[monthName].pending++;
            }
          }
        } else {
          const taskStartDateObj = parseDateFromDDMMYYYY(taskStartDate);
          const shouldCountInStats = taskStartDateObj <= today;

          if (shouldCountInStats) {
            totalTasks++;

            if (status === 'completed') {
              completedTasks++;
              if (staffData) staffData.completedTasks++;
              statusData.Completed++;

              const completedMonth = parseDateFromDDMMYYYY(completionDate);
              if (completedMonth) {
                const monthName = completedMonth.toLocaleString('default', { month: 'short' });
                if (monthlyData[monthName]) {
                  monthlyData[monthName].completed++;
                }
              }
            } else {
              if (staffData) staffData.pendingTasks++;

              if (isDateInPast(taskStartDate) && !isDateToday(taskStartDate)) {
                overdueTasks++;
                statusData.Overdue++;
              }

              pendingTasks++;
              statusData.Pending++;

              const monthName = today.toLocaleString('default', { month: 'short' });
              if (monthlyData[monthName]) {
                monthlyData[monthName].pending++;
              }
            }
          }
        }

        return taskObj;
      }).filter(task => task !== null);

      console.log("Processed rows:", processedRows.length);

      const completionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0;

      const barChartData = Object.entries(monthlyData).map(([name, data]) => ({
        name,
        completed: data.completed,
        pending: data.pending
      }));

      const pieChartData = [
        { name: "Completed", value: statusData.Completed, color: "#22c55e" },
        { name: "Pending", value: statusData.Pending, color: "#facc15" },
        { name: "Overdue", value: statusData.Overdue, color: "#ef4444" }
      ];

      // UPDATED: For non-admin users, only show their data
      let staffMembers;
      if (!isAdmin) {
        const userData = staffTrackingMap.get(username);
        staffMembers = userData ? [{
          id: username.replace(/\s+/g, '-').toLowerCase(),
          name: username,
          email: `${username.toLowerCase().replace(/\s+/g, '.')}@example.com`,
          totalTasks: userData.totalTasks,
          completedTasks: userData.completedTasks,
          pendingTasks: userData.pendingTasks,
          progress: userData.totalTasks > 0 ? Math.round((userData.completedTasks / userData.totalTasks) * 100) : 0
        }] : [];
      } else {
        staffMembers = Array.from(staffTrackingMap.values()).map(staff => {
          const progress = staff.totalTasks > 0
            ? Math.round((staff.completedTasks / staff.totalTasks) * 100)
            : 0;

          return {
            id: staff.name.replace(/\s+/g, '-').toLowerCase(),
            name: staff.name,
            email: `${staff.name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
            totalTasks: staff.totalTasks,
            completedTasks: staff.completedTasks,
            pendingTasks: staff.pendingTasks,
            progress
          };
        });
      }

      if (signal && signal.aborted) return;

      setDepartmentData({
        allTasks: processedRows,
        staffMembers,
        totalTasks,
        completedTasks,
        pendingTasks,
        overdueTasks,
        completionRate,
        barChartData,
        pieChartData,
        completedRatingOne,
        completedRatingTwo,
        completedRatingThreePlus
      });

      console.log("Department data updated successfully");

    } catch (error) {
      if (error.name === 'AbortError') return;
      console.error(`Error fetching ${sheetName} sheet data:`, error);
      console.error("Error details:", error.message);

      if (signal && signal.aborted) return;

      setDepartmentData({
        allTasks: [],
        staffMembers: [],
        totalTasks: 0,
        completedTasks: 0,
        pendingTasks: 0,
        overdueTasks: 0,
        completionRate: 0,
        barChartData: [],
        pieChartData: [],
        completedRatingOne: 0,
        completedRatingTwo: 0,
        completedRatingThreePlus: 0
      });
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchDepartmentData(controller.signal);
    return () => controller.abort();
  }, [dashboardType, isAdmin, username]);

  // When dashboard loads, set current date
  useEffect(() => {
    setCurrentDate(new Date());
  }, []);

  // Filter tasks based on the filter criteria
  const filteredTasks = departmentData.allTasks.filter((task) => {
    // UPDATED: For non-admin users, only show their tasks
    if (!isAdmin && task.assignedTo.toLowerCase() !== username.toLowerCase()) {
      return false;
    }

    if (filterStatus !== "all" && task.status !== filterStatus) return false;

    if (filterStaff !== "all" && task.assignedTo !== filterStaff) return false;

    if (searchQuery && searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase().trim();

      if (typeof task.title === 'string' && task.title.toLowerCase().includes(query)) {
        return true;
      }

      if ((typeof task.id === 'string' && task.id.toLowerCase().includes(query)) ||
        (typeof task.id === 'number' && task.id.toString().includes(query))) {
        return true;
      }

      if (typeof task.assignedTo === 'string' && task.assignedTo.toLowerCase().includes(query)) {
        return true;
      }

      return false;
    }

    return true;
  });

  const getTasksByView = (view) => {
    const viewFilteredTasks = filteredTasks.filter((task) => {
      if (task.status === "completed") return false;

      const taskStartDate = parseDateFromDDMMYYYY(task.taskStartDate);
      if (!taskStartDate) return false;

      switch (view) {
        case "recent":
          if (dashboardType === "delegation") {
            return isDateToday(task.taskStartDate);
          } else {
            return isDateToday(task.taskStartDate);
          }
        case "upcoming":
          if (dashboardType === "delegation") {
            return isDateFuture(task.taskStartDate);
          } else {
            return isDateTomorrow(task.taskStartDate);
          }
        case "overdue":
          if (dashboardType === "delegation") {
            return isDateInPast(task.taskStartDate) && !isDateToday(task.taskStartDate);
          } else {
            return isDateInPast(task.taskStartDate) && !isDateToday(task.taskStartDate);
          }
        default:
          return true;
      }
    });

    return viewFilteredTasks;
  };

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
          <YAxis fontSize={12} stroke="#888888" tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
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
          <Pie data={departmentData.pieChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value">
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

  // User Tasks Table Component
  const UserTasksTable = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // UPDATED: For non-admin users, only show their data
    let staffMembersWithCurrentTasks;
    if (!isAdmin) {
      const userTasks = departmentData.allTasks.filter(task =>
        task.assignedTo.toLowerCase() === username.toLowerCase()
      );

      const completedTasks = userTasks.filter(task => task.status === 'completed').length;
      const totalTasks = userTasks.length;
      const pendingTasks = totalTasks - completedTasks;
      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      staffMembersWithCurrentTasks = [{
        id: username.replace(/\s+/g, '-').toLowerCase(),
        name: username,
        email: `${username.toLowerCase().replace(/\s+/g, '.')}@example.com`,
        totalTasks,
        completedTasks,
        pendingTasks,
        progress
      }];
    } else {
      staffMembersWithCurrentTasks = departmentData.staffMembers.map(staff => {
        const staffTasks = departmentData.allTasks.filter(task => {
          const taskDate = parseDateFromDDMMYYYY(task.taskStartDate);
          return task.assignedTo === staff.name && taskDate && taskDate <= today;
        });

        const completedTasks = staffTasks.filter(task => task.status === 'completed').length;
        const totalTasks = staffTasks.length;
        const pendingTasks = totalTasks - completedTasks;
        const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        return {
          ...staff,
          totalTasks,
          completedTasks,
          pendingTasks,
          progress
        };
      });
    }

    return (
      <>
        <div className="hidden sm:block rounded-md border border-gray-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Tasks
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Completed
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pending
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Progress
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {staffMembersWithCurrentTasks.map((staff) => (
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

        <div className="sm:hidden space-y-4">
          {staffMembersWithCurrentTasks.map((staff) => (
            <div key={staff.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:bg-gray-50">
              <div className="space-y-3">
                <div className="flex justify-between items-center border-b pb-2">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{staff.name}</div>
                    <div className="text-xs text-gray-500">{staff.email}</div>
                  </div>
                  <div>
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
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 border-b pb-2">
                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-700">Total</div>
                    <div className="text-lg font-bold text-gray-900">{staff.totalTasks}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-700">Completed</div>
                    <div className="text-lg font-bold text-green-600">{staff.completedTasks}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-700">Pending</div>
                    <div className="text-lg font-bold text-amber-600">{staff.pendingTasks}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Progress</span>
                    <span className="text-sm font-bold text-gray-900">{staff.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${staff.progress}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <h1 className="text-2xl font-bold tracking-tight text-purple-500">
            {isAdmin ? "Admin Dashboard" : "User Dashboard"}
          </h1>
          <div className="flex items-center gap-2">
            <select
              value={dashboardType}
              onChange={(e) => {
                setDashboardType(e.target.value);
              }}
              className="w-[140px] rounded-md border border-purple-200 p-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="checklist">Checklist</option>
              <option value="delegation">Delegation</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-l-4 border-l-blue-500 shadow-md hover:shadow-lg transition-all bg-white" onClick={() => handleCardClick('total')}>
            <div className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-blue-50 to-blue-100 rounded-tr-lg p-4">
              <h3 className="text-sm font-medium text-blue-700">Total Tasks</h3>
              <ListTodo className="h-4 w-4 text-blue-500" />
            </div>
            <div className="p-4">
              <div className="text-3xl font-bold text-blue-700">{departmentData.totalTasks}</div>
              <p className="text-xs text-blue-600">
                {dashboardType === "delegation"
                  ? "All tasks in delegation sheet"
                  : "Total tasks in checklist (up to today)"
                }
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-l-4 border-l-green-500 shadow-md hover:shadow-lg transition-all bg-white" onClick={() => handleCardClick('completed')}>
            <div className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-green-50 to-green-100 rounded-tr-lg p-4">
              <h3 className="text-sm font-medium text-green-700">
                {dashboardType === "delegation" ? "Completed Task" : "Completed Tasks"}
              </h3>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </div>
            <div className="p-4">
              <div className="text-3xl font-bold text-green-700">
                {dashboardType === "delegation" ? departmentData.completedRatingOne : departmentData.completedTasks}
              </div>
              <p className="text-xs text-green-600">
                {dashboardType === "delegation" ? "Tasks completed once" : "Total completed till date"}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-l-4 border-l-amber-500 shadow-md hover:shadow-lg transition-all bg-white" onClick={() => handleCardClick('pending')}>
            <div className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-amber-50 to-amber-100 rounded-tr-lg p-4">
              <h3 className="text-sm font-medium text-amber-700">
                {dashboardType === "delegation" ? "Pending" : "Pending Tasks"}
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
                {dashboardType === "delegation" ? "Tasks completed twice" : "Including today + overdue"}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-l-4 border-l-red-500 shadow-md hover:shadow-lg transition-all bg-white" onClick={() => handleCardClick('overdue')}>
            <div className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-red-50 to-red-100 rounded-tr-lg p-4">
              <h3 className="text-sm font-medium text-red-700">
                {dashboardType === "delegation" ? "Verify Pending" : "Overdue Tasks"}
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
                {dashboardType === "delegation" ? "Tasks completed 3+ times" : "Past due (excluding today)"}
              </p>
            </div>
          </div>
        </div>

        {/* UPDATED: Only show filter options for admin users */}
        {isAdmin && (
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
                Filter by User
              </label>
              <select
                id="staff-filter"
                value={filterStaff}
                onChange={(e) => setFilterStaff(e.target.value)}
                className="w-full rounded-md border border-purple-200 p-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="all">All Users</option>
                {departmentData.staffMembers.map((staff) => (
                  <option key={staff.id} value={staff.name}>
                    {staff.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="w-full overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="grid grid-cols-3">
            <button
              className={`py-3 text-center font-medium transition-colors ${taskView === "recent" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              onClick={() => setTaskView("recent")}
            >
              Today Tasks
            </button>
            <button
              className={`py-3 text-center font-medium transition-colors ${taskView === "upcoming" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              onClick={() => setTaskView("upcoming")}
            >
              {dashboardType === "delegation" ? "Future Tasks" : "Upcoming Tasks"}
            </button>
            <button
              className={`py-3 text-center font-medium transition-colors ${taskView === "overdue" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              onClick={() => setTaskView("overdue")}
            >
              Overdue Tasks
            </button>
          </div>

          <div className="p-4">
            {getTasksByView(taskView).length === 0 ? (
              <div className="text-center p-8 text-gray-500">
                <p>No tasks found matching your filters.</p>
              </div>
            ) : (
              <>
                <div className="hidden sm:block overflow-x-auto" style={{ maxHeight: "400px", overflowY: "auto" }}>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Task ID
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Task Description
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Assigned To
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Task End Date
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
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

                <div className="sm:hidden space-y-4" style={{ maxHeight: "400px", overflowY: "auto" }}>
                  {getTasksByView(taskView).map((task) => (
                    <div key={task.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:bg-gray-50">
                      <div className="space-y-3">
                        <div className="flex justify-between items-center border-b pb-2">
                          <span className="font-medium text-gray-700">Task ID:</span>
                          <div className="text-sm text-gray-900 break-words">
                            {task.id}
                          </div>
                        </div>

                        <div className="flex justify-between items-start border-b pb-2">
                          <span className="font-medium text-gray-700">Description:</span>
                          <div className="text-sm text-gray-500 break-words text-right max-w-[60%]">
                            {task.title}
                          </div>
                        </div>

                        <div className="flex justify-between items-center border-b pb-2">
                          <span className="font-medium text-gray-700">Assigned To:</span>
                          <div className="text-sm text-gray-500 break-words">
                            {task.assignedTo}
                          </div>
                        </div>

                        <div className="flex justify-between items-center border-b pb-2">
                          <span className="font-medium text-gray-700">End Date:</span>
                          <div className="text-sm text-gray-500 break-words">
                            {task.taskStartDate}
                          </div>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="font-medium text-gray-700">Frequency:</span>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getFrequencyColor(task.frequency)}`}
                          >
                            {task.frequency.charAt(0).toUpperCase() + task.frequency.slice(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-1">
          <div className="rounded-lg border border-l-4 border-l-indigo-500 shadow-md hover:shadow-lg transition-all bg-white">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-indigo-50 to-indigo-100 rounded-tr-lg p-4">
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
                  className="h-full bg-gradient-to-r from-green-500 to-amber-500 rounded-full"
                  style={{ width: `${departmentData.completionRate}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs - UPDATED: Show tabs for all users but only Overview for non-admin */}
        <div className="space-y-4">
          <div className="bg-purple-100 rounded-md p-1 flex space-x-1">
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex-1 py-2 text-center rounded-md transition-colors ${activeTab === "overview" ? "bg-purple-600 text-white" : "text-purple-700 hover:bg-purple-200"
                }`}
            >
              Overview
            </button>
            {isAdmin && (
              <>
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
                  User Performance
                </button>
              </>
            )}
          </div>

          {/* Overview tab - visible to all users */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <div className="lg:col-span-4 rounded-lg border border-purple-200 shadow-md bg-white">
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 p-4">
                    <h3 className="text-purple-700 font-medium">Tasks Overview</h3>
                    <p className="text-purple-600 text-sm">
                      {isAdmin ? "Task completion rate over time" : "Your task completion rate over time"}
                    </p>
                  </div>
                  <div className="p-4 pl-2">
                    <TasksOverviewChart />
                  </div>
                </div>
                <div className="lg:col-span-3 rounded-lg border border-purple-200 shadow-md bg-white">
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 p-4">
                    <h3 className="text-purple-700 font-medium">Task Status</h3>
                    <p className="text-purple-600 text-sm">
                      {isAdmin ? "Distribution of tasks by status" : "Distribution of your tasks by status"}
                    </p>
                  </div>
                  <div className="p-4">
                    <TasksCompletionChart />
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-purple-200 shadow-md bg-white">
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 p-4">
                  <h3 className="text-purple-700 font-medium">
                    {isAdmin ? "User Task Summary" : "Your Task Summary"}
                  </h3>
                  <p className="text-purple-600 text-sm">
                    {isAdmin ? "Overview of tasks assigned to each user" : "Overview of your tasks and progress"}
                  </p>
                </div>
                <div className="p-4">
                  <UserTasksTable />
                </div>
              </div>
            </div>
          )}

          {/* MIS Report tab - only for admin */}
          {isAdmin && activeTab === "mis" && (
            <div className="rounded-lg border border-purple-200 shadow-md bg-white">
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 p-4">
                <h3 className="text-purple-700 font-medium">MIS Report</h3>
                <p className="text-purple-600 text-sm">
                  {dashboardType === "delegation"
                    ? "Detailed delegation analytics - all tasks from sheet data"
                    : "Detailed task analytics and performance metrics"
                  }
                </p>
              </div>
              <div className="p-4">
                <div className="space-y-8">
                  {dashboardType !== "delegation" && (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
                      <div className="space-y-2 lg:col-span-1">
                        <label htmlFor="start-date" className="flex items-center text-purple-700 text-sm font-medium">
                          End Date
                        </label>
                        <input
                          id="start-date"
                          type="date"
                          value={dateRange.startDate}
                          onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
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
                          onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
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
                  )}

                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-purple-600">Total Tasks Assigned</div>
                      <div className="text-3xl font-bold text-purple-700">
                        {dashboardType === "delegation"
                          ? departmentData.totalTasks
                          : (dateRange.filtered ? filteredDateStats.totalTasks : departmentData.totalTasks)
                        }
                      </div>
                      {dashboardType === "delegation" ? (
                        <p className="text-xs text-purple-600">All tasks from delegation sheet</p>
                      ) : (
                        dateRange.filtered && (
                          <p className="text-xs text-purple-600">
                            For period: {formatLocalDate(dateRange.startDate)} - {formatLocalDate(dateRange.endDate)}
                          </p>
                        )
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-purple-600">Tasks Completed</div>
                      <div className="text-3xl font-bold text-purple-700">
                        {dashboardType === "delegation"
                          ? departmentData.completedTasks
                          : (dateRange.filtered ? filteredDateStats.completedTasks : departmentData.completedTasks)
                        }
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-purple-600">
                        {dashboardType === "delegation" ? "Tasks Pending" : "Tasks Pending/Overdue"}
                      </div>
                      <div className="text-3xl font-bold text-purple-700">
                        {dashboardType === "delegation"
                          ? departmentData.pendingTasks
                          : (dateRange.filtered
                            ? `${filteredDateStats.pendingTasks} / ${filteredDateStats.overdueTasks}`
                            : `${departmentData.pendingTasks} / ${departmentData.overdueTasks}`
                          )
                        }
                      </div>
                      <div className="text-xs text-purple-600">
                        {dashboardType === "delegation"
                          ? "All incomplete tasks"
                          : "Pending (all incomplete) / Overdue (past dates only)"
                        }
                      </div>
                    </div>
                  </div>

                  {dashboardType !== "delegation" && dateRange.filtered && (
                    <div className="rounded-lg border border-purple-100 p-4 bg-gray-50">
                      <h4 className="text-lg font-medium text-purple-700 mb-4">Detailed Date Range Breakdown</h4>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="bg-white p-3 rounded-lg border border-amber-200">
                          <div className="text-sm font-medium text-amber-700">Pending Tasks</div>
                          <div className="text-2xl font-bold text-amber-600">{filteredDateStats.pendingTasks}</div>
                          <div className="text-xs text-amber-600 mt-1">All incomplete tasks (including overdue + today)</div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-red-200">
                          <div className="text-sm font-medium text-red-700">Overdue Tasks</div>
                          <div className="text-2xl font-bold text-red-600">{filteredDateStats.overdueTasks}</div>
                          <div className="text-xs text-red-600 mt-1">Past due dates only (excluding today)</div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-green-200">
                          <div className="text-sm font-medium text-green-700">Completed Task</div>
                          <div className="text-2xl font-bold text-green-600">{departmentData.completedRatingOne}</div>
                          <div className="text-xs text-green-600 mt-1">Tasks with rating 1</div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-amber-200">
                          <div className="text-sm font-medium text-amber-700">Pending</div>
                          <div className="text-2xl font-bold text-amber-600">{departmentData.completedRatingTwo}</div>
                          <div className="text-xs text-amber-600 mt-1">Tasks with rating 2</div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-red-200">
                          <div className="text-sm font-medium text-red-700">Extended Date</div>
                          <div className="text-2xl font-bold text-red-600">{departmentData.completedRatingThreePlus}</div>
                          <div className="text-xs text-red-600 mt-1">Tasks with rating 3 or higher</div>
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
                            {dashboardType === "delegation"
                              ? departmentData.completionRate
                              : (dateRange.filtered ? filteredDateStats.completionRate : departmentData.completionRate)
                            }%
                          </div>
                          <div className="flex-1">
                            <div className="w-full h-6 bg-gray-200 rounded-full">
                              <div
                                className="h-full rounded-full flex items-center justify-end px-3 text-xs font-medium text-white"
                                style={{
                                  width: `${dashboardType === "delegation"
                                    ? departmentData.completionRate
                                    : (dateRange.filtered ? filteredDateStats.completionRate : departmentData.completionRate)
                                    }%`,
                                  background: `linear-gradient(to right, #10b981 ${(dashboardType === "delegation"
                                    ? departmentData.completionRate
                                    : (dateRange.filtered ? filteredDateStats.completionRate : departmentData.completionRate)
                                  ) * 0.8}%, #f59e0b ${(dashboardType === "delegation"
                                    ? departmentData.completionRate
                                    : (dateRange.filtered ? filteredDateStats.completionRate : departmentData.completionRate)
                                  ) * 0.8}%)`
                                }}
                              >
                                {dashboardType === "delegation"
                                  ? departmentData.completionRate
                                  : (dateRange.filtered ? filteredDateStats.completionRate : departmentData.completionRate)
                                }%
                              </div>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-purple-600 mt-2">
                          {dashboardType === "delegation" ?
                            `${departmentData.completedTasks} of ${departmentData.totalTasks} tasks completed in delegation mode (all sheet data)` :
                            `${dateRange.filtered ? filteredDateStats.completedTasks : departmentData.completedTasks} of ${dateRange.filtered ? filteredDateStats.totalTasks : departmentData.totalTasks} tasks completed in checklist mode`
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* User Performance tab - only for admin */}
          {isAdmin && activeTab === "staff" && (
            <div className="rounded-lg border border-purple-200 shadow-md bg-white">
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 p-4">
                <h3 className="text-purple-700 font-medium">User Performance</h3>
                <p className="text-purple-600 text-sm">
                  {dashboardType === "delegation"
                    ? "Task completion rates by user (all delegation sheet data)"
                    : "Task completion rates by user (tasks up to today only)"
                  }
                </p>
              </div>
              <div className="p-4">
                <div className="space-y-8">
                  {departmentData.staffMembers.length > 0 ? (
                    <>
                      {(() => {
                        const sortedStaffMembers = [...departmentData.staffMembers]
                          .filter(staff => staff.totalTasks > 0)
                          .sort((a, b) => b.progress - a.progress);

                        return (
                          <>
                            <div className="rounded-md border border-green-200">
                              <div className="p-4 bg-gradient-to-r from-green-50 to-green-100 border-b border-green-200">
                                <h3 className="text-lg font-medium text-green-700">Top Performers</h3>
                                <p className="text-sm text-green-600">
                                  {dashboardType === "delegation"
                                    ? "Users with high task completion rates (all delegation data)"
                                    : "Users with high task completion rates (tasks up to today only)"
                                  }
                                </p>
                              </div>
                              <div className="p-4">
                                <div className="space-y-4">
                                  {sortedStaffMembers
                                    .filter(staff => staff.progress >= 70)
                                    .map((staff) => (
                                      <div
                                        key={staff.id}
                                        className="flex items-center justify-between p-3 border border-green-100 rounded-md bg-green-50"
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className="h-10 w-10 rounded-full bg-gradient-to-r from-green-500 to-teal-500 flex items-center justify-center">
                                            <span className="text-sm font-medium text-white">{staff.name.charAt(0)}</span>
                                          </div>
                                          <div>
                                            <p className="font-medium text-green-700">{staff.name}</p>
                                            <p className="text-xs text-green-600">{staff.completedTasks} of {staff.totalTasks} tasks completed</p>
                                          </div>
                                        </div>
                                        <div className="text-lg font-bold text-green-600">{staff.progress}%</div>
                                      </div>
                                    ))
                                  }
                                  {sortedStaffMembers.filter(staff => staff.progress >= 70).length === 0 && (
                                    <div className="text-center p-4 text-gray-500">
                                      <p>No staff members with high completion rates found.</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="rounded-md border border-yellow-200">
                              <div className="p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 border-b border-yellow-200">
                                <h3 className="text-lg font-medium text-yellow-700">Average Performers</h3>
                                <p className="text-sm text-yellow-600">
                                  {dashboardType === "delegation"
                                    ? "Users with moderate task completion rates (all delegation data)"
                                    : "Users with moderate task completion rates (tasks up to today only)"
                                  }
                                </p>
                              </div>
                              <div className="p-4">
                                <div className="space-y-4">
                                  {sortedStaffMembers
                                    .filter(staff => staff.progress >= 40 && staff.progress < 70)
                                    .map((staff) => (
                                      <div
                                        key={staff.id}
                                        className="flex items-center justify-between p-3 border border-yellow-100 rounded-md bg-yellow-50"
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className="h-10 w-10 rounded-full bg-gradient-to-r from-yellow-500 to-amber-500 flex items-center justify-center">
                                            <span className="text-sm font-medium text-white">{staff.name.charAt(0)}</span>
                                          </div>
                                          <div>
                                            <p className="font-medium text-yellow-700">{staff.name}</p>
                                            <p className="text-xs text-yellow-600">{staff.completedTasks} of {staff.totalTasks} tasks completed</p>
                                          </div>
                                        </div>
                                        <div className="text-lg font-bold text-yellow-600">{staff.progress}%</div>
                                      </div>
                                    ))
                                  }
                                  {sortedStaffMembers.filter(staff => staff.progress >= 40 && staff.progress < 70).length === 0 && (
                                    <div className="text-center p-4 text-gray-500">
                                      <p>No users with moderate completion rates found.</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="rounded-md border border-red-200">
                              <div className="p-4 bg-gradient-to-r from-red-50 to-red-100 border-b border-red-200">
                                <h3 className="text-lg font-medium text-red-700">Needs Improvement</h3>
                                <p className="text-sm text-red-600">
                                  {dashboardType === "delegation"
                                    ? "Users with lower task completion rates (all delegation data)"
                                    : "Users with lower task completion rates (tasks up to today only)"
                                  }
                                </p>
                              </div>
                              <div className="p-4">
                                <div className="space-y-4">
                                  {sortedStaffMembers
                                    .filter(staff => staff.progress < 40)
                                    .map((staff) => (
                                      <div
                                        key={staff.id}
                                        className="flex items-center justify-between p-3 border border-red-100 rounded-md bg-red-50"
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className="h-10 w-10 rounded-full bg-gradient-to-r from-red-500 to-pink-500 flex items-center justify-center">
                                            <span className="text-sm font-medium text-white">{staff.name.charAt(0)}</span>
                                          </div>
                                          <div>
                                            <p className="font-medium text-red-700">{staff.name}</p>
                                            <p className="text-xs text-red-600">{staff.completedTasks} of {staff.totalTasks} tasks completed</p>
                                          </div>
                                        </div>
                                        <div className="text-lg font-bold text-red-600">{staff.progress}%</div>
                                      </div>
                                    ))
                                  }
                                  {sortedStaffMembers.filter(staff => staff.progress < 40).length === 0 && (
                                    <div className="text-center p-4 text-gray-500">
                                      <p>No users with low completion rates found.</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {departmentData.staffMembers.filter(staff => staff.totalTasks === 0).length > 0 && (
                              <div className="rounded-md border border-gray-200">
                                <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                                  <h3 className="text-lg font-medium text-gray-700">No Tasks Assigned</h3>
                                  <p className="text-sm text-gray-600">
                                    {dashboardType === "delegation"
                                      ? "Staff with no tasks in delegation sheet"
                                      : "Staff with no tasks assigned for current period"
                                    }
                                  </p>
                                </div>
                                <div className="p-4">
                                  <div className="space-y-4">
                                    {departmentData.staffMembers
                                      .filter(staff => staff.totalTasks === 0)
                                      .map((staff) => (
                                        <div
                                          key={staff.id}
                                          className="flex items-center justify-between p-3 border border-gray-100 rounded-md bg-gray-50"
                                        >
                                          <div className="flex items-center gap-2">
                                            <div className="h-10 w-10 rounded-full bg-gradient-to-r from-gray-500 to-gray-600 flex items-center justify-center">
                                              <span className="text-sm font-medium text-white">{staff.name.charAt(0)}</span>
                                            </div>
                                            <div>
                                              <p className="font-medium text-gray-700">{staff.name}</p>
                                              <p className="text-xs text-gray-600">
                                                {dashboardType === "delegation"
                                                  ? "No tasks in delegation sheet"
                                                  : "No tasks assigned up to today"
                                                }
                                              </p>
                                            </div>
                                          </div>
                                          <div className="text-lg font-bold text-gray-600">N/A</div>
                                        </div>
                                      ))
                                    }
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </>
                  ) : (
                    <div className="text-center p-8 text-gray-500">
                      <p>
                        {dashboardType === "delegation"
                          ? "No delegation data available."
                          : "Loading user data..."
                        }
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        {popupOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl w-11/12 max-w-6xl h-5/6 flex flex-col">
              <div className="flex justify-between items-center p-4 border-b">
                <h2 className="text-xl font-bold text-purple-700">
                  {popupType.charAt(0).toUpperCase() + popupType.slice(1)} Tasks Details
                </h2>
                <button
                  onClick={() => setPopupOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="p-4 border-b bg-gray-50">
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      placeholder="Search tasks..."
                      value={popupFilters.search}
                      onChange={(e) => handlePopupFilterChange('search', e.target.value)}
                      className="pl-10 pr-4 py-2 border border-purple-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  {isAdmin && (
                    <>
                      <select
                        value={popupFilters.department}
                        onChange={(e) => handlePopupFilterChange('department', e.target.value)}
                        className="border border-purple-200 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="all">All Departments</option>
                        {Array.from(new Set(popupData.map(task => task.department).filter(Boolean))).map(dept => (
                          <option key={dept} value={dept}>{dept}</option>
                        ))}
                      </select>

                      <select
                        value={popupFilters.name}
                        onChange={(e) => handlePopupFilterChange('name', e.target.value)}
                        className="border border-purple-200 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="all">All Names</option>
                        {Array.from(new Set(popupData.map(task => task.assignedTo).filter(Boolean))).map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </>
                  )}

                  <button
                    onClick={() => setPopupFilters({
                      search: "",
                      department: "all",
                      givenBy: "all",
                      name: "all",
                    })}
                    className="px-4 py-2 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 transition-colors font-medium flex items-center gap-2"
                  >
                    <X size={16} />
                    Clear Filters
                  </button>

                  <h1 className="text-blue-800 font-medium">
                    Total Tasks: {getFilteredPopupData().length}
                  </h1>
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                <div className="hidden md:block">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Task ID</th>
                        {isAdmin && (
                          <>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                          </>
                        )}
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">End Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Frequency</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {getFilteredPopupData().map(task => (
                        <tr key={task.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-900">{task.id}</td>
                          {isAdmin && (
                            <>
                              <td className="px-6 py-4 text-sm text-gray-500">{task.department}</td>
                            </>
                          )}
                          <td className="px-6 py-4 text-sm text-gray-500">{task.assignedTo}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{task.title}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{task.taskStartDate}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{task.frequency}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden space-y-4 p-4">
                  {getFilteredPopupData().map(task => (
                    <div key={task.id} className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-medium text-gray-500">Task ID</span>
                          <p className="text-sm font-semibold text-gray-900">{task.id}</p>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${task.frequency === 'daily' ? 'bg-blue-100 text-blue-700' :
                          task.frequency === 'weekly' ? 'bg-purple-100 text-purple-700' :
                            task.frequency === 'monthly' ? 'bg-orange-100 text-orange-700' :
                              'bg-gray-100 text-gray-700'
                          }`}>
                          {task.frequency}
                        </span>
                      </div>

                      <div>
                        <span className="text-xs font-medium text-gray-500">Description</span>
                        <p className="text-sm text-gray-900 mt-1">{task.title}</p>
                      </div>

                      {isAdmin && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <span className="text-xs font-medium text-gray-500">Department</span>
                            <p className="text-sm text-gray-900">{task.department}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-gray-500">Assigned To</span>
                            <p className="text-sm text-gray-900">{task.assignedTo}</p>
                          </div>
                        </div>
                      )}

                      {!isAdmin && (
                        <div>
                          <span className="text-xs font-medium text-gray-500">Assigned To</span>
                          <p className="text-sm text-gray-900">{task.assignedTo}</p>
                        </div>
                      )}

                      <div>
                        <span className="text-xs font-medium text-gray-500">End Date</span>
                        <p className="text-sm text-gray-900">{task.taskStartDate}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
