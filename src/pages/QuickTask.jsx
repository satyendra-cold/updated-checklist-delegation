"use client"
import { useEffect, useState, useCallback, useRef } from "react";
import { format } from 'date-fns';
import { Search, ChevronDown, Filter, Trash2, Save } from "lucide-react";
import AdminLayout from "../components/layout/AdminLayout";
import DelegationPage from "./delegation-data";
import { getUserRole, getUsername, isAdminUser, isSuperAdmin } from "../utils/authUtils";

export default function QuickTask() {
  const [tasks, setTasks] = useState([]);
  const [delegationTasks, setDelegationTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [delegationLoading, setDelegationLoading] = useState(false);
  const [userLoading, setUserLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [activeTab, setActiveTab] = useState('checklist');
  const [nameFilter, setNameFilter] = useState('');
  const [freqFilter, setFreqFilter] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  // UPDATED: Always set to 'super_admin' for unrestricted access
  const [userRole, setUserRole] = useState("super_admin");
  // UPDATED: Always true for super_admin access
  const isAdmin = true;
  // UPDATED: Check if user is super_admin for Action column (checkbox & delete button)
  const canAccessActionColumn = isSuperAdmin();
  const [dropdownOpen, setDropdownOpen] = useState({
    name: false,
    frequency: false
  });
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [editingRows, setEditingRows] = useState(new Set());
  const [editedData, setEditedData] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(null); // Track which row is being deleted
  const dropdownRef = useRef(null);


  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen({ name: false, frequency: false });
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Dropdown toggle functions



  const formatTimestampForSheet = () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  };



  const generateTaskId = () => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `TASK${timestamp}${random}`;
  };

  const handleRowSelection = (taskId) => {
    const newSelected = new Set(selectedRows);
    const newEditing = new Set(editingRows);

    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
      newEditing.delete(taskId);
      // Remove from edited data
      setEditedData(prev => {
        const newData = { ...prev };
        delete newData[taskId];
        return newData;
      });
    } else {
      newSelected.add(taskId);
      newEditing.add(taskId);
      // Initialize edited data with current task data
      const currentTasks = activeTab === 'checklist' ? filteredChecklistTasks : filteredDelegationTasks;
      const task = currentTasks.find(t => t._id === taskId);
      setEditedData(prev => ({ ...prev, [taskId]: { ...task } }));
    }

    setSelectedRows(newSelected);
    setEditingRows(newEditing);
  };

  const handleSelectAll = () => {
    const currentTasks = activeTab === 'checklist' ? filteredChecklistTasks : filteredDelegationTasks;

    if (selectedRows.size === currentTasks.length && currentTasks.length > 0) {
      // Deselect all
      setSelectedRows(new Set());
      setEditingRows(new Set());
      setEditedData({});
    } else {
      // Select all
      const allIds = new Set(currentTasks.map(task => task._id));
      setSelectedRows(allIds);
      setEditingRows(allIds);
      // Initialize edited data for all tasks
      const newEditedData = {};
      currentTasks.forEach(task => {
        newEditedData[task._id] = { ...task };
      });
      setEditedData(newEditedData);
    }
  };

  const handleInputChange = (taskId, field, value) => {
    setEditedData(prev => ({
      ...prev,
      [taskId]: { ...prev[taskId], [field]: value }
    }));
  };

  const formatDateForSheet = (dateString) => {
    if (!dateString) return '';

    // If already in sheet format "12/11/2025 21:00:00", return exactly as-is
    if (typeof dateString === 'string' && dateString.match(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/)) {
      return dateString;
    }

    // Handle Google Sheets Date format: Date(2025,11,12,9,0,0)
    if (typeof dateString === 'string' && dateString.startsWith('Date(')) {
      try {
        const match = dateString.match(/Date\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/);
        if (match) {
          const year = parseInt(match[1], 10);
          const month = parseInt(match[2], 10); // 0-based (0=Jan, 11=Dec)
          const day = parseInt(match[3], 10);
          const hour = parseInt(match[4], 10);
          const minute = parseInt(match[5], 10);
          const second = parseInt(match[6], 10);

          // Format to DD/MM/YYYY HH:MM:SS
          const formattedDay = String(day).padStart(2, '0');
          const formattedMonth = String(month + 1).padStart(2, '0'); // Convert to 1-based
          const formattedYear = year;
          const formattedHour = String(hour).padStart(2, '0');
          const formattedMinute = String(minute).padStart(2, '0');
          const formattedSecond = String(second).padStart(2, '0');

          return `${formattedDay}/${formattedMonth}/${formattedYear} ${formattedHour}:${formattedMinute}:${formattedSecond}`;
        }
      } catch (e) {
        // Continue to other parsing methods
      }
    }

    // Handle Date object or ISO string
    try {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
      }
    } catch (e) {
      // Return original value if can't parse
    }

    return dateString; // Return whatever was in the input field
  };


  // CONFIG must be defined before functions that use it
  const CONFIG = {
    SHEET_ID: "1YCLFppf8OrwZjKjhVyVB77s63vFQUylXzEniWLeatW0/",
    WHATSAPP_SHEET: "Whatsapp", // Updated to match other pages
    CHECKLIST_SHEET: "Unique", // For unique checklist tasks
    DELEGATION_SHEET: "Delegation", // For delegation tasks
    APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbyGf3LdYk6MPiOs_shPU9_AW7wmRjJZ4QxMk9qYqTScsDMB7IliaWRB1HueYy7w5qxqNw/exec",
    PAGE_CONFIG: {
      title: "Task Management",
      description: "Showing your tasks"
    }
  };


  // Function to update a single task
  const handleUpdateRow = async (taskInternalId) => {
    if (submitting) return;

    try {
      setSubmitting(true);
      const userAppScriptUrl = CONFIG.APPS_SCRIPT_URL;
      const isChecklist = activeTab === 'checklist';
      const currentDataList = isChecklist ? tasks : delegationTasks;
      const originalTask = currentDataList.find(t => t._id === taskInternalId);
      const editedTask = editedData[taskInternalId];

      if (!originalTask || !editedTask) {
        throw new Error('Task data not found');
      }

      const existingTaskId = originalTask['Task ID'];
      const sheetName = isChecklist ? CONFIG.CHECKLIST_SHEET : CONFIG.DELEGATION_SHEET;

      let rowData = [];
      if (isChecklist) {
        rowData = [
          "", // Column A - Timestamp
          String(existingTaskId), // Column B - Task ID
          editedTask.Department || originalTask.Department || "",
          editedTask['Given By'] || originalTask['Given By'] || "",
          editedTask.Name || originalTask.Name || "",
          editedTask['Task Description'] || originalTask['Task Description'] || "",
          formatDateForSheet(editedTask['Start Date'] || originalTask['Start Date']),
          editedTask.Frequency || originalTask.Frequency || "",
          editedTask.Reminders || originalTask.Reminders || "",
          editedTask.Attachment || originalTask.Attachment || ""
        ];
      } else {
        // Delegation Sheet structure: Timestamp, Task ID, Dept, Given By, Name, Desc, Task Start Date, Freq, Reminders, Attachment
        rowData = [
          formatTimestampForSheet(), // Column A - Timestamp
          String(existingTaskId), // Column B - Task ID
          editedTask.Department || originalTask.Department || "",
          editedTask['Given By'] || originalTask['Given By'] || "",
          editedTask.Name || originalTask.Name || "",
          editedTask['Task Description'] || originalTask['Task Description'] || "",
          formatDateForSheet(editedTask['Task Start Date'] || originalTask['Task Start Date']),
          editedTask.Freq || originalTask.Freq || "",
          editedTask['Enable Reminders'] || originalTask['Enable Reminders'] || "",
          editedTask['Require Attachment'] || originalTask['Require Attachment'] || ""
        ];
      }

      const requestBody = {
        sheetName: sheetName,
        action: 'updateQuickTask',
        taskId: String(existingTaskId),
        rowData: JSON.stringify(rowData)
      };

      const response = await fetch(userAppScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(requestBody)
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();

      if (result.success) {
        alert(`${isChecklist ? 'Checklist' : 'Delegation'} task updated successfully!`);
        // Remove from editing mode after success
        const newEditing = new Set(editingRows);
        newEditing.delete(taskInternalId);
        setEditingRows(newEditing);

        const newSelected = new Set(selectedRows);
        newSelected.delete(taskInternalId);
        setSelectedRows(newSelected);

        if (isChecklist) {
          await fetchChecklistData();
        } else {
          await fetchDelegationData();
        }
      } else {
        throw new Error(result.error || result.message);
      }
    } catch (error) {
      console.error('Update error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };



  // Delete task function for super_admin
  const handleDeleteTask = async (task) => {
    if (!confirm(`Are you sure you want to delete this task?\n\nTask ID: ${task['Task ID'] || 'N/A'}\nName: ${task.Name || 'N/A'}\nDescription: ${task['Task Description'] || 'N/A'}`)) {
      return;
    }

    try {
      setDeleting(task._id);

      const userAppScriptUrl = CONFIG.APPS_SCRIPT_URL;
      const isChecklist = activeTab === 'checklist';
      const sheetName = isChecklist ? CONFIG.CHECKLIST_SHEET : CONFIG.DELEGATION_SHEET;

      // Use rowIndex to identify the row to delete (matches backend handleDeleteRow)
      const rowIndex = task._rowIndex;
      const taskId = task['Task ID'];

      if (!rowIndex) {
        throw new Error('Row index not found. Cannot delete this row.');
      }

      console.log("Deleting task:", {
        taskId: taskId,
        rowIndex: rowIndex,
        sheetName: sheetName
      });

      // Backend expects: action='deleteRow', sheet (not sheetName), rowIndex
      const response = await fetch(userAppScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          action: 'deleteRow',
          sheet: sheetName, // Backend uses 'sheet' not 'sheetName'
          rowIndex: String(rowIndex)
        })
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();

      console.log("Delete result:", result);

      if (!result.success) throw new Error(result.error || 'Server returned error');

      // Refresh the data
      if (isChecklist) {
        await fetchChecklistData();
      } else {
        await fetchDelegationData();
      }
      alert(`${isChecklist ? 'Checklist' : 'Delegation'} task "${taskId}" deleted successfully!`);
    } catch (error) {
      console.error('Delete error:', error);
      alert(`Error deleting task: ${error.message}`);
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedRows.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedRows.size} selected task(s)?`)) {
      return;
    }

    try {
      setDeleting('bulk');
      const userAppScriptUrl = CONFIG.APPS_SCRIPT_URL;
      const isChecklist = activeTab === 'checklist';
      const sheetName = isChecklist ? CONFIG.CHECKLIST_SHEET : CONFIG.DELEGATION_SHEET;
      const currentTasks = isChecklist ? tasks : delegationTasks;

      for (const taskId of selectedRows) {
        const task = currentTasks.find(t => t._id === taskId);
        if (task && task._rowIndex) {
          const response = await fetch(userAppScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              action: 'deleteRow',
              sheet: sheetName,
              rowIndex: String(task._rowIndex)
            })
          });

          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          const result = await response.json();
          if (!result.success) throw new Error(result.error || 'Server returned error');
        }
      }

      if (isChecklist) {
        await fetchChecklistData();
      } else {
        await fetchDelegationData();
      }
      setSelectedRows(new Set());
      setEditingRows(new Set());
      alert(`Successfully deleted ${selectedRows.size} task(s)!`);
    } catch (error) {
      console.error('Bulk delete error:', error);
      alert(`Error deleting tasks: ${error.message}`);
    } finally {
      setDeleting(null);
    }
  };

  // Auto-detect current user from login session and get role from Whatsapp sheet
  const fetchCurrentUser = useCallback(async () => {
    try {
      setUserLoading(true);
      setError(null);

      const loggedInUsername = sessionStorage.getItem('username');
      if (!loggedInUsername) {
        throw new Error("No user logged in. Please log in to access tasks.");
      }

      const response = await fetch(`${CONFIG.APPS_SCRIPT_URL}?sheet=${CONFIG.WHATSAPP_SHEET}&action=fetch`);
      if (!response.ok) throw new Error("Failed to fetch user data");

      const responseText = await response.text();
      let parsedData;

      try {
        parsedData = JSON.parse(responseText);
      } catch (parseError) {
        const jsonStart = responseText.indexOf('{');
        const jsonEnd = responseText.lastIndexOf('}') + 1;
        if (jsonStart !== -1 && jsonEnd !== -1) {
          parsedData = JSON.parse(responseText.substring(jsonStart, jsonEnd));
        } else {
          throw new Error("Invalid JSON response from server");
        }
      }

      let rows = [];
      if (parsedData.table && parsedData.table.rows) {
        rows = parsedData.table.rows;
      } else if (Array.isArray(parsedData)) {
        rows = parsedData;
      } else if (parsedData.values) {
        rows = parsedData.values.map(r => ({ c: r.map(v => ({ v: v })) }));
      }

      if (rows.length > 0) {
        let foundUser = null;
        // Skip header
        const dataRows = rows.slice(1);

        for (const row of dataRows) {
          let rowValues = [];
          if (row.c) {
            rowValues = row.c.map(cell => cell && cell.v !== undefined ? cell.v : "");
          } else if (Array.isArray(row)) {
            rowValues = row;
          }

          // Column A=0(Dept), B=1(Given), C=2(Name), D=3(Pass), E=4(Role)
          const doerName = String(rowValues[2] || "").trim();
          const role = String(rowValues[4] || "user").trim().toLowerCase();

          if (doerName.toLowerCase() === loggedInUsername.toLowerCase()) {
            foundUser = {
              name: doerName,
              role: role,
              department: rowValues[0] || "",
              givenBy: rowValues[1] || ""
            };
            break;
          }
        }

        if (foundUser) {
          setCurrentUser(foundUser.name);
          setUserRole(foundUser.role);
        } else {
          throw new Error(`User "${loggedInUsername}" not found in Whatsapp sheet. Please contact administrator.`);
        }
      } else {
        throw new Error("No data found in Whatsapp sheet");
      }
    } catch (err) {
      console.error("Error fetching user:", err);
      setError(err.message);
    } finally {
      setUserLoading(false);
    }
  }, []);
  // **COMPLETE CORRECTED fetchChecklistData function** - Replace your entire fetchChecklistData function:

  const fetchChecklistData = useCallback(async () => {
    if (!currentUser || userLoading) return;

    try {
      setLoading(true);

      const response = await fetch(`${CONFIG.APPS_SCRIPT_URL}?sheet=${CONFIG.CHECKLIST_SHEET}&action=fetch`);
      if (!response.ok) throw new Error("Failed to fetch checklist data");

      const responseText = await response.text();
      let parsedData;

      try {
        parsedData = JSON.parse(responseText);
      } catch (parseError) {
        const jsonStart = responseText.indexOf('{');
        const jsonEnd = responseText.lastIndexOf('}') + 1;
        if (jsonStart !== -1 && jsonEnd !== -1) {
          parsedData = JSON.parse(responseText.substring(jsonStart, jsonEnd));
        } else {
          throw new Error("Invalid JSON response from server");
        }
      }

      let rows = [];
      if (parsedData.table && parsedData.table.rows) {
        rows = parsedData.table.rows;
      } else if (Array.isArray(parsedData)) {
        rows = parsedData;
      } else if (parsedData.values) {
        rows = parsedData.values.map(r => ({ c: r.map(v => ({ v: v })) }));
      }

      if (rows.length > 0) {
        const dataRows = rows.slice(1); // Skip header

        const transformedData = dataRows.map((row, index) => {
          let rowValues = [];
          if (row.c) {
            rowValues = row.c.map(cell => cell && cell.v !== undefined ? cell.v : "");
          } else if (Array.isArray(row)) {
            rowValues = row;
          }

          // Map columns B-J from Checklist (Unique) sheet
          // Index 1=Task ID, 2=Dept, 3=Given By, 4=Name, 5=Description, 6=End Date, 7=Freq, 8=Reminders, 9=Attachment
          return {
            _id: `checklist_${index}_${Math.random().toString(36).substring(2, 11)}`,
            _rowIndex: index + 2,
            'Task ID': rowValues[1] || "",
            Department: rowValues[2] || "",
            'Given By': rowValues[3] || "",
            Name: rowValues[4] || "",
            'Task Description': rowValues[5] || "",
            'Start Date': formatDateForSheet(rowValues[6]),
            Frequency: rowValues[7] || "",
            Reminders: rowValues[8] || "",
            Attachment: rowValues[9] || "",
            Task: 'Checklist'
          };
        });

        // Apply role-based filtering
        let filteredData;
        if (isAdmin) {
          filteredData = transformedData;
        } else {
          filteredData = transformedData.filter(item => {
            const itemName = (item.Name || '').toString().toLowerCase().trim();
            const currentUserLower = currentUser.toLowerCase().trim();
            return itemName === currentUserLower;
          });
        }

        setTasks(filteredData);
      }
    } catch (err) {
      console.error("Checklist fetch error:", err);
      setError(err.message || "Failed to load checklist data");
    } finally {
      setLoading(false);
    }
  }, [currentUser, userRole, userLoading]);

  const fetchDelegationData = useCallback(async () => {
    if (!currentUser || userLoading) return;

    try {
      setDelegationLoading(true);

      const response = await fetch(`${CONFIG.APPS_SCRIPT_URL}?sheet=${CONFIG.DELEGATION_SHEET}&action=fetch`);
      if (!response.ok) throw new Error("Failed to fetch delegation data");

      const responseText = await response.text();
      let parsedData;

      try {
        parsedData = JSON.parse(responseText);
      } catch (parseError) {
        const jsonStart = responseText.indexOf('{');
        const jsonEnd = responseText.lastIndexOf('}') + 1;
        if (jsonStart !== -1 && jsonEnd !== -1) {
          parsedData = JSON.parse(responseText.substring(jsonStart, jsonEnd));
        } else {
          throw new Error("Invalid JSON response from server");
        }
      }

      let rows = [];
      if (parsedData.table && parsedData.table.rows) {
        rows = parsedData.table.rows;
      } else if (Array.isArray(parsedData)) {
        rows = parsedData;
      } else if (parsedData.values) {
        rows = parsedData.values.map(r => ({ c: r.map(v => ({ v: v })) }));
      }

      if (rows.length > 0) {
        const dataRows = rows.slice(1); // Skip header
        const transformedData = dataRows.map((row, index) => {
          let rowValues = [];
          if (row.c) {
            rowValues = row.c.map(cell => cell && cell.v !== undefined ? cell.v : "");
          } else if (Array.isArray(row)) {
            rowValues = row;
          }

          return {
            _id: `delegation_${index}_${Math.random().toString(36).substring(2, 11)}`,
            _rowIndex: index + 2,
            Timestamp: formatDate(rowValues[0]),
            'Task ID': rowValues[1] || "",
            Department: rowValues[2] || "",
            'Given By': rowValues[3] || "",
            Name: rowValues[4] || "",
            'Task Description': rowValues[5] || "",
            'Task Start Date': formatDate(rowValues[6]),
            Freq: rowValues[7] || "",
            'Enable Reminders': rowValues[8] || "",
            'Require Attachment': rowValues[9] || "",
          };
        });

        // Apply role-based filtering
        let filteredData;
        if (isAdmin) {
          filteredData = transformedData;
        } else {
          filteredData = transformedData.filter(item => {
            const itemName = (item.Name || '').toString().toLowerCase().trim();
            const itemGivenBy = (item['Given By'] || '').toString().toLowerCase().trim();
            const currentUserLower = currentUser.toLowerCase().trim();
            return itemName === currentUserLower || itemGivenBy === currentUserLower;
          });
        }

        setDelegationTasks(filteredData);
      }
    } catch (err) {
      console.error("Delegation fetch error:", err);
      setError(err.message || "Failed to load delegation data");
    } finally {
      setDelegationLoading(false);
    }
  }, [currentUser, userRole, userLoading]);

  const formatDate = (dateValue) => {
    if (!dateValue) return "";
    try {
      // already "dd/MM/yyyy HH:mm:ss"
      if (typeof dateValue === "string" &&
        dateValue.match(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/)) {
        return dateValue;
      }

      // Google Sheets gviz: Date(2025,10,12,21,0,0)
      if (typeof dateValue === "string" && dateValue.startsWith("Date(")) {
        const match = dateValue.match(/Date\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/);
        if (match) {
          const year = parseInt(match[1], 10);
          const month = parseInt(match[2], 10);      // already 0‑based
          const day = parseInt(match[3], 10);
          const hour = parseInt(match[4], 10);
          const minute = parseInt(match[5], 10);
          const second = parseInt(match[6], 10);
          const d = new Date(year, month, day, hour, minute, second);
          const dd = String(d.getDate()).padStart(2, "0");
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const yyyy = d.getFullYear();
          const hh = String(d.getHours()).padStart(2, "0");
          const mi = String(d.getMinutes()).padStart(2, "0");
          const ss = String(d.getSeconds()).padStart(2, "0");
          return `${dd}/${mm}/${yyyy} ${hh}:${mi}:${ss}`;
        }
      }

      // fallback
      const d = new Date(dateValue);
      if (!isNaN(d.getTime())) {
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const yyyy = d.getFullYear();
        const hh = String(d.getHours()).padStart(2, "0");
        const mi = String(d.getMinutes()).padStart(2, "0");
        const ss = String(d.getSeconds()).padStart(2, "0");
        return `${dd}/${mm}/${yyyy} ${hh}:${mi}:${ss}`;
      }

      return dateValue;
    } catch {
      return dateValue;
    }
  };


  const requestSort = (key) => {
    if (loading) return;
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const toggleDropdown = (dropdown) => {
    setDropdownOpen(prev => ({
      ...prev,
      [dropdown]: !prev[dropdown]
    }));
  };

  const handleNameFilterSelect = (name) => {
    setNameFilter(name);
    setDropdownOpen({ ...dropdownOpen, name: false });
  };

  const handleFrequencyFilterSelect = (freq) => {
    setFreqFilter(freq);
    setDropdownOpen({ ...dropdownOpen, frequency: false });
  };

  const clearNameFilter = () => {
    setNameFilter('');
    setDropdownOpen({ ...dropdownOpen, name: false });
  };

  const clearFrequencyFilter = () => {
    setFreqFilter('');
    setDropdownOpen({ ...dropdownOpen, frequency: false });
  };

  // Get filter options based on active tab
  const getFilterOptions = () => {
    const currentTasks = activeTab === 'checklist' ? tasks : delegationTasks;

    const names = [...new Set(currentTasks.map(task => task.Name))]
      .filter(name => name && typeof name === 'string' && name.trim() !== '');

    // For checklist, use 'Frequency' field, for delegation use 'Freq'
    const frequencies = activeTab === 'checklist'
      ? [...new Set(currentTasks.map(task => task.Frequency))]
        .filter(freq => freq && typeof freq === 'string' && freq.trim() !== '')
      : [...new Set(currentTasks.map(task => task.Freq))]
        .filter(freq => freq && typeof freq === 'string' && freq.trim() !== '');

    return { names, frequencies };
  };

  const { names: currentNames, frequencies: currentFrequencies } = getFilterOptions();

  // Reset filters when changing tabs
  useEffect(() => {
    setNameFilter('');
    setFreqFilter('');
    setDropdownOpen({ name: false, frequency: false });
  }, [activeTab]);

  const filteredChecklistTasks = tasks.filter(task => {
    const nameFilterPass = !nameFilter || task.Name === nameFilter;
    const freqFilterPass = !freqFilter || task.Frequency === freqFilter;
    const searchTermPass = Object.values(task).some(
      value => value && value.toString().toLowerCase().includes(searchTerm.toLowerCase())
    );
    return nameFilterPass && freqFilterPass && searchTermPass;
  }).sort((a, b) => {
    if (!sortConfig.key) return 0;
    if (a[sortConfig.key] < b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (a[sortConfig.key] > b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  // Memoized derived data for Delegation
  const filteredDelegationTasks = delegationTasks.filter(task => {
    const nameFilterPass = !nameFilter || task.Name === nameFilter;
    const freqFilterPass = !freqFilter || task.Freq === freqFilter;
    const searchTermPass = Object.values(task).some(
      value => value && value.toString().toLowerCase().includes(searchTerm.toLowerCase())
    );
    return nameFilterPass && freqFilterPass && searchTermPass;
  }).sort((a, b) => {
    if (!sortConfig.key) return 0;
    if (a[sortConfig.key] < b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (a[sortConfig.key] > b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  const currentFilteredTasks = activeTab === 'checklist' ? filteredChecklistTasks : filteredDelegationTasks;

  // Auto-detect user on component mount
  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  // Fetch task data when user is loaded
  useEffect(() => {
    if (currentUser && userRole && !userLoading) {
      // console.log("Fetching data for user:", currentUser, "with role:", userRole);
      fetchChecklistData();
      fetchDelegationData();
    }
  }, [fetchChecklistData, fetchDelegationData, currentUser, userRole, userLoading]);

  // Show loading while fetching user data
  if (userLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mb-4"></div>
            <p className="text-purple-600 text-lg">Loading user session...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  // Show error if user not found or not logged in
  if (error) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg border border-red-200">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 19c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
              <p className="text-sm text-gray-600 mb-4">{error}</p>
              <button
                onClick={() => window.location.href = '/login'}
                className="w-full bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors"
              >
                Go to Login
              </button>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="sticky top-0 z-30 bg-white pb-4 border-b border-gray-200">
        {/* Tab Selection */}
        <div className="flex border-b border-gray-200 mb-4 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('checklist')}
            className={`px-6 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors duration-200 ${activeTab === 'checklist'
              ? 'border-purple-600 text-purple-700 bg-purple-50'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
          >
            Checklist Tasks
          </button>
          <button
            onClick={() => setActiveTab('delegation')}
            className={`px-6 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors duration-200 ${activeTab === 'delegation'
              ? 'border-purple-600 text-purple-700 bg-purple-50'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
          >
            Delegation Tasks
          </button>
        </div>

        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-purple-700 pl-3">
              {activeTab === 'checklist' ? 'Checklist Management' : 'Delegation Management'}
            </h1>
            <p className="text-purple-600 text-sm pl-3">
              {currentUser && `Welcome ${currentUser}`}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-5 w-full sm:w-auto">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder={`Search ${activeTab === 'checklist' ? 'checklist' : 'delegation'} tasks...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-purple-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={loading || delegationLoading}
              />
            </div>

            <div className="flex gap-2" ref={dropdownRef}>
              <div className="relative">
                <button
                  onClick={() => toggleDropdown('name')}
                  className="flex items-center gap-2 px-3 py-2 border border-purple-200 rounded-md bg-white text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Filter className="h-4 w-4" />
                  {nameFilter || 'Filter by Name'}
                  <ChevronDown size={16} className={`transition-transform ${dropdownOpen.name ? 'rotate-180' : ''}`} />
                </button>
                {dropdownOpen.name && (
                  <div className="absolute z-50 mt-1 right-0 w-56 rounded-md bg-white shadow-lg border border-gray-200 max-h-60 overflow-auto">
                    <div className="py-1">
                      <button
                        onClick={clearNameFilter}
                        className={`block w-full text-left px-4 py-2 text-sm ${!nameFilter ? 'bg-purple-100 text-purple-900' : 'text-gray-700 hover:bg-gray-100'}`}
                      >
                        All Names
                      </button>
                      {currentNames.map(name => (
                        <button
                          key={name}
                          onClick={() => handleNameFilterSelect(name)}
                          className={`block w-full text-left px-4 py-2 text-sm ${nameFilter === name ? 'bg-purple-100 text-purple-900' : 'text-gray-700 hover:bg-gray-100'}`}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={() => toggleDropdown('frequency')}
                  className="flex items-center gap-2 px-3 py-2 border border-purple-200 rounded-md bg-white text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Filter className="h-4 w-4" />
                  {freqFilter || (activeTab === 'checklist' ? 'Filter by Frequency' : 'Filter by Freq')}
                  <ChevronDown size={16} className={`transition-transform ${dropdownOpen.frequency ? 'rotate-180' : ''}`} />
                </button>
                {dropdownOpen.frequency && (
                  <div className="absolute z-50 mt-1 right-0 w-56 rounded-md bg-white shadow-lg border border-gray-200 max-h-60 overflow-auto">
                    <div className="py-1">
                      <button
                        onClick={clearFrequencyFilter}
                        className={`block w-full text-left px-4 py-2 text-sm ${!freqFilter ? 'bg-purple-100 text-purple-900' : 'text-gray-700 hover:bg-gray-100'}`}
                      >
                        {activeTab === 'checklist' ? 'All Frequencies' : 'All Freq'}
                      </button>
                      {currentFrequencies.map(freq => (
                        <button
                          key={freq}
                          onClick={() => handleFrequencyFilterSelect(freq)}
                          className={`block w-full text-left px-4 py-2 text-sm ${freqFilter === freq ? 'bg-purple-100 text-purple-900' : 'text-gray-700 hover:bg-gray-100'}`}
                        >
                          {freq}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-purple-200 shadow-md bg-white overflow-hidden">
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 p-4">
          <h2 className="text-purple-700 font-medium">
            {activeTab === 'checklist'
              ? (isAdmin ? 'All Unique Checklists' : 'My Unique Checklists')
              : (isAdmin ? 'All Delegation Tasks' : 'My Delegation Tasks')
            }
          </h2>
          <p className="text-purple-600 text-sm">
            {activeTab === 'checklist'
              ? (isAdmin ? 'Showing all unique tasks from checklist' : 'Showing your unique checklist tasks')
              : (isAdmin ? 'Showing all delegation tasks' : 'Showing your delegation tasks')
            }
          </p>
        </div>

        {/* Action Buttons for Selected Rows */}
        {selectedRows.size > 0 && isAdmin && (
          <div className="mb-4 flex justify-end p-4 bg-blue-50 border-b gap-3">
            <button
              onClick={handleDeleteSelected}
              disabled={deleting === 'bulk' || submitting}
              className="bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white px-4 py-2 rounded-md font-medium flex items-center gap-2"
            >
              {deleting === 'bulk' ? 'Deleting...' : `Delete ${selectedRows.size} Selected`}
            </button>
            <button
              onClick={() => {
                alert('Bulk update functionality coming soon or use individual save buttons.');
              }}
              disabled={submitting || deleting === 'bulk'}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md font-medium flex items-center gap-2"
            >
              {submitting ? 'Processing...' : `Action on ${selectedRows.size} Selected`}
            </button>
          </div>
        )}

        <div className="hidden sm:block overflow-x-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-20">
              <tr>
                {isAdmin && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedRows.size === currentFilteredTasks.length && currentFilteredTasks.length > 0}
                        onChange={handleSelectAll}
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                      />
                      <span className="ml-2">Action</span>
                    </div>
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-green-50">
                  Task ID
                </th>
                {[
                  { key: 'Department', label: 'Department' },
                  { key: 'Given By', label: 'Given By' },
                  { key: 'Name', label: 'Name' },
                  { key: 'Task Description', label: 'Task Description', minWidth: 'min-w-[300px]' },
                  { key: activeTab === 'checklist' ? 'Start Date' : 'Task Start Date', label: 'Start Date', bg: 'bg-yellow-50' },
                  { key: activeTab === 'checklist' ? 'Frequency' : 'Freq', label: 'Frequency' },
                  { key: activeTab === 'checklist' ? 'Reminders' : 'Enable Reminders', label: 'Reminders' },
                  { key: activeTab === 'checklist' ? 'Attachment' : 'Require Attachment', label: 'Attachment' },
                ].map((column) => (
                  <th
                    key={column.label}
                    className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${column.bg || ''} ${column.minWidth || ''} ${column.key ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                    onClick={() => column.key && requestSort(column.key)}
                  >
                    <div className="flex items-center">
                      {column.label}
                      {sortConfig.key === column.key && (
                        <span className="ml-1">
                          {sortConfig.direction === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(loading || delegationLoading) ? (
                <tr>
                  <td colSpan={isAdmin ? 10 : 9} className="px-6 py-8 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500 mb-2"></div>
                      <p className="text-purple-600">Loading {activeTab} tasks...</p>
                    </div>
                  </td>
                </tr>
              ) : currentFilteredTasks.length > 0 ? (
                currentFilteredTasks.map((task) => {
                  const isEditing = editingRows.has(task._id);
                  const editedTask = editedData[task._id] || task;
                  const isSelected = selectedRows.has(task._id);

                  // Field mapping based on tab
                  const startDateKey = activeTab === 'checklist' ? 'Start Date' : 'Task Start Date';
                  const freqKey = activeTab === 'checklist' ? 'Frequency' : 'Freq';
                  const reminderKey = activeTab === 'checklist' ? 'Reminders' : 'Enable Reminders';
                  const attachmentKey = activeTab === 'checklist' ? 'Attachment' : 'Require Attachment';

                  return (
                    <tr key={task._id} className={`hover:bg-gray-50 ${isEditing ? 'bg-blue-50' : ''}`}>
                      {isAdmin && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleRowSelection(task._id)}
                              className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                            />
                            <div className="flex gap-2">
                              {isEditing && (
                                <button
                                  onClick={() => handleUpdateRow(task._id)}
                                  disabled={submitting}
                                  className="px-2 py-1 bg-green-100 text-green-700 hover:bg-green-200 rounded text-xs font-medium transition-colors"
                                  title="Submit Task"
                                >
                                  {submitting ? 'Submitting...' : 'Submit'}
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 bg-green-50">
                        {task['Task ID'] || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editedTask.Department || ''}
                            onChange={(e) => handleInputChange(task._id, 'Department', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        ) : (
                          task.Department || "—"
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editedTask['Given By'] || ''}
                            onChange={(e) => handleInputChange(task._id, 'Given By', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        ) : (
                          task['Given By'] || "—"
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editedTask.Name || ''}
                            onChange={(e) => handleInputChange(task._id, 'Name', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        ) : (
                          task.Name || "—"
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 min-w-[300px] max-w-[400px]">
                        {isEditing ? (
                          <textarea
                            value={editedTask['Task Description'] || ''}
                            onChange={(e) => handleInputChange(task._id, 'Task Description', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            rows={2}
                          />
                        ) : (
                          <div className="whitespace-normal break-words">
                            {task['Task Description'] || "—"}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 bg-yellow-50">
                        {isEditing ? (
                          <div className="flex gap-2 items-center">
                            <input
                              type="date"
                              value={editedTask[startDateKey] ? editedTask[startDateKey].split(' ')[0].split('/').reverse().join('-') : ''}
                              onChange={(e) => {
                                if (e.target.value) {
                                  const [year, month, day] = e.target.value.split('-');
                                  handleInputChange(task._id, startDateKey, `${day}/${month}/${year} 00:00:00`);
                                }
                              }}
                              className="px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          </div>
                        ) : (
                          formatDate(task[startDateKey]) || "—"
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={`px-2 py-1 rounded-full text-xs ${task[freqKey] === 'Daily' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100'}`}>
                          {task[freqKey] || "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editedTask[reminderKey] || ''}
                            onChange={(e) => handleInputChange(task._id, reminderKey, e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        ) : (
                          task[reminderKey] || "—"
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editedTask[attachmentKey] || ''}
                            onChange={(e) => handleInputChange(task._id, attachmentKey, e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        ) : (
                          task[attachmentKey] || "—"
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={isAdmin ? 10 : 9} className="px-6 py-4 text-center text-gray-500">
                    No {activeTab} tasks found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="sm:hidden space-y-4 p-4">
          {currentFilteredTasks.map((task) => {
            const startDateKey = activeTab === 'checklist' ? 'Start Date' : 'Task Start Date';
            return (
              <div key={task._id} className="bg-white border rounded-lg p-4 shadow-sm border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-purple-700">{task['Task ID']}</span>
                  {isAdmin && (
                    <button onClick={() => handleDeleteTask(task)} className="text-red-500"><Trash2 className="h-5 w-5" /></button>
                  )}
                </div>
                <div className="text-sm space-y-1">
                  <p><span className="font-medium">Name:</span> {task.Name}</p>
                  <p><span className="font-medium">Desc:</span> {task['Task Description']}</p>
                  <p><span className="font-medium">Date:</span> {formatDate(task[startDateKey])}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AdminLayout>
  );
}