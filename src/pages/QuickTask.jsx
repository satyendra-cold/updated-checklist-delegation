"use client"
import { useEffect, useState, useCallback, useRef } from "react";
import { format } from 'date-fns';
import { Search, ChevronDown, Filter, Trash2 } from "lucide-react";
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
      const task = filteredChecklistTasks.find(t => t._id === taskId);
      setEditedData(prev => ({ ...prev, [taskId]: { ...task } }));
    }

    setSelectedRows(newSelected);
    setEditingRows(newEditing);
  };

  const handleSelectAll = () => {
    if (selectedRows.size === filteredChecklistTasks.length) {
      // Deselect all
      setSelectedRows(new Set());
      setEditingRows(new Set());
      setEditedData({});
    } else {
      // Select all
      const allIds = new Set(filteredChecklistTasks.map(task => task._id));
      setSelectedRows(allIds);
      setEditingRows(allIds);
      // Initialize edited data for all tasks
      const newEditedData = {};
      filteredChecklistTasks.forEach(task => {
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




  const submitSelectedTasks = async () => {
    // Prevent double submission
    if (submitting) {
      console.log("Already submitting, ignoring duplicate call");
      return;
    }

    // Validate we have tasks to submit
    if (selectedRows.size === 0) {
      alert('No tasks selected');
      return;
    }

    try {
      setSubmitting(true);

      const userAppScriptUrl = "https://script.google.com/macros/s/AKfycbyGf3LdYk6MPiOs_shPU9_AW7wmRjJZ4QxMk9qYqTScsDMB7IliaWRB1HueYy7w5qxqNw/exec";

      // Log selected rows to check for duplicates
      console.log("=== SELECTED ROWS ===");
      console.log("Selected row IDs:", Array.from(selectedRows));
      console.log("Number of selected:", selectedRows.size);

      // Build tasks to update using EXISTING Task IDs and row indices
      const tasksToUpdate = Array.from(selectedRows).map((taskInternalId) => {
        const editedTask = editedData[taskInternalId];
        // Use 'tasks' array (original unfiltered) to find the original task with _rowIndex
        const originalTask = tasks.find(t => t._id === taskInternalId);

        if (!originalTask) {
          console.error(`Original task not found for ID: ${taskInternalId}`);
          return null;
        }

        // Use the EXISTING Task ID and rowIndex from the original task
        const existingTaskId = originalTask['Task ID'];
        const rowIndex = originalTask._rowIndex;

        // Validate rowIndex
        if (!rowIndex || rowIndex < 2) {
          console.error(`Invalid rowIndex (${rowIndex}) for task ID: ${existingTaskId}`);
          return null;
        }

        // Log for debugging
        console.log("=== Task Update Debug ===");
        console.log("Internal ID:", taskInternalId);
        console.log("Existing Task ID:", existingTaskId);
        console.log("Row Index (sheet row):", rowIndex);
        console.log("Original Task:", originalTask);
        console.log("Edited Task:", editedTask);

        // Build row data array for ALL columns (A through J)
        // Backend expects: rowData[0] = Column A, rowData[1] = Column B, etc.
        // Empty strings are skipped by the backend
        const rowData = [
          "", // Column A (index 0) - Timestamp - keep original, don't update
          String(existingTaskId), // Column B (index 1) - Task ID - keep same
          editedTask?.Department || originalTask?.Department || "", // Column C (index 2)
          editedTask?.['Given By'] || originalTask?.['Given By'] || "", // Column D (index 3)
          editedTask?.Name || originalTask?.Name || "", // Column E (index 4)
          editedTask?.['Task Description'] || originalTask?.['Task Description'] || "", // Column F (index 5)
          formatDateForSheet(editedTask?.['End Date'] || originalTask?.['End Date']), // Column G (index 6)
          editedTask?.Frequency || originalTask?.Frequency || "", // Column H (index 7)
          editedTask?.Reminders || originalTask?.Reminders || "", // Column I (index 8)
          editedTask?.Attachment || originalTask?.Attachment || "" // Column J (index 9)
        ];

        console.log("Row Data to send:", rowData);

        return {
          rowIndex: rowIndex,
          taskId: String(existingTaskId),
          rowData: rowData
        };
      }).filter(Boolean); // Remove null entries

      if (tasksToUpdate.length === 0) {
        throw new Error('No valid tasks to update. Check console for errors.');
      }

      // console.log("=== Final Tasks to Update ===");
      // console.log(JSON.stringify(tasksToUpdate, null, 2));

      // Update each task using the 'update' action (matches backend doPost)
      let successCount = 0;
      for (const task of tasksToUpdate) {
        // Build the request body
        const requestBody = {
          sheetName: CONFIG.CHECKLIST_SHEET,
          action: 'updateQuickTask',
          taskId: task.taskId,
          rowData: JSON.stringify(task.rowData)
        };

        // console.log("=== REQUEST DETAILS ===");
        // console.log("URL:", userAppScriptUrl);
        // console.log("Sheet:", requestBody.sheetName);
        // console.log("Action:", requestBody.action);
        // console.log("Task ID:", requestBody.taskId);
        // console.log("Row Data:", requestBody.rowData);

        // Use URLSearchParams as the backend expects form data
        const response = await fetch(userAppScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(requestBody)
        });

        if (!response.ok) {
          console.error(`Failed to update task ${task.taskId}: HTTP ${response.status}`);
          continue;
        }

        const result = await response.json();
        console.log(`=== FULL BACKEND RESPONSE for Task ID ${task.taskId} ===`);
        console.log(JSON.stringify(result, null, 2));

        if (result.success) {
          successCount++;
        } else {
          console.error(`Failed to update task ${task.taskId}:`, result.error || result.message);
        }
      }

      setSelectedRows(new Set());
      setEditingRows(new Set());
      setEditedData({});
      await fetchChecklistData();

      if (successCount === tasksToUpdate.length) {
        alert(`Successfully updated ${successCount} task(s)!`);
      } else if (successCount > 0) {
        alert(`Updated ${successCount} of ${tasksToUpdate.length} task(s). Some updates may have failed.`);
      } else {
        throw new Error('No tasks were updated. Please check the console for errors.');
      }
    } catch (error) {
      console.error('Submission error:', error);
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

      const userAppScriptUrl = "https://script.google.com/macros/s/AKfycbyGf3LdYk6MPiOs_shPU9_AW7wmRjJZ4QxMk9qYqTScsDMB7IliaWRB1HueYy7w5qxqNw/exec";
      const sheetName = CONFIG.CHECKLIST_SHEET;

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
      await fetchChecklistData();
      alert(`Task "${taskId}" deleted successfully!`);
    } catch (error) {
      console.error('Delete error:', error);
      alert(`Error deleting task: ${error.message}`);
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
            'End Date': formatDateForSheet(rowValues[6]),
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
            'Task End Date': formatDate(rowValues[6]),
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
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-purple-700 pl-3">
              {CONFIG.PAGE_CONFIG.title}
            </h1>
            <p className="text-purple-600 text-sm pl-3">
              {currentUser && `Welcome ${currentUser}`}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-5 w-full sm:w-auto">
            <div className="flex border border-purple-200 rounded-md overflow-hidden self-start">
              <button
                className={`px-4 py-2 text-sm font-medium ${activeTab === 'checklist' ? 'bg-purple-600 text-white' : 'bg-white text-purple-600 hover:bg-purple-50'}`}
                onClick={() => setActiveTab('checklist')}
              >
                Unique Task
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium ${activeTab === 'delegation' ? 'bg-purple-600 text-white' : 'bg-white text-purple-600 hover:bg-purple-50'}`}
                onClick={() => setActiveTab('delegation')}
              >
                Delegation
              </button>
            </div>

            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-purple-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={loading || delegationLoading}
              />
            </div>

            <div className="flex gap-2" ref={dropdownRef}>
              {/* Name Filter Dropdown */}
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
                  <div className="absolute z-50 mt-1 w-56 rounded-md bg-white shadow-lg border border-gray-200 max-h-60 overflow-auto">
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

              {/* Frequency Filter Dropdown */}
              <div className="relative">
                <button
                  onClick={() => toggleDropdown('frequency')}
                  className="flex items-center gap-2 px-3 py-2 border border-purple-200 rounded-md bg-white text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Filter className="h-4 w-4" />
                  {freqFilter || 'Filter by Frequency'}
                  <ChevronDown size={16} className={`transition-transform ${dropdownOpen.frequency ? 'rotate-180' : ''}`} />
                </button>
                {dropdownOpen.frequency && (
                  <div className="absolute z-50 mt-1 w-56 rounded-md bg-white shadow-lg border border-gray-200 max-h-60 overflow-auto">
                    <div className="py-1">
                      <button
                        onClick={clearFrequencyFilter}
                        className={`block w-full text-left px-4 py-2 text-sm ${!freqFilter ? 'bg-purple-100 text-purple-900' : 'text-gray-700 hover:bg-gray-100'}`}
                      >
                        All Frequencies
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

      {currentUser && (
        <>
          {activeTab === 'checklist' ? (
            <div className="mt-4 rounded-lg border border-purple-200 shadow-md bg-white overflow-hidden">
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 p-4">
                <h2 className="text-purple-700 font-medium">
                  {isAdmin ? 'All Unique Tasks' : 'My Unique Tasks'}
                </h2>
                <p className="text-purple-600 text-sm">
                  {isAdmin ? 'Showing all unique tasks from checklist' : CONFIG.PAGE_CONFIG.description}
                </p>
              </div>

              {/* Submit Button */}
              {selectedRows.size > 0 && (
                <div className="mb-4 flex justify-end p-4 bg-blue-50 border-b">
                  <button
                    onClick={submitSelectedTasks}
                    disabled={submitting}
                    className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md font-medium flex items-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <div className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                        Submitting...
                      </>
                    ) : (
                      `Submit ${selectedRows.size} Selected Task${selectedRows.size === 1 ? '' : 's'}`
                    )}
                  </button>
                </div>
              )}

              <div className="hidden sm:block overflow-x-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-20">
                    <tr>
                      {/* UPDATED: Only super_admin can see the Action column header */}
                      {canAccessActionColumn && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={selectedRows.size === filteredChecklistTasks.length && filteredChecklistTasks.length > 0}
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
                        { key: 'End Date', label: 'End Date', bg: 'bg-yellow-50' },
                        { key: 'Frequency', label: 'Frequency' },
                        { key: 'Reminders', label: 'Reminders' },
                        { key: 'Attachment', label: 'Attachment' },
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
                    {loading ? (
                      <tr>
                        <td colSpan={9} className="px-6 py-8 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500 mb-2"></div>
                            <p className="text-purple-600">Loading Unique task...</p>
                          </div>
                        </td>
                      </tr>
                    ) : filteredChecklistTasks.length > 0 ? (
                      filteredChecklistTasks.map((task) => {
                        const isEditing = editingRows.has(task._id);
                        const editedTask = editedData[task._id] || task;
                        const isSelected = selectedRows.has(task._id);

                        return (
                          <tr key={task._id} className={`hover:bg-gray-50 ${isEditing ? 'bg-blue-50' : ''}`}>
                            {/* UPDATED: Only super_admin can see the Action column (checkbox & delete) */}
                            {canAccessActionColumn && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <div className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleRowSelection(task._id)}
                                    className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                                  />
                                  <div className="flex justify-center">
                                    <button
                                      onClick={() => handleDeleteTask(task)}
                                      disabled={deleting === task._id}
                                      className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                      title="Delete task"
                                    >
                                      {deleting === task._id ? (
                                        <div className="h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                                      ) : (
                                        <Trash2 className="h-4 w-4" />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </td>
                            )}
                            {/* NEW Task ID column */}
                            {/* Task ID column - display from sheet */}
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
                                    value={editedTask['End Date'] ? editedTask['End Date'].split(' ')[0].split('/').reverse().join('-') : ''}
                                    onChange={(e) => {
                                      if (e.target.value) {
                                        const [year, month, day] = e.target.value.split('-');
                                        handleInputChange(task._id, 'End Date', `${day}/${month}/${year} 00:00:00`);
                                      } else {
                                        handleInputChange(task._id, 'End Date', '');
                                      }
                                    }}
                                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                                  />
                                  <input
                                    type="time"
                                    value={editedTask['End Date'] ? editedTask['End Date'].split(' ')[1] || '00:00' : '00:00'}
                                    onChange={(e) => {
                                      const dateStr = editedTask['End Date']?.split(' ')[0] || '';
                                      if (dateStr) {
                                        const [hours, minutes] = e.target.value.split(':');
                                        handleInputChange(task._id, 'End Date', `${dateStr} ${hours}:${minutes}:00`);
                                      }
                                    }}
                                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                                  />
                                </div>
                              ) : (
                                formatDate(task['End Date']) || "—"
                              )}
                            </td>

                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {isEditing ? (
                                <select
                                  value={editedTask.Frequency || ''}
                                  onChange={(e) => handleInputChange(task._id, 'Frequency', e.target.value)}
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                >
                                  <option value="">Select Frequency</option>
                                  <option value="Daily">Daily</option>
                                  <option value="Weekly">Weekly</option>
                                  <option value="Monthly">Monthly</option>
                                </select>
                              ) : (
                                <span className={`px-2 py-1 rounded-full text-xs ${task.Frequency === 'Daily' ? 'bg-blue-100 text-blue-800' :
                                  task.Frequency === 'Weekly' ? 'bg-green-100 text-green-800' :
                                    task.Frequency === 'Monthly' ? 'bg-purple-100 text-purple-800' :
                                      'bg-gray-100 text-gray-800'
                                  }`}>
                                  {task.Frequency || "—"}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editedTask.Reminders || ''}
                                  onChange={(e) => handleInputChange(task._id, 'Reminders', e.target.value)}
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                              ) : (
                                task.Reminders || "—"
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editedTask.Attachment || ''}
                                  onChange={(e) => handleInputChange(task._id, 'Attachment', e.target.value)}
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                              ) : (
                                task.Attachment || "—"
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                          {searchTerm || nameFilter || freqFilter
                            ? "No tasks matching your filters"
                            : isAdmin ? "No unique tasks available" : "No unique tasks assigned to you"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile card view - replace existing mobile section with this */}
              <div className="sm:hidden space-y-4 p-4" style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
                {loading ? (
                  <div className="text-center py-8">
                    <div className="flex flex-col items-center justify-center">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500 mb-2"></div>
                      <p className="text-purple-600">Loading Unique task...</p>
                    </div>
                  </div>
                ) : filteredChecklistTasks.length > 0 ? (
                  <>
                    {/* Select All Option - Mobile */}
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-3">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedRows.size === filteredChecklistTasks.length && filteredChecklistTasks.length > 0}
                          onChange={handleSelectAll}
                          className="h-5 w-5 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                        />
                        <span className="font-medium text-purple-700">
                          Select All ({selectedRows.size}/{filteredChecklistTasks.length})
                        </span>
                      </label>
                    </div>

                    {filteredChecklistTasks.map((task) => {
                      const isEditing = editingRows.has(task._id);
                      const editedTask = editedData[task._id] || task;
                      const isSelected = selectedRows.has(task._id);

                      return (
                        <div key={task._id} className={`bg-white border rounded-lg p-4 shadow-sm ${isSelected ? 'border-purple-500 bg-purple-50' : 'border-gray-200'
                          } ${isEditing ? 'ring-2 ring-blue-200' : ''}`}>
                          {/* Checkbox at top of card */}
                          <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleRowSelection(task._id)}
                                className="h-5 w-5 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                              />
                              <span className="font-medium text-gray-700">
                                {isSelected ? 'Selected' : 'Select Task'}
                              </span>
                            </label>
                            {isEditing && (
                              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                                Editing Mode
                              </span>
                            )}
                          </div>

                          <div className="space-y-3">
                            <div className="flex justify-between items-center border-b pb-2">
                              <span className="font-medium text-gray-700">Department:</span>
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editedTask.Department || ''}
                                  onChange={(e) => handleInputChange(task._id, 'Department', e.target.value)}
                                  className="w-[35%] px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                              ) : (
                                <div className="text-sm text-gray-900 break-words text-right w-[35%]">
                                  {task.Department || "—"}
                                </div>
                              )}
                            </div>
                            <div className="flex justify-between items-center border-b pb-2">
                              <span className="font-medium text-gray-700">Given By:</span>
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editedTask['Given By'] || ''}
                                  onChange={(e) => handleInputChange(task._id, 'Given By', e.target.value)}
                                  className="w-[35%] px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                              ) : (
                                <div className="text-sm text-gray-900 break-words text-right w-[35%]">
                                  {task['Given By'] || "—"}
                                </div>
                              )}
                            </div>
                            <div className="flex justify-between items-center border-b pb-2">
                              <span className="font-medium text-gray-700">Name:</span>
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editedTask.Name || ''}
                                  onChange={(e) => handleInputChange(task._id, 'Name', e.target.value)}
                                  className="w-[35%] px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                              ) : (
                                <div className="text-sm text-gray-900 break-words text-right w-[35%]">
                                  {task.Name || "—"}
                                </div>
                              )}
                            </div>
                            <div className="flex justify-between items-start border-b pb-2">
                              <span className="font-medium text-gray-700">Task Description:</span>
                              {isEditing ? (
                                <textarea
                                  value={editedTask['Task Description'] || ''}
                                  onChange={(e) => handleInputChange(task._id, 'Task Description', e.target.value)}
                                  className="w-[35%] px-2 py-1 border border-gray-300 rounded text-sm"
                                  rows={2}
                                />
                              ) : (
                                <div className="text-sm text-gray-900 break-words text-right w-[35%]">
                                  {task['Task Description'] || "—"}
                                </div>
                              )}
                            </div>
                            <div className="flex justify-between items-center border-b pb-2">
                              <span className="font-medium text-gray-700">End Date:</span>
                              {isEditing ? (
                                <div className="flex gap-1 items-center w-[35%]">
                                  <input
                                    type="date"
                                    value={editedTask['End Date'] ? editedTask['End Date'].split(' ')[0].split('/').reverse().join('-') : ''}
                                    onChange={(e) => {
                                      if (e.target.value) {
                                        const [year, month, day] = e.target.value.split('-');
                                        handleInputChange(task._id, 'End Date', `${day}/${month}/${year} 00:00:00`);
                                      } else {
                                        handleInputChange(task._id, 'End Date', '');
                                      }
                                    }}
                                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                                  />
                                  <input
                                    type="time"
                                    value={editedTask['End Date'] ? editedTask['End Date'].split(' ')[1] || '00:00' : '00:00'}
                                    onChange={(e) => {
                                      const dateStr = editedTask['End Date']?.split(' ')[0] || '';
                                      if (dateStr) {
                                        const [hours, minutes] = e.target.value.split(':');
                                        handleInputChange(task._id, 'End Date', `${dateStr} ${hours}:${minutes}:00`);
                                      }
                                    }}
                                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                                  />
                                </div>
                              ) : (
                                <div className="text-sm text-gray-900 break-words bg-yellow-50 px-2 py-1 rounded text-right w-[35%]">
                                  {formatDate(task['End Date']) || "—"}
                                </div>
                              )}
                            </div>
                            <div className="flex justify-between items-center border-b pb-2">
                              <span className="font-medium text-gray-700">Frequency:</span>
                              {isEditing ? (
                                <select
                                  value={editedTask.Frequency || ''}
                                  onChange={(e) => handleInputChange(task._id, 'Frequency', e.target.value)}
                                  className="w-[35%] px-2 py-1 border border-gray-300 rounded text-sm"
                                >
                                  <option value="">Select Frequency</option>
                                  <option value="Daily">Daily</option>
                                  <option value="Weekly">Weekly</option>
                                  <option value="Monthly">Monthly</option>
                                </select>
                              ) : (
                                <span className={`px-2 py-1 rounded-full text-xs ${task.Frequency === 'Daily' ? 'bg-blue-100 text-blue-800' :
                                  task.Frequency === 'Weekly' ? 'bg-green-100 text-green-800' :
                                    task.Frequency === 'Monthly' ? 'bg-purple-100 text-purple-800' :
                                      'bg-gray-100 text-gray-800'
                                  }`}>
                                  {task.Frequency || "—"}
                                </span>
                              )}
                            </div>
                            <div className="flex justify-between items-center border-b pb-2">
                              <span className="font-medium text-gray-700">Reminders:</span>
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editedTask.Reminders || ''}
                                  onChange={(e) => handleInputChange(task._id, 'Reminders', e.target.value)}
                                  className="w-[35%] px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                              ) : (
                                <div className="text-sm text-gray-900 break-words text-right w-[35%]">
                                  {task.Reminders || "—"}
                                </div>
                              )}
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-gray-700">Attachment:</span>
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editedTask.Attachment || ''}
                                  onChange={(e) => handleInputChange(task._id, 'Attachment', e.target.value)}
                                  className="w-[35%] px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                              ) : (
                                <div className="text-sm text-gray-900 break-words text-right w-[35%]">
                                  {task.Attachment || "—"}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    {searchTerm || nameFilter || freqFilter
                      ? "No tasks matching your filters"
                      : isAdmin ? "No unique tasks available" : "No unique tasks assigned to you"}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <DelegationPage
              searchTerm={searchTerm}
              nameFilter={nameFilter}
              freqFilter={freqFilter}
              setNameFilter={setNameFilter}
              setFreqFilter={setFreqFilter}
              currentUser={currentUser}
              userRole={userRole}
              CONFIG={CONFIG}
              delegationTasks={delegationTasks}
              delegationLoading={delegationLoading}
              loading={delegationLoading}
            />
          )}
        </>
      )
      }
    </AdminLayout >
  );
}