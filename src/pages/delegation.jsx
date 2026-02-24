"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  CheckCircle2,
  Upload,
  X,
  Search,
  History,
  ArrowLeft,
  Filter,
  ChevronDown,
  Camera,
} from "lucide-react";
import AdminLayout from "../components/layout/AdminLayout";
import { getUserRole, getUsername, isAdminUser } from "../utils/authUtils";

// Configuration object - Move all configurations here
const CONFIG = {
  // Google Apps Script URL
  APPS_SCRIPT_URL:
    "https://script.google.com/macros/s/AKfycbyGf3LdYk6MPiOs_shPU9_AW7wmRjJZ4QxMk9qYqTScsDMB7IliaWRB1HueYy7w5qxqNw/exec",

  // Google Drive folder ID for file uploads
  DRIVE_FOLDER_ID: "16dsqFDV5s6un6ygwlUp7MMr6AHLcrWk-",

  // Sheet names
  SOURCE_SHEET_NAME: "Delegation",
  TARGET_SHEET_NAME: "DELEGATION DONE",

  // Page configuration
  PAGE_CONFIG: {
    title: "DELEGATION Tasks",
    historyTitle: "DELEGATION Task History",
    description: "Showing all pending tasks",
    historyDescription:
      "Read-only view of completed tasks with submission history",
  },
};

// Debounce hook for search optimization
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

function DelegationDataPage() {
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
  const [statusData, setStatusData] = useState({});
  const [nextTargetDate, setNextTargetDate] = useState({});
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  // UPDATED: Always set to 'super_admin' for unrestricted access
  const [userRole, setUserRole] = useState("super_admin");
  const [username, setUsername] = useState("");
  // UPDATED: Always true for super_admin access
  const isAdmin = true;
  const [nameFilter, setNameFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState({
    name: false,
    department: false,
  });

  // Debounced search term for better performance
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState("");
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [currentCaptureId, setCurrentCaptureId] = useState(null);


  // Add these refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const dropdownRef = useRef(null);

  // Add click outside listener to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen({ name: false, department: false });
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Add camera cleanup useEffect (after other useEffects)
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  // Add these camera functions (after other functions, before handleSubmit)
  const startCamera = async () => {
    try {
      setCameraError("");
      setIsCameraLoading(true);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError("Camera not supported on this device");
        setIsCameraLoading(false);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      setCameraStream(stream);
      setIsCameraOpen(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        await new Promise((resolve, reject) => {
          const video = videoRef.current;
          if (!video) {
            reject(new Error("Video ref lost"));
            return;
          }

          let metadataLoaded = false;
          let canPlay = false;

          const checkReady = () => {
            if (metadataLoaded && canPlay) {
              resolve();
            }
          };

          video.onloadedmetadata = () => {
            metadataLoaded = true;
            checkReady();
          };

          video.oncanplay = () => {
            canPlay = true;
            checkReady();
          };

          video.onerror = (err) => {
            reject(err);
          };

          setTimeout(() => {
            if (!metadataLoaded || !canPlay) {
              reject(new Error("Video initialization timeout"));
            }
          }, 10000);
        });

        await videoRef.current.play();
      }

    } catch (error) {
      console.error("Camera error:", error);

      if (error.name === 'NotAllowedError') {
        setCameraError("Camera access denied. Please allow camera permissions.");
      } else if (error.name === 'NotFoundError') {
        setCameraError("No camera found on this device.");
      } else if (error.name === 'NotReadableError') {
        setCameraError("Camera is being used by another application.");
      } else {
        setCameraError("Unable to access camera: " + error.message);
      }
    } finally {
      setIsCameraLoading(false);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => {
        track.stop();
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
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !currentCaptureId) {
      alert("Camera not initialized. Please try again.");
      return;
    }

    const video = videoRef.current;

    try {
      if (video.readyState < 2) {
        alert("Camera is still loading. Please wait a moment and try again.");
        return;
      }

      if (!video.videoWidth || !video.videoHeight) {
        alert("Camera dimensions not available. Please restart camera.");
        return;
      }

      if (!cameraStream || !cameraStream.active) {
        alert("Camera stream not active. Please restart camera.");
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const context = canvas.getContext('2d');
      if (!context) {
        alert("Failed to create canvas context");
        return;
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Failed to create blob"));
            }
          },
          'image/jpeg',
          0.92
        );
      });

      const file = new File(
        [blob],
        `camera-${Date.now()}.jpg`,
        { type: 'image/jpeg' }
      );

      stopCamera();

      handleImageUpload(currentCaptureId, { target: { files: [file] } });

      alert("✅ Photo captured successfully!");

    } catch (error) {
      console.error("❌ Capture error:", error);
      alert("Failed to capture photo: " + error.message);
    }
  };

  // NEW: Function to format date to DD/MM/YYYY HH:MM:SS
  const formatDateTimeToDDMMYYYY = useCallback((date) => {
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  }, []);

  const formatDateToDDMMYYYY = useCallback((date) => {
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }, []);

  // NEW: Function to create a proper datetime object for Google Sheets
  const createGoogleSheetsDateTime = useCallback((date) => {
    // Return a Date object that Google Sheets can properly interpret with time
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      date.getSeconds()
    );
  }, []);

  // NEW: Function to format datetime for Google Sheets submission
  const formatDateTimeForGoogleSheets = useCallback((date) => {
    // Create a properly formatted datetime string that Google Sheets will recognize
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");

    return {
      formatted: `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`,
      dateObject: new Date(
        year,
        date.getMonth(),
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
        date.getSeconds()
      ),
      iso: date.toISOString(),
      googleSheetsValue: `=DATETIME(${year},${month},${day},${hours},${minutes},${seconds})`,
    };
  }, []);

  // Function to format date for Google Sheets submission (date only)
  const formatDateForGoogleSheets = useCallback((date) => {
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();

    return {
      formatted: `${day}/${month}/${year}`,
      dateObject: new Date(year, date.getMonth(), date.getDate()),
      iso: date.toISOString().split("T")[0],
      googleSheetsValue: `=DATE(${year},${month},${day})`,
    };
  }, []);

  // NEW: Function to convert DD/MM/YYYY HH:MM:SS string to Google Sheets datetime format
  const convertToGoogleSheetsDateTime = useCallback(
    (dateTimeString) => {
      if (!dateTimeString || typeof dateTimeString !== "string") return "";

      // Handle DD/MM/YYYY HH:MM:SS format
      const dateTimeRegex =
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/;
      const match = dateTimeString.match(dateTimeRegex);

      if (match) {
        const [, day, month, year, hours, minutes, seconds] = match;
        const date = new Date(year, month - 1, day, hours, minutes, seconds);
        if (!isNaN(date.getTime())) {
          return formatDateTimeForGoogleSheets(date);
        }
      }

      // If only date provided, add current time for extend date
      if (dateTimeString.includes("/") && !dateTimeString.includes(":")) {
        const [day, month, year] = dateTimeString.split("/");
        const currentDate = new Date();
        const date = new Date(
          year,
          month - 1,
          day,
          currentDate.getHours(),
          currentDate.getMinutes(),
          currentDate.getSeconds()
        );
        if (!isNaN(date.getTime())) {
          return formatDateTimeForGoogleSheets(date);
        }
      }

      // If in YYYY-MM-DD format (from HTML date input), add current time
      if (dateTimeString.includes("-") && !dateTimeString.includes(":")) {
        const [year, month, day] = dateTimeString.split("-");
        const currentDate = new Date();
        const date = new Date(
          year,
          month - 1,
          day,
          currentDate.getHours(),
          currentDate.getMinutes(),
          currentDate.getSeconds()
        );
        if (!isNaN(date.getTime())) {
          return formatDateTimeForGoogleSheets(date);
        }
      }

      return {
        formatted: dateTimeString,
        dateObject: null,
        iso: "",
        googleSheetsValue: dateTimeString,
      };
    },
    [formatDateTimeForGoogleSheets]
  );

  // NEW: Function to convert DD/MM/YYYY string to Google Sheets date format
  const convertToGoogleSheetsDate = useCallback(
    (dateString) => {
      if (!dateString || typeof dateString !== "string") return "";

      // If already in DD/MM/YYYY format
      if (dateString.includes("/")) {
        const [day, month, year] = dateString.split("/");
        const date = new Date(year, month - 1, day);
        if (!isNaN(date.getTime())) {
          return formatDateForGoogleSheets(date);
        }
      }

      // If in YYYY-MM-DD format (from HTML date input)
      if (dateString.includes("-")) {
        const [year, month, day] = dateString.split("-");
        const date = new Date(year, month - 1, day);
        if (!isNaN(date.getTime())) {
          return formatDateForGoogleSheets(date);
        }
      }

      return {
        formatted: dateString,
        dateObject: null,
        iso: "",
        googleSheetsValue: dateString,
      };
    },
    [formatDateForGoogleSheets]
  );

  const isEmpty = useCallback((value) => {
    return (
      value === null ||
      value === undefined ||
      (typeof value === "string" && value.trim() === "")
    );
  }, []);

  useEffect(() => {
    // UPDATED: Use authUtils for super_admin access
    const role = getUserRole(); // Always returns 'super_admin'
    const user = getUsername();
    setUserRole(role);
    setUsername(user);
  }, []);

  // NEW: Parse Google Sheets datetime with support for DD/MM/YYYY HH:MM:SS format
  const parseGoogleSheetsDateTime = useCallback(
    (dateTimeStr) => {
      if (!dateTimeStr) return "";

      // If it's already in DD/MM/YYYY HH:MM:SS format, return as is
      if (
        typeof dateTimeStr === "string" &&
        dateTimeStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{1,2}:\d{1,2}$/)
      ) {
        // Ensure proper padding for DD/MM/YYYY HH:MM:SS format
        const [datePart, timePart] = dateTimeStr.split(" ");
        const [day, month, year] = datePart.split("/");
        const [hours, minutes, seconds] = timePart.split(":");

        const paddedDay = day.padStart(2, "0");
        const paddedMonth = month.padStart(2, "0");
        const paddedHours = hours.padStart(2, "0");
        const paddedMinutes = minutes.padStart(2, "0");
        const paddedSeconds = seconds.padStart(2, "0");

        return `${paddedDay}/${paddedMonth}/${year} ${paddedHours}:${paddedMinutes}:${paddedSeconds}`;
      }

      // If it's only date format DD/MM/YYYY, add default time 00:00:00
      if (
        typeof dateTimeStr === "string" &&
        dateTimeStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)
      ) {
        const parts = dateTimeStr.split("/");
        if (parts.length === 3) {
          const day = parts[0].padStart(2, "0");
          const month = parts[1].padStart(2, "0");
          const year = parts[2];
          return `${day}/${month}/${year} 00:00:00`;
        }
        return dateTimeStr + " 00:00:00";
      }

      // Handle Google Sheets Date() format
      if (typeof dateTimeStr === "string" && dateTimeStr.startsWith("Date(")) {
        const match = /Date\((\d+),(\d+),(\d+)\)/.exec(dateTimeStr);
        if (match) {
          const year = Number.parseInt(match[1], 10);
          const month = Number.parseInt(match[2], 10);
          const day = Number.parseInt(match[3], 10);
          return `${day.toString().padStart(2, "0")}/${(month + 1)
            .toString()
            .padStart(2, "0")}/${year} 00:00:00`;
        }
      }

      // Handle other date formats
      try {
        const date = new Date(dateTimeStr);
        if (!isNaN(date.getTime())) {
          // Check if it has time component
          if (dateTimeStr.includes(":") || dateTimeStr.includes("T")) {
            return formatDateTimeToDDMMYYYY(date);
          } else {
            // If no time component, add 00:00:00
            return formatDateToDDMMYYYY(date) + " 00:00:00";
          }
        }
      } catch (error) {
        console.error("Error parsing datetime:", error);
      }

      // If all else fails, add 00:00:00 if it looks like a date
      if (
        typeof dateTimeStr === "string" &&
        dateTimeStr.includes("/") &&
        !dateTimeStr.includes(":")
      ) {
        return dateTimeStr + " 00:00:00";
      }

      // If all else fails, return the original string
      return dateTimeStr;
    },
    [formatDateTimeToDDMMYYYY, formatDateToDDMMYYYY]
  );

  const parseGoogleSheetsDate = useCallback(
    (dateStr) => {
      if (!dateStr) return "";

      // If it's already in DD/MM/YYYY format, return as is
      if (
        typeof dateStr === "string" &&
        dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)
      ) {
        // Ensure proper padding for DD/MM/YYYY format
        const parts = dateStr.split("/");
        if (parts.length === 3) {
          const day = parts[0].padStart(2, "0");
          const month = parts[1].padStart(2, "0");
          const year = parts[2];
          return `${day}/${month}/${year}`;
        }
        return dateStr;
      }

      // Handle Google Sheets Date() format
      if (typeof dateStr === "string" && dateStr.startsWith("Date(")) {
        const match = /Date\((\d+),(\d+),(\d+)\)/.exec(dateStr);
        if (match) {
          const year = Number.parseInt(match[1], 10);
          const month = Number.parseInt(match[2], 10);
          const day = Number.parseInt(match[3], 10);
          return `${day.toString().padStart(2, "0")}/${(month + 1)
            .toString()
            .padStart(2, "0")}/${year}`;
        }
      }

      // Handle other date formats
      try {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return formatDateToDDMMYYYY(date);
        }
      } catch (error) {
        console.error("Error parsing date:", error);
      }

      // If all else fails, return the original string
      return dateStr;
    },
    [formatDateToDDMMYYYY]
  );

  // NEW: Format datetime for display with support for both date and datetime
  const formatDateTimeForDisplay = useCallback(
    (dateTimeStr) => {
      if (!dateTimeStr) return "—";

      // If it's already in proper DD/MM/YYYY HH:MM:SS format, return as is
      if (
        typeof dateTimeStr === "string" &&
        dateTimeStr.match(/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}$/)
      ) {
        return dateTimeStr;
      }

      // If it's in DD/MM/YYYY format only, return as is
      if (
        typeof dateTimeStr === "string" &&
        dateTimeStr.match(/^\d{2}\/\d{2}\/\d{4}$/)
      ) {
        return dateTimeStr;
      }

      // Try to parse and reformat
      return parseGoogleSheetsDateTime(dateTimeStr) || "—";
    },
    [parseGoogleSheetsDateTime]
  );

  const formatDateForDisplay = useCallback(
    (dateStr) => {
      if (!dateStr) return "—";

      // If it's already in proper DD/MM/YYYY format, return as is
      if (
        typeof dateStr === "string" &&
        dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)
      ) {
        return dateStr;
      }

      // Try to parse and reformat
      return parseGoogleSheetsDate(dateStr) || "—";
    },
    [parseGoogleSheetsDate]
  );

  const parseDateFromDDMMYYYY = useCallback((dateStr) => {
    if (!dateStr || typeof dateStr !== "string") return null;

    // Handle both date and datetime formats
    const datePart = dateStr.split(" ")[0]; // Get only the date part if datetime
    const parts = datePart.split("/");
    if (parts.length !== 3) return null;
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }, []);

  const isToday = useCallback(
    (dateStr) => {
      if (!dateStr) return false;

      try {
        const today = new Date();
        const todayFormatted = formatDateToDDMMYYYY(today);

        // Check if dateStr is in DD/MM/YYYY format
        if (dateStr.includes("/")) {
          const datePart = dateStr.split(" ")[0]; // Get date part only
          return datePart === todayFormatted;
        }

        // If not in expected format, try parsing
        const parsedDate = parseDateFromDDMMYYYY(dateStr);
        if (!parsedDate) return false;

        return formatDateToDDMMYYYY(parsedDate) === todayFormatted;
      } catch (error) {
        console.error("Error checking if date is today:", error);
        return false;
      }
    },
    [formatDateToDDMMYYYY, parseDateFromDDMMYYYY]
  );

  const isOverdue = useCallback(
    (dateStr) => {
      if (!dateStr) return false;
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const parsedDate = parseDateFromDDMMYYYY(dateStr);
        if (!parsedDate) return false;
        parsedDate.setHours(0, 0, 0, 0);
        return parsedDate < today;
      } catch (error) {
        return false;
      }
    },
    [parseDateFromDDMMYYYY]
  );

  const isUpcoming = useCallback(
    (dateStr) => {
      if (!dateStr) return false;
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const parsedDate = parseDateFromDDMMYYYY(dateStr);
        if (!parsedDate) return false;
        parsedDate.setHours(0, 0, 0, 0);
        return parsedDate > today;
      } catch (error) {
        return false;
      }
    },
    [parseDateFromDDMMYYYY]
  );

  const sortDateWise = useCallback(
    (a, b) => {
      const dateStrA = a["col6"] || "";
      const dateStrB = b["col6"] || "";
      const dateA = parseDateFromDDMMYYYY(dateStrA);
      const dateB = parseDateFromDDMMYYYY(dateStrB);
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateA.getTime() - dateB.getTime();
    },
    [parseDateFromDDMMYYYY]
  );

  const resetFilters = useCallback(() => {
    setSearchTerm("");
    setStartDate("");
    setEndDate("");
    setNameFilter("");
    setDepartmentFilter("");
  }, []);

  // Get color based on data from column R
  const getRowColor = useCallback((colorCode) => {
    if (!colorCode) return "bg-white";

    const code = colorCode.toString().toLowerCase();
    switch (code) {
      case "red":
        return "bg-red-50 border-l-4 border-red-400";
      case "yellow":
        return "bg-yellow-50 border-l-4 border-yellow-400";
      case "green":
        return "bg-green-50 border-l-4 border-green-400";
      case "blue":
        return "bg-blue-50 border-l-4 border-blue-400";
      default:
        return "bg-white";
    }
  }, []);

  // Get all unique names and departments for admin filters
  const allNames = useMemo(() => {
    return [...new Set(accountData.map((account) => account["col4"]))]
      .filter((name) => name && typeof name === "string" && name.trim() !== "")
      .sort();
  }, [accountData]);

  const allDepartments = useMemo(() => {
    return [...new Set(accountData.map((account) => account["col2"]))]
      .filter((dept) => dept && typeof dept === "string" && dept.trim() !== "")
      .sort();
  }, [accountData]);

  // Toggle dropdown
  const toggleDropdown = useCallback((dropdown) => {
    setDropdownOpen((prev) => ({
      ...prev,
      [dropdown]: !prev[dropdown],
    }));
  }, []);

  // Handle filter selection
  const handleNameFilterSelect = useCallback((name) => {
    setNameFilter(name);
    setDropdownOpen((prev) => ({ ...prev, name: false }));
  }, []);

  const handleDepartmentFilterSelect = useCallback((dept) => {
    setDepartmentFilter(dept);
    setDropdownOpen((prev) => ({ ...prev, department: false }));
  }, []);

  // Clear filters
  const clearNameFilter = useCallback(() => {
    setNameFilter("");
  }, []);

  const clearDepartmentFilter = useCallback(() => {
    setDepartmentFilter("");
  }, []);

  // Optimized filtered data with debounced search and admin filters
  const filteredAccountData = useMemo(() => {
    const filtered = debouncedSearchTerm
      ? accountData.filter((account) =>
        Object.values(account).some(
          (value) =>
            value &&
            value
              .toString()
              .toLowerCase()
              .includes(debouncedSearchTerm.toLowerCase())
        )
      )
      : accountData;

    // Apply admin filters if user is admin
    let adminFiltered = filtered;
    if (userRole === "admin") {
      if (nameFilter) {
        adminFiltered = adminFiltered.filter(
          (account) => account["col4"] === nameFilter
        );
      }
      if (departmentFilter) {
        adminFiltered = adminFiltered.filter(
          (account) => account["col2"] === departmentFilter
        );
      }
    }

    return adminFiltered.sort(sortDateWise);
  }, [
    accountData,
    debouncedSearchTerm,
    sortDateWise,
    userRole,
    nameFilter,
    departmentFilter,
  ]);

  // Updated history filtering with user filter based on column H
  const filteredHistoryData = useMemo(() => {
    return historyData
      .filter((item) => {
        // User filter: For non-admin users, check column H (col7) matches username
        const userMatch =
          userRole === "admin" ||
          (item["col7"] &&
            item["col7"].toLowerCase() === username.toLowerCase());

        if (!userMatch) return false;

        const matchesSearch = debouncedSearchTerm
          ? Object.values(item).some(
            (value) =>
              value &&
              value
                .toString()
                .toLowerCase()
                .includes(debouncedSearchTerm.toLowerCase())
          )
          : true;

        let matchesDateRange = true;
        if (startDate || endDate) {
          const itemDate = parseDateFromDDMMYYYY(item["col0"]);
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

        return matchesSearch && matchesDateRange;
      })
      .sort((a, b) => {
        const dateStrA = a["col0"] || "";
        const dateStrB = b["col0"] || "";
        const dateA = parseDateFromDDMMYYYY(dateStrA);
        const dateB = parseDateFromDDMMYYYY(dateStrB);
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateB.getTime() - dateA.getTime();
      });
  }, [
    historyData,
    debouncedSearchTerm,
    startDate,
    endDate,
    parseDateFromDDMMYYYY,
    userRole,
    username,
  ]);

  // Optimized data fetching with parallel requests
  const fetchSheetData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Parallel fetch both sheets for better performance
      const [mainResponse, historyResponse] = await Promise.all([
        fetch(
          `${CONFIG.APPS_SCRIPT_URL}?sheet=${CONFIG.SOURCE_SHEET_NAME}&action=fetch`
        ),
        fetch(
          `${CONFIG.APPS_SCRIPT_URL}?sheet=${CONFIG.TARGET_SHEET_NAME}&action=fetch`
        ).catch(() => null),
      ]);

      if (!mainResponse.ok) {
        throw new Error(`Failed to fetch data: ${mainResponse.status}`);
      }

      // Process main data
      const mainText = await mainResponse.text();
      let data;
      try {
        data = JSON.parse(mainText);
      } catch (parseError) {
        const jsonStart = mainText.indexOf("{");
        const jsonEnd = mainText.lastIndexOf("}");
        if (jsonStart !== -1 && jsonEnd !== -1) {
          const jsonString = mainText.substring(jsonStart, jsonEnd + 1);
          data = JSON.parse(jsonString);
        } else {
          throw new Error("Invalid JSON response from server");
        }
      }

      // Process history data if available
      let processedHistoryData = [];
      if (historyResponse && historyResponse.ok) {
        try {
          const historyText = await historyResponse.text();
          let historyData;
          try {
            historyData = JSON.parse(historyText);
          } catch (parseError) {
            const jsonStart = historyText.indexOf("{");
            const jsonEnd = historyText.lastIndexOf("}");
            if (jsonStart !== -1 && jsonEnd !== -1) {
              const jsonString = historyText.substring(jsonStart, jsonEnd + 1);
              historyData = JSON.parse(jsonString);
            }
          }

          if (historyData && historyData.table && historyData.table.rows) {
            processedHistoryData = historyData.table.rows
              .map((row, rowIndex) => {
                if (rowIndex === 0) return null;

                const rowData = {
                  _id: Math.random().toString(36).substring(2, 15),
                  _rowIndex: rowIndex + 2,
                };

                const rowValues = row.c
                  ? row.c.map((cell) =>
                    cell && cell.v !== undefined ? cell.v : ""
                  )
                  : [];

                // Map all columns including column H (col7) for user filtering and column I (col8) for Task
                rowData["col0"] = rowValues[0]
                  ? parseGoogleSheetsDateTime(String(rowValues[0]))
                  : "";
                rowData["col1"] = rowValues[1] || "";
                rowData["col2"] = rowValues[2] || "";
                rowData["col3"] = rowValues[3]
                  ? parseGoogleSheetsDateTime(String(rowValues[3]))
                  : ""; // Next Target Date with datetime
                rowData["col4"] = rowValues[4] || "";
                rowData["col5"] = rowValues[5] || "";
                rowData["col6"] = rowValues[6] || "";
                rowData["col7"] = rowValues[7] || ""; // Column H - User name
                rowData["col8"] = rowValues[8] || ""; // Column I - Task
                rowData["col9"] = rowValues[9] || ""; // Column J - Given By

                return rowData;
              })
              .filter((row) => row !== null);
          }
        } catch (historyError) {
          console.error("Error processing history data:", historyError);
        }
      }

      setHistoryData(processedHistoryData);

      // Process main delegation data
      const currentUsername = sessionStorage.getItem("username");
      const currentUserRole = sessionStorage.getItem("role");

      const pendingAccounts = [];

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
        if (rowIndex === 0) return; // Skip header row

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
        const isUserMatch =
          (currentUserRole === "admin" || currentUserRole === "superadmin" || currentUserRole === "super_admin") ||
          assignedTo.toLowerCase() === currentUsername.toLowerCase();
        if (!isUserMatch && !(currentUserRole === "admin" || currentUserRole === "superadmin" || currentUserRole === "super_admin")) return;

        // Check conditions: Column K not null and Column L null
        const columnKValue = rowValues[10];
        const columnLValue = rowValues[11];

        const hasColumnK = !isEmpty(columnKValue);
        const isColumnLEmpty = isEmpty(columnLValue);

        if (!hasColumnK || !isColumnLEmpty) {
          return;
        }

        const googleSheetsRowIndex = rowIndex + 1;
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

        // Map all columns with special handling for datetime columns
        for (let i = 0; i < 18; i++) {
          if (i === 0 || i === 6 || i === 10) {
            // Task End Date, Planned Date and other datetime columns - parse as datetime
            rowData[`col${i}`] = rowValues[i]
              ? parseGoogleSheetsDateTime(String(rowValues[i]))
              : "";
          } else {
            rowData[`col${i}`] = rowValues[i] || "";
          }
        }

        pendingAccounts.push(rowData);
      });

      setAccountData(pendingAccounts);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching sheet data:", error);
      setError("Failed to load account data: " + error.message);
      setLoading(false);
    }
  }, [parseGoogleSheetsDateTime, parseGoogleSheetsDate, isEmpty]);

  useEffect(() => {
    fetchSheetData();
  }, [fetchSheetData]);

  const handleSelectItem = useCallback((id, isChecked) => {
    setSelectedItems((prev) => {
      const newSelected = new Set(prev);

      if (isChecked) {
        newSelected.add(id);
        setStatusData((prevStatus) => ({ ...prevStatus, [id]: "Done" }));
      } else {
        newSelected.delete(id);
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
        setStatusData((prevStatus) => {
          const newStatusData = { ...prevStatus };
          delete newStatusData[id];
          return newStatusData;
        });
        setNextTargetDate((prevDate) => {
          const newDateData = { ...prevDate };
          delete newDateData[id];
          return newDateData;
        });
      }

      return newSelected;
    });
  }, []);

  const handleCheckboxClick = useCallback(
    (e, id) => {
      e.stopPropagation();
      const isChecked = e.target.checked;
      handleSelectItem(id, isChecked);
    },
    [handleSelectItem]
  );

  const handleSelectAllItems = useCallback(
    (e) => {
      e.stopPropagation();
      const checked = e.target.checked;

      if (checked) {
        const allIds = filteredAccountData.map((item) => item._id);
        setSelectedItems(new Set(allIds));

        const newStatusData = {};
        allIds.forEach((id) => {
          newStatusData[id] = "Done";
        });
        setStatusData((prev) => ({ ...prev, ...newStatusData }));
      } else {
        setSelectedItems(new Set());
        setAdditionalData({});
        setRemarksData({});
        setStatusData({});
        setNextTargetDate({});
      }
    },
    [filteredAccountData]
  );

  const handleImageUpload = useCallback(async (id, e) => {
    const file = e.target.files[0];
    if (!file) return;

    setAccountData((prev) =>
      prev.map((item) => (item._id === id ? { ...item, image: file } : item))
    );
  }, []);

  const handleStatusChange = useCallback((id, value) => {
    setStatusData((prev) => ({ ...prev, [id]: value }));
    if (value === "Done") {
      setNextTargetDate((prev) => {
        const newDates = { ...prev };
        delete newDates[id];
        return newDates;
      });
    }
  }, []);

  const handleNextTargetDateChange = useCallback((id, value) => {
    setNextTargetDate((prev) => ({ ...prev, [id]: value }));
  }, []);

  const fileToBase64 = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  }, []);

  const toggleHistory = useCallback(() => {
    setShowHistory((prev) => !prev);
    resetFilters();
  }, [resetFilters]);

  const handleSubmit = async () => {
    const selectedItemsArray = Array.from(selectedItems);

    if (selectedItemsArray.length === 0) {
      alert("Please select at least one item to submit");
      return;
    }

    const missingStatus = selectedItemsArray.filter((id) => !statusData[id]);
    if (missingStatus.length > 0) {
      alert(
        `Please select a status for all selected items. ${missingStatus.length} item(s) are missing status.`
      );
      return;
    }

    const missingNextDate = selectedItemsArray.filter(
      (id) => statusData[id] === "Extend date" && !nextTargetDate[id]
    );
    if (missingNextDate.length > 0) {
      alert(
        `Please select a next target date for all items with "Extend date" status. ${missingNextDate.length} item(s) are missing target date.`
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

    setIsSubmitting(true);

    try {
      const today = new Date();
      // UPDATED: Use the new function to format datetime properly for Google Sheets
      const dateTimeForSubmission = formatDateTimeForGoogleSheets(today);

      // Process submissions in batches for better performance
      const batchSize = 5;
      for (let i = 0; i < selectedItemsArray.length; i += batchSize) {
        const batch = selectedItemsArray.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (id) => {
            const item = accountData.find((account) => account._id === id);
            let imageUrl = "";

            if (item.image instanceof File) {
              try {
                const base64Data = await fileToBase64(item.image);

                const uploadFormData = new FormData();
                uploadFormData.append("action", "uploadFile");
                uploadFormData.append("base64Data", base64Data);
                uploadFormData.append(
                  "fileName",
                  `task_${item["col1"]}_${Date.now()}.${item.image.name
                    .split(".")
                    .pop()}`
                );
                uploadFormData.append("mimeType", item.image.type);
                uploadFormData.append("folderId", CONFIG.DRIVE_FOLDER_ID);

                const uploadResponse = await fetch(CONFIG.APPS_SCRIPT_URL, {
                  method: "POST",
                  body: uploadFormData,
                });

                const uploadResult = await uploadResponse.json();
                if (uploadResult.success) {
                  imageUrl = uploadResult.fileUrl;
                }
              } catch (uploadError) {
                console.error("Error uploading image:", uploadError);
              }
            }

            // UPDATED: Use properly formatted datetime for submission
            // Format the next target date properly if it exists - NOW WITH DATETIME FORMAT
            let formattedNextTargetDateTime = "";
            let nextTargetDateTimeForGoogleSheets = null;

            if (nextTargetDate[id]) {
              const convertedDateTime = convertToGoogleSheetsDateTime(
                nextTargetDate[id]
              );
              formattedNextTargetDateTime = convertedDateTime.formatted;
              nextTargetDateTimeForGoogleSheets = convertedDateTime.dateObject;
            }

            // Updated to include username in column H and task description in column I when submitting to history
            const newRowData = [
              dateTimeForSubmission.formatted, // Use formatted datetime string - DD/MM/YYYY HH:MM:SS
              item["col1"] || "",
              statusData[id] || "",
              formattedNextTargetDateTime, // Use properly formatted next target datetime - DD/MM/YYYY HH:MM:SS
              remarksData[id] || "",
              imageUrl,
              "", // Column G
              username, // Column H - Store the logged-in username
              item["col5"] || "", // Column I - Task description from col5
              item["col3"] || "", // Column J - Given By from original task
            ];

            const insertFormData = new FormData();
            insertFormData.append("sheetName", CONFIG.TARGET_SHEET_NAME);
            insertFormData.append("action", "insert");
            insertFormData.append("rowData", JSON.stringify(newRowData));

            // UPDATED: Add comprehensive datetime format hints for Google Sheets
            insertFormData.append("dateTimeFormat", "DD/MM/YYYY HH:MM:SS");
            insertFormData.append("timestampColumn", "0"); // Column A - Timestamp
            insertFormData.append("nextTargetDateTimeColumn", "3"); // Column D - Next Target Date with time

            // Add additional metadata for proper datetime handling
            const dateTimeMetadata = {
              columns: {
                0: { type: "datetime", format: "DD/MM/YYYY HH:MM:SS" }, // Timestamp
                3: { type: "datetime", format: "DD/MM/YYYY HH:MM:SS" }, // Next Target Date with time
              },
            };
            insertFormData.append(
              "dateTimeMetadata",
              JSON.stringify(dateTimeMetadata)
            );

            // If we have a proper datetime object for next target date, send it separately
            if (nextTargetDateTimeForGoogleSheets) {
              insertFormData.append(
                "nextTargetDateTimeObject",
                nextTargetDateTimeForGoogleSheets.toISOString()
              );
            }

            return fetch(CONFIG.APPS_SCRIPT_URL, {
              method: "POST",
              body: insertFormData,
            });
          })
        );
      }

      setAccountData((prev) =>
        prev.filter((item) => !selectedItems.has(item._id))
      );

      setSuccessMessage(
        `Successfully processed ${selectedItemsArray.length} task records! Data submitted to ${CONFIG.TARGET_SHEET_NAME} sheet.`
      );
      setSelectedItems(new Set());
      setAdditionalData({});
      setRemarksData({});
      setStatusData({});
      setNextTargetDate({});

      setTimeout(() => {
        fetchSheetData();
      }, 2000);
    } catch (error) {
      console.error("Submission error:", error);
      alert("Failed to submit task records: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedItemsCount = selectedItems.size;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

          {/* PAGE TITLE */}
          <h1 className="text-2xl font-bold tracking-tight text-purple-700 text-center sm:text-left">
            {showHistory ? CONFIG.PAGE_CONFIG.historyTitle : CONFIG.PAGE_CONFIG.title}
          </h1>

          {/* SEARCH + FILTER + BUTTONS WRAPPER */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">

            {/* SEARCH BOX */}
            <div className="relative w-full sm:w-64">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="text"
                placeholder={showHistory ? "Search by Task ID..." : "Search tasks..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-purple-200 rounded-md 
                   focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* ADMIN FILTERS */}
            {isAdmin && !showHistory && (
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto" ref={dropdownRef}>

                {/* NAME FILTER */}
                <div className="relative w-full sm:w-auto">
                  <button
                    onClick={() => toggleDropdown("name")}
                    className="flex items-center justify-between gap-2 w-full px-3 py-2 border border-purple-200
                       rounded-md bg-white text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Filter className="h-4 w-4" />
                    {nameFilter || "Filter by Name"}
                    <ChevronDown
                      size={16}
                      className={`transition-transform ${dropdownOpen.name ? "rotate-180" : ""
                        }`}
                    />
                  </button>

                  {dropdownOpen.name && (
                    <div className="absolute z-50 mt-1 w-full sm:w-56 rounded-md bg-white shadow-lg 
                            border border-gray-200 max-h-60 overflow-auto">
                      <div className="py-1">
                        <button
                          onClick={clearNameFilter}
                          className={`block w-full text-left px-4 py-2 text-sm ${!nameFilter
                            ? "bg-purple-100 text-purple-900"
                            : "text-gray-700 hover:bg-gray-100"
                            }`}
                        >
                          All Names
                        </button>

                        {allNames.map((name) => (
                          <button
                            key={name}
                            onClick={() => handleNameFilterSelect(name)}
                            className={`block w-full text-left px-4 py-2 text-sm ${nameFilter === name
                              ? "bg-purple-100 text-purple-900"
                              : "text-gray-700 hover:bg-gray-100"
                              }`}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* DEPARTMENT FILTER */}
                <div className="relative w-full sm:w-auto">
                  <button
                    onClick={() => toggleDropdown("department")}
                    className="flex items-center justify-between gap-2 w-full px-3 py-2 border border-purple-200 
                       rounded-md bg-white text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Filter className="h-4 w-4" />
                    {departmentFilter || "Filter by Department"}
                    <ChevronDown
                      size={16}
                      className={`transition-transform ${dropdownOpen.department ? "rotate-180" : ""
                        }`}
                    />
                  </button>

                  {dropdownOpen.department && (
                    <div className="absolute z-50 mt-1 w-full sm:w-48 rounded-md bg-white shadow-lg 
                            border border-gray-200 max-h-48 overflow-auto">
                      <div className="py-1">
                        <button
                          onClick={clearDepartmentFilter}
                          className={`block w-full text-left px-3 py-2 text-sm ${!departmentFilter
                            ? "bg-purple-100 text-purple-900"
                            : "text-gray-700 hover:bg-gray-100"
                            }`}
                        >
                          All Departments
                        </button>

                        {allDepartments.map((dept) => (
                          <button
                            key={dept}
                            onClick={() => handleDepartmentFilterSelect(dept)}
                            className={`block w-full text-left px-3 py-2 text-sm ${departmentFilter === dept
                              ? "bg-purple-100 text-purple-900"
                              : "text-gray-700 hover:bg-gray-100"
                              }`}
                          >
                            {dept}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* HISTORY BUTTON (ADMIN) */}
            {isAdmin && (
              <button
                onClick={toggleHistory}
                className="w-full sm:w-auto rounded-md bg-gradient-to-r from-blue-500 to-indigo-600 
                   py-2 px-3 text-white hover:from-blue-600 hover:to-indigo-700 
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {showHistory ? (
                  <div className="flex items-center justify-center">
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    <span>Back to Tasks</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <History className="h-4 w-4 mr-1" />
                    <span>View History</span>
                  </div>
                )}
              </button>
            )}

            {/* SUBMIT BUTTON */}
            {!showHistory && (
              <button
                onClick={handleSubmit}
                disabled={selectedItemsCount === 0 || isSubmitting}
                className="w-full sm:w-auto rounded-md bg-gradient-to-r from-purple-600 to-pink-600 
                   py-2 px-3 text-white hover:from-purple-700 hover:to-pink-700 
                   focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 
                   disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting
                  ? "Processing..."
                  : `Submit Selected (${selectedItemsCount})`}
              </button>
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
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 p-2">
            <h2 className="text-purple-700 font-medium">
              {showHistory
                ? `Completed ${CONFIG.SOURCE_SHEET_NAME} Tasks`
                : `Pending ${CONFIG.SOURCE_SHEET_NAME} Tasks`}
            </h2>
            <p className="text-purple-600 text-sm">
              {showHistory
                ? `${CONFIG.PAGE_CONFIG.historyDescription} for ${isAdmin ? "all" : "your"
                } tasks`
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
              <button
                className="underline ml-2"
                onClick={() => window.location.reload()}
              >
                Try again
              </button>
            </div>
          ) : showHistory ? (
            <>
              {/* Simplified History Filters - Only Date Range */}
              <div className="p-4 border-b border-purple-100 bg-gray-50">
                <div className="flex flex-wrap items-center justify-between gap-4">
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

                  {(startDate || endDate || searchTerm) && (
                    <button
                      onClick={resetFilters}
                      className="px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 text-sm"
                    >
                      Clear All Filters
                    </button>
                  )}
                </div>
              </div>

              {/* History Table with Proper Text Wrapping */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[140px]">
                        Timestamp
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                        Task ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[250px]">
                        Task
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[140px]">
                        Next Target Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
                        Remarks
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                        Uploaded Image
                      </th>
                      {userRole === "admin" && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                          User
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                        Given By
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredHistoryData.length > 0 ? (
                      filteredHistoryData.map((history) => (
                        <tr key={history._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 min-w-[140px]">
                            <div className="text-sm font-medium text-gray-900 whitespace-normal break-words">
                              {formatDateTimeForDisplay(history["col0"]) || "—"}
                            </div>
                          </td>
                          <td className="px-6 py-4 min-w-[100px]">
                            <div className="text-sm text-gray-900 whitespace-normal break-words">
                              {history["col1"] || "—"}
                            </div>
                          </td>
                          <td className="px-6 py-4 min-w-[250px] max-w-[300px]">
                            <div
                              className="text-sm text-gray-900 whitespace-normal break-words leading-relaxed"
                              title={history["col8"]}
                            >
                              {history["col8"] || "—"}
                            </div>
                          </td>
                          <td className="px-6 py-4 min-w-[100px]">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full whitespace-normal ${history["col2"] === "Done"
                                ? "bg-green-100 text-green-800"
                                : history["col2"] === "Extend date"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-gray-100 text-gray-800"
                                }`}
                            >
                              {history["col2"] || "—"}
                            </span>
                          </td>
                          <td className="px-6 py-4 min-w-[140px]">
                            <div className="text-sm text-gray-900 whitespace-normal break-words">
                              {formatDateTimeForDisplay(history["col3"]) || "—"}
                            </div>
                          </td>
                          <td className="px-6 py-4 bg-purple-50 min-w-[200px] max-w-[250px]">
                            <div
                              className="text-sm text-gray-900 whitespace-normal break-words leading-relaxed"
                              title={history["col4"]}
                            >
                              {history["col4"] || "—"}
                            </div>
                          </td>
                          <td className="px-6 py-4 min-w-[120px]">
                            {history["col5"] ? (
                              <a
                                href={history["col5"]}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 underline flex items-center"
                              >
                                <img
                                  src={
                                    history["col5"] || "/api/placeholder/32/32"
                                  }
                                  alt="Attachment"
                                  className="h-8 w-8 object-cover rounded-md mr-2"
                                />
                                <span className="text-xs whitespace-normal break-words">
                                  View
                                </span>
                              </a>
                            ) : (
                              <span className="text-gray-400 text-xs">
                                No attachment
                              </span>
                            )}
                          </td>
                          {userRole === "admin" && (
                            <td className="px-6 py-4 min-w-[100px]">
                              <div className="text-sm text-gray-900 whitespace-normal break-words">
                                {history["col7"] || "—"}
                              </div>
                            </td>
                          )}
                          <td className="px-6 py-4 min-w-[120px]">
                            <div className="text-sm text-gray-900 whitespace-normal break-words">
                              {history["col9"] || "—"}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={userRole === "admin" ? 9 : 8}
                          className="px-6 py-4 text-center text-gray-500"
                        >
                          {searchTerm || startDate || endDate
                            ? "No historical records matching your filters"
                            : "No completed records found"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* History Table - Mobile Card View */}
              <div className="sm:hidden space-y-4 p-4">
                {filteredHistoryData.length > 0 ? (
                  filteredHistoryData.map((history) => (
                    <div
                      key={history._id}
                      className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:bg-gray-50"
                    >
                      <div className="space-y-3">
                        {/* Timestamp */}
                        <div className="flex justify-between items-center border-b pb-2">
                          <span className="font-medium text-gray-700">
                            Timestamp:
                          </span>
                          <div className="text-sm font-medium text-gray-900 break-words text-right">
                            {formatDateTimeForDisplay(history["col0"]) || "—"}
                          </div>
                        </div>

                        {/* Task ID */}
                        <div className="flex justify-between items-center border-b pb-2">
                          <span className="font-medium text-gray-700">
                            Task ID:
                          </span>
                          <div className="text-sm text-gray-900 break-words">
                            {history["col1"] || "—"}
                          </div>
                        </div>

                        {/* Task */}
                        <div className="flex justify-between items-start border-b pb-2">
                          <span className="font-medium text-gray-700">
                            Task:
                          </span>
                          <div className="text-sm text-gray-900 break-words text-right max-w-[60%]">
                            {history["col8"] || "—"}
                          </div>
                        </div>

                        {/* Status */}
                        <div className="flex justify-between items-center border-b pb-2">
                          <span className="font-medium text-gray-700">
                            Status:
                          </span>
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${history["col2"] === "Done"
                              ? "bg-green-100 text-green-800"
                              : history["col2"] === "Extend date"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-gray-100 text-gray-800"
                              }`}
                          >
                            {history["col2"] || "—"}
                          </span>
                        </div>

                        {/* Next Target Date */}
                        <div className="flex justify-between items-center border-b pb-2">
                          <span className="font-medium text-gray-700">
                            Next Target Date:
                          </span>
                          <div className="text-sm text-gray-900 break-words">
                            {formatDateTimeForDisplay(history["col3"]) || "—"}
                          </div>
                        </div>

                        {/* Remarks */}
                        <div className="flex justify-between items-start border-b pb-2">
                          <span className="font-medium text-gray-700">
                            Remarks:
                          </span>
                          <div className="text-sm text-gray-900 break-words text-right max-w-[60%]">
                            {history["col4"] || "—"}
                          </div>
                        </div>

                        {/* Uploaded Image */}
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-gray-700">
                            Attachment:
                          </span>
                          {history["col5"] ? (
                            <a
                              href={history["col5"]}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 underline flex items-center"
                            >
                              <img
                                src={
                                  history["col5"] || "/api/placeholder/32/32"
                                }
                                alt="Attachment"
                                className="h-8 w-8 object-cover rounded-md mr-2"
                              />
                              <span className="text-xs break-words">View</span>
                            </a>
                          ) : (
                            <span className="text-gray-400 text-xs">
                              No attachment
                            </span>
                          )}
                        </div>

                        {/* User (Admin only) */}
                        {userRole === "admin" && (
                          <div className="flex justify-between items-center border-t pt-2">
                            <span className="font-medium text-gray-700">
                              User:
                            </span>
                            <div className="text-sm text-gray-900 break-words">
                              {history["col7"] || "—"}
                            </div>
                          </div>
                        )}

                        {/* Given By */}
                        <div className="flex justify-between items-center border-t pt-2">
                          <span className="font-medium text-gray-700">
                            Given By:
                          </span>
                          <div className="text-sm text-gray-900 break-words">
                            {history["col9"] || "—"}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    {searchTerm || startDate || endDate
                      ? "No historical records matching your filters"
                      : "No completed records found"}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* /* Regular Tasks Table with Proper Text Wrapping */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[50px]">
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                        Task ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                        Department
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                        Given By
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[250px]">
                        Task Description
                      </th>
                      <th
                        className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[140px] ${!accountData["col17"] ? "bg-yellow-50" : ""
                          }`}
                      >
                        Task End Date
                      </th>
                      <th
                        className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[140px] ${!accountData["col17"] ? "bg-green-50" : ""
                          }`}
                      >
                        Planned Date
                      </th>
                      <th
                        className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px] ${!accountData["col17"] ? "bg-blue-50" : ""
                          }`}
                      >
                        Status
                      </th>
                      <th
                        className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[140px] ${!accountData["col17"] ? "bg-indigo-50" : ""
                          }`}
                      >
                        Next Target Date
                      </th>
                      <th
                        className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px] ${!accountData["col17"] ? "bg-purple-50" : ""
                          }`}
                      >
                        Remarks
                      </th>
                      <th
                        className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px] ${!accountData["col17"] ? "bg-orange-50" : ""
                          }`}
                      >
                        Upload Image
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredAccountData.length > 0 ? (
                      filteredAccountData.map((account) => {
                        const isSelected = selectedItems.has(account._id);
                        const isDisabled = account.isDisabled;
                        const isComplete = account.status === "Complete";
                        const rowColorClass = getRowColor(account["col17"]);
                        const taskStatus = statusData[account._id] || "";
                        const isTodayTask = isToday(account["col6"]);
                        const isOverdueTask = isOverdue(account["col6"]);
                        const isUpcomingTask = isUpcoming(account["col6"]);


                        return (
                          <tr
                            key={account._id}
                            className={`${isSelected ? "bg-purple-50" : ""} 
                    hover:bg-gray-50 
                    ${rowColorClass}
                    ${isTodayTask || isOverdueTask || isUpcomingTask ? "relative" : ""}
                  `}
                          >
                            <td className="px-6 py-4 min-w-[50px] relative">
                              {isOverdueTask && (
                                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-b-md shadow-md z-10 whitespace-nowrap">
                                  OVERDUE
                                </div>
                              )}
                              {isTodayTask && (
                                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-b-md shadow-md z-10 whitespace-nowrap">
                                  TODAY
                                </div>
                              )}
                              {isUpcomingTask && (
                                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-b-md shadow-md z-10 whitespace-nowrap">
                                  UPCOMING
                                </div>
                              )}
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                checked={isSelected}
                                onChange={(e) =>
                                  handleCheckboxClick(e, account._id)
                                }
                              />
                            </td>
                            <td className="px-6 py-4 min-w-[100px]">
                              <div className="text-sm text-gray-900 whitespace-normal break-words">
                                {account["col1"] || "—"}
                              </div>
                            </td>
                            <td className="px-6 py-4 min-w-[120px]">
                              <div className="text-sm text-gray-900 whitespace-normal break-words">
                                {account["col2"] || "—"}
                              </div>
                            </td>
                            <td className="px-6 py-4 min-w-[120px]">
                              <div className="text-sm text-gray-900 whitespace-normal break-words">
                                {account["col3"] || "—"}
                              </div>
                            </td>
                            <td className="px-6 py-4 min-w-[120px]">
                              <div className="text-sm text-gray-900 whitespace-normal break-words">
                                {account["col4"] || "—"}
                              </div>
                            </td>
                            <td className="px-6 py-4 min-w-[250px] max-w-[300px]">
                              <div
                                className="text-sm text-gray-900 whitespace-normal break-words leading-relaxed"
                                title={account["col5"]}
                              >
                                {account["col5"] || "—"}
                              </div>
                            </td>
                            <td
                              className={`px-6 py-4 min-w-[140px] ${!account["col17"] ? "bg-yellow-50" : ""
                                }`}
                            >
                              <div className="text-sm text-gray-900 whitespace-normal break-words">
                                {formatDateTimeForDisplay(account["col6"])}
                              </div>
                            </td>
                            <td
                              className={`px-6 py-4 min-w-[140px] ${!account["col17"] ? "bg-green-50" : ""
                                }`}
                            >
                              <div className="text-sm text-gray-900 whitespace-normal break-words">
                                {formatDateTimeForDisplay(account["col10"])}
                              </div>
                            </td>
                            <td
                              className={`px-6 py-4 min-w-[120px] ${!account["col17"] ? "bg-blue-50" : ""
                                }`}
                            >
                              <select
                                disabled={!isSelected}
                                value={statusData[account._id] || ""}
                                onChange={(e) =>
                                  handleStatusChange(
                                    account._id,
                                    e.target.value
                                  )
                                }
                                className="border border-gray-300 rounded-md px-2 py-1 w-full disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
                              >
                                <option value="">Select</option>
                                <option value="Done">Done</option>
                                <option value="Extend date">Extend date</option>
                              </select>
                            </td>
                            <td
                              className={`px-6 py-4 min-w-[140px] ${!account["col17"] ? "bg-indigo-50" : ""
                                }`}
                            >
                              <input
                                type="date"
                                disabled={
                                  !isSelected ||
                                  statusData[account._id] !== "Extend date"
                                }
                                value={
                                  nextTargetDate[account._id]
                                    ? (() => {
                                      const dateStr =
                                        nextTargetDate[account._id];
                                      if (dateStr && dateStr.includes("/")) {
                                        const datePart =
                                          dateStr.split(" ")[0]; // Get only date part if datetime
                                        const [day, month, year] =
                                          datePart.split("/");
                                        return `${year}-${month.padStart(
                                          2,
                                          "0"
                                        )}-${day.padStart(2, "0")}`;
                                      }
                                      return dateStr;
                                    })()
                                    : ""
                                }
                                onChange={(e) => {
                                  const inputDate = e.target.value;
                                  if (inputDate) {
                                    const [year, month, day] =
                                      inputDate.split("-");
                                    // When user selects a date, add current time to make it datetime format
                                    const currentTime = new Date();
                                    const hours = currentTime
                                      .getHours()
                                      .toString()
                                      .padStart(2, "0");
                                    const minutes = currentTime
                                      .getMinutes()
                                      .toString()
                                      .padStart(2, "0");
                                    const seconds = currentTime
                                      .getSeconds()
                                      .toString()
                                      .padStart(2, "0");
                                    const formattedDateTime = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
                                    handleNextTargetDateChange(
                                      account._id,
                                      formattedDateTime
                                    );
                                  } else {
                                    handleNextTargetDateChange(account._id, "");
                                  }
                                }}
                                className="border border-gray-300 rounded-md px-2 py-1 w-full disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
                              />
                            </td>
                            <td
                              className={`px-6 py-4 min-w-[200px] max-w-[250px] ${!account["col17"] ? "bg-purple-50" : ""
                                }`}
                            >
                              <textarea
                                placeholder="Enter remarks"
                                disabled={!isSelected}
                                value={remarksData[account._id] || ""}
                                onChange={(e) =>
                                  setRemarksData((prev) => ({
                                    ...prev,
                                    [account._id]: e.target.value,
                                  }))
                                }
                                className="border rounded-md px-2 py-1 w-full border-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm resize-none whitespace-normal"
                                rows="2"
                              />
                            </td>
                            {/* Upload Image */}
                            <td className="px-3 md:px-6 py-2 md:py-4 whitespace-nowrap w-[160px]">
                              {account.image ? (
                                <div className="flex items-center">
                                  <div className="flex flex-col">
                                    <span className="text-sm font-medium text-gray-900">
                                      {account.image instanceof File
                                        ? account.image.name
                                        : "Image Selected"}
                                    </span>
                                    {account.image instanceof File ? (
                                      <span className="text-xs text-green-600 font-semibold">Ready to upload</span>
                                    ) : (
                                      <button
                                        className="text-xs text-purple-600 hover:text-purple-800 underline mt-1"
                                        onClick={() => window.open(account.image, "_blank")}
                                      >
                                        View Image
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-col gap-2">
                                  <label
                                    htmlFor={`upload-${account._id}`}
                                    className={`flex items-center cursor-pointer ${account["col9"]?.toUpperCase() === "YES"
                                      ? "text-red-600 font-medium"
                                      : "text-purple-600 hover:text-purple-800"
                                      } ${isDisabled ? "pointer-events-none opacity-50" : ""}`}
                                  >
                                    <Upload className="h-4 w-4 mr-1" />
                                    <span className="text-xs">
                                      {account["col9"]?.toUpperCase() === "YES"
                                        ? "Upload (Required*)"
                                        : "Upload from File"}
                                    </span>
                                  </label>

                                  <input
                                    id={`upload-${account._id}`}
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={(e) => handleImageUpload(account._id, e)}
                                    disabled={!isSelected || isDisabled}
                                  />

                                  {/* Camera functionality removed - only show upload from file */}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td
                          colSpan={12}
                          className="px-6 py-4 text-center text-gray-500"
                        >
                          {searchTerm || nameFilter || departmentFilter
                            ? "No tasks matching your filters"
                            : "No pending tasks found"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Regular Tasks Table - Mobile Card View */}
              <div className="sm:hidden space-y-4 p-4">
                {filteredAccountData.length > 0 ? (
                  filteredAccountData.map((account) => {
                    const isSelected = selectedItems.has(account._id);
                    const isDisabled = account.isDisabled;
                    const isComplete = account.status === "Complete";
                    const rowColorClass = getRowColor(account["col17"]);
                    const taskStatus = statusData[account._id] || "";
                    const isTodayTask = isToday(account["col6"]);
                    const isOverdueTask = isOverdue(account["col6"]);
                    const isUpcomingTask = isUpcoming(account["col6"]);

                    return (
                      <div key={account._id} className={`bg-white border border-gray-200 rounded-lg p-4 shadow-sm ${isSelected ? "bg-purple-50 border-purple-200" : ""
                        } ${rowColorClass}`}>

                        {/* Status Badges */}
                        {isOverdueTask && (
                          <div className="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-md shadow-md mb-3 text-center">
                            OVERDUE
                          </div>
                        )}
                        {isTodayTask && (
                          <div className="bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-md shadow-md mb-3 text-center">
                            TODAY
                          </div>
                        )}
                        {isUpcomingTask && (
                          <div className="bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-md shadow-md mb-3 text-center">
                            UPCOMING
                          </div>
                        )}

                        <div className="space-y-3">
                          {/* Checkbox */}
                          <div className="flex justify-between items-center border-b pb-2">
                            <span className="font-medium text-gray-700">Select:</span>
                            <input
                              type="checkbox"
                              className="h-5 w-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                              checked={isSelected}
                              onChange={(e) => handleCheckboxClick(e, account._id)}
                            />
                          </div>

                          {/* Task ID */}
                          <div className="flex justify-between items-center border-b pb-2">
                            <span className="font-medium text-gray-700">Task ID:</span>
                            <div className="text-sm text-gray-900 break-words">
                              {account["col1"] || "—"}
                            </div>
                          </div>

                          {/* Department */}
                          <div className="flex justify-between items-center border-b pb-2">
                            <span className="font-medium text-gray-700">Department:</span>
                            <div className="text-sm text-gray-900 break-words">
                              {account["col2"] || "—"}
                            </div>
                          </div>

                          {/* Given By */}
                          <div className="flex justify-between items-center border-b pb-2">
                            <span className="font-medium text-gray-700">Given By:</span>
                            <div className="text-sm text-gray-900 break-words">
                              {account["col3"] || "—"}
                            </div>
                          </div>

                          {/* Name */}
                          <div className="flex justify-between items-center border-b pb-2">
                            <span className="font-medium text-gray-700">Name:</span>
                            <div className="text-sm text-gray-900 break-words">
                              {account["col4"] || "—"}
                            </div>
                          </div>

                          {/* Description */}
                          <div className="flex justify-between items-start border-b pb-2">
                            <span className="font-medium text-gray-700">Description:</span>
                            <div className="text-sm text-gray-900 break-words text-right max-w-[60%]">
                              {account["col5"] || "—"}
                            </div>
                          </div>

                          {/* End Date */}
                          <div className="flex justify-between items-center border-b pb-2">
                            <span className="font-medium text-gray-700">End Date:</span>
                            <div className="text-sm text-gray-900 break-words">
                              {formatDateTimeForDisplay(account["col6"])}
                            </div>
                          </div>

                          {/* Planned Date */}
                          <div className="flex justify-between items-center border-b pb-2">
                            <span className="font-medium text-gray-700">Planned Date:</span>
                            <div className="text-sm text-gray-900 break-words">
                              {formatDateTimeForDisplay(account["col10"])}
                            </div>
                          </div>

                          {/* Status */}
                          <div className="flex justify-between items-center border-b pb-2">
                            <span className="font-medium text-gray-700">Status:</span>
                            <select
                              disabled={!isSelected}
                              value={taskStatus}
                              onChange={(e) => handleStatusChange(account._id, e.target.value)}
                              className="border border-gray-300 rounded-md px-2 py-1 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
                            >
                              <option value="">Select</option>
                              <option value="Done">Done</option>
                              <option value="Extend date">Extend date</option>
                            </select>
                          </div>

                          {/* Next Target Date */}
                          <div className="flex justify-between items-center border-b pb-2">
                            <span className="font-medium text-gray-700">Next Target Date:</span>
                            <input
                              type="date"
                              disabled={!isSelected || taskStatus !== "Extend date"}
                              value={
                                nextTargetDate[account._id]
                                  ? (() => {
                                    const dateStr = nextTargetDate[account._id];
                                    if (dateStr && dateStr.includes("/")) {
                                      const datePart = dateStr.split(" ")[0];
                                      const [day, month, year] = datePart.split("/");
                                      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
                                    }
                                    return dateStr;
                                  })()
                                  : ""
                              }
                              onChange={(e) => {
                                const inputDate = e.target.value;
                                if (inputDate) {
                                  const [year, month, day] = inputDate.split("-");
                                  const currentTime = new Date();
                                  const formattedDateTime = `${day}/${month}/${year} ${currentTime.getHours().toString().padStart(2, "0")}:${currentTime.getMinutes().toString().padStart(2, "0")}:${currentTime.getSeconds().toString().padStart(2, "0")}`;
                                  handleNextTargetDateChange(account._id, formattedDateTime);
                                }
                              }}
                              className="border border-gray-300 rounded-md px-2 py-1 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
                            />
                          </div>

                          {/* Remarks */}
                          <div className="flex justify-between items-start border-b pb-2">
                            <span className="font-medium text-gray-700">Remarks:</span>
                            <textarea
                              placeholder="Enter remarks"
                              disabled={!isSelected}
                              value={remarksData[account._id] || ""}
                              onChange={(e) => setRemarksData((prev) => ({ ...prev, [account._id]: e.target.value }))}
                              className="border rounded-md px-2 py-1 border-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm resize-none w-32"
                              rows="2"
                            />
                          </div>

                          {/* ✅ CAMERA + GALLERY BUTTONS */}
                          <div className="text-sm">
                            <span className="font-medium">Upload Image: </span>
                            {account.image ? (
                              <div className="flex flex-col mt-2">
                                <span className="text-sm font-semibold text-gray-900">
                                  {account.image instanceof File ? account.image.name : "Image Selected"}
                                </span>
                                {account.image instanceof File ? (
                                  <span className="text-xs text-green-600 font-bold">Ready to upload</span>
                                ) : (
                                  <button
                                    className="text-xs text-purple-600 hover:text-purple-800 underline mt-1 text-left"
                                    onClick={() => window.open(account.image, "_blank")}
                                  >
                                    View Image
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2 mt-2">
                                {/* Camera button removed */}

                                <label className={`flex items-center px-3 py-2 rounded-lg border-2 text-sm font-medium ${isSelected
                                  ? account["col9"]?.toUpperCase() === "YES"
                                    ? "bg-red-50 border-red-300 text-red-700 hover:bg-red-100 shadow-md"
                                    : "bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100 shadow-md"
                                  : "bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed"
                                  }`}>
                                  <Upload className="h-4 w-4 mr-1" />
                                  <span>{account["col9"]?.toUpperCase() === "YES" ? "Upload (Required*)" : "Upload from File"}</span>
                                  <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={(e) => handleImageUpload(account._id, e)}
                                    disabled={!isSelected || isDisabled}
                                  />
                                </label>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    No pending tasks found
                  </div>
                )}
              </div>

            </>
          )}
        </div>
        {isCameraOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full overflow-hidden">
              <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold">📸 Take Photo</h3>
                <button
                  onClick={stopCamera}
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="relative bg-black">
                <video
                  ref={videoRef}
                  className="w-full h-[400px] object-cover"
                  autoPlay
                  playsInline
                  muted
                />

                {isCameraLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="text-white text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent mx-auto mb-3"></div>
                      <p>Initializing camera...</p>
                    </div>
                  </div>
                )}
              </div>

              {cameraError && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4">
                  <p className="text-sm text-red-700">{cameraError}</p>
                </div>
              )}

              <div className="p-4 bg-gray-50 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={capturePhoto}
                  disabled={isCameraLoading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  📸 Capture Photo
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default DelegationDataPage;