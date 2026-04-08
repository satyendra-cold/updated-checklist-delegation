import { useState, useEffect } from "react";
import { BellRing, FileCheck, Calendar, Clock } from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";

// Calendar Component (defined outside)
const CalendarComponent = ({ date, onChange, onClose }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
  };

  const handleDateClick = (day) => {
    const selectedDate = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day,
    );
    onChange(selectedDate);
    onClose();
  };

  const renderDays = () => {
    const days = [];
    const daysInMonth = getDaysInMonth(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
    );
    const firstDayOfMonth = getFirstDayOfMonth(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
    );

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="h-8 w-8"></div>);
    }

    // Add cells for each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const isSelected =
        date &&
        date.getDate() === day &&
        date.getMonth() === currentMonth.getMonth() &&
        date.getFullYear() === currentMonth.getFullYear();

      days.push(
        <button
          key={day}
          type="button"
          onClick={() => handleDateClick(day)}
          className={`h-8 w-8 rounded-full flex items-center justify-center text-sm ${isSelected
            ? "bg-purple-600 text-white"
            : "hover:bg-purple-100 text-gray-700"
            }`}
        >
          {day}
        </button>,
      );
    }

    return days;
  };

  const prevMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1),
    );
  };

  const nextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1),
    );
  };

  return (
    <div className="p-2 bg-white border border-gray-200 rounded-md shadow-md">
      <div className="flex justify-between items-center mb-2">
        <button
          type="button"
          onClick={prevMonth}
          className="p-1 hover:bg-gray-100 rounded-full"
        >
          &lt;
        </button>
        <div className="text-sm font-medium">
          {currentMonth.toLocaleString("default", { month: "long" })}{" "}
          {currentMonth.getFullYear()}
        </div>
        <button
          type="button"
          onClick={nextMonth}
          className="p-1 hover:bg-gray-100 rounded-full"
        >
          &gt;
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
          <div
            key={day}
            className="h-8 w-8 flex items-center justify-center text-xs text-gray-500"
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">{renderDays()}</div>
    </div>
  );
};

// Helper functions for date manipulation
const formatDate = (date) => {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const addDays = (date, days) => {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + days);
  return newDate;
};

const addMonths = (date, months) => {
  const newDate = new Date(date);
  newDate.setMonth(newDate.getMonth() + months);
  return newDate;
};

const addYears = (date, years) => {
  const newDate = new Date(date);
  newDate.setFullYear(newDate.getFullYear() + years);
  return newDate;
};

const getCurrentTime = () => {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
};

export default function AssignTask() {
  const [date, setSelectedDate] = useState(new Date());
  const [time, setTime] = useState(getCurrentTime()); // Default to current time
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedTasks, setGeneratedTasks] = useState([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [accordionOpen, setAccordionOpen] = useState(false);

  // Add new state variables for dropdown options
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [givenByOptions, setGivenByOptions] = useState([]);
  const [doerOptions, setDoerOptions] = useState([]);

  const frequencies = [
    { value: "one-time", label: "One Time (No Recurrence)" },
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "fortnightly", label: "Fortnightly" },
    { value: "monthly", label: "Monthly" },
    { value: "quarterly", label: "Quarterly" },
    { value: "half-yearly", label: "Half Yearly" },
    { value: "yearly", label: "Yearly" },
    { value: "end-of-1st-week", label: "End of 1st Week" },
    { value: "end-of-2nd-week", label: "End of 2nd Week" },
    { value: "end-of-3rd-week", label: "End of 3rd Week" },
    { value: "end-of-4th-week", label: "End of 4th Week" },
    { value: "end-of-last-week", label: "End of Last Week" },
  ];

  const [formData, setFormData] = useState({
    department: "",
    givenBy: "",
    doer: "",
    description: "",
    frequency: "one-time",
    enableReminders: true,
    requireAttachment: false,
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSwitchChange = (name, e) => {
    setFormData((prev) => ({ ...prev, [name]: e.target.checked }));
  };

  // Function to fetch options from master sheet
  const fetchMasterSheetOptions = async () => {
    try {
      const appsScriptUrl = "https://script.google.com/macros/s/AKfycbyGf3LdYk6MPiOs_shPU9_AW7wmRjJZ4QxMk9qYqTScsDMB7IliaWRB1HueYy7w5qxqNw/exec";
      const masterSheetName = "MASTER";

      const url = `${appsScriptUrl}?sheet=${encodeURIComponent(masterSheetName)}&action=fetch`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch master data: ${response.status}`);
      }

      const data = await response.json();

      if (!data.table || !data.table.rows) {
        console.log("No master data found");
        return;
      }

      // Extract options from columns A, B, and C
      const departments = [];
      const givenBy = [];
      const doers = [];

      // Process all rows starting from index 1 (skip header)
      data.table.rows.slice(1).forEach((row) => {
        // Column A (Index 0) - Departments
        if (row.c && row.c[0] && row.c[0].v) {
          const value = row.c[0].v.toString().trim();
          if (value !== "") {
            departments.push(value);
          }
        }
        // Column B (Index 1) - Given By
        if (row.c && row.c[1] && row.c[1].v) {
          const value = row.c[1].v.toString().trim();
          if (value !== "") {
            givenBy.push(value);
          }
        }
        // Column C (Index 2) - Doers
        if (row.c && row.c[2] && row.c[2].v) {
          const value = row.c[2].v.toString().trim();
          if (value !== "") {
            doers.push(value);
          }
        }
      });

      // Remove duplicates and sort
      setDepartmentOptions([...new Set(departments)].sort());
      setGivenByOptions([...new Set(givenBy)].sort());
      setDoerOptions([...new Set(doers)].sort());

      console.log("Master sheet options loaded successfully from Apps Script");
    } catch (error) {
      console.error("Error fetching master sheet options:", error);
      // Fallback: try the direct gviz URL if Apps Script fails
      try {
        const masterSheetId = "1YCLFppf8OrwZjKjhVyVB77s63vFQUylXzEniWLeatW0";
        const gvizUrl = `https://docs.google.com/spreadsheets/d/${masterSheetId}/gviz/tq?tqx=out:json&sheet=MASTER`;

        const gvizResponse = await fetch(gvizUrl);
        if (gvizResponse.ok) {
          const text = await gvizResponse.text();
          const jsonStart = text.indexOf("{");
          const jsonEnd = text.lastIndexOf("}");
          const data = JSON.parse(text.substring(jsonStart, jsonEnd + 1));

          if (data.table && data.table.rows) {
            const depts = [];
            const givers = [];
            const staff = [];

            data.table.rows.slice(1).forEach(row => {
              if (row.c && row.c[0]?.v) depts.push(row.c[0].v.toString().trim());
              if (row.c && row.c[1]?.v) givers.push(row.c[1].v.toString().trim());
              if (row.c && row.c[2]?.v) staff.push(row.c[2].v.toString().trim());
            });

            setDepartmentOptions([...new Set(depts)].sort());
            setGivenByOptions([...new Set(givers)].sort());
            setDoerOptions([...new Set(staff)].sort());
            return;
          }
        }
      } catch (fallbackError) {
        console.error("Fallback fetch also failed:", fallbackError);
      }

      // Default options if all fetches fail
      setDepartmentOptions(["Department 1", "Department 2"]);
      setGivenByOptions(["User 1", "User 2"]);
      setDoerOptions(["Doer 1", "Doer 2"]);
    }
  };

  // Update date display format
  const getFormattedDate = (date) => {
    if (!date) return "Select a date";
    return formatDate(date);
  };

  // NEW: Function to combine date and time into DD/MM/YYYY HH:MM:SS format
  const formatDateTimeForStorage = (date, time) => {
    if (!date || !time) return "";

    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const year = d.getFullYear();

    // Time is already in HH:MM format, just add :00 for seconds
    const timeWithSeconds = time + ":00";

    return `${day}/${month}/${year} ${timeWithSeconds}`;
  };

  // NEW: Function to get current timestamp in DD/MM/YYYY HH:MM:SS format
  const getCurrentTimestamp = () => {
    const now = new Date();
    const day = now.getDate().toString().padStart(2, "0");
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const year = now.getFullYear();
    const hour = now.getHours().toString().padStart(2, "0");
    const minute = now.getMinutes().toString().padStart(2, "0");
    const second = now.getSeconds().toString().padStart(2, "0");

    return `${day}/${month}/${year} ${hour}:${minute}:${second}`;
  };

  // NEW: Function to get formatted display for date and time
  const getFormattedDateTime = () => {
    if (!date) return "Select date and time";

    const dateStr = formatDate(date);
    const timeStr = time || "09:00";

    return `${dateStr} at ${timeStr}`;
  };

  useEffect(() => {
    fetchMasterSheetOptions();
  }, []);

  // Add a function to get the last task ID from the specified sheet
  const getLastTaskId = async (sheetName) => {
    try {
      const appsScriptUrl = "https://script.google.com/macros/s/AKfycbyGf3LdYk6MPiOs_shPU9_AW7wmRjJZ4QxMk9qYqTScsDMB7IliaWRB1HueYy7w5qxqNw/exec";
      const url = `${appsScriptUrl}?sheet=${encodeURIComponent(sheetName)}&action=fetch`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (
        !data ||
        !data.table ||
        !data.table.rows ||
        data.table.rows.length <= 1
      ) {
        console.log(`No existing tasks found in ${sheetName}, starting from ID 1`);
        return 0; // Start from 1 if no tasks exist (only header row)
      }

      // Get the last task ID from column B (index 1)
      let lastTaskId = 0;
      // Skip the first row (header) by starting from index 1
      for (let i = 1; i < data.table.rows.length; i++) {
        const row = data.table.rows[i];
        if (row.c && row.c[1] && row.c[1].v) {
          const taskIdValue = row.c[1].v.toString().trim();
          const taskId = parseInt(taskIdValue);
          if (!isNaN(taskId) && taskId > lastTaskId) {
            lastTaskId = taskId;
          }
        }
      }

      console.log(`Last Task ID in ${sheetName}: ${lastTaskId}`);
      return lastTaskId;
    } catch (error) {
      console.error("Error fetching last task ID:", error);
      return 0;
    }
  };

  // UPDATED: Date formatting function to return DD/MM/YYYY format (for working days comparison)
  const formatDateToDDMMYYYY = (date) => {
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Function to fetch working days from the Working Day Calendar sheet
  const fetchWorkingDays = async () => {
    try {
      const appsScriptUrl = "https://script.google.com/macros/s/AKfycbyGf3LdYk6MPiOs_shPU9_AW7wmRjJZ4QxMk9qYqTScsDMB7IliaWRB1HueYy7w5qxqNw/exec";
      const sheetName = "Working Day Calendar";

      const url = `${appsScriptUrl}?sheet=${encodeURIComponent(sheetName)}&action=fetch`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch working days: ${response.status}`);
      }

      const text = await response.text();
      let parsedData;
      try {
        parsedData = JSON.parse(text);
      } catch (e) {
        // Robust JSON extraction if response is wrapped
        const jsonStart = text.indexOf("{");
        const jsonEnd = text.lastIndexOf("}");
        if (jsonStart !== -1 && jsonEnd !== -1) {
          parsedData = JSON.parse(text.substring(jsonStart, jsonEnd + 1));
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

      if (rows.length === 0) return [];

      // Extract dates from column A
      const workingDays = [];

      // Skip header row
      rows.slice(1).forEach((row) => {
        let dateValue = null;

        // Extract cell value - Column A (index 0)
        if (row.c && row.c[0]) {
          // Prefer formatted value 'f', then raw value 'v'
          dateValue = row.c[0].f || row.c[0].v;
        } else if (Array.isArray(row) && row[0] !== undefined) {
          dateValue = row[0];
        }

        if (dateValue === null || dateValue === undefined || dateValue === "") return;

        // Normalize to string and trim
        dateValue = dateValue.toString().trim();

        let formattedDate = null;

        // 1. Handle DD/MM/YYYY or D/M/YYYY
        if (dateValue.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
          const [d, m, y] = dateValue.split('/').map(Number);
          formattedDate = `${d.toString().padStart(2, "0")}/${m.toString().padStart(2, "0")}/${y}`;
        }
        // 2. Handle Google Date format: Date(2026,1,23)
        else if (dateValue.startsWith("Date(")) {
          const match = /Date\((\d+),(\d+),(\d+)/.exec(dateValue);
          if (match) {
            const year = parseInt(match[1], 10);
            const month = parseInt(match[2], 10) + 1; // 0-indexed month
            const day = parseInt(match[3], 10);
            formattedDate = `${day.toString().padStart(2, "0")}/${month.toString().padStart(2, "0")}/${year}`;
          }
        }
        // 3. Fallback to generic JS Date parsing
        else {
          try {
            const d = new Date(dateValue);
            if (!isNaN(d.getTime())) {
              formattedDate = formatDateToDDMMYYYY(d);
            }
          } catch (e) {
            // Skip unparseable dates
          }
        }

        if (formattedDate && formattedDate.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
          workingDays.push(formattedDate);
        }
      });

      console.log(`Found ${workingDays.length} valid working days`);
      return workingDays;
    } catch (error) {
      console.error("Error fetching working days:", error);
      return [];
    }
  };

  // NEW: Helper function to find next working day for a given date
  const findNextWorkingDay = (targetDate, workingDays) => {
    const targetDateStr = formatDateToDDMMYYYY(targetDate);

    // If target date is already a working day, return it
    if (workingDays.includes(targetDateStr)) {
      return targetDateStr;
    }

    // Otherwise, find the next working day
    let checkDate = new Date(targetDate);
    for (let i = 1; i <= 30; i++) {
      // Check up to 30 days ahead
      checkDate = addDays(targetDate, i);
      const checkDateStr = formatDateToDDMMYYYY(checkDate);
      if (workingDays.includes(checkDateStr)) {
        return checkDateStr;
      }
    }

    // If no working day found in 30 days, return the original target date
    return targetDateStr;
  };

  // UPDATED: generateTasks function with proper frequency logic
  const generateTasks = async () => {
    if (
      !date ||
      !time ||
      !formData.doer ||
      !formData.description ||
      !formData.frequency
    ) {
      alert("Please fill in all required fields including date and time.");
      return;
    }

    // For one-time frequency, generate a single task with specific date
    if (formData.frequency === "one-time") {
      // Fetch working days and find the appropriate date (your existing logic)
      const workingDays = await fetchWorkingDays();
      if (workingDays.length === 0) {
        alert(
          "Could not retrieve working days. Please make sure the Working Day Calendar sheet is properly set up.",
        );
        return;
      }

      const sortedWorkingDays = [...workingDays].sort((a, b) => {
        const [dayA, monthA, yearA] = a.split("/").map(Number);
        const [dayB, monthB, yearB] = b.split("/").map(Number);
        return (
          new Date(yearA, monthA - 1, dayA) - new Date(yearB, monthB - 1, dayB)
        );
      });

      const selectedDate = new Date(date);
      selectedDate.setHours(0, 0, 0, 0); // Standardize to midnight for comparison

      const futureDates = sortedWorkingDays.filter((dateStr) => {
        try {
          const [dateDay, month, year] = dateStr.split("/").map(Number);
          const dateObj = new Date(year, month - 1, dateDay);
          dateObj.setHours(0, 0, 0, 0);
          return dateObj >= selectedDate;
        } catch (e) {
          return false;
        }
      });

      if (futureDates.length === 0) {
        alert(
          "No working days found on or after your selected date. Please choose a different End Date or update the Working Day Calendar.",
        );
        return;
      }

      const startDateStr = formatDateToDDMMYYYY(selectedDate);
      let startIndex = futureDates.findIndex((d) => d === startDateStr);

      if (startIndex === -1) {
        startIndex = 0;
        alert(
          `The selected date (${startDateStr}) is not in the Working Day Calendar. The next available working day will be used instead: ${futureDates[0]}`,
        );
      }

      const taskDateStr = futureDates[startIndex];
      const taskDateTimeStr = formatDateTimeForStorage(
        new Date(taskDateStr.split("/").reverse().join("-")),
        time,
      );

      const tasks = [
        {
          description: formData.description,
          department: formData.department,
          givenBy: formData.givenBy,
          doer: formData.doer,
          dueDate: taskDateTimeStr,
          status: "pending",
          frequency: formData.frequency,
          enableReminders: formData.enableReminders,
          requireAttachment: formData.requireAttachment,
        },
      ];

      setGeneratedTasks(tasks);
    } else {
      // For recurring frequencies, generate only ONE task with the End Date
      // The recurrence logic will be handled by your backend/system
      const taskDateTimeStr = formatDateTimeForStorage(date, time);

      const tasks = [
        {
          description: formData.description,
          department: formData.department,
          givenBy: formData.givenBy,
          doer: formData.doer,
          dueDate: taskDateTimeStr, // This becomes the End Date for recurrence
          status: "pending",
          frequency: formData.frequency,
          enableReminders: formData.enableReminders,
          requireAttachment: formData.requireAttachment,
        },
      ];

      setGeneratedTasks(tasks);
    }

    setAccordionOpen(true);
  };

  // Helper function to find the closest working day to a target date
  const findClosestWorkingDayIndex = (workingDays, targetDateStr) => {
    // Parse the target date (DD/MM/YYYY format)
    const [targetDay, targetMonth, targetYear] = targetDateStr
      .split("/")
      .map(Number);
    const targetDate = new Date(targetYear, targetMonth - 1, targetDay);

    // Find the closest working day (preferably after the target date)
    let closestIndex = -1;
    let minDifference = Infinity;

    for (let i = 0; i < workingDays.length; i++) {
      const [workingDay, workingMonth, workingYear] = workingDays[i]
        .split("/")
        .map(Number);
      const currentDate = new Date(workingYear, workingMonth - 1, workingDay);

      // Calculate difference in days
      const difference = Math.abs(
        (currentDate - targetDate) / (1000 * 60 * 60 * 24),
      );

      if (currentDate >= targetDate && difference < minDifference) {
        minDifference = difference;
        closestIndex = i;
      }
    }

    // If no working day found after the target date, find the closest one before
    if (closestIndex === -1) {
      for (let i = workingDays.length - 1; i >= 0; i--) {
        const [workingDay2, workingMonth2, workingYear2] = workingDays[i]
          .split("/")
          .map(Number);
        const currentDate2 = new Date(
          workingYear2,
          workingMonth2 - 1,
          workingDay2,
        );

        if (currentDate2 < targetDate) {
          closestIndex = i;
          break;
        }
      }
    }

    return closestIndex !== -1 ? closestIndex : workingDays.length - 1;
  };

  // Helper function to find the date for the end of a specific week in a month
  const findEndOfWeekDate = (date, weekNumber, workingDays) => {
    const year = date.getFullYear();
    const month = date.getMonth();

    // Get all working days in the target month (DD/MM/YYYY format)
    const daysInMonth = workingDays.filter((dateStr) => {
      const [, m, y] = dateStr.split("/").map(Number);
      return y === year && m === month + 1;
    });

    // Sort them chronologically
    daysInMonth.sort((a, b) => {
      const [dayA] = a.split("/").map(Number);
      const [dayB] = b.split("/").map(Number);
      return dayA - dayB;
    });

    // Group by weeks (assuming Monday is the first day of the week)
    const weekGroups = [];
    let currentWeek = [];
    let lastWeekDay = -1;

    for (const dateStr of daysInMonth) {
      const [workingDay2, m, y] = dateStr.split("/").map(Number);
      const dateObj = new Date(y, m - 1, workingDay2);
      const weekDay = dateObj.getDay(); // 0 for Sunday, 1 for Monday, etc.

      if (weekDay <= lastWeekDay || currentWeek.length === 0) {
        if (currentWeek.length > 0) {
          weekGroups.push(currentWeek);
        }
        currentWeek = [dateStr];
      } else {
        currentWeek.push(dateStr);
      }

      lastWeekDay = weekDay;
    }

    if (currentWeek.length > 0) {
      weekGroups.push(currentWeek);
    }

    // Return the last day of the requested week
    if (weekNumber === -1) {
      // Last week of the month
      return (
        weekGroups[weekGroups.length - 1]?.[
        weekGroups[weekGroups.length - 1].length - 1
        ] || daysInMonth[daysInMonth.length - 1]
      );
    } else if (weekNumber > 0 && weekNumber <= weekGroups.length) {
      // Specific week
      return (
        weekGroups[weekNumber - 1]?.[weekGroups[weekNumber - 1].length - 1] ||
        daysInMonth[daysInMonth.length - 1]
      );
    } else {
      // Default to the last day of the month if the requested week doesn't exist
      return daysInMonth[daysInMonth.length - 1];
    }
  };

  // UPDATED: handleSubmit function with first-time user check logic

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (generatedTasks.length === 0) {
        alert(
          "Please generate tasks first by clicking Preview Generated Tasks",
        );
        setIsSubmitting(false);
        return;
      }

      // Validate that department is selected
      if (!formData.department || formData.department.trim() === "") {
        alert("Please select a department before submitting tasks");
        setIsSubmitting(false);
        return;
      }

      // Check if getLastTaskId function exists
      if (typeof getLastTaskId !== "function") {
        console.error("getLastTaskId function is not defined");
        alert(
          "System error: Task ID function not found. Please refresh the page.",
        );
        setIsSubmitting(false);
        return;
      }

      // Helper function to check if this is the first task for the user
      const isFirstTaskForUser = async (doerName) => {
        try {
          const appsScriptUrl = "https://script.google.com/macros/s/AKfycbyGf3LdYk6MPiOs_shPU9_AW7wmRjJZ4QxMk9qYqTScsDMB7IliaWRB1HueYy7w5qxqNw/exec";
          const sheetName = "Checklist";

          const url = `${appsScriptUrl}?sheet=${encodeURIComponent(sheetName)}&action=fetch`;

          const response = await fetch(url);
          if (!response.ok) {
            console.log("Checklist sheet not found - treating as first task");
            return true;
          }

          const data = await response.json();

          if (!data || !data.table || !data.table.rows || data.table.rows.length <= 1) {
            console.log("Checklist sheet is empty - treating as first task");
            return true;
          }

          // Check if doer name exists in column E (index 4) - "name" column
          for (let i = 1; i < data.table.rows.length; i++) {
            const row = data.table.rows[i];
            if (row.c && row.c[4] && row.c[4].v) {
              const existingDoer = row.c[4].v.toString().trim();
              if (existingDoer === doerName.trim()) {
                console.log(
                  `User "${doerName}" found in Checklist - NOT first task`,
                );
                return false;
              }
            }
          }

          console.log(
            `User "${doerName}" NOT found in Checklist - IS first task`,
          );
          return true;
        } catch (error) {
          console.error("Error checking first task:", error);
          return true;
        }
      };

      // Determine the sheet(s) based on frequency and first-time user check
      let submitToSheets = [];

      if (formData.frequency === "one-time") {
        submitToSheets = ["DELEGATION"];
        console.log("One-time task - submitting to DELEGATION only");
      } else {
        const isFirstTask = await isFirstTaskForUser(formData.doer);
        if (isFirstTask) {
          // Submit to BOTH Unique and Checklist for first-time user
          submitToSheets = ["Unique", "Checklist"];
          console.log(
            "First task for user - submitting to both Unique and Checklist",
          );
        } else {
          // Submit to BOTH Unique and Checklist for existing user as well (as per your requirement)
          submitToSheets = ["Unique", "Checklist"];
          console.log(
            "Existing user - submitting to BOTH Unique and Checklist",
          );
        }
      }

      console.log(`Selected department: ${formData.department}`);
      console.log(`Doer: ${formData.doer}`);
      console.log(`Target sheets: ${submitToSheets.join(", ")}`);

      // Function to submit data to a sheet
      const submitToSheet = async (sheetName, data) => {
        try {
          const formPayload = new FormData();
          formPayload.append("sheetName", sheetName);
          formPayload.append("action", "insert");
          formPayload.append("batchInsert", "true");
          formPayload.append("rowData", JSON.stringify(data));

          console.log(`Submitting to ${sheetName}:`, data);

          await fetch(
            "https://script.google.com/macros/s/AKfycbyGf3LdYk6MPiOs_shPU9_AW7wmRjJZ4QxMk9qYqTScsDMB7IliaWRB1HueYy7w5qxqNw/exec",
            {
              method: "POST",
              body: formPayload,
              mode: "no-cors",
            },
          );

          console.log(`Successfully submitted to ${sheetName}`);
          return true;
        } catch (error) {
          console.error(`Error submitting to ${sheetName}:`, error);
          return false;
        }
      };

      // Submit to each target sheet
      const submissionResults = [];

      for (const sheetName of submitToSheets) {
        console.log(`Processing sheet: ${sheetName}`);

        if (sheetName === "DELEGATION") {
          // For DELEGATION sheet - get taskId
          const lastTaskId = await getLastTaskId(sheetName);
          let nextTaskId = lastTaskId + 1;

          // Prepare data for DELEGATION with taskId
          const delegationData = generatedTasks.map((task, index) => {
            return {
              timestamp: getCurrentTimestamp(),
              department: formData.department,
              givenBy: formData.givenBy,
              name: formData.doer,
              description: task.description,
              startDate: task.dueDate,
              freq: task.frequency,
              enableReminders: task.enableReminders ? "Yes" : "No",
              requireAttachment: task.requireAttachment ? "Yes" : "No",
              taskId: (nextTaskId + index).toString(),
            };
          });

          const result = await submitToSheet(sheetName, delegationData);
          if (result) submissionResults.push(sheetName);
        } else if (sheetName === "Unique") {
          // For Unique sheet - get taskId
          const lastTaskId = await getLastTaskId(sheetName);
          let nextTaskId = lastTaskId + 1;

          // Prepare data for Unique with taskId
          const uniqueData = generatedTasks.map((task, index) => {
            return {
              timestamp: getCurrentTimestamp(),
              department: formData.department,
              givenBy: formData.givenBy,
              name: formData.doer,
              description: task.description,
              startDate: task.dueDate,
              freq: task.frequency,
              enableReminders: task.enableReminders ? "Yes" : "No",
              requireAttachment: task.requireAttachment ? "Yes" : "No",
              taskId: (nextTaskId + index).toString(),
            };
          });

          const result = await submitToSheet(sheetName, uniqueData);
          if (result) submissionResults.push(sheetName);
        } else if (sheetName === "Checklist") {
          // For Checklist sheet - NO taskId
          const checklistData = generatedTasks.map((task, index) => {
            return {
              timestamp: getCurrentTimestamp(),
              department: formData.department,
              givenBy: formData.givenBy,
              name: formData.doer,
              description: task.description,
              startDate: task.dueDate,
              freq: task.frequency,
              enableReminders: task.enableReminders ? "Yes" : "No",
              requireAttachment: task.requireAttachment ? "Yes" : "No",
              // NO taskId for Checklist
            };
          });

          // Try different variations of Checklist sheet name
          const checklistVariations = [
            "Checklist",
            "CHECKLIST",
            "checklist",
            "CheckList",
          ];
          let checklistSubmitted = false;

          for (const variation of checklistVariations) {
            console.log(`Trying Checklist as: ${variation}`);
            try {
              const checklistFormPayload = new FormData();
              checklistFormPayload.append("sheetName", variation);
              checklistFormPayload.append("action", "insert");
              checklistFormPayload.append("batchInsert", "true");
              checklistFormPayload.append(
                "rowData",
                JSON.stringify(checklistData),
              );

              await fetch(
                "https://script.google.com/macros/s/AKfycbyGf3LdYk6MPiOs_shPU9_AW7wmRjJZ4QxMk9qYqTScsDMB7IliaWRB1HueYy7w5qxqNw/exec",
                {
                  method: "POST",
                  body: checklistFormPayload,
                  mode: "no-cors",
                },
              );

              console.log(
                `Successfully submitted to Checklist as ${variation}`,
              );
              checklistSubmitted = true;
              submissionResults.push("Checklist");
              break;
            } catch (error) {
              console.error(`Error submitting to ${variation}:`, error);
              continue;
            }
          }

          if (!checklistSubmitted) {
            console.warn(
              "Could not submit to Checklist sheet with any name variation",
            );
          }
        }
      }

      // Show success message
      if (submissionResults.length > 0) {
        const sheetNames = submissionResults.join(" and ");
        alert(
          `Successfully submitted ${generatedTasks.length} task${generatedTasks.length !== 1 ? "s" : ""} to ${sheetNames} sheet${submissionResults.length > 1 ? "s" : ""}!`,
        );
      } else {
        alert("Failed to submit tasks. Please try again.");
      }

      // Reset form
      setFormData({
        department: "",
        givenBy: "",
        doer: "",
        description: "",
        frequency: "one-time",
        enableReminders: true,
        requireAttachment: false,
      });
      setSelectedDate(new Date());
      setTime(getCurrentTime());
      setGeneratedTasks([]);
      setAccordionOpen(false);
    } catch (error) {
      console.error("Submission error:", error);
      alert("Failed to assign tasks. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };
  // Helper function to format date for display in preview
  const formatDateForDisplay = (dateTimeStr) => {
    // dateTimeStr is in format "DD/MM/YYYY HH:MM:SS"
    return dateTimeStr;
  };

  // NEW: Function to get the target sheet display name for preview
  const getTargetSheetDisplay = () => {
    if (!formData.department) return "Please select a department first";

    if (formData.frequency === "one-time") {
      return "DELEGATION sheet";
    } else {
      return "Checklist sheet";
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold tracking-tight mb-6 text-purple-500">
          Assign New Task
        </h1>
        <div className="rounded-lg border border-purple-200 bg-white shadow-md overflow-hidden">
          <form onSubmit={handleSubmit}>
            <div className="bg-linear-to-r from-purple-50 to-pink-50 p-6 border-b border-purple-100">
              <h2 className="text-xl font-semibold text-purple-700">
                Task Details
              </h2>
              <p className="text-purple-600">
                Fill in the details to assign a new task to a staff member.
              </p>
            </div>
            <div className="p-6 space-y-4">
              {/* Department Name Dropdown */}
              <div className="space-y-2">
                <label
                  htmlFor="department"
                  className="block text-sm font-medium text-purple-700"
                >
                  Department Name *
                </label>
                <select
                  id="department"
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  required
                  className="w-full rounded-md border border-purple-200 p-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="">Select Department</option>
                  {departmentOptions.map((dept, index) => (
                    <option key={index} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
                {formData.department && (
                  <p className="text-xs text-purple-600">
                    Tasks will be stored in Task List sheet
                  </p>
                )}
              </div>

              {/* Given By Dropdown */}
              <div className="space-y-2">
                <label
                  htmlFor="givenBy"
                  className="block text-sm font-medium text-purple-700"
                >
                  Given By
                </label>
                <select
                  id="givenBy"
                  name="givenBy"
                  value={formData.givenBy}
                  onChange={handleChange}
                  required
                  className="w-full rounded-md border border-purple-200 p-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="">Select Given By</option>
                  {givenByOptions.map((person, index) => (
                    <option key={index} value={person}>
                      {person}
                    </option>
                  ))}
                </select>
              </div>

              {/* Doer's Name Dropdown */}
              <div className="space-y-2">
                <label
                  htmlFor="doer"
                  className="block text-sm font-medium text-purple-700"
                >
                  Doer's Name
                </label>
                <select
                  id="doer"
                  name="doer"
                  value={formData.doer}
                  onChange={handleChange}
                  required
                  className="w-full rounded-md border border-purple-200 p-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="">Select Doer</option>
                  {doerOptions.map((doer, index) => (
                    <option key={index} value={doer}>
                      {doer}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-purple-700"
                >
                  Task Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Enter task description"
                  rows={4}
                  required
                  className="w-full rounded-md border border-purple-200 p-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              {/* Date, Time and Frequency */}
              <div className="grid gap-4 md:grid-cols-3">
                {/* Date Picker */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-purple-700">
                    Task Start Date
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowCalendar(!showCalendar)}
                      className="w-full flex justify-start items-center rounded-md border border-purple-200 p-2 text-left focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                      <Calendar className="mr-2 h-4 w-4 text-purple-500" />
                      {date ? getFormattedDate(date) : "Select a date"}
                    </button>
                    {showCalendar && (
                      <div className="absolute z-10 mt-1">
                        <CalendarComponent
                          date={date}
                          onChange={setSelectedDate}
                          onClose={() => setShowCalendar(false)}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* NEW: Time Picker */}
                <div className="space-y-2">
                  <label
                    htmlFor="time"
                    className="block text-sm font-medium text-purple-700"
                  >
                    Time
                  </label>
                  <div className="relative">
                    <input
                      type="time"
                      id="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      required
                      className="w-full rounded-md border border-purple-200 p-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 pl-8"
                    />
                    <Clock className="absolute left-2 top-2.5 h-4 w-4 text-purple-500" />
                  </div>
                </div>

                {/* Frequency */}
                <div className="space-y-2">
                  <label
                    htmlFor="frequency"
                    className="block text-sm font-medium text-purple-700"
                  >
                    Frequency
                  </label>
                  <select
                    id="frequency"
                    name="frequency"
                    value={formData.frequency}
                    onChange={handleChange}
                    className="w-full rounded-md border border-purple-200 p-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    {frequencies.map((freq) => (
                      <option key={freq.value} value={freq.value}>
                        {freq.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Additional Options */}
              <div className="space-y-4 pt-2 border-t border-purple-100">
                <h3 className="text-lg font-medium text-purple-700 pt-2">
                  Additional Options
                </h3>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label
                      htmlFor="enable-reminders"
                      className="text-purple-700 font-medium"
                    >
                      Enable Reminders
                    </label>
                    <p className="text-sm text-purple-600">
                      Send reminders before task due date
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <BellRing className="h-4 w-4 text-purple-500" />
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        id="enable-reminders"
                        checked={formData.enableReminders}
                        onChange={(e) =>
                          handleSwitchChange("enableReminders", e)
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label
                      htmlFor="require-attachment"
                      className="text-purple-700 font-medium"
                    >
                      Require Attachment
                    </label>
                    <p className="text-sm text-purple-600">
                      User must upload a file when completing task
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <FileCheck className="h-4 w-4 text-purple-500" />
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        id="require-attachment"
                        checked={formData.requireAttachment}
                        onChange={(e) =>
                          handleSwitchChange("requireAttachment", e)
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Preview and Submit Buttons */}
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={generateTasks}
                  className="w-full rounded-md border border-purple-200 bg-purple-50 py-2 px-4 text-purple-700 hover:bg-purple-100 hover:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                >
                  Preview Generated Tasks
                </button>

                {generatedTasks.length > 0 && (
                  <div className="w-full">
                    <div className="border border-purple-200 rounded-md">
                      <button
                        type="button"
                        onClick={() => setAccordionOpen(!accordionOpen)}
                        className="w-full flex justify-between items-center p-4 text-purple-700 hover:bg-purple-50 focus:outline-none"
                      >
                        <span className="font-medium">
                          {generatedTasks.length} Task
                          {generatedTasks.length !== 1 ? "s" : ""} Generated
                          {formData.frequency === "one-time"
                            ? " (Will be stored in DELEGATION sheet)"
                            : ` (Recurring task - Will be stored in Task List sheet)`}
                        </span>
                        <svg
                          className={`w-5 h-5 transition-transform ${accordionOpen ? "rotate-180" : ""
                            }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>

                      {accordionOpen && (
                        <div className="p-4 border-t border-purple-200">
                          <div className="max-h-60 overflow-y-auto space-y-2">
                            {generatedTasks.slice(0, 20).map((task, index) => (
                              <div
                                key={index}
                                className="text-sm p-2 border rounded-md border-purple-200 bg-purple-50"
                              >
                                <div className="font-medium text-purple-700">
                                  {task.description}
                                </div>
                                <div className="text-xs text-purple-600">
                                  Due: {formatDateForDisplay(task.dueDate)} |
                                  Department: {task.department}
                                </div>
                                <div className="flex space-x-2 mt-1">
                                  {task.enableReminders && (
                                    <span className="inline-flex items-center text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                                      <BellRing className="h-3 w-3 mr-1" />{" "}
                                      Reminders
                                    </span>
                                  )}
                                  {task.requireAttachment && (
                                    <span className="inline-flex items-center text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                                      <FileCheck className="h-3 w-3 mr-1" />{" "}
                                      Attachment Required
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                            {generatedTasks.length > 20 && (
                              <div className="text-sm text-center text-purple-600 py-2">
                                ...and {generatedTasks.length - 20} more tasks
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between bg-linear-to-r from-purple-50 to-pink-50 p-6 border-t border-purple-100">
              <button
                type="button"
                onClick={() => {
                  setFormData({
                    department: "",
                    givenBy: "",
                    doer: "",
                    description: "",
                    frequency: "One Time (No Recurrence)",
                    enableReminders: true,
                    requireAttachment: false,
                  });
                  setSelectedDate(new Date());
                  setTime(getCurrentTime());
                  setGeneratedTasks([]);
                  setAccordionOpen(false);
                }}
                className="rounded-md border border-purple-200 py-2 px-4 text-purple-700 hover:border-purple-300 hover:bg-purple-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-linear-to-r from-purple-600 to-pink-600 py-2 px-4 text-white hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Assigning..." : "Assign Task"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AdminLayout>
  );
}
