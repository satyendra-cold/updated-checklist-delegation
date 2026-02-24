
"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  CheckCircle2,
  Upload,
  X,
  Search,
  History,
  ArrowLeft,
  Edit,
  Save,
  XCircle,
} from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import { getUserRole, getUsername, isAdminUser } from "../../utils/authUtils";

// Configuration object - Move all configurations here
const CONFIG = {
  // Google Apps Script URL
  APPS_SCRIPT_URL:
    "https://script.google.com/macros/s/AKfycbyGf3LdYk6MPiOs_shPU9_AW7wmRjJZ4QxMk9qYqTScsDMB7IliaWRB1HueYy7w5qxqNw/exec",
  // Google Drive folder ID for file uploads
  DRIVE_FOLDER_ID: "1Y1lg8X7qFA4KgvcaVA_ywKx1gOnZ2ZO6",
  // Sheet name to work with
  SHEET_NAME: "Checklist",
  // Page configuration
  PAGE_CONFIG: {
    title: "Checklist Tasks",
    historyTitle: "Approval Pending Tasks",
    description: "Showing today, tomorrow's tasks and past due tasks",
    historyDescription:
      "Read-only view of completed tasks with submission history (excluding admin-processed items)",
  },
};



// Helper functions moved out of component for performance
const formatDateTimeToDDMMYYYY = (date) => {
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
};

const formatDateToDDMMYYYY = (date) => {
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const isEmpty = (value) => {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  );
};

const parseGoogleSheetsDateTime = (dateTimeStr) => {
  if (!dateTimeStr) return "";
  if (typeof dateTimeStr === "string" && dateTimeStr.match(/^\d{2}\/\d{2}\/\d{4}( \d{2}:\d{2}:\d{2})?$/)) {
    return dateTimeStr;
  }
  if (typeof dateTimeStr === "string" && dateTimeStr.startsWith("Date(")) {
    const match = /Date\((\d+),(\d+),(\d+)\)/.exec(dateTimeStr);
    if (match) {
      const year = Number.parseInt(match[1], 10);
      const month = Number.parseInt(match[2], 10);
      const day = Number.parseInt(match[3], 10);
      return `${day.toString().padStart(2, "0")}/${(month + 1).toString().padStart(2, "0")}/${year}`;
    }
  }
  try {
    const date = new Date(dateTimeStr);
    if (!isNaN(date.getTime())) {
      if (typeof dateTimeStr === "string" && (dateTimeStr.includes(":") || dateTimeStr.includes("T"))) {
        return formatDateTimeToDDMMYYYY(date);
      }
      return formatDateToDDMMYYYY(date);
    }
  } catch (error) {
    console.error("Error parsing date-time:", error);
  }
  return dateTimeStr;
};

const parseDateFromDDMMYYYY = (dateStr) => {
  if (!dateStr || typeof dateStr !== "string") return null;
  const datePart = dateStr.includes(" ") ? dateStr.split(" ")[0] : dateStr;
  const parts = datePart.split("/");
  if (parts.length !== 3) return null;
  return new Date(parts[2], parts[1] - 1, parts[0]);
};

const convertToDateTimeLocal = (dateStr) => {
  if (!dateStr) return "";
  const [datePart, timePart] = dateStr.split(" ");
  if (!datePart || !timePart) return "";
  const [day, month, year] = datePart.split("/");
  return `${year}-${month}-${day}T${timePart.substring(0, 5)}`;
};

function Approval() {
  const [accountData, setAccountData] = useState([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [showHistory, setShowHistory] = useState(true);
  const [membersList, setMembersList] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  // UPDATED: Always set to 'super_admin' for unrestricted access
  const [userRole, setUserRole] = useState("super_admin");
  const [username, setUsername] = useState("");

  useEffect(() => {
    // UPDATED: Use authUtils for super_admin access
    const role = getUserRole(); // Always returns 'super_admin'
    const user = getUsername();
    setUserRole(role);
    setUsername(user);
  }, []);

  // NEW: Admin history selection states
  const [selectedHistoryItems, setSelectedHistoryItems] = useState([]);
  const [markingAsDone, setMarkingAsDone] = useState(false);
  const [confirmationModal, setConfirmationModal] = useState({
    isOpen: false,
    itemCount: 0,
  });

  // NEW: Edit functionality states
  const [editingRows, setEditingRows] = useState(new Set());
  const [editedAdminStatus, setEditedAdminStatus] = useState({});
  const [editedRemarks, setEditedRemarks] = useState({});
  const [editedTaskEndDate, setEditedTaskEndDate] = useState({});
  const [bulkRemarks, setBulkRemarks] = useState("");
  const [savingEdits, setSavingEdits] = useState(new Set());

  const [delegationHistoryData, setDelegationHistoryData] = useState([]);
  const [activeApprovalTab, setActiveApprovalTab] = useState('checklist');

  // UPDATED: Always true for super_admin access
  const isAdmin = true;

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedMembers([]);
    setStartDate("");
    setEndDate("");
  };

  // NEW: Edit functionality functions
  const handleEditClick = (historyItem) => {
    const rowId = historyItem._id;
    setEditingRows((prev) => new Set([...prev, rowId]));
    const adminDoneCol = historyItem._sheetType === 'delegation' ? 'col19' : 'col15';
    setEditedAdminStatus((prev) => ({
      ...prev,
      [rowId]: historyItem[adminDoneCol] || "",
    }));
    setEditedRemarks((prev) => ({
      ...prev,
      [rowId]: historyItem["col13"] || "",
    }));
    if (historyItem._sheetType === 'delegation') {
      setEditedTaskEndDate((prev) => ({
        ...prev,
        [rowId]: historyItem["col6"] || "",
      }));
    }
  };

  const handleCancelEdit = (rowId) => {
    setEditingRows((prev) => {
      const newSet = new Set(prev);
      newSet.delete(rowId);
      return newSet;
    });
    setEditedAdminStatus((prev) => {
      const newStatus = { ...prev };
      delete newStatus[rowId];
      return newStatus;
    });
    setEditedRemarks((prev) => {
      const newRemarks = { ...prev };
      delete newRemarks[rowId];
      return newRemarks;
    });
    setEditedTaskEndDate((prev) => {
      const newDates = { ...prev };
      delete newDates[rowId];
      return newDates;
    });
  };

  const handleSaveEdit = async (historyItem) => {
    const rowId = historyItem._id;
    const newStatus = editedAdminStatus[rowId];
    const sheetType = historyItem._sheetType || 'checklist';
    const targetSheet = sheetType === 'delegation' ? 'Delegation' : CONFIG.SHEET_NAME;

    if (savingEdits.has(rowId)) return;

    setSavingEdits((prev) => new Set([...prev, rowId]));

    try {
      const statusToSend =
        newStatus === "" || newStatus === undefined ? "" : newStatus;

      const remarksToSend = editedRemarks[rowId] || historyItem["col13"] || "";
      const taskEndDateToSend = editedTaskEndDate[rowId] || historyItem["col6"] || "";

      const submissionData = [
        {
          taskId: historyItem._taskId || historyItem["col1"],
          rowIndex: historyItem._rowIndex,
          adminDoneStatus: statusToSend,
          remarks: remarksToSend,
          taskEndDate: taskEndDateToSend,
          sheetType: sheetType,
        },
      ];

      const formData = new FormData();
      formData.append("sheetName", targetSheet);
      formData.append("action", "updateAdminDone");
      formData.append("rowData", JSON.stringify(submissionData));

      const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
        method: "POST",
        body: formData,
      });

      const responseText = await response.text();

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error("JSON Parse Error:", parseError);
        throw new Error(`Invalid response format: ${responseText}`);
      }

      if (result.success) {
        const updatedStatus =
          newStatus === "" || newStatus === undefined ? "" : newStatus;

        // Update the correct history data based on sheet type
        if (sheetType === 'delegation') {
          setDelegationHistoryData((prev) =>
            prev.map((item) =>
              item._id === rowId ? {
                ...item,
                col19: updatedStatus,
                col13: remarksToSend,
                col6: taskEndDateToSend
              } : item
            )
          );
        } else {
          setHistoryData((prev) =>
            prev.map((item) =>
              item._id === rowId ? {
                ...item,
                col15: updatedStatus,
                col13: remarksToSend
              } : item
            )
          );
        }

        setEditingRows((prev) => {
          const newSet = new Set(prev);
          newSet.delete(rowId);
          return newSet;
        });

        setEditedAdminStatus((prev) => {
          const newStatusObj = { ...prev };
          delete newStatusObj[rowId];
          return newStatusObj;
        });

        setSuccessMessage("Admin status updated successfully!");

        setTimeout(() => {
          fetchSheetData();
        }, 3000);
      } else {
        console.error("Backend Error:", result.error);
        throw new Error(result.error || "Failed to update Admin status");
      }
    } catch (error) {
      console.error("Error updating Admin status:", error);
      setSuccessMessage(`Failed to update Admin status: ${error.message}`);
    } finally {
      setSavingEdits((prev) => {
        const newSet = new Set(prev);
        newSet.delete(rowId);
        return newSet;
      });
    }
  };

  // NEW: Admin functions for history management
  const handleMarkMultipleDone = async () => {
    if (selectedHistoryItems.length === 0) {
      return;
    }
    if (markingAsDone) return;

    // Open confirmation modal
    setConfirmationModal({
      isOpen: true,
      itemCount: selectedHistoryItems.length,
    });
  };

  // NEW: Confirmation modal component
  const ConfirmationModal = ({ isOpen, itemCount, onConfirm, onCancel }) => {
    if (!isOpen) return null;

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
            <h2 className="text-xl font-bold text-gray-800">
              Mark Items as Admin Done
            </h2>
          </div>

          <p className="text-gray-600 text-center mb-6">
            Are you sure you want to mark {itemCount}{" "}
            {itemCount === 1 ? "item" : "items"} as Admin Done?
          </p>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Remarks for all selected items (Optional)
            </label>
            <textarea
              className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-green-500 focus:border-green-500"
              rows="3"
              placeholder="Enter remarks..."
              value={bulkRemarks}
              onChange={(e) => setBulkRemarks(e.target.value)}
            ></textarea>
          </div>

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
    );
  };

  const confirmMarkDone = async () => {
    setConfirmationModal({ isOpen: false, itemCount: 0 });
    setMarkingAsDone(true);

    try {
      const checklistItems = selectedHistoryItems.filter(item => item._sheetType === 'checklist');
      const delegationItems = selectedHistoryItems.filter(item => item._sheetType === 'delegation');

      // Submit checklist items
      if (checklistItems.length > 0) {
        const checklistSubmissionData = checklistItems.map((historyItem) => ({
          taskId: historyItem._taskId || historyItem["col1"],
          rowIndex: historyItem._rowIndex,
          adminDoneStatus: "Done",
          remarks: bulkRemarks || historyItem["col13"] || "",
          sheetType: 'checklist',
        }));

        const checklistFormData = new FormData();
        checklistFormData.append("sheetName", CONFIG.SHEET_NAME);
        checklistFormData.append("action", "updateAdminDone");
        checklistFormData.append("rowData", JSON.stringify(checklistSubmissionData));

        const checklistResponse = await fetch(CONFIG.APPS_SCRIPT_URL, {
          method: "POST",
          body: checklistFormData,
        });
        const checklistResult = await checklistResponse.json();
        if (!checklistResult.success) {
          throw new Error(checklistResult.error || "Failed to mark checklist items as Admin Done");
        }
      }

      // Submit delegation items
      if (delegationItems.length > 0) {
        const delegationSubmissionData = delegationItems.map((historyItem) => ({
          taskId: historyItem._taskId || historyItem["col1"],
          rowIndex: historyItem._rowIndex,
          adminDoneStatus: "Done",
          remarks: bulkRemarks || historyItem["col13"] || "",
          sheetType: 'delegation',
        }));

        const delegationFormData = new FormData();
        delegationFormData.append("sheetName", "Delegation");
        delegationFormData.append("action", "updateAdminDone");
        delegationFormData.append("rowData", JSON.stringify(delegationSubmissionData));

        const delegationResponse = await fetch(CONFIG.APPS_SCRIPT_URL, {
          method: "POST",
          body: delegationFormData,
        });
        const delegationResult = await delegationResponse.json();
        if (!delegationResult.success) {
          throw new Error(delegationResult.error || "Failed to mark delegation items as Admin Done");
        }
      }

      // Remove processed items from both history views
      setHistoryData((prev) =>
        prev.filter(
          (item) =>
            !selectedHistoryItems.some(
              (selected) => selected._id === item._id
            )
        )
      );

      setDelegationHistoryData((prev) =>
        prev.filter(
          (item) =>
            !selectedHistoryItems.some(
              (selected) => selected._id === item._id
            )
        )
      );

      setSelectedHistoryItems([]);
      setSuccessMessage(
        `Successfully marked ${selectedHistoryItems.length} items as Admin Done!`
      );

      setTimeout(() => {
        fetchSheetData();
      }, 2000);
    } catch (error) {
      console.error("Error marking tasks as Admin Done:", error);
      setSuccessMessage(`Failed to mark tasks as Admin Done: ${error.message}`);
    } finally {
      setMarkingAsDone(false);
    }
  };

  const filteredHistoryData = useMemo(() => {
    return historyData
      .filter((item) => {
        const matchesSearch = searchTerm
          ? Object.values(item).some(
            (value) =>
              value &&
              value
                .toString()
                .toLowerCase()
                .includes(searchTerm.toLowerCase())
          )
          : true;
        const matchesMember =
          selectedMembers.length > 0
            ? selectedMembers.includes(item["col4"])
            : true;
        let matchesDateRange = true;
        if (startDate || endDate) {
          const itemDate = parseDateFromDDMMYYYY(item["col10"]);
          if (!itemDate) return false;
          if (startDate) {
            const startDateObj = new Date(startDate);
            startDateObj.setHours(0, 0, 0, 0);
            if (itemDate < startDateObj) matchesDateRange = false;
          }
          if (endDate) {
            const endDateObj = new Date(endDate);
            endDateObj.setHours(23, 59, 59, 999);
            if (itemDate > endDateObj) matchesDateRange = false;
          }
        }
        return matchesSearch && matchesMember && matchesDateRange;
      })
      .sort((a, b) => {
        const dateStrA = a["col10"] || "";
        const dateStrB = b["col10"] || "";
        const dateA = parseDateFromDDMMYYYY(dateStrA);
        const dateB = parseDateFromDDMMYYYY(dateStrB);
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateB.getTime() - dateA.getTime();
      });
  }, [historyData, searchTerm, selectedMembers, startDate, endDate]);



  const filteredDelegationHistoryData = useMemo(() => {
    return delegationHistoryData
      .filter((item) => {
        const matchesSearch = searchTerm
          ? Object.values(item).some(
            (value) =>
              value &&
              value
                .toString()
                .toLowerCase()
                .includes(searchTerm.toLowerCase())
          )
          : true;
        const matchesMember =
          selectedMembers.length > 0
            ? selectedMembers.includes(item["col4"])
            : true;
        let matchesDateRange = true;
        if (startDate || endDate) {
          const itemDate = parseDateFromDDMMYYYY(item["col10"]);
          if (!itemDate) return false;
          if (startDate) {
            const startDateObj = new Date(startDate);
            startDateObj.setHours(0, 0, 0, 0);
            if (itemDate < startDateObj) matchesDateRange = false;
          }
          if (endDate) {
            const endDateObj = new Date(endDate);
            endDateObj.setHours(23, 59, 59, 999);
            if (itemDate > endDateObj) matchesDateRange = false;
          }
        }
        return matchesSearch && matchesMember && matchesDateRange;
      })
      .sort((a, b) => {
        const dateStrA = a["col10"] || "";
        const dateStrB = b["col10"] || "";
        const dateA = parseDateFromDDMMYYYY(dateStrA);
        const dateB = parseDateFromDDMMYYYY(dateStrB);
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateB.getTime() - dateA.getTime();
      });
  }, [delegationHistoryData, searchTerm, selectedMembers, startDate, endDate]);


  const getTaskStatistics = useMemo(() => {
    const data = activeApprovalTab === 'checklist' ? historyData : delegationHistoryData;
    const filteredData = activeApprovalTab === 'checklist' ? filteredHistoryData : filteredDelegationHistoryData;

    const totalCompleted = data.length;
    const memberStats =
      selectedMembers.length > 0
        ? selectedMembers.reduce((stats, member) => {
          const memberTasks = data.filter(
            (task) => task["col4"] === member
          ).length;
          return {
            ...stats,
            [member]: memberTasks,
          };
        }, {})
        : {};
    const filteredTotal = filteredData.length;
    return {
      totalCompleted,
      memberStats,
      filteredTotal,
    };
  }, [activeApprovalTab, historyData, delegationHistoryData, filteredHistoryData, filteredDelegationHistoryData, selectedMembers]);

  const handleMemberSelection = (member) => {
    setSelectedMembers((prev) => {
      if (prev.includes(member)) {
        return prev.filter((item) => item !== member);
      } else {
        return [...prev, member];
      }
    });
  };

  const getFilteredMembersList = () => {
    // UPDATED: Super admin always sees all members
    return membersList;
  };

  const fetchSheetData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch both sheets in parallel for better performance
      const [checklistResponse, delegationResponse] = await Promise.all([
        fetch(`${CONFIG.APPS_SCRIPT_URL}?sheet=${CONFIG.SHEET_NAME}&action=fetch`),
        fetch(`${CONFIG.APPS_SCRIPT_URL}?sheet=Delegation&action=fetch`)
      ]);

      if (!checklistResponse.ok) throw new Error(`Checklist fetch failed: ${checklistResponse.status}`);
      if (!delegationResponse.ok) throw new Error(`Delegation fetch failed: ${delegationResponse.status}`);

      const [checklistText, delegationText] = await Promise.all([
        checklistResponse.text(),
        delegationResponse.text()
      ]);

      const parseResponse = (text) => {
        try {
          return JSON.parse(text);
        } catch (e) {
          const start = text.indexOf("{"), end = text.lastIndexOf("}");
          if (start !== -1 && end !== -1) return JSON.parse(text.substring(start, end + 1));
          throw new Error("Invalid format");
        }
      };

      const checklistData = parseResponse(checklistText);
      const delegationData = parseResponse(delegationText);

      const currentUsername = getUsername()?.toLowerCase();
      const isSuperAdmin = isAdminUser();
      const membersSet = new Set();

      const processSheetData = (data, sheetType) => {
        const historyRows = [];
        let rows = data.table?.rows || (Array.isArray(data) ? data : data.values?.map(r => ({ c: r.map(v => ({ v })) }))) || [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          let rowValues = row.c ? row.c.map(cell => cell?.v ?? "") : (Array.isArray(row) ? row : []);
          if (rowValues.length === 0) continue;

          // Standard check for visibility based on sheet type
          const assignedTo = sheetType === 'checklist' ? (rowValues[4] || "Unassigned") : (rowValues[7] || "Unassigned");
          if (assignedTo) membersSet.add(assignedTo);

          const isUserMatch = isSuperAdmin || (assignedTo.toLowerCase() === currentUsername);
          if (!isUserMatch) continue;

          // Quick check for completion before heavy object processing
          const isCompleted = sheetType === 'checklist'
            ? (!isEmpty(rowValues[6]) && !isEmpty(rowValues[10]))
            : !isEmpty(rowValues[11]);

          if (!isCompleted) continue;

          const googleSheetsRowIndex = i + 1;
          const taskId = rowValues[1] || "";
          const rowData = {
            _id: `${sheetType}_${taskId}_${googleSheetsRowIndex}_${i}`,
            _rowIndex: googleSheetsRowIndex,
            _taskId: taskId,
            _sheetType: sheetType,
          };

          if (sheetType === 'checklist') {
            const cols = ["col0", "col1", "col2", "col3", "col4", "col5", "col6", "col7", "col8", "col9", "col10", "col11", "col12", "col13", "col14", "col15", "col16", "col17", "col18", "col19"];
            cols.forEach((h, idx) => {
              const val = rowValues[idx];
              rowData[h] = (idx === 6 || idx === 10) ? parseGoogleSheetsDateTime(String(val ?? "")) : (val ?? "");
            });
          } else {
            rowData["col0"] = rowValues[0] || "";
            rowData["col1"] = rowValues[1] || "";
            rowData["col2"] = rowValues[2] || "DELEGATION";
            rowData["col3"] = rowValues[3] || "ADMIN";
            rowData["col4"] = assignedTo;
            rowData["col5"] = rowValues[5] || "—";
            rowData["col6"] = rowValues[10] || "";
            rowData["col7"] = "One-time";
            rowData["col8"] = rowValues[8] || "No";
            rowData["col9"] = rowValues[9] || "No";
            rowData["col10"] = parseGoogleSheetsDateTime(String(rowValues[11] || ""));
            rowData["col12"] = rowValues[13] || "DONE";
            rowData["col13"] = rowValues[14] || "";
            rowData["col14"] = rowValues[15] || "";
            rowData["col19"] = rowValues[19] || "";
          }
          historyRows.push(rowData);
        }
        return historyRows;
      };

      const [checklistHistory, delegationHistory] = [
        processSheetData(checklistData, 'checklist'),
        processSheetData(delegationData, 'delegation')
      ];

      if (membersSet.size > 0) setMembersList(Array.from(membersSet).sort());
      setHistoryData(checklistHistory);
      setDelegationHistoryData(delegationHistory);
      setLoading(false);
    } catch (error) {
      console.error("Fetch error:", error);
      setError("Failed to load data: " + error.message);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSheetData();
  }, [fetchSheetData]);

  const [memberSearchTerm, setMemberSearchTerm] = useState("");
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMemberDropdown && !event.target.closest(".relative")) {
        setShowMemberDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMemberDropdown]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-purple-700 text-center sm:text-left">
              {CONFIG.PAGE_CONFIG.historyTitle}
            </h1>

            {/* Tab Buttons */}
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setActiveApprovalTab('checklist')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeApprovalTab === 'checklist'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
              >
                Checklist Tasks
              </button>
              <button
                onClick={() => setActiveApprovalTab('delegation')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeApprovalTab === 'delegation'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
              >
                Delegation Tasks
              </button>
            </div>
          </div>


          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md flex items-center justify-between">
              <div className="flex items-center">
                <CheckCircle2 className="h-5 w-5 mr-2 text-green-500" />
                {successMessage}
              </div>
              <button
                onClick={() => setSuccessMessage("")}
                className="text-green-500 hover:text-green-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          )}

          <div className="rounded-lg border border-purple-200 shadow-md bg-white overflow-hidden">
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 p-4">
              <h2 className="text-purple-700 font-medium">
                {`Completed ${activeApprovalTab === 'checklist' ? 'Checklist' : 'Delegation'} Tasks`}
              </h2>
              <p className="text-purple-600 text-sm">
                {`${CONFIG.PAGE_CONFIG.historyDescription} for ${isAdmin ? "all" : "your"
                  } tasks`}
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
                <button
                  className="underline ml-2"
                  onClick={() => window.location.reload()}
                >
                  Try again
                </button>
              </div>
            ) : (
              <>
                {/* History Filters */}
                <div className="p-4 border-b border-purple-100 bg-gray-50">
                  <div className="flex flex-wrap items-center justify-between gap-4">


                    {getFilteredMembersList().length > 0 && isAdmin && (
                      <div className="flex flex-col">
                        <div className="mb-2 flex items-center">
                          <span className="text-sm font-medium text-purple-700">
                            Filter by Member:
                          </span>
                        </div>
                        <div className="relative min-w-[250px]">
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="Search members..."
                              value={memberSearchTerm}
                              onChange={(e) =>
                                setMemberSearchTerm(e.target.value)
                              }
                              onFocus={() => setShowMemberDropdown(true)}
                              className="w-full p-2 pr-8 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                            <Search
                              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400"
                              size={18}
                            />
                          </div>

                          {showMemberDropdown && (
                            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                              {getFilteredMembersList()
                                .filter((member) =>
                                  member
                                    .toLowerCase()
                                    .includes(memberSearchTerm.toLowerCase())
                                )
                                .map((member, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center px-3 py-2 hover:bg-purple-50 cursor-pointer"
                                    onClick={() => handleMemberSelection(member)}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedMembers.includes(member)}
                                      onChange={() => { }}
                                      className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 pointer-events-none"
                                    />
                                    <label className="ml-2 text-sm text-gray-700 cursor-pointer flex-1">
                                      {member}
                                    </label>
                                  </div>
                                ))}
                              {getFilteredMembersList().filter((member) =>
                                member
                                  .toLowerCase()
                                  .includes(memberSearchTerm.toLowerCase())
                              ).length === 0 && (
                                  <div className="px-3 py-2 text-sm text-gray-500">
                                    No members found
                                  </div>
                                )}
                            </div>
                          )}

                          {selectedMembers.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {selectedMembers.map((member, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-700 rounded-md text-xs"
                                >
                                  {member}
                                  <button
                                    onClick={() => handleMemberSelection(member)}
                                    className="ml-1 text-purple-600 hover:text-purple-800"
                                  >
                                    <X size={14} />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="flex flex-col">
                      <div className="mb-2 flex items-center">
                        <span className="text-sm font-medium text-purple-700">
                          Filter by Date Range:
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center">
                          <label
                            htmlFor="start-date"
                            className="text-sm text-gray-700 mr-1"
                          >
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
                          <label
                            htmlFor="end-date"
                            className="text-sm text-gray-700 mr-1"
                          >
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
                    {(selectedMembers.length > 0 ||
                      startDate ||
                      endDate ||
                      searchTerm) && (
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
                  onCancel={() =>
                    setConfirmationModal({ isOpen: false, itemCount: 0 })
                  }
                />

                {/* Task Statistics */}
                <div className="p-4 border-b border-purple-100 bg-blue-50">
                  <div className="flex flex-col">
                    <h3 className="text-sm font-medium text-blue-700 mb-2">
                      Task Completion Statistics:
                    </h3>
                    <div className="flex flex-wrap gap-4">
                      <div className="px-3 py-2 bg-white rounded-md shadow-sm">
                        <span className="text-xs text-gray-500">
                          Total Completed
                        </span>
                        <div className="text-lg font-semibold text-blue-600">
                          {getTaskStatistics.totalCompleted}
                        </div>
                      </div>
                      {(selectedMembers.length > 0 ||
                        startDate ||
                        endDate ||
                        searchTerm) && (
                          <div className="px-3 py-2 bg-white rounded-md shadow-sm">
                            <span className="text-xs text-gray-500">
                              Filtered Results
                            </span>
                            <div className="text-lg font-semibold text-blue-600">
                              {getTaskStatistics.filteredTotal}
                            </div>
                          </div>
                        )}
                      {selectedMembers.map((member) => (
                        <div
                          key={member}
                          className="px-3 py-2 bg-white rounded-md shadow-sm"
                        >
                          <span className="text-xs text-gray-500">{member}</span>
                          <div className="text-lg font-semibold text-indigo-600">
                            {getTaskStatistics.memberStats[member]}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* History Table - Based on Active Tab */}
                <div className="hidden sm:block h-[calc(100vh-300px)] overflow-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        {/* Admin Done Column - NOW FIRST */}
                        {isAdmin && (
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 min-w-[160px]">
                            Admin Done
                          </th>
                        )}

                        {/* Admin Select Column Header */}
                        {isAdmin && (
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                            <div className="flex flex-col items-center">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                checked={
                                  (activeApprovalTab === 'checklist' ? filteredHistoryData : filteredDelegationHistoryData).filter(
                                    (item) => {
                                      const adminDoneColumn = item._sheetType === 'delegation' ? 'col19' : 'col15';
                                      return isEmpty(item[adminDoneColumn]) ||
                                        (item[adminDoneColumn].toString().trim() !== "Done" &&
                                          item[adminDoneColumn].toString().trim() !== "Not Done");
                                    }
                                  ).length > 0 &&
                                  selectedHistoryItems.length ===
                                  (activeApprovalTab === 'checklist' ? filteredHistoryData : filteredDelegationHistoryData).filter(
                                    (item) => {
                                      const adminDoneColumn = item._sheetType === 'delegation' ? 'col19' : 'col15';
                                      return isEmpty(item[adminDoneColumn]) ||
                                        (item[adminDoneColumn].toString().trim() !== "Done" &&
                                          item[adminDoneColumn].toString().trim() !== "Not Done");
                                    }
                                  ).length
                                }
                                onChange={(e) => {
                                  const currentData = activeApprovalTab === 'checklist' ? filteredHistoryData : filteredDelegationHistoryData;
                                  const unprocessedItems = currentData.filter((item) => {
                                    const adminDoneColumn = item._sheetType === 'delegation' ? 'col19' : 'col15';
                                    return isEmpty(item[adminDoneColumn]) ||
                                      (item[adminDoneColumn].toString().trim() !== "Done" &&
                                        item[adminDoneColumn].toString().trim() !== "Not Done");
                                  });
                                  if (e.target.checked) {
                                    setSelectedHistoryItems(unprocessedItems);
                                  } else {
                                    setSelectedHistoryItems([]);
                                  }
                                }}
                              />
                              <span className="text-xs text-gray-400 mt-1">Admin</span>
                            </div>
                          </th>
                        )}

                        {/* Hide Task ID column for admin in history view */}
                        {!isAdmin && (
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                            Task ID
                          </th>
                        )}

                        {/* Hide Department Name column for admin in history view */}
                        {!isAdmin && isAdmin && (
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                            Department Name
                          </th>
                        )}

                        {/* Hide Given By column for admin in history view */}
                        {!isAdmin && isAdmin && (
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                            Given By
                          </th>
                        )}

                        {/* Hide Name column for admin in history view */}
                        {!isAdmin && isAdmin && (
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                            Name
                          </th>
                        )}
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
                          Task Description
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-yellow-50 min-w-[140px]">
                          Task End Date & Time
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">
                          Freq
                        </th>
                        {/* Hide Enable Reminders column for admin in history view */}
                        {!isAdmin && isAdmin && (
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                            Enable Reminders
                          </th>
                        )}
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
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {loading ? (
                        <tr>
                          <td
                            colSpan={
                              (isAdmin ? 2 : 0) + // Admin Done + Admin checkbox columns
                              (!isAdmin ? 1 : 0) + // Task ID column
                              (!isAdmin && isAdmin ? 3 : 0) + // Department, Given By, Name columns
                              7 + // Fixed columns (Task Description, End Date, Freq, Require Attachment, Actual Date, Status, Remarks, Attachment)
                              (!isAdmin && isAdmin ? 1 : 0) // Enable Reminders column
                            }
                            className="px-6 py-8 text-center"
                          >
                            <div className="flex flex-col items-center justify-center">
                              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500 mb-2"></div>
                              <p className="text-purple-600">Loading task data...</p>
                            </div>
                          </td>
                        </tr>
                      ) : (activeApprovalTab === 'checklist' ? filteredHistoryData : filteredDelegationHistoryData).length > 0 ? (
                        (activeApprovalTab === 'checklist' ? filteredHistoryData : filteredDelegationHistoryData).map((history) => {
                          const isInEditMode = editingRows.has(history._id);
                          const isSaving = savingEdits.has(history._id);
                          const adminDoneColumn = history._sheetType === 'delegation' ? 'col19' : 'col15';

                          return (
                            <tr key={history._id} className="hover:bg-gray-50">
                              {/* FIRST: Admin Done Column with Edit functionality */}
                              {isAdmin && (
                                <td className="px-3 py-4 bg-gray-50 min-w-[160px]">
                                  {isInEditMode ? (
                                    <div className="flex items-center space-x-2">
                                      <select
                                        value={editedAdminStatus[history._id] || "Not Done"}
                                        onChange={(e) =>
                                          setEditedAdminStatus((prev) => ({
                                            ...prev,
                                            [history._id]: e.target.value,
                                          }))
                                        }
                                        className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        disabled={isSaving}
                                      >
                                        <option value="Not Done">Not Done</option>
                                        <option value="Done">Done</option>
                                      </select>
                                      <div className="flex space-x-1">
                                        <button
                                          onClick={() => handleSaveEdit(history)}
                                          disabled={isSaving}
                                          className="p-1 text-green-600 hover:text-green-800 disabled:opacity-50"
                                          title="Save changes"
                                        >
                                          {isSaving ? (
                                            <div className="animate-spin h-4 w-4 border-2 border-green-600 border-t-transparent rounded-full"></div>
                                          ) : (
                                            <Save className="h-4 w-4" />
                                          )}
                                        </button>
                                        <button
                                          onClick={() => handleCancelEdit(history._id)}
                                          disabled={isSaving}
                                          className="p-1 text-red-600 hover:text-red-800 disabled:opacity-50"
                                          title="Cancel editing"
                                        >
                                          <XCircle className="h-4 w-4" />
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between">
                                      <div>
                                        {!isEmpty(history[adminDoneColumn]) &&
                                          history[adminDoneColumn].toString().trim() === "Done" ? (
                                          <div className="flex items-center">
                                            <div className="h-4 w-4 rounded border-gray-300 text-green-600 bg-green-100 mr-2 flex items-center justify-center">
                                              <span className="text-xs text-green-600">✓</span>
                                            </div>
                                            <div className="flex flex-col">
                                              <div className="font-medium text-green-700 text-sm">Done</div>
                                            </div>
                                          </div>
                                        ) : !isEmpty(history[adminDoneColumn]) &&
                                          history[adminDoneColumn].toString().trim() === "Not Done" ? (
                                          <div className="flex items-center text-red-500 text-sm">
                                            <div className="h-4 w-4 rounded border-gray-300 bg-red-100 mr-2 flex items-center justify-center">
                                              <span className="text-xs text-red-600">✗</span>
                                            </div>
                                            <span className="font-medium">Not Done</span>
                                          </div>
                                        ) : (
                                          <div className="flex items-center text-gray-400 text-sm">
                                            <div className="h-4 w-4 rounded border-gray-300 mr-2"></div>
                                            <span>Pending</span>
                                          </div>
                                        )}
                                      </div>
                                      <button
                                        onClick={() => handleEditClick(history)}
                                        className="p-1 text-blue-600 hover:text-blue-800 ml-2"
                                        title="Edit admin status"
                                      >
                                        <Edit className="h-4 w-4" />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              )}

                              {/* SECOND: Admin Select Checkbox */}
                              {isAdmin && (
                                <td className="px-3 py-4 w-12">
                                  {!isEmpty(history[adminDoneColumn]) &&
                                    (history[adminDoneColumn].toString().trim() === "Done" ||
                                      history[adminDoneColumn].toString().trim() === "Not Done") ? (
                                    <div className="flex flex-col items-center">
                                      <div
                                        className={`h-4 w-4 rounded border-gray-300 ${history[adminDoneColumn].toString().trim() === "Done"
                                          ? "text-green-600 bg-green-100"
                                          : "text-red-600 bg-red-100"
                                          }`}
                                      >
                                        <span
                                          className={`text-xs ${history[adminDoneColumn].toString().trim() === "Done"
                                            ? "text-green-600"
                                            : "text-red-600"
                                            }`}
                                        >
                                          {history[adminDoneColumn].toString().trim() === "Done" ? "✓" : "✗"}
                                        </span>
                                      </div>
                                      <span
                                        className={`text-xs mt-1 text-center break-words ${history[adminDoneColumn].toString().trim() === "Done"
                                          ? "text-green-600"
                                          : "text-red-600"
                                          }`}
                                      >
                                        {history[adminDoneColumn].toString().trim()}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-center">
                                      <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                        checked={selectedHistoryItems.some(item => item._id === history._id)}
                                        onChange={() => {
                                          setSelectedHistoryItems(prev =>
                                            prev.some(item => item._id === history._id)
                                              ? prev.filter(item => item._id !== history._id)
                                              : [...prev, history]
                                          );
                                        }}
                                      />
                                      <span className="text-xs text-gray-400 mt-1 text-center break-words">
                                        Mark Done
                                      </span>
                                    </div>
                                  )}
                                </td>
                              )}

                              {/* Rest of the columns - Task ID, Department, etc. */}
                              {!isAdmin && (
                                <td className="px-3 py-4 min-w-[100px]">
                                  <div className="text-sm font-medium text-gray-900 break-words">
                                    {history["col1"] || "—"}
                                  </div>
                                </td>
                              )}

                              {!isAdmin && isAdmin && (
                                <td className="px-3 py-4 min-w-[120px]">
                                  <div className="text-sm text-gray-900 break-words">
                                    {history["col2"] || "—"}
                                  </div>
                                </td>
                              )}

                              {!isAdmin && isAdmin && (
                                <td className="px-3 py-4 min-w-[100px]">
                                  <div className="text-sm text-gray-900 break-words">
                                    {history["col3"] || "—"}
                                  </div>
                                </td>
                              )}

                              {!isAdmin && isAdmin && (
                                <td className="px-3 py-4 min-w-[100px]">
                                  <div className="text-sm text-gray-900 break-words">
                                    {history["col4"] || "—"}
                                  </div>
                                </td>
                              )}

                              <td className="px-3 py-4 min-w-[200px]">
                                <div className="text-sm text-gray-900 break-words" title={history["col5"]}>
                                  {history["col5"] || "—"}
                                </div>
                              </td>

                              <td className="px-3 py-4 bg-yellow-50 min-w-[140px]">
                                <div className="text-sm text-gray-900 break-words">
                                  {isInEditMode && history._sheetType === 'delegation' ? (
                                    <input
                                      type="datetime-local"
                                      value={convertToDateTimeLocal(editedTaskEndDate[history._id] || history["col6"])}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        if (!val) return;
                                        const [date, time] = val.split("T");
                                        const [year, month, day] = date.split("-");
                                        const formatted = `${day}/${month}/${year} ${time}:00`;
                                        setEditedTaskEndDate((prev) => ({
                                          ...prev,
                                          [history._id]: formatted,
                                        }));
                                      }}
                                      className="text-xs border border-gray-300 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
                                    />
                                  ) : history["col6"] ? (
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
                                <div className="text-sm text-gray-900 break-words">
                                  {history["col7"] || "—"}
                                </div>
                              </td>

                              {!isAdmin && isAdmin && (
                                <td className="px-3 py-4 min-w-[120px]">
                                  <div className="text-sm text-gray-900 break-words">
                                    {history["col8"] || "—"}
                                  </div>
                                </td>
                              )}

                              <td className="px-3 py-4 min-w-[120px]">
                                <div className="text-sm text-gray-900 break-words">
                                  {history["col9"] || "—"}
                                </div>
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
                                {isInEditMode ? (
                                  <textarea
                                    value={editedRemarks[history._id] || ""}
                                    onChange={(e) =>
                                      setEditedRemarks((prev) => ({
                                        ...prev,
                                        [history._id]: e.target.value,
                                      }))
                                    }
                                    className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full min-h-[60px]"
                                    placeholder="Enter remarks..."
                                  />
                                ) : (
                                  <div className="text-sm text-gray-900 break-words" title={history["col13"]}>
                                    {history["col13"] || "—"}
                                  </div>
                                )}
                              </td>

                              <td className="px-3 py-4 min-w-[100px]">
                                {(() => {
                                  const attachmentCol = history["col14"];
                                  return attachmentCol ? (
                                    <a href={attachmentCol}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-800 underline flex items-center break-words"
                                    >
                                      {/* <img
                        src={attachmentCol || "/placeholder.svg?height=32&width=32"}
                        alt="Attachment"
                        className="h-8 w-8 object-cover rounded-md mr-2 flex-shrink-0"
                      /> */}
                                      <span className="break-words">View</span>
                                    </a>
                                  ) : (
                                    <span className="text-gray-400">No attachment</span>
                                  );
                                })()}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td
                            colSpan={
                              (isAdmin ? 2 : 0) + // Admin Done + Admin checkbox columns
                              (!isAdmin ? 1 : 0) + // Task ID column
                              (!isAdmin && isAdmin ? 3 : 0) + // Department, Given By, Name columns
                              7 + // Fixed columns
                              (!isAdmin && isAdmin ? 1 : 0) // Enable Reminders column
                            }
                            className="px-6 py-4 text-center text-gray-500"
                          >
                            {searchTerm || selectedMembers.length > 0 || startDate || endDate
                              ? "No historical records matching your filters"
                              : `No completed ${activeApprovalTab} records found`}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="sm:hidden space-y-4 p-4 max-h-[calc(100vh-300px)] overflow-auto">
                  {(activeApprovalTab === 'checklist' ? filteredHistoryData : filteredDelegationHistoryData).length > 0 ? (
                    (activeApprovalTab === 'checklist' ? filteredHistoryData : filteredDelegationHistoryData).map((history) => {
                      const isInEditMode = editingRows.has(history._id);
                      const isSaving = savingEdits.has(history._id);

                      return (
                        <div
                          key={history._id}
                          className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
                        >
                          {/* Mobile card content - replicate your table row data here */}
                          <div className="space-y-3">
                            {isAdmin && (
                              <div className="px-3 py-4 w-12">
                                {(() => {
                                  const adminDoneColumn = history._sheetType === 'delegation' ? 'col19' : 'col15';
                                  return !isEmpty(history[adminDoneColumn]) &&
                                    (history[adminDoneColumn].toString().trim() === "Done" ||
                                      history[adminDoneColumn].toString().trim() ===
                                      "Not Done") ? (
                                    // Already processed - show status only
                                    <div className="flex flex-col items-center">
                                      <div
                                        className={`h-4 w-4 rounded border-gray-300 ${history[adminDoneColumn].toString().trim() ===
                                          "Done"
                                          ? "text-green-600 bg-green-100"
                                          : "text-red-600 bg-red-100"
                                          }`}
                                      >
                                        <span
                                          className={`text-xs ${history[adminDoneColumn].toString().trim() ===
                                            "Done"
                                            ? "text-green-600"
                                            : "text-red-600"
                                            }`}
                                        >
                                          {history[adminDoneColumn].toString().trim() ===
                                            "Done"
                                            ? "✓"
                                            : "✗"}
                                        </span>
                                      </div>
                                      <span
                                        className={`text-xs mt-1 text-center break-words ${history[adminDoneColumn].toString().trim() ===
                                          "Done"
                                          ? "text-green-600"
                                          : "text-red-600"
                                          }`}
                                      >
                                        {history[adminDoneColumn].toString().trim()}
                                      </span>
                                    </div>
                                  ) : (
                                    // Not processed yet - normal selectable checkbox
                                    <div className="flex flex-col items-center">
                                      <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                        checked={selectedHistoryItems.some(
                                          (item) => item._id === history._id
                                        )}
                                        onChange={() => {
                                          setSelectedHistoryItems((prev) =>
                                            prev.some(
                                              (item) => item._id === history._id
                                            )
                                              ? prev.filter(
                                                (item) => item._id !== history._id
                                              )
                                              : [...prev, history]
                                          );
                                        }}
                                      />
                                      <span className="text-xs text-gray-400 mt-1 text-center break-words">
                                        Mark Done
                                      </span>
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                            {/* Admin Done Section */}
                            {isAdmin && (
                              <div className="flex justify-between items-center border-b pb-2">
                                <span className="font-medium text-gray-700">
                                  Admin Status:
                                </span>
                                {/* Copy your admin status display/editing logic here */}
                                {(() => {
                                  const adminDoneColumn = history._sheetType === 'delegation' ? 'col19' : 'col19';
                                  return isInEditMode ? (
                                    // Edit mode
                                    <div className="flex items-center space-x-2">
                                      <select
                                        value={
                                          editedAdminStatus[history._id] ||
                                          "Not Done"
                                        }
                                        onChange={(e) =>
                                          setEditedAdminStatus((prev) => ({
                                            ...prev,
                                            [history._id]: e.target.value,
                                          }))
                                        }
                                        className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        disabled={isSaving}
                                      >
                                        <option value="Not Done">Not Done</option>
                                        <option value="Done">Done</option>
                                      </select>
                                      <div className="flex space-x-1">
                                        <button
                                          onClick={() => handleSaveEdit(history)}
                                          disabled={isSaving}
                                          className="p-1 text-green-600 hover:text-green-800 disabled:opacity-50"
                                          title="Save changes"
                                        >
                                          {isSaving ? (
                                            <div className="animate-spin h-4 w-4 border-2 border-green-600 border-t-transparent rounded-full"></div>
                                          ) : (
                                            <Save className="h-4 w-4" />
                                          )}
                                        </button>
                                        <button
                                          onClick={() =>
                                            handleCancelEdit(history._id)
                                          }
                                          disabled={isSaving}
                                          className="p-1 text-red-600 hover:text-red-800 disabled:opacity-50"
                                          title="Cancel editing"
                                        >
                                          <XCircle className="h-4 w-4" />
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    // Display mode
                                    <div className="flex items-center justify-between">
                                      <div>
                                        {!isEmpty(history[adminDoneColumn]) &&
                                          history[adminDoneColumn].toString().trim() ===
                                          "Done" ? (
                                          <div className="flex items-center">
                                            <div className="h-4 w-4 rounded border-gray-300 text-green-600 bg-green-100 mr-2 flex items-center justify-center">
                                              <span className="text-xs text-green-600">
                                                ✓
                                              </span>
                                            </div>
                                            <div className="flex flex-col">
                                              <div className="font-medium text-green-700 text-sm">
                                                Done
                                              </div>
                                            </div>
                                          </div>
                                        ) : !isEmpty(history[adminDoneColumn]) &&
                                          history[adminDoneColumn].toString().trim() ===
                                          "Not Done" ? (
                                          <div className="flex items-center text-red-500 text-sm">
                                            <div className="h-4 w-4 rounded border-gray-300 bg-red-100 mr-2 flex items-center justify-center">
                                              <span className="text-xs text-red-600">
                                                ✗
                                              </span>
                                            </div>
                                            <span className="font-medium">
                                              Not Done
                                            </span>
                                          </div>
                                        ) : (
                                          <div className="flex items-center text-gray-400 text-sm">
                                            <div className="h-4 w-4 rounded border-gray-300 mr-2"></div>
                                            <span>Pending</span>
                                          </div>
                                        )}
                                      </div>
                                      <button
                                        onClick={() => handleEditClick(history)}
                                        className="p-1 text-blue-600 hover:text-blue-800 ml-2"
                                        title="Edit admin status"
                                      >
                                        <Edit className="h-4 w-4" />
                                      </button>
                                    </div>
                                  );
                                })()}
                              </div>
                            )}



                            {/* Task Description */}
                            <div>
                              <span className="font-medium text-gray-700">
                                Task:
                              </span>
                              <p className="mt-1 text-gray-900">
                                {history["col5"] || "—"}
                              </p>
                            </div>

                            {/* Dates */}
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <span className="font-medium text-gray-700">
                                  End Date:
                                </span>
                                {isInEditMode && history._sheetType === 'delegation' ? (
                                  <input
                                    type="datetime-local"
                                    value={convertToDateTimeLocal(editedTaskEndDate[history._id] || history["col6"])}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (!val) return;
                                      const [date, time] = val.split("T");
                                      const [year, month, day] = date.split("-");
                                      const formatted = `${day}/${month}/${year} ${time}:00`;
                                      setEditedTaskEndDate((prev) => ({
                                        ...prev,
                                        [history._id]: formatted,
                                      }));
                                    }}
                                    className="text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full mt-1"
                                  />
                                ) : (
                                  <p className="text-sm text-gray-900">
                                    {history["col6"] || "—"}
                                  </p>
                                )}
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">
                                  Actual Date:
                                </span>
                                <p className="text-sm text-gray-900">
                                  {history["col10"] || "—"}
                                </p>
                              </div>
                            </div>

                            {/* Status and Attachment */}
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <span className="font-medium text-gray-700">
                                  Status:
                                </span>
                                <p className="text-sm text-gray-900">
                                  {history["col12"] || "—"}
                                </p>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">
                                  Attachment:
                                </span>
                                <div className="mt-1">
                                  {(() => {
                                    const attachmentCol = history["col14"];
                                    return attachmentCol ? (
                                      <a href={attachmentCol}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 underline text-sm"
                                      >
                                        View
                                      </a>
                                    ) : (
                                      <span className="text-gray-400 text-sm">No attachment</span>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>

                            {/* Remarks Section */}
                            <div>
                              <span className="font-medium text-gray-700">
                                Remarks:
                              </span>
                              {isInEditMode ? (
                                <textarea
                                  value={editedRemarks[history._id] || ""}
                                  onChange={(e) =>
                                    setEditedRemarks((prev) => ({
                                      ...prev,
                                      [history._id]: e.target.value,
                                    }))
                                  }
                                  className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full min-h-[60px] mt-1"
                                  placeholder="Enter remarks..."
                                />
                              ) : (
                                <p className="text-sm text-gray-900">
                                  {history["col13"] || "—"}
                                </p>
                              )}
                            </div>

                            {/* Add more fields as needed for mobile view */}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      {searchTerm ||
                        selectedMembers.length > 0 ||
                        startDate ||
                        endDate
                        ? "No historical records matching your filters"
                        : "No completed records found"}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default Approval;