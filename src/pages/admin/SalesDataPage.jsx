"use client";
import { useState, useEffect, useCallback, useMemo, useRef, captureBtnRef } from "react";
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
  Camera,

} from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import { getUserRole, getUsername, isAdminUser } from "../../utils/authUtils";

// Configuration object - Move all configurations here
const CONFIG = {
  // Google Apps Script URL
  APPS_SCRIPT_URL:
    "https://script.google.com/macros/s/AKfycbyGf3LdYk6MPiOs_shPU9_AW7wmRjJZ4QxMk9qYqTScsDMB7IliaWRB1HueYy7w5qxqNw/exec",
  // Google Drive folder ID for file uploads
  DRIVE_FOLDER_ID: "1mocSXHZWgUBRpRCpOS_-1L-f0CcVJcl_",
  // Sheet name to work with
  SHEET_NAME: "Checklist",
  // Page configuration
  PAGE_CONFIG: {
    title: "Checklist Tasks",
    historyTitle: "Checklist Task History",
    description: "Showing today, tomorrow's tasks and past due tasks",
    historyDescription:
      "Read-only view of completed tasks with submission history (excluding admin-processed items)",
  },
};

function AccountDataPage() {
  const [accountData, setAccountData] = useState([]);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [additionalData, setAdditionalData] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [remarksData, setRemarksData] = useState({});
  const [historyData, setHistoryData] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [membersList, setMembersList] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  // UPDATED: Always set to 'super_admin' for unrestricted access
  const [userRole, setUserRole] = useState("super_admin");
  const [username, setUsername] = useState("");

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
  const [savingEdits, setSavingEdits] = useState(new Set());

  const [buddyTaskFilter, setBuddyTaskFilter] = useState(""); // Selected buddy name
  const [assignedPersons, setAssignedPersons] = useState([]); // List from sessionStorage
  const [currentCaptureId, setCurrentCaptureId] = useState(null);
  // Ye states already hai aapke code me (around line 50-60), check karo ye sab exist karte hai:
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isCameraLoading, setIsCameraLoading] = useState(false); // ✅ Ye line check karo
  // Add these functions in your component (around line 150-250, after other functions)



  // Camera cleanup when component unmounts
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);
  // ✅ Add these camera functions in your component (around line 150-250)

  const startCamera = async () => {
    try {
      setCameraError("");
      setIsCameraLoading(true);

      console.log("🎥 Starting camera... Platform check");

      // Check camera support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const errorMsg = "Camera not supported on this device/browser";
        setCameraError(errorMsg);
        console.error(errorMsg);
        setIsCameraLoading(false);
        return;
      }

      // Detect device type
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      console.log(`📱 Device: ${isMobile ? 'Mobile' : 'Desktop'}`);

      // Different constraints for mobile vs desktop
      let constraints;

      if (isMobile) {
        // MOBILE CONSTRAINTS
        constraints = {
          video: {
            facingMode: { exact: "environment" }, // Force back camera on mobile
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 24, max: 30 }
          },
          audio: false
        };
      } else {
        // DESKTOP CONSTRAINTS
        constraints = {
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 }
          },
          audio: false
        };
      }

      console.log("📹 Requesting camera with constraints:", constraints);

      // Get camera stream
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("✅ Camera stream obtained");

      // Set state
      setCameraStream(stream);
      setIsCameraOpen(true);

      // Set video source
      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = stream;

        // Wait for video to load
        await new Promise((resolve) => {
          if (video.readyState >= 3) { // HAVE_FUTURE_DATA
            resolve();
            return;
          }

          video.onloadedmetadata = () => {
            console.log("✅ Video metadata loaded");
            resolve();
          };

          video.onerror = () => {
            console.error("❌ Video error event");
            resolve(); // Still continue even if error
          };

          // Timeout fallback
          setTimeout(resolve, 2000);
        });

        // Play video
        try {
          await video.play();
          console.log("▶️ Video playing successfully");
        } catch (playError) {
          console.warn("⚠️ Autoplay prevented, trying with user gesture...", playError);
          // Mobile browsers often block autoplay, but we can still show the stream
        }
      }

      console.log("🚀 Camera started successfully");
      setIsCameraLoading(false);

    } catch (error) {
      console.error("❌ Camera error details:", error);
      setIsCameraLoading(false);

      // User-friendly error messages
      let errorMessage = "Unable to access camera";

      switch (error.name) {
        case 'NotAllowedError':
        case 'PermissionDeniedError':
          errorMessage = "Camera permission denied. Please allow camera access in your browser settings.";
          break;
        case 'NotFoundError':
        case 'DevicesNotFoundError':
          errorMessage = "No camera found on this device.";
          break;
        case 'NotReadableError':
        case 'TrackStartError':
          errorMessage = "Camera is already in use by another application.";
          break;
        case 'OverconstrainedError':
          errorMessage = "Camera constraints could not be satisfied. Trying alternative settings...";
          // Try with simpler constraints
          try {
            const fallbackStream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false
            });
            if (videoRef.current) {
              videoRef.current.srcObject = fallbackStream;
              setCameraStream(fallbackStream);
              setIsCameraOpen(true);
              setIsCameraLoading(false);
              return; // Success with fallback
            }
          } catch (fallbackError) {
            console.error("Fallback also failed:", fallbackError);
            errorMessage = "Camera access failed even with basic settings.";
          }
          break;
        default:
          errorMessage = `Camera error: ${error.message || error.name}`;
      }

      setCameraError(errorMessage);
    }
  };

  // ✅ UPDATED: UNIVERSAL CAPTURE PHOTO FUNCTION
  const capturePhoto = async () => {
    console.log("📸 Capture photo initiated...");

    if (!currentCaptureId) {
      alert("Please select a task first");
      return;
    }

    if (!videoRef.current) {
      alert("Camera not ready. Please wait or restart camera.");
      return;
    }

    const video = videoRef.current;

    // Check video state
    if (video.readyState < video.HAVE_CURRENT_DATA) {
      alert("Camera still loading. Please wait...");
      return;
    }

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      alert("Camera feed not available. Please check camera permissions.");
      return;
    }

    try {
      console.log(`Capturing from video: ${video.videoWidth}x${video.videoHeight}`);

      // Create canvas with video dimensions
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error("Could not create canvas context");
      }

      // Draw video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      console.log("✅ Frame drawn to canvas");

      // Convert to blob
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              console.log(`📦 Blob created: ${(blob.size / 1024).toFixed(1)} KB`);
              resolve(blob);
            } else {
              reject(new Error("Canvas to blob conversion failed"));
            }
          },
          'image/jpeg',
          0.92 // Good quality for both mobile and desktop
        );
      });

      // Create file object
      const fileName = `task_${currentCaptureId}_${Date.now()}.jpg`;
      const file = new File([blob], fileName, { type: 'image/jpeg' });

      console.log(`✅ Photo captured: ${fileName}`);

      // Stop camera
      stopCamera();

      // Update state with captured photo
      handleCameraCapture(currentCaptureId, file);

      // Show success message
      setSuccessMessage("Photo captured successfully! Ready to submit.");

      // Auto-hide success message after 3 seconds
      setTimeout(() => setSuccessMessage(""), 3000);

    } catch (error) {
      console.error("❌ Photo capture error:", error);
      alert(`Failed to capture photo: ${error.message}`);
    }
  };

  // ✅ UPDATED: STOP CAMERA FUNCTION
  const stopCamera = () => {
    console.log("🛑 Stopping camera...");

    if (cameraStream) {
      cameraStream.getTracks().forEach(track => {
        track.stop();
        console.log(`Stopped track: ${track.kind}`);
      });
      setCameraStream(null);
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsCameraOpen(false);
    setCameraError("");
    setIsCameraLoading(false);
    setCurrentCaptureId(null);

    console.log("✅ Camera stopped completely");
  };

  // UPDATED: Always true for super_admin access
  const isAdmin = true;

  // UPDATED: Format date-time to DD/MM/YYYY HH:MM:SS
  const formatDateTimeToDDMMYYYY = (date) => {
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  };

  // UPDATED: Format date only to DD/MM/YYYY (for comparison purposes)
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

  useEffect(() => {
    // UPDATED: Use authUtils for super_admin access
    const role = getUserRole(); // Always returns 'super_admin'
    const user = getUsername();

    const assignPersonData = sessionStorage.getItem("AssignPerson");

    setUserRole(role);
    setUsername(user);

    // Parse and set assigned persons list
    if (assignPersonData) {
      try {
        const parsedData = JSON.parse(assignPersonData);
        setAssignedPersons(parsedData || []);
      } catch (error) {
        console.error("Error parsing AssignPerson:", error);
        setAssignedPersons([]);
      }
    }
  }, []);

  // UPDATED: Parse Google Sheets date-time to handle DD/MM/YYYY HH:MM:SS format
  const parseGoogleSheetsDateTime = (dateTimeStr) => {
    if (!dateTimeStr) return "";
    // If already in DD/MM/YYYY HH:MM:SS format, return as is
    if (
      typeof dateTimeStr === "string" &&
      dateTimeStr.match(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/)
    ) {
      return dateTimeStr;
    }
    // If in DD/MM/YYYY format (without time), return as is
    if (
      typeof dateTimeStr === "string" &&
      dateTimeStr.match(/^\d{2}\/\d{2}\/\d{4}$/)
    ) {
      return dateTimeStr;
    }
    // Handle Google Sheets Date(year,month,day) format
    if (typeof dateTimeStr === "string" && dateTimeStr.startsWith("Date(")) {
      const match = /Date\((\d+),(\d+),(\d+)\)/.exec(dateTimeStr);
      if (match) {
        const year = Number.parseInt(match[1], 10);
        const month = Number.parseInt(match[2], 10);
        const day = Number.parseInt(match[3], 10);
        return `${day.toString().padStart(2, "0")}/${(month + 1)
          .toString()
          .padStart(2, "0")}/${year}`;
      }
    }
    // Try to parse as a regular date
    try {
      const date = new Date(dateTimeStr);
      if (!isNaN(date.getTime())) {
        // Check if the original string contained time information
        if (
          typeof dateTimeStr === "string" &&
          (dateTimeStr.includes(":") || dateTimeStr.includes("T"))
        ) {
          return formatDateTimeToDDMMYYYY(date);
        } else {
          return formatDateToDDMMYYYY(date);
        }
      }
    } catch (error) {
      console.error("Error parsing date-time:", error);
    }
    return dateTimeStr;
  };

  // UPDATED: Parse date from DD/MM/YYYY or DD/MM/YYYY HH:MM:SS format for comparison
  const parseDateFromDDMMYYYY = (dateStr) => {
    if (!dateStr || typeof dateStr !== "string") return null;

    // Extract just the date part if it includes time
    const datePart = dateStr.includes(" ") ? dateStr.split(" ")[0] : dateStr;
    const parts = datePart.split("/");
    if (parts.length !== 3) return null;
    return new Date(parts[2], parts[1] - 1, parts[0]);
  };

  const sortDateWise = (a, b) => {
    const dateStrA = a["col6"] || "";
    const dateStrB = b["col6"] || "";
    const dateA = parseDateFromDDMMYYYY(dateStrA);
    const dateB = parseDateFromDDMMYYYY(dateStrB);
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateA.getTime() - dateB.getTime();
  };

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
    setEditedAdminStatus((prev) => ({
      ...prev,
      [rowId]: historyItem["col15"] || "",
    }));
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
  };

  const handleSaveEdit = async (historyItem) => {
    const rowId = historyItem._id;
    const newStatus = editedAdminStatus[rowId];

    if (savingEdits.has(rowId)) return;

    setSavingEdits((prev) => new Set([...prev, rowId]));

    try {
      // Different approaches for clearing vs setting
      const statusToSend =
        newStatus === "" || newStatus === undefined ? "" : newStatus;

      // console.log('=== EDIT DEBUG INFO ===')
      // console.log('Row ID:', rowId)
      // console.log('Original Status:', historyItem["col15"])
      // console.log('New Status:', newStatus)
      // console.log('Status to Send:', statusToSend)
      // console.log('Task ID:', historyItem._taskId || historyItem["col1"])
      // console.log('Row Index:', historyItem._rowIndex)

      const submissionData = [
        {
          taskId: historyItem._taskId || historyItem["col1"],
          rowIndex: historyItem._rowIndex,
          adminDoneStatus: statusToSend, // Send empty string to clear, "Done" to set
        },
      ];

      // console.log('Submission Data:', JSON.stringify(submissionData, null, 2))

      const formData = new FormData();
      formData.append("sheetName", CONFIG.SHEET_NAME);
      formData.append("action", "updateAdminDone");
      formData.append("rowData", JSON.stringify(submissionData));

      // console.log('Making API request...')
      const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
        method: "POST",
        body: formData,
      });

      const responseText = await response.text();
      console.log("Raw Response:", responseText);

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error("JSON Parse Error:", parseError);
        throw new Error(`Invalid response format: ${responseText}`);
      }

      // console.log('Parsed Result:', result)

      if (result.success) {
        // Update local state - use empty string for cleared status
        const updatedStatus =
          newStatus === "" || newStatus === undefined ? "" : newStatus;

        // console.log('Updating local state with:', updatedStatus)

        setHistoryData((prev) =>
          prev.map((item) =>
            item._id === rowId ? { ...item, col15: updatedStatus } : item
          )
        );

        // Exit edit mode
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

        // Refresh data after a short delay
        setTimeout(() => {
          // console.log('Refreshing data...')
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

  const isSubmitEnabled = useMemo(() => {
    if (selectedItems.size === 0) return false;

    const selectedItemsArray = Array.from(selectedItems);
    // console.log("sleectedItemsArray", selectedItemsArray);
    return selectedItemsArray.every(
      (id) => additionalData[id] === "Yes" || additionalData[id] === "Not Done"
    );
  }, [selectedItems, additionalData]);

  // Memoized filtered data to prevent unnecessary re-renders
  const filteredAccountData = useMemo(() => {
    const filtered = searchTerm
      ? accountData.filter((account) =>
        Object.values(account).some(
          (value) =>
            value &&
            value.toString().toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
      : accountData;

    // Frontend-only: hide tasks whose Remarks (col13) contain "leave" — no sheet changes
    const withoutLeave = filtered.filter((account) => {
      const remarks = String(account["col13"] || "").trim().toLowerCase();
      return !remarks.includes("leave");
    });

    return withoutLeave.sort(sortDateWise);
  }, [accountData, searchTerm]);

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

  const getTaskStatistics = () => {
    const totalCompleted = historyData.length;
    const memberStats =
      selectedMembers.length > 0
        ? selectedMembers.reduce((stats, member) => {
          const memberTasks = historyData.filter(
            (task) => task["col4"] === member
          ).length;
          return {
            ...stats,
            [member]: memberTasks,
          };
        }, {})
        : {};
    const filteredTotal = filteredHistoryData.length;
    return {
      totalCompleted,
      memberStats,
      filteredTotal,
    };
  };

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
    if (isAdmin) {
      return membersList;
    } else {
      return membersList.filter(
        (member) => member.toLowerCase() === username.toLowerCase()
      );
    }
  };

  // UPDATED: fetchSheetData - Show only data where Column K is null
  const fetchSheetData = useCallback(async () => {
    try {
      setLoading(true);
      const pendingAccounts = [];
      const historyRows = [];
      const response = await fetch(
        `${CONFIG.APPS_SCRIPT_URL}?sheet=${CONFIG.SHEET_NAME}&action=fetch`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status}`);
      }
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        const jsonStart = text.indexOf("{");
        const jsonEnd = text.lastIndexOf("}");
        if (jsonStart !== -1 && jsonEnd !== -1) {
          const jsonString = text.substring(jsonStart, jsonEnd + 1);
          data = JSON.parse(jsonString);
        } else {
          throw new Error("Invalid JSON response from server");
        }
      }

      const currentUsername = sessionStorage.getItem("username");
      const currentUserRole = sessionStorage.getItem("role");

      const membersSet = new Set();
      let rows = [];
      if (data.table && data.table.rows) {
        rows = data.table.rows;
      } else if (Array.isArray(data)) {
        rows = data;
      } else if (data.values) {
        rows = data.values.map((row) => ({
          c: row.map((val) => ({ v: val })),
        }));
      }

      rows.forEach((row, rowIndex) => {
        if (rowIndex === 0) return;
        let rowValues = [];
        if (row.c) {
          rowValues = row.c.map((cell) =>
            cell && cell.v !== undefined ? cell.v : ""
          );
        } else if (Array.isArray(row)) {
          rowValues = row;
        } else {
          return;
        }

        const assignedTo = rowValues[4] || "Unassigned";
        membersSet.add(assignedTo);

        const filterName = buddyTaskFilter || currentUsername;

        const isUserMatch =
          (currentUserRole === "admin" || currentUserRole === "superadmin" || currentUserRole === "super_admin") ||
          assignedTo.toLowerCase() === filterName.toLowerCase();

        if (!isUserMatch && currentUserRole !== "admin") return;

        const columnGValue = rowValues[6]; // Task Start Date
        const columnKValue = rowValues[10]; // Actual Date (Column K)
        const columnPValue = rowValues[15]; // Admin Processed Date (Column P)

        const rowDateStr = columnGValue ? String(columnGValue).trim() : "";
        const formattedRowDate = parseGoogleSheetsDateTime(rowDateStr);
        const googleSheetsRowIndex = rowIndex + 1;

        // Create stable unique ID using task ID and row index
        const taskId = rowValues[1] || "";
        const stableId = taskId
          ? `task_${taskId}_${googleSheetsRowIndex}`
          : `row_${googleSheetsRowIndex}_${Math.random()
            .toString(36)
            .substring(2, 15)}`;

        const rowData = {
          _id: stableId,
          _rowIndex: googleSheetsRowIndex,
          _taskId: taskId,
        };

        const columnHeaders = [
          { id: "col0", label: "Timestamp", type: "string" },
          { id: "col1", label: "Task ID", type: "string" },
          { id: "col2", label: "Firm", type: "string" },
          { id: "col3", label: "Given By", type: "string" },
          { id: "col4", label: "Name", type: "string" },
          { id: "col5", label: "Task Description", type: "string" },
          { id: "col6", label: "Task Start Date", type: "datetime" },
          { id: "col7", label: "Freq", type: "string" },
          { id: "col8", label: "Enable Reminders", type: "string" },
          { id: "col9", label: "Require Attachment", type: "string" },
          { id: "col10", label: "Actual", type: "datetime" },
          { id: "col11", label: "Column L", type: "string" },
          { id: "col12", label: "Status", type: "string" },
          { id: "col13", label: "Remarks", type: "string" },
          { id: "col14", label: "Uploaded Image", type: "string" },
          { id: "col15", label: "Admin Done", type: "string" }, // Column P
        ];

        columnHeaders.forEach((header, index) => {
          const cellValue = rowValues[index];
          if (
            header.type === "datetime" ||
            header.type === "date" ||
            (cellValue && String(cellValue).startsWith("Date("))
          ) {
            rowData[header.id] = cellValue
              ? parseGoogleSheetsDateTime(String(cellValue))
              : "";
          } else if (
            header.type === "number" &&
            cellValue !== null &&
            cellValue !== ""
          ) {
            rowData[header.id] = cellValue;
          } else {
            rowData[header.id] = cellValue !== null ? cellValue : "";
          }
        });

        // ✅ ONLY ADD IF COLUMN K IS EMPTY/NULL
        const isColumnKEmpty = isEmpty(columnKValue);

        if (isColumnKEmpty && isEmpty(columnPValue)) {
          pendingAccounts.push(rowData);
        }
        // For history view, include tasks where Column K is NOT empty
        else if (!isColumnKEmpty) {
          const isUserHistoryMatch =
            currentUserRole === "admin" ||
            currentUserRole === "superadmin" ||
            currentUserRole === "super_admin" ||
            assignedTo.toLowerCase() === currentUsername.toLowerCase();
          if (isUserHistoryMatch) {
            historyRows.push(rowData);
          }
        }
      });

      setMembersList(Array.from(membersSet).sort());
      setAccountData(pendingAccounts);
      setHistoryData(historyRows);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching sheet data:", error);
      setError("Failed to load account data: " + error.message);
      setLoading(false);
    }
  }, [buddyTaskFilter]);

  useEffect(() => {
    fetchSheetData();
  }, [fetchSheetData]);

  // Checkbox handlers with better state management
  const handleSelectItem = useCallback((id, isChecked) => {
    // console.log(`Checkbox action: ${id} -> ${isChecked}`)
    setSelectedItems((prev) => {
      const newSelected = new Set(prev);
      if (isChecked) {
        newSelected.add(id);
      } else {
        newSelected.delete(id);
        // Clean up related data when unchecking
        setAdditionalData((prevData) => {
          const newAdditionalData = { ...prevData };
          delete newAdditionalData[id];
          return newAdditionalData;
        });
        setRemarksData((prevRemarks) => {
          const newRemarksData = { ...prevRemarks };
          delete newRemarksData[id];
          return newRemarksData;
        });
      }
      // console.log(`Updated selection: ${Array.from(newSelected)}`)
      return newSelected;
    });
  }, []);

  const handleCheckboxClick = useCallback(
    (e, id) => {
      e.stopPropagation();
      const isChecked = e.target.checked;
      // console.log(`Checkbox clicked: ${id}, checked: ${isChecked}`)
      handleSelectItem(id, isChecked);
    },
    [handleSelectItem]
  );

  const handleSelectAllItems = useCallback(
    (e) => {
      e.stopPropagation();
      const checked = e.target.checked;
      // console.log(`Select all clicked: ${checked}`)
      if (checked) {
        const allIds = filteredAccountData.map((item) => item._id);
        setSelectedItems(new Set(allIds));
        // console.log(`Selected all items: ${allIds}`)
      } else {
        setSelectedItems(new Set());
        setAdditionalData({});
        setRemarksData({});
        // console.log("Cleared all selections")
      }
    },
    [filteredAccountData]
  );

  // ✅ SEPARATE: File upload handler
  const handleImageUpload = useCallback(async (id, e) => {
    const file = e.target.files[0];
    if (!file) return;

    console.log(`📁 File upload for: ${id}`, file.name);

    setAccountData((prev) =>
      prev.map((item) => (item._id === id ? { ...item, image: file } : item))
    );
  }, []);

  const handleCameraCapture = useCallback((id, file) => {
    console.log("📸 handleCameraCapture called");
    console.log("ID:", id);
    console.log("File:", file.name, file.size, "bytes");

    setAccountData((prev) => {
      const updated = prev.map((item) => {
        if (item._id === id) {
          console.log("✅ Found matching item, updating image");
          return { ...item, image: file };
        }
        return item;
      });
      console.log("📊 State updated");
      return updated;
    });
  }, []);

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  const toggleHistory = () => {
    setShowHistory((prev) => !prev);
    resetFilters();
    setBuddyTaskFilter("");
  };

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
      alert(
        `Please provide remarks for items marked as "No". ${missingRemarks.length} item(s) are missing remarks.`
      );
      return;
    }

    const missingRequiredImages = selectedItemsArray.filter((id) => {
      const item = accountData.find((account) => account._id === id);
      const requiresAttachment =
        item["col9"] && item["col9"].toUpperCase() === "YES";
      return requiresAttachment && !item.image;
    });

    if (missingRequiredImages.length > 0) {
      alert(
        `Please upload images for all required attachments. ${missingRequiredImages.length} item(s) are missing required images.`
      );
      return;
    }

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
              formData.append(
                "fileName",
                `task_${item["col1"]}_${Date.now()}.${item.image.name
                  .split(".")
                  .pop()}`
              );
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

        const assignedTo = item["col4"] || ""; // Name column
        const isBuddyTask =
          buddyTaskFilter &&
          buddyTaskFilter !== "" &&
          assignedTo.toLowerCase() !== username.toLowerCase();
        console.log("isbuddyTask", isBuddyTask);
        console.log("username", username);

        submissionData.push({
          taskId: item["col1"], // Column B
          rowIndex: item._rowIndex,
          actualDate: todayFormatted, // Column K (formatted as DD/MM/YYYY HH:MM:SS)
          status: additionalData[id] || "", // Column M
          remarks: remarksData[id] || "", // Column N
          imageUrl:
            imageUrlMap[id] ||
            (item.image && typeof item.image === "string" ? item.image : ""), // Column O

          buddyName: isBuddyTask ? username : "",
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
          col14:
            imageUrlMap[id] ||
            (item.image && typeof item.image === "string" ? item.image : ""), // Column O
        };
      });

      // Update local state
      setAccountData((prev) =>
        prev.filter((item) => !selectedItems.has(item._id))
      );
      setHistoryData((prev) => [...submittedItemsForHistory, ...prev]);
      setSelectedItems(new Set());
      setAdditionalData({});
      setRemarksData({});

      // Submit to Google Sheets
      const formData = new FormData();
      formData.append("sheetName", CONFIG.SHEET_NAME);
      formData.append("action", "updateTaskData");
      formData.append("rowData", JSON.stringify(submissionData));

      setIsSubmitting(true);

      const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (result.success) {
        setSuccessMessage(
          `Successfully submitted ${selectedItemsArray.length} task(s)!`
        );
      } else {
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
  const selectedItemsCount = selectedItems.size;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-purple-700 text-center sm:text-left">
            {showHistory
              ? CONFIG.PAGE_CONFIG.historyTitle
              : CONFIG.PAGE_CONFIG.title}
          </h1>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
            {/* Search box */}
            <div className="relative w-full sm:w-64">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="text"
                placeholder={
                  showHistory ? "Search history..." : "Search tasks..."
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-purple-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 w-full"
              />
            </div>

            {/* Buddy Task Dropdown */}
            {assignedPersons.length > 0 && (
              <div className="relative w-full sm:w-64">
                <label
                  htmlFor="buddy-task"
                  className="block text-xs text-gray-600 mb-1"
                >
                  Buddy Task
                </label>
                <select
                  id="buddy-task"
                  value={buddyTaskFilter}
                  onChange={(e) => setBuddyTaskFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-purple-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">My Tasks</option>
                  {assignedPersons.map((person, idx) => (
                    <option key={idx} value={person}>
                      {person}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Toggle history button */}
            {/* <button
              onClick={toggleHistory}
              className="rounded-md bg-gradient-to-r from-blue-500 to-indigo-600 py-2 px-4 text-white hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 w-full sm:w-auto text-center"
            >
              {showHistory ? (
                <div className="flex items-center justify-center sm:justify-start">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  <span>Back to Tasks</span>
                </div>
              ) : (
                <div className="flex items-center justify-center sm:justify-start">
                  <History className="h-4 w-4 mr-1" />
                  <span>View History</span>
                </div>
              )}
            </button> */}

            {/* Submit button (only when not history view) */}
            {!showHistory && (
              <button
                onClick={handleSubmit}
                disabled={!isSubmitEnabled || isSubmitting}
                className={`rounded-md py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all duration-200 w-full sm:w-auto ${isSubmitEnabled && !isSubmitting
                  ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 cursor-pointer"
                  : "bg-gray-400 cursor-not-allowed opacity-50"
                  }`}
              >
                {isSubmitting
                  ? "Processing..."
                  : `Submit Selected (${selectedItemsCount})`}
              </button>
            )}

            {/* Admin Submit Button for History View */}
            {showHistory &&
              ['admin', 'superadmin', 'super admin', 'superuser'].includes(userRole) &&
              selectedHistoryItems.length > 0 && (
                <div className="fixed bottom-6 right-6 sm:top-40 sm:right-10 z-50">
                  <button
                    onClick={handleMarkMultipleDone}
                    disabled={markingAsDone}
                    className="rounded-md bg-green-600 text-white px-4 py-2 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                  >
                    {markingAsDone
                      ? "Processing..."
                      : `Mark ${selectedHistoryItems.length} Items as Admin Done`}
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
            <button
              onClick={() => setSuccessMessage("")}
              className="text-green-500 hover:text-green-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        <div className="rounded-lg border border-purple-200 shadow-md bg-white overflow-hidden">
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 p-4 flex justify-between items-center">
            <div>
              <h2 className="text-purple-700 font-medium">
                {showHistory
                  ? `Completed ${CONFIG.SHEET_NAME} Tasks`
                  : `Pending ${CONFIG.SHEET_NAME} Tasks`}
              </h2>
              <p className="text-purple-600 text-sm">
                {showHistory
                  ? `${CONFIG.PAGE_CONFIG.historyDescription} for ${['admin', 'superadmin', 'super admin', 'superuser'].includes(userRole) ? "all" : "your"
                  } tasks`
                  : CONFIG.PAGE_CONFIG.description}
              </p>
            </div>

            <h1 className="sm:text-xl tracking-tight text-purple-700 text-center sm:text-left">
              Pending Tasks: {filteredAccountData.length}
            </h1>
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
          ) : showHistory ? (
            <>
              {/* History Filters */}
              <div className="p-4 border-b border-purple-100 bg-gray-50">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  {getFilteredMembersList().length > 0 && (
                    <div className="flex flex-col">
                      <div className="mb-2 flex items-center">
                        <span className="text-sm font-medium text-purple-700">
                          Filter by Member:
                        </span>
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
                            <label
                              htmlFor={`member-${idx}`}
                              className="ml-2 text-sm text-gray-700"
                            >
                              {member}
                            </label>
                          </div>
                        ))}
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
                        {getTaskStatistics().totalCompleted}
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
                            {getTaskStatistics().filteredTotal}
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
                      {/* NEW: Admin Done Column - NOW FIRST */}
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
                                filteredHistoryData.filter(
                                  (item) =>
                                    isEmpty(item["col15"]) ||
                                    (item["col15"].toString().trim() !==
                                      "Done" &&
                                      item["col15"].toString().trim() !==
                                      "Not Done")
                                ).length > 0 &&
                                selectedHistoryItems.length ===
                                filteredHistoryData.filter(
                                  (item) =>
                                    isEmpty(item["col15"]) ||
                                    (item["col15"].toString().trim() !==
                                      "Done" &&
                                      item["col15"].toString().trim() !==
                                      "Not Done")
                                ).length
                              }
                              onChange={(e) => {
                                const unprocessedItems =
                                  filteredHistoryData.filter(
                                    (item) =>
                                      isEmpty(item["col15"]) ||
                                      (item["col15"].toString().trim() !==
                                        "Done" &&
                                        item["col15"].toString().trim() !==
                                        "Not Done")
                                  );
                                if (e.target.checked) {
                                  setSelectedHistoryItems(unprocessedItems);
                                } else {
                                  setSelectedHistoryItems([]);
                                }
                              }}
                            />
                            <span className="text-xs text-gray-400 mt-1">
                              Admin
                            </span>
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
                        Task Start Date & Time
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
                    {filteredHistoryData.length > 0 ? (
                      filteredHistoryData.map((history) => {
                        const isInEditMode = editingRows.has(history._id);
                        const isSaving = savingEdits.has(history._id);

                        return (
                          <tr key={history._id} className="hover:bg-gray-50">
                            {/* FIRST: Admin Done Column with Edit functionality */}
                            {isAdmin && (
                              <td className="px-3 py-4 bg-gray-50 min-w-[160px]">
                                {isInEditMode ? (
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
                                      {!isEmpty(history["col15"]) &&
                                        history["col15"].toString().trim() ===
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
                                      ) : !isEmpty(history["col15"]) &&
                                        history["col15"].toString().trim() ===
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
                                )}
                              </td>
                            )}

                            {/* SECOND: Admin Select Checkbox - Hide for Done and Not Done items */}
                            {isAdmin && (
                              <td className="px-3 py-4 w-12">
                                {!isEmpty(history["col15"]) &&
                                  (history["col15"].toString().trim() ===
                                    "Done" ||
                                    history["col15"].toString().trim() ===
                                    "Not Done") ? (
                                  // Already processed - show status only
                                  <div className="flex flex-col items-center">
                                    <div
                                      className={`h-4 w-4 rounded border-gray-300 ${history["col15"].toString().trim() ===
                                        "Done"
                                        ? "text-green-600 bg-green-100"
                                        : "text-red-600 bg-red-100"
                                        }`}
                                    >
                                      <span
                                        className={`text-xs ${history["col15"].toString().trim() ===
                                          "Done"
                                          ? "text-green-600"
                                          : "text-red-600"
                                          }`}
                                      >
                                        {history["col15"].toString().trim() ===
                                          "Done"
                                          ? "✓"
                                          : "✗"}
                                      </span>
                                    </div>
                                    <span
                                      className={`text-xs mt-1 text-center break-words ${history["col15"].toString().trim() ===
                                        "Done"
                                        ? "text-green-600"
                                        : "text-red-600"
                                        }`}
                                    >
                                      {history["col15"].toString().trim()}
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
                                              (item) =>
                                                item._id !== history._id
                                            )
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

                            {/* Rest of the columns remain the same order */}
                            {/* Hide Task ID column for admin in history view */}
                            {!isAdmin && (
                              <td className="px-3 py-4 min-w-[100px]">
                                <div className="text-sm font-medium text-gray-900 break-words">
                                  {history["col1"] || "—"}
                                </div>
                              </td>
                            )}

                            {/* Hide Department Name column for admin in history view */}
                            {!isAdmin && isAdmin && (
                              <td className="px-3 py-4 min-w-[120px]">
                                <div className="text-sm text-gray-900 break-words">
                                  {history["col2"] || "—"}
                                </div>
                              </td>
                            )}

                            {/* Hide Given By column for admin in history view */}
                            {!isAdmin && isAdmin && (
                              <td className="px-3 py-4 min-w-[100px]">
                                <div className="text-sm text-gray-900 break-words">
                                  {history["col3"] || "—"}
                                </div>
                              </td>
                            )}

                            {/* Hide Name column for admin in history view */}
                            {!isAdmin && isAdmin && (
                              <td className="px-3 py-4 min-w-[100px]">
                                <div className="text-sm text-gray-900 break-words">
                                  {history["col4"] || "—"}
                                </div>
                              </td>
                            )}
                            <td className="px-3 py-4 min-w-[200px]">
                              <div
                                className="text-sm text-gray-900 break-words"
                                title={history["col5"]}
                              >
                                {history["col5"] || "—"}
                              </div>
                            </td>
                            <td className="px-3 py-4 bg-yellow-50 min-w-[140px]">
                              <div className="text-sm text-gray-900 break-words">
                                {history["col6"] ? (
                                  <div>
                                    <div className="font-medium break-words">
                                      {history["col6"].includes(" ")
                                        ? history["col6"].split(" ")[0]
                                        : history["col6"]}
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
                            {/* Hide Enable Reminders column for admin in history view */}
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
                                      {history["col10"].includes(" ")
                                        ? history["col10"].split(" ")[0]
                                        : history["col10"]}
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
                              <div
                                className="text-sm text-gray-900 break-words"
                                title={history["col13"]}
                              >
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
                                    src={
                                      history["col14"] ||
                                      "/placeholder.svg?height=32&width=32"
                                    }
                                    alt="Attachment"
                                    className="h-8 w-8 object-cover rounded-md mr-2 flex-shrink-0"
                                  />
                                  <span className="break-words">View</span>
                                </a>
                              ) : (
                                <span className="text-gray-400">
                                  No attachment
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        {/* Update colspan calculation based on hidden columns and new order */}
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
                          {searchTerm ||
                            selectedMembers.length > 0 ||
                            startDate ||
                            endDate
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
            <>
              {/* /* Regular Tasks Table - Optimized for performance */}
              <div className="hidden sm:block h-[calc(100vh-250px)] overflow-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          checked={
                            filteredAccountData.length > 0 &&
                            selectedItems.size === filteredAccountData.length
                          }
                          onChange={handleSelectAllItems}
                        />
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                        Task ID
                      </th>
                      {isAdmin && (
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                          Department Name
                        </th>
                      )}
                      {isAdmin && (
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                          Given By
                        </th>
                      )}
                      {isAdmin && (
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                          Name
                        </th>
                      )}
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
                        Task Description
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-yellow-50 min-w-[140px]">
                        Task Start Date & Time
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">
                        Freq
                      </th>
                      {/* Enable Reminders - only for admin */}
                      {isAdmin && (
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                          Enable Reminders
                        </th>
                      )}
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
                        const isSelected = selectedItems.has(account._id);
                        return (
                          <tr
                            key={account._id}
                            className={`${isSelected ? "bg-purple-50" : ""
                              } hover:bg-gray-50`}
                          >
                            <td className="px-3 py-4 w-12 relative">
                              {/* Status Label - Fixed positioning */}
                              <div className="absolute -top-2 -left-1 right-0 mx-auto z-10 whitespace-nowrap text-xs font-bold px-2 py-1 rounded-md shadow-md w-fit">
                                {(() => {
                                  const dateStr = account["col6"] || "";
                                  if (!dateStr) return null;

                                  const datePart = dateStr.split(" ")[0];
                                  const parsedDate = parseDateFromDDMMYYYY(datePart);
                                  if (!parsedDate) return null;

                                  const today = new Date();
                                  today.setHours(0, 0, 0, 0);

                                  const taskDate = new Date(parsedDate);
                                  taskDate.setHours(0, 0, 0, 0);

                                  const timeDiff = taskDate.getTime() - today.getTime();
                                  const dayDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

                                  if (dayDiff === 0) {
                                    return (
                                      <div className="bg-amber-500 text-white text-center px-2 min-w-[65px]">
                                        TODAY
                                      </div>
                                    );
                                  } else if (dayDiff < 0) {
                                    return (
                                      <div className="bg-red-600 text-white text-center px-2 min-w-[65px]">
                                        OVERDUE
                                      </div>
                                    );
                                  } else if (dayDiff > 0) {
                                    return (
                                      <div className="bg-blue-500 text-white text-center px-2 min-w-[65px]">
                                        UPCOMING
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>

                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                checked={isSelected}
                                onChange={(e) => handleCheckboxClick(e, account._id)}
                              />
                            </td>
                            <td className="px-3 py-4 min-w-[100px]">
                              <div className="text-sm text-gray-900 break-words">
                                {account["col1"] || "—"}
                              </div>
                            </td>
                            {isAdmin && (
                              <td className="px-3 py-4 min-w-[120px]">
                                <div className="text-sm text-gray-900 break-words">
                                  {account["col2"] || "—"}
                                </div>
                              </td>
                            )}
                            {isAdmin && (
                              <td className="px-3 py-4 min-w-[100px]">
                                <div className="text-sm text-gray-900 break-words">
                                  {account["col3"] || "—"}
                                </div>
                              </td>
                            )}
                            {isAdmin && (
                              <td className="px-3 py-4 min-w-[100px]">
                                <div className="text-sm text-gray-900 break-words">
                                  {account["col4"] || "—"}
                                </div>
                              </td>
                            )}
                            <td className="px-3 py-4 min-w-[200px]">
                              <div
                                className="text-sm text-gray-900 break-words"
                                title={account["col5"]}
                              >
                                {account["col5"] || "—"}
                              </div>
                            </td>
                            <td className="px-3 py-4 bg-yellow-50 min-w-[140px]">
                              <div className="text-sm text-gray-900 break-words">
                                {account["col6"] ? (
                                  <div>
                                    <div className="font-medium break-words">
                                      {account["col6"].includes(" ")
                                        ? account["col6"].split(" ")[0]
                                        : account["col6"]}
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
                              <div className="text-sm text-gray-900 break-words">
                                {account["col7"] || "—"}
                              </div>
                            </td>
                            {isAdmin && (
                              <td className="px-3 py-4 min-w-[120px]">
                                <div className="text-sm text-gray-900 break-words">
                                  {account["col8"] || "—"}
                                </div>
                              </td>
                            )}
                            <td className="px-3 py-4 min-w-[120px]">
                              <div className="text-sm text-gray-900 break-words">
                                {account["col9"] || "—"}
                              </div>
                            </td>
                            <td className="px-3 py-4 bg-yellow-50 min-w-[100px]">
                              <select
                                disabled={!isSelected}
                                value={additionalData[account._id] || ""}
                                onChange={(e) => {
                                  setAdditionalData((prev) => ({
                                    ...prev,
                                    [account._id]: e.target.value,
                                  }));
                                  if (e.target.value !== "No") {
                                    setRemarksData((prev) => {
                                      const newData = { ...prev };
                                      delete newData[account._id];

                                      // console.log("new DAta",newData);
                                      return newData;
                                    });
                                  }
                                }}
                                className="border border-gray-300 rounded-md px-2 py-1 w-full disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
                              >
                                <option value="">Select...</option>
                                <option value="Yes">Yes</option>
                                <option value="Not Done">Not Done</option>
                              </select>
                            </td>
                            <td className="px-3 py-4 bg-orange-50 min-w-[150px]">
                              <input
                                type="text"
                                placeholder="Enter remarks"
                                disabled={
                                  !isSelected || !additionalData[account._id]
                                }
                                value={remarksData[account._id] || ""}
                                onChange={(e) =>
                                  setRemarksData((prev) => ({
                                    ...prev,
                                    [account._id]: e.target.value,
                                  }))
                                }
                                className="border rounded-md px-2 py-1 w-full border-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm break-words"
                              />
                            </td>
                            {/* Upload Image Column - DESKTOP */}
                            <td className={`px-6 py-4 min-w-[150px] ${!account["col17"] ? "bg-orange-50" : ""}`}>
                              {account.image ? (
                                // ✅ SHOW UPLOADED IMAGE
                                <div className="flex items-center">
                                  <img
                                    src={typeof account.image === "string" ? account.image : URL.createObjectURL(account.image)}
                                    alt="Receipt"
                                    className="h-10 w-10 object-cover rounded-md mr-2 flex-shrink-0"
                                  />
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-xs text-gray-500 break-words">
                                      {account.image instanceof File ? account.image.name : "Uploaded"}
                                    </span>
                                    {account.image instanceof File ? (
                                      <span className="text-xs text-green-600">Ready to upload</span>
                                    ) : (
                                      <button
                                        className="text-xs text-purple-600 hover:text-purple-800 break-words"
                                        onClick={() => window.open(account.image, "_blank")}
                                      >
                                        View Image
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                // ✅ SHOW UPLOAD OPTIONS
                                <div className="flex flex-col gap-2">

                                  {/* ✅ CAMERA BUTTON - Opens Modal */}
                                  {/* <button
        onClick={() => {
          if (!isSelected) return;
          console.log("📸 Opening camera for:", account._id);
          setCurrentCaptureId(account._id);
          startCamera();
        }}
        disabled={!isSelected || isCameraLoading}
        className={`flex items-center justify-start px-2 py-1 rounded text-xs font-medium transition-colors ${
          isSelected 
            ? "text-blue-600 hover:text-blue-800 hover:bg-blue-50" 
            : "text-gray-400 cursor-not-allowed"
        } disabled:opacity-50`}
      >
        <Camera className="h-4 w-4 mr-1 flex-shrink-0" />
        <span>{isCameraLoading ? "Loading..." : "Take Photo"}</span>
      </button> */}

                                  {/* ✅ FILE UPLOAD BUTTON - Opens File Picker */}
                                  <label
                                    htmlFor={`upload-${account._id}`}
                                    className={`flex items-center justify-start px-2 py-1 rounded text-xs font-medium transition-colors ${isSelected
                                      ? account["col9"]?.toUpperCase() === "YES"
                                        ? "text-red-600 hover:text-red-800 hover:bg-red-50 cursor-pointer"
                                        : "text-purple-600 hover:text-purple-800 hover:bg-purple-50 cursor-pointer"
                                      : "text-gray-400 cursor-not-allowed"
                                      }`}
                                  >
                                    <Upload className="h-4 w-4 mr-1 flex-shrink-0" />
                                    <span className="break-words">
                                      {account["col9"]?.toUpperCase() === "YES" ? "Upload (Required*)" : "Upload from File"}
                                    </span>
                                  </label>

                                  <input
                                    id={`upload-${account._id}`}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      console.log("📁 File selected for:", account._id);
                                      handleImageUpload(account._id, e);
                                    }}
                                    disabled={!isSelected}
                                  />
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td
                          colSpan={isAdmin ? 13 : 9}
                          className="px-6 py-4 text-center text-gray-500"
                        >
                          {searchTerm
                            ? "No tasks matching your search"
                            : "No pending tasks found for today, tomorrow, or past due dates"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View for Regular Tasks */}
              <div className="sm:hidden space-y-4 p-4 max-h-[calc(100vh-250px)] overflow-auto">
                {filteredAccountData.length > 0 ? (
                  filteredAccountData.map((account) => {
                    const isSelected = selectedItems.has(account._id);
                    return (
                      <div
                        key={account._id}
                        className={`bg-white border border-gray-200 rounded-lg p-4 shadow-sm ${isSelected ? "bg-purple-50 border-purple-200" : ""
                          }`}
                      >
                        <div className="space-y-3">
                          {/* Checkbox */}
                          <div className="flex justify-between items-center border-b pb-2">
                            <span className="font-medium text-gray-700">
                              Select:
                            </span>
                            <input
                              type="checkbox"
                              className="h-5 w-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                              checked={isSelected}
                              onChange={(e) =>
                                handleCheckboxClick(e, account._id)
                              }
                            />
                          </div>

                          {/* Task ID */}
                          <div className="flex justify-between items-center border-b pb-2">
                            <span className="font-medium text-gray-700">
                              Task ID:
                            </span>
                            <div className="text-sm text-gray-900 break-words">
                              {account["col1"] || "—"}
                            </div>
                          </div>

                          {/* Department Name (Admin only) */}
                          {isAdmin && (
                            <div className="flex justify-between items-center border-b pb-2">
                              <span className="font-medium text-gray-700">
                                Department:
                              </span>
                              <div className="text-sm text-gray-900 break-words">
                                {account["col2"] || "—"}
                              </div>
                            </div>
                          )}

                          {/* Given By (Admin only) */}
                          {isAdmin && (
                            <div className="flex justify-between items-center border-b pb-2">
                              <span className="font-medium text-gray-700">
                                Given By:
                              </span>
                              <div className="text-sm text-gray-900 break-words">
                                {account["col3"] || "—"}
                              </div>
                            </div>
                          )}

                          {/* Name (Admin only) */}
                          {isAdmin && (
                            <div className="flex justify-between items-center border-b pb-2">
                              <span className="font-medium text-gray-700">
                                Name:
                              </span>
                              <div className="text-sm text-gray-900 break-words">
                                {account["col4"] || "—"}
                              </div>
                            </div>
                          )}

                          {/* Task Description */}
                          <div className="flex justify-between items-start border-b pb-2">
                            <span className="font-medium text-gray-700">
                              Description:
                            </span>
                            <div className="text-sm text-gray-900 break-words text-right max-w-[60%]">
                              {account["col5"] || "—"}
                            </div>
                          </div>

                          {/* Task Start Date */}
                          <div className="flex justify-between items-center border-b pb-2">
                            <span className="font-medium text-gray-700">
                              Start Date:
                            </span>
                            <div className="text-sm text-gray-900 break-words text-right">
                              {account["col6"] ? (
                                <div>
                                  <div className="font-medium break-words">
                                    {account["col6"].includes(" ")
                                      ? account["col6"].split(" ")[0]
                                      : account["col6"]}
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
                          </div>

                          {/* Freq */}
                          <div className="flex justify-between items-center border-b pb-2">
                            <span className="font-medium text-gray-700">
                              Frequency:
                            </span>
                            <div className="text-sm text-gray-900 break-words">
                              {account["col7"] || "—"}
                            </div>
                          </div>

                          {/* Enable Reminders (Admin only) */}
                          {isAdmin && (
                            <div className="flex justify-between items-center border-b pb-2">
                              <span className="font-medium text-gray-700">
                                Reminders:
                              </span>
                              <div className="text-sm text-gray-900 break-words">
                                {account["col8"] || "—"}
                              </div>
                            </div>
                          )}

                          {/* Require Attachment */}
                          <div className="flex justify-between items-center border-b pb-2">
                            <span className="font-medium text-gray-700">
                              Attachment Required:
                            </span>
                            <div className="text-sm text-gray-900 break-words">
                              {account["col9"] || "—"}
                            </div>
                          </div>

                          {/* Status */}
                          <div className="flex justify-between items-center border-b pb-2">
                            <span className="font-medium text-gray-700">
                              Status:
                            </span>
                            <select
                              disabled={!isSelected}
                              value={additionalData[account._id] || ""}
                              onChange={(e) => {
                                setAdditionalData((prev) => ({
                                  ...prev,
                                  [account._id]: e.target.value,
                                }));
                                if (e.target.value !== "No") {
                                  setRemarksData((prev) => {
                                    const newData = { ...prev };
                                    delete newData[account._id];
                                    return newData;
                                  });
                                }
                              }}
                              className="border border-gray-300 rounded-md px-2 py-1 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
                            >
                              <option value="">Select...</option>
                              <option value="Yes">Yes</option>
                              <option value="Not Done">Not Done</option>
                            </select>
                          </div>

                          {/* Remarks */}
                          <div className="flex justify-between items-start border-b pb-2">
                            <span className="font-medium text-gray-700">
                              Remarks:
                            </span>
                            <input
                              type="text"
                              placeholder="Enter remarks"
                              disabled={
                                !isSelected || !additionalData[account._id]
                              }
                              value={remarksData[account._id] || ""}
                              onChange={(e) =>
                                setRemarksData((prev) => ({
                                  ...prev,
                                  [account._id]: e.target.value,
                                }))
                              }
                              className="border rounded-md px-2 py-1 border-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm break-words w-32"
                            />
                          </div>

                          {/* ✅ MOBILE: Upload Image Section */}
                          <div className="border-b pb-3">
                            <span className="font-medium text-gray-700 block mb-2">Upload Image:</span>

                            {account.image ? (
                              // ✅ SHOW UPLOADED IMAGE
                              <div className="flex items-center mt-2">
                                <img
                                  src={
                                    typeof account.image === "string"
                                      ? account.image
                                      : URL.createObjectURL(account.image)
                                  }
                                  alt="Receipt"
                                  className="h-12 w-12 object-cover rounded-md mr-3"
                                />
                                <div className="flex flex-col">
                                  <span className="text-sm text-gray-700 font-medium">
                                    {account.image instanceof File ? account.image.name : "Uploaded Image"}
                                  </span>
                                  {account.image instanceof File ? (
                                    <span className="text-xs text-green-600">✓ Ready to upload</span>
                                  ) : (
                                    <button
                                      className="text-xs text-purple-600 hover:text-purple-800 text-left"
                                      onClick={() => window.open(account.image, "_blank")}
                                    >
                                      View Full Image →
                                    </button>
                                  )}
                                </div>
                              </div>
                            ) : (
                              // ✅ SHOW UPLOAD OPTIONS
                              <div className="flex flex-col gap-3 mt-2">

                                {/* ✅ CAMERA BUTTON */}
                                {/* <button
        onClick={() => {
          if (!isSelected) return;
          console.log("📸 Opening camera for:", account._id);
          setCurrentCaptureId(account._id);
          startCamera();
        }}
        disabled={!isSelected || isCameraLoading}
        className={`flex items-center justify-center px-4 py-3 rounded-lg border-2 text-sm font-semibold transition-all ${
          isSelected 
            ? "bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100 hover:shadow-md active:scale-95" 
            : "bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed"
        } disabled:opacity-50`}
      >
        <Camera className="h-5 w-5 mr-2" />
        <span>{isCameraLoading ? "Loading Camera..." : "📸 Take Photo"}</span>
      </button> */}

                                {/* ✅ FILE UPLOAD BUTTON */}
                                <label
                                  className={`flex items-center justify-center px-4 py-3 rounded-lg border-2 text-sm font-semibold transition-all ${isSelected
                                    ? account["col9"]?.toUpperCase() === "YES"
                                      ? "bg-red-50 border-red-300 text-red-700 hover:bg-red-100 hover:shadow-md active:scale-95 cursor-pointer"
                                      : "bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100 hover:shadow-md active:scale-95 cursor-pointer"
                                    : "bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed"
                                    } ${!isSelected ? "pointer-events-none" : ""}`}
                                >
                                  <Upload className="h-5 w-5 mr-2" />
                                  <span>
                                    {account["col9"]?.toUpperCase() === "YES"
                                      ? "📁 Upload (Required*)"
                                      : "📁 Upload from Gallery"}
                                  </span>
                                  <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={(e) => {
                                      console.log("📁 File selected for:", account._id);
                                      handleImageUpload(account._id, e);
                                    }}
                                    disabled={!isSelected}
                                  />
                                </label>

                                {account["col9"]?.toUpperCase() === "YES" && (
                                  <p className="text-xs text-red-600 text-center">
                                    ⚠️ Image upload is mandatory for this task
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    {searchTerm
                      ? "No tasks matching your search"
                      : "No pending tasks found for today, tomorrow, or past due dates"}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        {isCameraOpen && (
          <div className="fixed inset-0 bg-black z-[9999] flex flex-col">

            {/* Header */}
            <div className="bg-black text-white px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between border-b border-gray-800">
              <div className="flex items-center gap-2 sm:gap-3">
                <Camera className="w-5 h-5 sm:w-6 sm:h-6" />
                <span className="font-medium text-base sm:text-lg">Take Photo</span>
              </div>
              <button
                onClick={stopCamera}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                aria-label="Close camera"
              >
                <X className="w-6 h-6 sm:w-7 sm:h-7" />
              </button>
            </div>

            {/* Video Preview Area */}
            <div className="flex-1 relative bg-black overflow-hidden">
              <video
                ref={videoRef}
                className="w-full h-full object-contain bg-black"
                autoPlay
                playsInline
                muted
                style={{
                  WebkitTransform: 'scaleX(-1)',
                  transform: 'scaleX(-1)'
                }}
              />

              {/* Loading Overlay */}
              {isCameraLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-90">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-4 border-white border-t-transparent mx-auto mb-4"></div>
                    <p className="text-white font-medium text-base sm:text-lg">Initializing camera...</p>
                    <p className="text-gray-300 text-sm sm:text-base mt-2">Please wait</p>
                  </div>
                </div>
              )}

              {/* Camera Guide/Overlay */}
              {!isCameraLoading && !cameraError && (
                <>
                  {/* Desktop guide (crosshair) */}
                  <div className="hidden sm:block absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="relative">
                      <div className="border-2 border-white/60 border-dashed rounded-xl w-80 h-80"></div>
                      <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/40"></div>
                      <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/40"></div>
                    </div>
                  </div>

                  {/* Mobile guide (simpler) */}
                  <div className="sm:hidden absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="border-2 border-white/50 border-dashed rounded-lg w-4/5 h-1/2"></div>
                  </div>
                </>
              )}

              {/* Error Display */}
              {cameraError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/95 p-4">
                  <div className="max-w-md text-center">
                    <div className="w-16 h-16 bg-red-900/80 rounded-full flex items-center justify-center mx-auto mb-4">
                      <X className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Camera Error</h3>
                    <p className="text-gray-200 mb-4">{cameraError}</p>
                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={stopCamera}
                        className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                      >
                        Close
                      </button>
                      <button
                        onClick={startCamera}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Camera Controls */}
            <div className="bg-gradient-to-t from-black/95 to-black/80 p-4 sm:p-6">
              {/* Capture Button (Center) */}
              <div className="flex justify-center mb-4">
                <button
                  onClick={capturePhoto}
                  disabled={isCameraLoading || !!cameraError}
                  className={`
            relative w-20 h-20 sm:w-24 sm:h-24 rounded-full 
            flex items-center justify-center
            ${isCameraLoading || cameraError
                      ? 'bg-gray-600 cursor-not-allowed'
                      : 'bg-white hover:bg-gray-100 active:scale-95'
                    }
            transition-all duration-200
            shadow-2xl
          `}
                  aria-label="Capture photo"
                >
                  {/* Outer ring */}
                  <div className="absolute inset-0 border-4 border-white/30 rounded-full"></div>

                  {/* Inner circle */}
                  <div className={`
            w-16 h-16 sm:w-20 sm:h-20 rounded-full
            ${isCameraLoading || cameraError ? 'bg-gray-500' : 'bg-white'}
            flex items-center justify-center
          `}>
                    {isCameraLoading ? (
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-black border-t-transparent"></div>
                    ) : cameraError ? (
                      <X className="w-8 h-8 sm:w-10 sm:h-10 text-black" />
                    ) : (
                      <Camera className="w-8 h-8 sm:w-10 sm:h-10 text-black" />
                    )}
                  </div>
                </button>
              </div>

              {/* Instructions */}
              <div className="text-center">
                <p className="text-white/80 text-sm sm:text-base">
                  {isCameraLoading
                    ? "Initializing camera..."
                    : cameraError
                      ? "Fix camera error to continue"
                      : "Center the subject and tap the button above"
                  }
                </p>
                <p className="text-white/60 text-xs sm:text-sm mt-2">
                  {currentCaptureId ? `Task: ${currentCaptureId}` : "No task selected"}
                </p>
              </div>

              {/* Additional Controls for Desktop */}
              <div className="hidden sm:flex justify-between items-center mt-4 pt-4 border-t border-white/20">
                <div className="text-white/70 text-sm">
                  Press <kbd className="px-2 py-1 bg-gray-800 rounded">Esc</kbd> to close
                </div>
                <div className="text-white/70 text-sm">
                  Use <kbd className="px-2 py-1 bg-gray-800 rounded">Space</kbd> to capture
                </div>
              </div>
            </div>

            {/* Keyboard Shortcuts for Desktop */}
            {!isCameraLoading && !cameraError && (
              <div className="hidden">
                {/* Hidden button for keyboard capture */}
                <button
                  ref={captureBtnRef}
                  onClick={capturePhoto}
                  style={{ display: 'none' }}
                >
                  Capture
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout >
  );
}

export default AccountDataPage;
