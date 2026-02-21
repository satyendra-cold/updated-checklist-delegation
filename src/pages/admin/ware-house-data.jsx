"use client"
import { useState, useEffect, useCallback, useMemo } from "react"
import { CheckCircle2, Upload, X, Search, History, ArrowLeft } from "lucide-react"
import AdminLayout from "../../components/layout/AdminLayout"
import { getUserRole, getUsername, isAdminUser } from "../../utils/authUtils"

// Configuration object - Move all configurations here
const CONFIG = {
  // Google Apps Script URL
  APPS_SCRIPT_URL:
    "https://script.google.com/macros/s/AKfycbyGf3LdYk6MPiOs_shPU9_AW7wmRjJZ4QxMk9qYqTScsDMB7IliaWRB1HueYy7w5qxqNw/exec",
  // Google Drive folder ID for file uploads
  DRIVE_FOLDER_ID: "1Y1lg8X7qFA4KgvcaVA_ywKx1gOnZ2ZO6",
  // Sheet name to work with
  SHEET_NAME: "Packing(Mohan)",
  // Page configuration
  PAGE_CONFIG: {
    title: "Packing(Mohan) Tasks",
    historyTitle: "Packing(Mohan) Task History",
    description: "Showing today, tomorrow's tasks and past due tasks",
    historyDescription: "Read-only view of completed tasks with submission history (excluding admin-processed items)",
  },
}

function AccountDataPage() {
  const [accountData, setAccountData] = useState([])
  const [selectedItems, setSelectedItems] = useState(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")
  const [additionalData, setAdditionalData] = useState({})
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [remarksData, setRemarksData] = useState({})
  const [historyData, setHistoryData] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [membersList, setMembersList] = useState([])
  const [selectedMembers, setSelectedMembers] = useState([])
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  // UPDATED: Always set to 'super_admin' for unrestricted access
  const [userRole, setUserRole] = useState("super_admin")
  const [username, setUsername] = useState("")

  // NEW: Admin history selection states
  const [selectedHistoryItems, setSelectedHistoryItems] = useState([])
  const [markingAsDone, setMarkingAsDone] = useState(false)
  const [confirmationModal, setConfirmationModal] = useState({
    isOpen: false,
    itemCount: 0,
  })

  // UPDATED: Format date-time to DD/MM/YYYY HH:MM:SS
  const formatDateTimeToDDMMYYYY = (date) => {
    const day = date.getDate().toString().padStart(2, "0")
    const month = (date.getMonth() + 1).toString().padStart(2, "0")
    const year = date.getFullYear()
    const hours = date.getHours().toString().padStart(2, "0")
    const minutes = date.getMinutes().toString().padStart(2, "0")
    const seconds = date.getSeconds().toString().padStart(2, "0")
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`
  }

  // UPDATED: Format date only to DD/MM/YYYY (for comparison purposes)
  const formatDateToDDMMYYYY = (date) => {
    const day = date.getDate().toString().padStart(2, "0")
    const month = (date.getMonth() + 1).toString().padStart(2, "0")
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  const isEmpty = (value) => {
    return value === null || value === undefined || (typeof value === "string" && value.trim() === "")
  }

  useEffect(() => {
    // UPDATED: Use authUtils for super_admin access
    const role = getUserRole() // Always returns 'super_admin'
    const user = getUsername()
    setUserRole(role)
    setUsername(user)
  }, [])

  // UPDATED: Always true for super_admin access
  const isAdmin = true;

  // UPDATED: Parse Google Sheets date-time to handle DD/MM/YYYY HH:MM:SS format
  const parseGoogleSheetsDateTime = (dateTimeStr) => {
    if (!dateTimeStr) return ""
    // If already in DD/MM/YYYY HH:MM:SS format, return as is
    if (typeof dateTimeStr === "string" && dateTimeStr.match(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/)) {
      return dateTimeStr
    }
    // If in DD/MM/YYYY format (without time), return as is
    if (typeof dateTimeStr === "string" && dateTimeStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      return dateTimeStr
    }
    // Handle Google Sheets Date(year,month,day) format
    if (typeof dateTimeStr === "string" && dateTimeStr.startsWith("Date(")) {
      const match = /Date\((\d+),(\d+),(\d+)\)/.exec(dateTimeStr)
      if (match) {
        const year = Number.parseInt(match[1], 10)
        const month = Number.parseInt(match[2], 10)
        const day = Number.parseInt(match[3], 10)
        return `${day.toString().padStart(2, "0")}/${(month + 1).toString().padStart(2, "0")}/${year}`
      }
    }
    // Try to parse as a regular date
    try {
      const date = new Date(dateTimeStr)
      if (!isNaN(date.getTime())) {
        // Check if the original string contained time information
        if (typeof dateTimeStr === "string" && (dateTimeStr.includes(":") || dateTimeStr.includes("T"))) {
          return formatDateTimeToDDMMYYYY(date)
        } else {
          return formatDateToDDMMYYYY(date)
        }
      }
    } catch (error) {
      console.error("Error parsing date-time:", error)
    }
    return dateTimeStr
  }

  // UPDATED: Parse date from DD/MM/YYYY or DD/MM/YYYY HH:MM:SS format for comparison
  const parseDateFromDDMMYYYY = (dateStr) => {
    if (!dateStr || typeof dateStr !== "string") return null

    // Extract just the date part if it includes time
    const datePart = dateStr.includes(" ") ? dateStr.split(" ")[0] : dateStr
    const parts = datePart.split("/")
    if (parts.length !== 3) return null
    return new Date(parts[2], parts[1] - 1, parts[0])
  }

  const sortDateWise = (a, b) => {
    const dateStrA = a["col6"] || ""
    const dateStrB = b["col6"] || ""
    const dateA = parseDateFromDDMMYYYY(dateStrA)
    const dateB = parseDateFromDDMMYYYY(dateStrB)
    if (!dateA) return 1
    if (!dateB) return -1
    return dateA.getTime() - dateB.getTime()
  }

  const resetFilters = () => {
    setSearchTerm("")
    setSelectedMembers([])
    setStartDate("")
    setEndDate("")
  }

  // NEW: Admin functions for history management
  const handleMarkMultipleDone = async () => {
    if (selectedHistoryItems.length === 0) {
      return
    }
    if (markingAsDone) return

    // Open confirmation modal
    setConfirmationModal({
      isOpen: true,
      itemCount: selectedHistoryItems.length,
    })
  }

  // NEW: Confirmation modal component
  const ConfirmationModal = ({ isOpen, itemCount, onConfirm, onCancel }) => {
    if (!isOpen) return null

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-yellow-100 text-yellow-600 rounded-full p-3 mr-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-800">Mark Items as Admin Done</h2>
          </div>

          <p className="text-gray-600 text-center mb-6">
            Are you sure you want to mark {itemCount} {itemCount === 1 ? "item" : "items"} as Admin Done?
          </p>

          <div className="flex justify-center space-x-4">
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    )
  }

  // UPDATED: Admin Done submission handler - Store "Done" text instead of timestamp
  const confirmMarkDone = async () => {
    // Close the modal
    setConfirmationModal({ isOpen: false, itemCount: 0 });
    setMarkingAsDone(true);

    try {
      // Prepare submission data for multiple items
      const submissionData = selectedHistoryItems.map((historyItem) => ({
        taskId: historyItem._taskId || historyItem["col1"],
        rowIndex: historyItem._rowIndex,
        adminDoneStatus: "Done", // This will update Column P
      }));

      const formData = new FormData();
      formData.append("sheetName", CONFIG.SHEET_NAME);
      formData.append("action", "updateAdminDone"); // Use the new action name
      formData.append("rowData", JSON.stringify(submissionData));

      const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
        method: "POST",
        body: formData,
      });
      const result = await response.json();

      if (result.success) {
        // Remove processed items from history view
        setHistoryData((prev) =>
          prev.filter((item) => !selectedHistoryItems.some((selected) => selected._id === item._id))
        );

        setSelectedHistoryItems([]);
        setSuccessMessage(`Successfully marked ${selectedHistoryItems.length} items as Admin Done!`);

        // Refresh data
        setTimeout(() => {
          fetchSheetData();
        }, 2000);
      } else {
        throw new Error(result.error || "Failed to mark items as Admin Done");
      }
    } catch (error) {
      console.error("Error marking tasks as Admin Done:", error);
      setSuccessMessage(`Failed to mark tasks as Admin Done: ${error.message}`);
    } finally {
      setMarkingAsDone(false);
    }
  };
  // Memoized filtered data to prevent unnecessary re-renders
  const filteredAccountData = useMemo(() => {
    const filtered = searchTerm
      ? accountData.filter((account) =>
        Object.values(account).some(
          (value) => value && value.toString().toLowerCase().includes(searchTerm.toLowerCase()),
        ),
      )
      : accountData
    return filtered.sort(sortDateWise)
  }, [accountData, searchTerm])

  const filteredHistoryData = useMemo(() => {
    return historyData
      .filter((item) => {
        const matchesSearch = searchTerm
          ? Object.values(item).some(
            (value) => value && value.toString().toLowerCase().includes(searchTerm.toLowerCase()),
          )
          : true
        const matchesMember = selectedMembers.length > 0 ? selectedMembers.includes(item["col4"]) : true
        let matchesDateRange = true
        if (startDate || endDate) {
          const itemDate = parseDateFromDDMMYYYY(item["col10"])
          if (!itemDate) return false
          if (startDate) {
            const startDateObj = new Date(startDate)
            startDateObj.setHours(0, 0, 0, 0)
            if (itemDate < startDateObj) matchesDateRange = false
          }
          if (endDate) {
            const endDateObj = new Date(endDate)
            endDateObj.setHours(23, 59, 59, 999)
            if (itemDate > endDateObj) matchesDateRange = false
          }
        }
        return matchesSearch && matchesMember && matchesDateRange
      })
      .sort((a, b) => {
        const dateStrA = a["col10"] || ""
        const dateStrB = b["col10"] || ""
        const dateA = parseDateFromDDMMYYYY(dateStrA)
        const dateB = parseDateFromDDMMYYYY(dateStrB)
        if (!dateA) return 1
        if (!dateB) return -1
        return dateB.getTime() - dateA.getTime()
      })
  }, [historyData, searchTerm, selectedMembers, startDate, endDate])

  const getTaskStatistics = () => {
    const totalCompleted = historyData.length
    const memberStats =
      selectedMembers.length > 0
        ? selectedMembers.reduce((stats, member) => {
          const memberTasks = historyData.filter((task) => task["col4"] === member).length
          return {
            ...stats,
            [member]: memberTasks,
          }
        }, {})
        : {}
    const filteredTotal = filteredHistoryData.length
    return {
      totalCompleted,
      memberStats,
      filteredTotal,
    }
  }

  const handleMemberSelection = (member) => {
    setSelectedMembers((prev) => {
      if (prev.includes(member)) {
        return prev.filter((item) => item !== member)
      } else {
        return [...prev, member]
      }
    })
  }

  const getFilteredMembersList = () => {
    if (isAdmin) {
      return membersList
    } else {
      return membersList.filter((member) => member.toLowerCase() === username.toLowerCase())
    }
  }

  // UPDATED: fetchSheetData - Include all history rows regardless of Column P status
  const fetchSheetData = useCallback(async () => {
    try {
      setLoading(true)
      const pendingAccounts = []
      const historyRows = []
      const response = await fetch(`${CONFIG.APPS_SCRIPT_URL}?sheet=${CONFIG.SHEET_NAME}&action=fetch`)
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status}`)
      }
      const text = await response.text()
      let data
      try {
        data = JSON.parse(text)
      } catch (parseError) {
        const jsonStart = text.indexOf("{")
        const jsonEnd = text.lastIndexOf("}")
        if (jsonStart !== -1 && jsonEnd !== -1) {
          const jsonString = text.substring(jsonStart, jsonEnd + 1)
          data = JSON.parse(jsonString)
        } else {
          throw new Error("Invalid JSON response from server")
        }
      }

      const currentUsername = sessionStorage.getItem("username")
      const currentUserRole = sessionStorage.getItem("role")
      const today = new Date()
      const tomorrow = new Date(today)
      tomorrow.setDate(today.getDate() + 1)
      const todayStr = formatDateToDDMMYYYY(today)
      const tomorrowStr = formatDateToDDMMYYYY(tomorrow)
      console.log("Filtering dates:", { todayStr, tomorrowStr })

      const membersSet = new Set()
      let rows = []
      if (data.table && data.table.rows) {
        rows = data.table.rows
      } else if (Array.isArray(data)) {
        rows = data
      } else if (data.values) {
        rows = data.values.map((row) => ({ c: row.map((val) => ({ v: val })) }))
      }

      rows.forEach((row, rowIndex) => {
        if (rowIndex === 0) return
        let rowValues = []
        if (row.c) {
          rowValues = row.c.map((cell) => (cell && cell.v !== undefined ? cell.v : ""))
        } else if (Array.isArray(row)) {
          rowValues = row
        } else {
          console.log("Unknown row format:", row)
          return
        }

        const assignedTo = rowValues[4] || "Unassigned"
        membersSet.add(assignedTo)
        const isUserMatch = isAdmin || assignedTo.toLowerCase() === currentUsername.toLowerCase()
        if (!isUserMatch && !isAdmin) return

        const columnGValue = rowValues[6] // Task End Date
        const columnKValue = rowValues[10] // Actual Date
        const columnMValue = rowValues[12] // Status (DONE)
        const columnPValue = rowValues[15] // Admin Processed Date (Column P)

        // Skip rows marked as DONE in column M for pending tasks only
        if (columnMValue && columnMValue.toString().trim() === "DONE") {
          return
        }

        const rowDateStr = columnGValue ? String(columnGValue).trim() : ""
        const formattedRowDate = parseGoogleSheetsDateTime(rowDateStr)
        const googleSheetsRowIndex = rowIndex + 1

        // Create stable unique ID using task ID and row index
        const taskId = rowValues[1] || ""
        const stableId = taskId
          ? `task_${taskId}_${googleSheetsRowIndex}`
          : `row_${googleSheetsRowIndex}_${Math.random().toString(36).substring(2, 15)}`

        const rowData = {
          _id: stableId,
          _rowIndex: googleSheetsRowIndex,
          _taskId: taskId,
        }

        const columnHeaders = [
          { id: "col0", label: "Timestamp", type: "string" },
          { id: "col1", label: "Task ID", type: "string" },
          { id: "col2", label: "Firm", type: "string" },
          { id: "col3", label: "Given By", type: "string" },
          { id: "col4", label: "Name", type: "string" },
          { id: "col5", label: "Task Description", type: "string" },
          { id: "col6", label: "Task End Date", type: "datetime" },
          { id: "col7", label: "Freq", type: "string" },
          { id: "col8", label: "Enable Reminders", type: "string" },
          { id: "col9", label: "Require Attachment", type: "string" },
          { id: "col10", label: "Actual", type: "datetime" },
          { id: "col11", label: "Column L", type: "string" },
          { id: "col12", label: "Status", type: "string" },
          { id: "col13", label: "Remarks", type: "string" },
          { id: "col14", label: "Uploaded Image", type: "string" },
          { id: "col15", label: "Admin Done", type: "string" }, // Column P
        ]

        columnHeaders.forEach((header, index) => {
          const cellValue = rowValues[index]
          if (
            header.type === "datetime" ||
            header.type === "date" ||
            (cellValue && String(cellValue).startsWith("Date("))
          ) {
            rowData[header.id] = cellValue ? parseGoogleSheetsDateTime(String(cellValue)) : ""
          } else if (header.type === "number" && cellValue !== null && cellValue !== "") {
            rowData[header.id] = cellValue
          } else {
            rowData[header.id] = cellValue !== null ? cellValue : ""
          }
        })

        console.log(`Row ${rowIndex}: Task ID = ${rowData.col1}, Google Sheets Row = ${googleSheetsRowIndex}`)

        const hasColumnG = !isEmpty(columnGValue)
        const isColumnKEmpty = isEmpty(columnKValue)

        // For pending tasks, exclude admin processed items (Column P not empty)
        if (hasColumnG && isColumnKEmpty && isEmpty(columnPValue)) {
          const rowDate = parseDateFromDDMMYYYY(formattedRowDate)
          const isToday = formattedRowDate.startsWith(todayStr)
          const isTomorrow = formattedRowDate.startsWith(tomorrowStr)
          const isPastDate = rowDate && rowDate <= today
          if (isToday || isTomorrow || isPastDate) {
            pendingAccounts.push(rowData)
          }
        }
        // For history, include ALL completed tasks regardless of Column P status
        else if (hasColumnG && !isColumnKEmpty) {
          const isUserHistoryMatch =
            isAdmin || assignedTo.toLowerCase() === currentUsername.toLowerCase()
          if (isUserHistoryMatch) {
            historyRows.push(rowData)
          }
        }
      })

      setMembersList(Array.from(membersSet).sort())
      setAccountData(pendingAccounts)
      setHistoryData(historyRows)
      setLoading(false)
    } catch (error) {
      console.error("Error fetching sheet data:", error)
      setError("Failed to load account data: " + error.message)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSheetData()
  }, [fetchSheetData])

  // Checkbox handlers with better state management
  const handleSelectItem = useCallback((id, isChecked) => {
    console.log(`Checkbox action: ${id} -> ${isChecked}`)
    setSelectedItems((prev) => {
      const newSelected = new Set(prev)
      if (isChecked) {
        newSelected.add(id)
      } else {
        newSelected.delete(id)
        // Clean up related data when unchecking
        setAdditionalData((prevData) => {
          const newAdditionalData = { ...prevData }
          delete newAdditionalData[id]
          return newAdditionalData
        })
        setRemarksData((prevRemarks) => {
          const newRemarksData = { ...prevRemarks }
          delete newRemarksData[id]
          return newRemarksData
        })
      }
      console.log(`Updated selection: ${Array.from(newSelected)}`)
      return newSelected
    })
  }, [])

  const handleCheckboxClick = useCallback(
    (e, id) => {
      e.stopPropagation()
      const isChecked = e.target.checked
      console.log(`Checkbox clicked: ${id}, checked: ${isChecked}`)
      handleSelectItem(id, isChecked)
    },
    [handleSelectItem],
  )

  const handleSelectAllItems = useCallback(
    (e) => {
      e.stopPropagation()
      const checked = e.target.checked
      console.log(`Select all clicked: ${checked}`)
      if (checked) {
        const allIds = filteredAccountData.map((item) => item._id)
        setSelectedItems(new Set(allIds))
        console.log(`Selected all items: ${allIds}`)
      } else {
        setSelectedItems(new Set())
        setAdditionalData({})
        setRemarksData({})
        console.log("Cleared all selections")
      }
    },
    [filteredAccountData],
  )

  const handleImageUpload = async (id, e) => {
    const file = e.target.files[0]
    if (!file) return
    console.log(`Image upload for: ${id}`)
    setAccountData((prev) => prev.map((item) => (item._id === id ? { ...item, image: file } : item)))
  }

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result)
      reader.onerror = (error) => reject(error)
    })
  }

  const toggleHistory = () => {
    setShowHistory((prev) => !prev)
    resetFilters()
  }

  // UPDATED: MAIN SUBMIT FUNCTION - Now also updates Admin Done column (Column P)
  const handleSubmit = async () => {
    const selectedItemsArray = Array.from(selectedItems);
    if (selectedItemsArray.length === 0) {
      alert("Please select at least one item to submit");
      return;
    }

    // Existing validation checks remain the same
    const missingRemarks = selectedItemsArray.filter((id) => {
      const additionalStatus = additionalData[id];
      const remarks = remarksData[id];
      return additionalStatus === "No" && (!remarks || remarks.trim() === "");
    });

    if (missingRemarks.length > 0) {
      alert(`Please provide remarks for items marked as "No". ${missingRemarks.length} item(s) are missing remarks.`);
      return;
    }

    const missingRequiredImages = selectedItemsArray.filter((id) => {
      const item = accountData.find((account) => account._id === id);
      const requiresAttachment = item["col9"] && item["col9"].toUpperCase() === "YES";
      return requiresAttachment && !item.image;
    });

    if (missingRequiredImages.length > 0) {
      alert(
        `Please upload images for all required attachments. ${missingRequiredImages.length} item(s) are missing required images.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const today = new Date();
      // Format as DD/MM/YYYY HH:MM:SS for column K
      const todayFormatted = formatDateTimeToDDMMYYYY(today);

      // Prepare data for submission
      const submissionData = [];
      const imageUploadPromises = [];

      // First handle all image uploads
      for (const id of selectedItemsArray) {
        const item = accountData.find((account) => account._id === id);

        if (item.image instanceof File) {
          const uploadPromise = fileToBase64(item.image)
            .then(async (base64Data) => {
              const formData = new FormData();
              formData.append("action", "uploadFile");
              formData.append("base64Data", base64Data);
              formData.append("fileName", `task_${item["col1"]}_${Date.now()}.${item.image.name.split(".").pop()}`);
              formData.append("mimeType", item.image.type);
              formData.append("folderId", CONFIG.DRIVE_FOLDER_ID);

              const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
                method: "POST",
                body: formData,
              });
              return response.json();
            })
            .then((result) => {
              if (result.success) {
                return { id, imageUrl: result.fileUrl };
              }
              return { id, imageUrl: "" };
            });

          imageUploadPromises.push(uploadPromise);
        }
      }

      // Wait for all image uploads to complete
      const uploadResults = await Promise.all(imageUploadPromises);
      const imageUrlMap = uploadResults.reduce((acc, result) => {
        acc[result.id] = result.imageUrl;
        return acc;
      }, {});

      // Prepare submission data
      for (const id of selectedItemsArray) {
        const item = accountData.find((account) => account._id === id);
        submissionData.push({
          taskId: item["col1"], // Column B
          rowIndex: item._rowIndex,
          actualDate: todayFormatted, // Column K (formatted as DD/MM/YYYY HH:MM:SS)
          status: additionalData[id] || "", // Column M
          remarks: remarksData[id] || "", // Column N
          imageUrl: imageUrlMap[id] || (item.image && typeof item.image === "string" ? item.image : ""), // Column O
        });
      }

      // Optimistic UI updates
      const submittedItemsForHistory = selectedItemsArray.map((id) => {
        const item = accountData.find((account) => account._id === id);
        return {
          ...item,
          col10: todayFormatted, // Column K
          col12: additionalData[id] || "", // Column M
          col13: remarksData[id] || "", // Column N
          col14: imageUrlMap[id] || (item.image && typeof item.image === "string" ? item.image : ""), // Column O
        };
      });

      // Update local state
      setAccountData((prev) => prev.filter((item) => !selectedItems.has(item._id)));
      setHistoryData((prev) => [...submittedItemsForHistory, ...prev]);
      setSelectedItems(new Set());
      setAdditionalData({});
      setRemarksData({});
      setSuccessMessage(`Successfully submitted ${selectedItemsArray.length} task(s)!`);

      // Submit to Google Sheets
      const formData = new FormData();
      formData.append("sheetName", CONFIG.SHEET_NAME);
      formData.append("action", "updateTaskData");
      formData.append("rowData", JSON.stringify(submissionData));

      const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (!result.success) {
        console.error("Background submission failed:", result.error);
        // Optionally show an error message
      }
    } catch (error) {
      console.error("Submission error:", error);
      alert("Error occurred during submission. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Convert Set to Array for display
  const selectedItemsCount = selectedItems.size

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <h1 className="text-2xl font-bold tracking-tight text-purple-700">
            {showHistory ? CONFIG.PAGE_CONFIG.historyTitle : CONFIG.PAGE_CONFIG.title}
          </h1>
          <div className="flex space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder={showHistory ? "Search history..." : "Search tasks..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-purple-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <button
              onClick={toggleHistory}
              className="rounded-md bg-gradient-to-r from-blue-500 to-indigo-600 py-2 px-4 text-white hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {showHistory ? (
                <div className="flex items-center">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  <span>Back to Tasks</span>
                </div>
              ) : (
                <div className="flex items-center">
                  <History className="h-4 w-4 mr-1" />
                  <span>View History</span>
                </div>
              )}
            </button>
            {!showHistory && (
              <button
                onClick={handleSubmit}
                disabled={selectedItemsCount === 0 || isSubmitting}
                className="rounded-md bg-gradient-to-r from-purple-600 to-pink-600 py-2 px-4 text-white hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Processing..." : `Submit Selected (${selectedItemsCount})`}
              </button>
            )}

            {/* NEW: Admin Submit Button for History View */}
            {showHistory && ['admin', 'superadmin', 'super admin'].includes(userRole) && selectedHistoryItems.length > 0 && (
              <div className="fixed top-40 right-10 z-50">
                <button
                  onClick={handleMarkMultipleDone}
                  disabled={markingAsDone}
                  className="rounded-md bg-green-600 text-white px-4 py-2 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {markingAsDone ? "Processing..." : `Mark ${selectedHistoryItems.length} Items as Admin Done`}
                </button>
              </div>
            )}
          </div>
        </div>

        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md flex items-center justify-between">
            <div className="flex items-center">
              <CheckCircle2 className="h-5 w-5 mr-2 text-green-500" />
              {successMessage}
            </div>
            <button onClick={() => setSuccessMessage("")} className="text-green-500 hover:text-green-700">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        <div className="rounded-lg border border-purple-200 shadow-md bg-white overflow-hidden">
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 p-4">
            <h2 className="text-purple-700 font-medium">
              {showHistory ? `Completed ${CONFIG.SHEET_NAME} Tasks` : `Pending ${CONFIG.SHEET_NAME} Tasks`}
            </h2>
            <p className="text-purple-600 text-sm">
              {showHistory
                ? `${CONFIG.PAGE_CONFIG.historyDescription} for ${userRole === "admin" ? "all" : "your"} tasks`
                : CONFIG.PAGE_CONFIG.description}
            </p>
          </div>

          {loading ? (
            <div className="text-center py-10">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500 mb-4"></div>
              <p className="text-purple-600">Loading task data...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 p-4 rounded-md text-red-800 text-center">
              {error}{" "}
              <button className="underline ml-2" onClick={() => window.location.reload()}>
                Try again
              </button>
            </div>
          ) : showHistory ? (
            <>
              {/* History Filters */}
              <div className="p-4 border-b border-purple-100 bg-gray-50">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  {getFilteredMembersList().length > 0 && (
                    <div className="flex flex-col">
                      <div className="mb-2 flex items-center">
                        <span className="text-sm font-medium text-purple-700">Filter by Member:</span>
                      </div>
                      <div className="flex flex-wrap gap-3 max-h-32 overflow-y-auto p-2 border border-gray-200 rounded-md bg-white">
                        {getFilteredMembersList().map((member, idx) => (
                          <div key={idx} className="flex items-center">
                            <input
                              id={`member-${idx}`}
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                              checked={selectedMembers.includes(member)}
                              onChange={() => handleMemberSelection(member)}
                            />
                            <label htmlFor={`member-${idx}`} className="ml-2 text-sm text-gray-700">
                              {member}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col">
                    <div className="mb-2 flex items-center">
                      <span className="text-sm font-medium text-purple-700">Filter by Date Range:</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center">
                        <label htmlFor="start-date" className="text-sm text-gray-700 mr-1">
                          From
                        </label>
                        <input
                          id="start-date"
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="text-sm border border-gray-200 rounded-md p-1"
                        />
                      </div>
                      <div className="flex items-center">
                        <label htmlFor="end-date" className="text-sm text-gray-700 mr-1">
                          To
                        </label>
                        <input
                          id="end-date"
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="text-sm border border-gray-200 rounded-md p-1"
                        />
                      </div>
                    </div>
                  </div>
                  {(selectedMembers.length > 0 || startDate || endDate || searchTerm) && (
                    <button
                      onClick={resetFilters}
                      className="px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 text-sm"
                    >
                      Clear All Filters
                    </button>
                  )}
                </div>
              </div>

              {/* NEW: Confirmation Modal */}
              <ConfirmationModal
                isOpen={confirmationModal.isOpen}
                itemCount={confirmationModal.itemCount}
                onConfirm={confirmMarkDone}
                onCancel={() => setConfirmationModal({ isOpen: false, itemCount: 0 })}
              />

              {/* Task Statistics */}
              <div className="p-4 border-b border-purple-100 bg-blue-50">
                <div className="flex flex-col">
                  <h3 className="text-sm font-medium text-blue-700 mb-2">Task Completion Statistics:</h3>
                  <div className="flex flex-wrap gap-4">
                    <div className="px-3 py-2 bg-white rounded-md shadow-sm">
                      <span className="text-xs text-gray-500">Total Completed</span>
                      <div className="text-lg font-semibold text-blue-600">{getTaskStatistics().totalCompleted}</div>
                    </div>
                    {(selectedMembers.length > 0 || startDate || endDate || searchTerm) && (
                      <div className="px-3 py-2 bg-white rounded-md shadow-sm">
                        <span className="text-xs text-gray-500">Filtered Results</span>
                        <div className="text-lg font-semibold text-blue-600">{getTaskStatistics().filteredTotal}</div>
                      </div>
                    )}
                    {selectedMembers.map((member) => (
                      <div key={member} className="px-3 py-2 bg-white rounded-md shadow-sm">
                        <span className="text-xs text-gray-500">{member}</span>
                        <div className="text-lg font-semibold text-indigo-600">
                          {getTaskStatistics().memberStats[member]}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* History Table - Optimized for performance */}
              <div className="h-[calc(100vh-300px)] overflow-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      {/* Admin Select Column Header */}
                      {userRole === "admin" && (
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                          <div className="flex flex-col items-center">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                              checked={
                                filteredHistoryData.filter(item => isEmpty(item["col15"]) || item["col15"].toString().trim() !== "Done").length > 0 &&
                                selectedHistoryItems.length === filteredHistoryData.filter(item => isEmpty(item["col15"]) || item["col15"].toString().trim() !== "Done").length
                              }
                              onChange={(e) => {
                                const unprocessedItems = filteredHistoryData.filter(item => isEmpty(item["col15"]) || item["col15"].toString().trim() !== "Done")
                                if (e.target.checked) {
                                  setSelectedHistoryItems(unprocessedItems)
                                } else {
                                  setSelectedHistoryItems([])
                                }
                              }}
                            />
                            <span className="text-xs text-gray-400 mt-1">Admin</span>
                          </div>
                        </th>
                      )}
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                        Task ID
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                        Department Name
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                        Given By
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                        Name
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
                        Task Description
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-yellow-50 min-w-[140px]">
                        Task End Date & Time
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">
                        Freq
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                        Enable Reminders
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                        Require Attachment
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-green-50 min-w-[140px]">
                        Actual Date & Time
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-50 min-w-[80px]">
                        Status
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-purple-50 min-w-[150px]">
                        Remarks
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                        Attachment
                      </th>
                      {/* NEW: Admin Done Date Column */}
                      {userRole === "admin" && (
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 min-w-[140px]">
                          Admin Done
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredHistoryData.length > 0 ? (
                      filteredHistoryData.map((history) => (
                        <tr key={history._id} className="hover:bg-gray-50">
                          {/* Admin Select Checkbox - Check for "Done" text specifically */}
                          {['admin', 'superadmin', 'super admin'].includes(userRole) && (
                            <td className="px-3 py-4 w-12">
                              {!isEmpty(history["col15"]) && history["col15"].toString().trim() === "Done" ? (
                                // Already marked as Admin Done - show checked and disabled checkbox
                                <div className="flex flex-col items-center">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-gray-300 text-green-600 bg-green-100"
                                    checked={true}
                                    disabled={true}
                                    title="Admin Done"
                                  />
                                  <span className="text-xs text-green-600 mt-1 text-center break-words">
                                    Done
                                  </span>
                                </div>
                              ) : (
                                // Not admin done yet - normal selectable checkbox
                                <div className="flex flex-col items-center">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                    checked={selectedHistoryItems.some((item) => item._id === history._id)}
                                    onChange={() => {
                                      setSelectedHistoryItems((prev) =>
                                        prev.some((item) => item._id === history._id)
                                          ? prev.filter((item) => item._id !== history._id)
                                          : [...prev, history],
                                      )
                                    }}
                                  />
                                  <span className="text-xs text-gray-400 mt-1 text-center break-words">
                                    Mark Done
                                  </span>
                                </div>
                              )}
                            </td>
                          )}
                          <td className="px-3 py-4 min-w-[100px]">
                            <div className="text-sm font-medium text-gray-900 break-words">
                              {history["col1"] || "—"}
                            </div>
                          </td>
                          <td className="px-3 py-4 min-w-[120px]">
                            <div className="text-sm text-gray-900 break-words">{history["col2"] || "—"}</div>
                          </td>
                          <td className="px-3 py-4 min-w-[100px]">
                            <div className="text-sm text-gray-900 break-words">{history["col3"] || "—"}</div>
                          </td>
                          <td className="px-3 py-4 min-w-[100px]">
                            <div className="text-sm text-gray-900 break-words">{history["col4"] || "—"}</div>
                          </td>
                          <td className="px-3 py-4 min-w-[200px]">
                            <div className="text-sm text-gray-900 break-words" title={history["col5"]}>
                              {history["col5"] || "—"}
                            </div>
                          </td>
                          <td className="px-3 py-4 bg-yellow-50 min-w-[140px]">
                            <div className="text-sm text-gray-900 break-words">
                              {history["col6"] ? (
                                <div>
                                  <div className="font-medium break-words">
                                    {history["col6"].includes(" ") ? history["col6"].split(" ")[0] : history["col6"]}
                                  </div>
                                  {history["col6"].includes(" ") && (
                                    <div className="text-xs text-gray-500 break-words">
                                      {history["col6"].split(" ")[1]}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                "—"
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-4 min-w-[80px]">
                            <div className="text-sm text-gray-900 break-words">{history["col7"] || "—"}</div>
                          </td>
                          <td className="px-3 py-4 min-w-[120px]">
                            <div className="text-sm text-gray-900 break-words">{history["col8"] || "—"}</div>
                          </td>
                          <td className="px-3 py-4 min-w-[120px]">
                            <div className="text-sm text-gray-900 break-words">{history["col9"] || "—"}</div>
                          </td>
                          <td className="px-3 py-4 bg-green-50 min-w-[140px]">
                            <div className="text-sm text-gray-900 break-words">
                              {history["col10"] ? (
                                <div>
                                  <div className="font-medium break-words">
                                    {history["col10"].includes(" ") ? history["col10"].split(" ")[0] : history["col10"]}
                                  </div>
                                  {history["col10"].includes(" ") && (
                                    <div className="text-xs text-gray-500 break-words">
                                      {history["col10"].split(" ")[1]}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                "—"
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-4 bg-blue-50 min-w-[80px]">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full break-words ${history["col12"] === "Yes"
                                ? "bg-green-100 text-green-800"
                                : history["col12"] === "No"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-gray-100 text-gray-800"
                                }`}
                            >
                              {history["col12"] || "—"}
                            </span>
                          </td>
                          <td className="px-3 py-4 bg-purple-50 min-w-[150px]">
                            <div className="text-sm text-gray-900 break-words" title={history["col13"]}>
                              {history["col13"] || "—"}
                            </div>
                          </td>
                          <td className="px-3 py-4 min-w-[100px]">
                            {history["col14"] ? (
                              <a
                                href={history["col14"]}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 underline flex items-center break-words"
                              >
                                <img
                                  src={history["col14"] || "/placeholder.svg?height=32&width=32"}
                                  alt="Attachment"
                                  className="h-8 w-8 object-cover rounded-md mr-2 flex-shrink-0"
                                />
                                <span className="break-words">View</span>
                              </a>
                            ) : (
                              <span className="text-gray-400">No attachment</span>
                            )}
                          </td>
                          {/* Admin Done Column - Show "Done" text */}
                          {['admin', 'superadmin', 'super admin'].includes(userRole) && (
                            <td className="px-3 py-4 bg-gray-50 min-w-[140px]">
                              {!isEmpty(history["col15"]) && history["col15"].toString().trim() === "Done" ? (
                                <div className="text-sm text-gray-900 break-words">
                                  <div className="flex items-center">
                                    <div className="h-4 w-4 rounded border-gray-300 text-green-600 bg-green-100 mr-2 flex items-center justify-center">
                                      <span className="text-xs text-green-600">✓</span>
                                    </div>
                                    <div className="flex flex-col">
                                      <div className="font-medium text-green-700 text-sm">
                                        Done
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center text-gray-400 text-sm">
                                  <div className="h-4 w-4 rounded border-gray-300 mr-2"></div>
                                  <span>Pending</span>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={['admin', 'superadmin', 'super admin'].includes(userRole) ? 15 : 13} className="px-6 py-4 text-center text-gray-500">
                          {searchTerm || selectedMembers.length > 0 || startDate || endDate
                            ? "No historical records matching your filters"
                            : "No completed records found"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            /* Regular Tasks Table - Optimized for performance */
            <div className="h-[calc(100vh-250px)] overflow-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        checked={filteredAccountData.length > 0 && selectedItems.size === filteredAccountData.length}
                        onChange={handleSelectAllItems}
                      />
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                      Task ID
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                      Department Name
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                      Given By
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                      Name
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
                      Task Description
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-yellow-50 min-w-[140px]">
                      Task End Date & Time
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">
                      Freq
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                      Enable Reminders
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                      Require Attachment
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                      Status
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">
                      Remarks
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                      Upload Image
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAccountData.length > 0 ? (
                    filteredAccountData.map((account) => {
                      const isSelected = selectedItems.has(account._id)
                      return (
                        <tr key={account._id} className={`${isSelected ? "bg-purple-50" : ""} hover:bg-gray-50`}>
                          <td className="px-3 py-4 w-12">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                              checked={isSelected}
                              onChange={(e) => handleCheckboxClick(e, account._id)}
                            />
                          </td>
                          <td className="px-3 py-4 min-w-[100px]">
                            <div className="text-sm text-gray-900 break-words">{account["col1"] || "—"}</div>
                          </td>
                          <td className="px-3 py-4 min-w-[120px]">
                            <div className="text-sm text-gray-900 break-words">{account["col2"] || "—"}</div>
                          </td>
                          <td className="px-3 py-4 min-w-[100px]">
                            <div className="text-sm text-gray-900 break-words">{account["col3"] || "—"}</div>
                          </td>
                          <td className="px-3 py-4 min-w-[100px]">
                            <div className="text-sm text-gray-900 break-words">{account["col4"] || "—"}</div>
                          </td>
                          <td className="px-3 py-4 min-w-[200px]">
                            <div className="text-sm text-gray-900 break-words" title={account["col5"]}>
                              {account["col5"] || "—"}
                            </div>
                          </td>
                          <td className="px-3 py-4 bg-yellow-50 min-w-[140px]">
                            <div className="text-sm text-gray-900 break-words">
                              {account["col6"] ? (
                                <div>
                                  <div className="font-medium break-words">
                                    {account["col6"].includes(" ") ? account["col6"].split(" ")[0] : account["col6"]}
                                  </div>
                                  {account["col6"].includes(" ") && (
                                    <div className="text-xs text-gray-500 break-words">
                                      {account["col6"].split(" ")[1]}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                "—"
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-4 min-w-[80px]">
                            <div className="text-sm text-gray-900 break-words">{account["col7"] || "—"}</div>
                          </td>
                          <td className="px-3 py-4 min-w-[120px]">
                            <div className="text-sm text-gray-900 break-words">{account["col8"] || "—"}</div>
                          </td>
                          <td className="px-3 py-4 min-w-[120px]">
                            <div className="text-sm text-gray-900 break-words">{account["col9"] || "—"}</div>
                          </td>
                          <td className="px-3 py-4 bg-yellow-50 min-w-[100px]">
                            <select
                              disabled={!isSelected}
                              value={additionalData[account._id] || ""}
                              onChange={(e) => {
                                setAdditionalData((prev) => ({ ...prev, [account._id]: e.target.value }))
                                if (e.target.value !== "No") {
                                  setRemarksData((prev) => {
                                    const newData = { ...prev }
                                    delete newData[account._id]
                                    return newData
                                  })
                                }
                              }}
                              className="border border-gray-300 rounded-md px-2 py-1 w-full disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
                            >
                              <option value="">Select...</option>
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                            </select>
                          </td>
                          <td className="px-3 py-4 bg-orange-50 min-w-[150px]">
                            <input
                              type="text"
                              placeholder="Enter remarks"
                              disabled={!isSelected || !additionalData[account._id]}
                              value={remarksData[account._id] || ""}
                              onChange={(e) => setRemarksData((prev) => ({ ...prev, [account._id]: e.target.value }))}
                              className="border rounded-md px-2 py-1 w-full border-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm break-words"
                            />
                          </td>
                          <td className="px-3 py-4 bg-green-50 min-w-[120px]">
                            {account.image ? (
                              <div className="flex items-center">
                                <img
                                  src={
                                    typeof account.image === "string"
                                      ? account.image
                                      : URL.createObjectURL(account.image)
                                  }
                                  alt="Receipt"
                                  className="h-10 w-10 object-cover rounded-md mr-2 flex-shrink-0"
                                />
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs text-gray-500 break-words">
                                    {account.image instanceof File ? account.image.name : "Uploaded Receipt"}
                                  </span>
                                  {account.image instanceof File ? (
                                    <span className="text-xs text-green-600">Ready to upload</span>
                                  ) : (
                                    <button
                                      className="text-xs text-purple-600 hover:text-purple-800 break-words"
                                      onClick={() => window.open(account.image, "_blank")}
                                    >
                                      View Full Image
                                    </button>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <label
                                className={`flex items-center cursor-pointer ${account["col9"]?.toUpperCase() === "YES" ? "text-red-600 font-medium" : "text-purple-600"} hover:text-purple-800`}
                              >
                                <Upload className="h-4 w-4 mr-1 flex-shrink-0" />
                                <span className="text-xs break-words">
                                  {account["col9"]?.toUpperCase() === "YES"
                                    ? "Required Upload"
                                    : "Upload Receipt Image"}
                                  {account["col9"]?.toUpperCase() === "YES" && (
                                    <span className="text-red-500 ml-1">*</span>
                                  )}
                                </span>
                                <input
                                  type="file"
                                  className="hidden"
                                  accept="image/*"
                                  onChange={(e) => handleImageUpload(account._id, e)}
                                  disabled={!isSelected}
                                />
                              </label>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={13} className="px-6 py-4 text-center text-gray-500">
                        {searchTerm
                          ? "No tasks matching your search"
                          : "No pending tasks found for today, tomorrow, or past due dates"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}

export default AccountDataPage