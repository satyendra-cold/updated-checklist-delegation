"use client";
import { useCallback, useEffect, useState, useMemo } from "react";
import { format } from "date-fns";
import { Search, ChevronDown, Filter } from "lucide-react";

export default function DelegationPage({
  searchTerm,
  nameFilter,
  freqFilter,
  setNameFilter,
  setFreqFilter,
  currentUser,
  userRole,
}) {
  const [delegationTasks, setDelegationTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [dropdownOpen, setDropdownOpen] = useState({
    name: false,
    frequency: false,
  });

  // Config should be memoized to prevent unnecessary re-renders
  const CONFIG = useMemo(
    () => ({
      APPS_SCRIPT_URL:
        "https://script.google.com/macros/s/AKfycbyGf3LdYk6MPiOs_shPU9_AW7wmRjJZ4QxMk9qYqTScsDMB7IliaWRB1HueYy7w5qxqNw/exec",
      DELEGATION_SHEET: "Delegation",
    }),
    []
  );

  // Format date helper function
  const formatDate = useCallback((dateValue) => {
    if (!dateValue) return "";
    try {
      const date = new Date(dateValue);
      return isNaN(date.getTime())
        ? dateValue
        : format(date, "dd/MM/yyyy HH:mm");
    } catch {
      return dateValue;
    }
  }, []);

  // Fetch data with role-based filtering
  const fetchData = useCallback(async () => {
    if (!currentUser || !userRole) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${CONFIG.APPS_SCRIPT_URL}?sheet=${CONFIG.DELEGATION_SHEET}&action=fetch`,
        { redirect: "follow" }
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();

      if (data?.table?.rows) {
        const transformedData = data.table.rows
          .slice(1)
          .map((row, rowIndex) => ({
            _id: `row_${rowIndex}_${Date.now()}`,
            _rowIndex: rowIndex + 2,
            Timestamp: formatDate(row.c[0]?.v),
            "Task ID": row.c[1]?.v || "",
            Department: row.c[2]?.v || "",
            "Given By": row.c[3]?.v || "",
            Name: row.c[4]?.v || "",
            "Task Description": row.c[5]?.v || "",
            "Task End Date": formatDate(row.c[6]?.v),
            Freq: row.c[7]?.v || "",
            "Enable Reminders": row.c[8]?.v || "",
            "Require Attachment": row.c[9]?.v || "",
          }));

        // Apply role-based filtering
        let filteredData;
        if (userRole === "admin" || userRole === "superadmin" || userRole === "super_admin") {
          filteredData = transformedData;
        } else {
          filteredData = transformedData.filter((task) => {
            const taskName = (task.Name || "").toString().toLowerCase().trim();
            const taskGivenBy = (task["Given By"] || "")
              .toString()
              .toLowerCase()
              .trim();
            const currentUserLower = currentUser.toLowerCase().trim();

            return (
              taskName === currentUserLower || taskGivenBy === currentUserLower
            );
          });
        }

        setDelegationTasks(filteredData);
      } else {
        throw new Error("Invalid data format");
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setError(err.message || "Failed to load delegation data");
    } finally {
      setLoading(false);
    }
  }, [CONFIG, currentUser, userRole, formatDate]);

  // Sort function
  const requestSort = useCallback(
    (key) => {
      if (loading) return;
      setSortConfig((prev) => ({
        key,
        direction:
          prev.key === key && prev.direction === "asc" ? "desc" : "asc",
      }));
    },
    [loading]
  );

  // Dropdown toggle
  const toggleDropdown = useCallback((dropdown) => {
    setDropdownOpen((prev) => ({
      ...prev,
      [dropdown]: !prev[dropdown],
    }));
  }, []);

  // Filter handlers
  const handleNameFilterSelect = useCallback(
    (name) => {
      setNameFilter(name);
      setDropdownOpen((prev) => ({ ...prev, name: false }));
    },
    [setNameFilter]
  );

  const handleFrequencyFilterSelect = useCallback(
    (freq) => {
      setFreqFilter(freq);
      setDropdownOpen((prev) => ({ ...prev, frequency: false }));
    },
    [setFreqFilter]
  );

  const clearNameFilter = useCallback(() => {
    setNameFilter("");
    setDropdownOpen((prev) => ({ ...prev, name: false }));
  }, [setNameFilter]);

  const clearFrequencyFilter = useCallback(() => {
    setFreqFilter("");
    setDropdownOpen((prev) => ({ ...prev, frequency: false }));
  }, [setFreqFilter]);

  // Memoized derived data
  const { allNames, allFrequencies, filteredTasks } = useMemo(() => {
    const names = [...new Set(delegationTasks.map((task) => task.Name))].filter(
      (name) => name?.trim()
    );

    const freqs = [...new Set(delegationTasks.map((task) => task.Freq))].filter(
      (freq) => freq?.trim()
    );

    const filtered = delegationTasks
      .filter((task) => {
        const nameMatch = !nameFilter || task.Name === nameFilter;
        const freqMatch = !freqFilter || task.Freq === freqFilter;
        const searchMatch =
          !searchTerm ||
          Object.values(task).some((value) =>
            value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
          );
        return nameMatch && freqMatch && searchMatch;
      })
      .sort((a, b) => {
        if (!sortConfig.key) return 0;
        const aValue = a[sortConfig.key] || "";
        const bValue = b[sortConfig.key] || "";
        return sortConfig.direction === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      });

    return { allNames: names, allFrequencies: freqs, filteredTasks: filtered };
  }, [delegationTasks, nameFilter, freqFilter, searchTerm, sortConfig]);

  // Table columns config
  const columns = useMemo(
    () => [
      { key: "Timestamp", label: "Timestamp" },
      { key: "Task ID", label: "Task ID" },
      { key: "Department", label: "Department" },
      { key: "Given By", label: "Given By" },
      { key: "Name", label: "Name" },
      {
        key: "Task Description",
        label: "Task Description",
        minWidth: "min-w-[300px]",
      },
      { key: "Task End Date", label: "End Date", bg: "bg-yellow-50" },
      { key: "Freq", label: "Frequency" },
      { key: "Enable Reminders", label: "Reminders" },
      { key: "Require Attachment", label: "Attachment" },
    ],
    []
  );

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!currentUser || !userRole) {
    return (
      <div className="mt-4 bg-yellow-50 p-4 rounded-md text-yellow-800 text-center">
        Loading delegation tasks...
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-purple-200 shadow-md bg-white overflow-hidden">
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 p-4">
        <h2 className="text-purple-700 font-medium">
          {userRole === "admin"
            ? "All Delegation Tasks"
            : "My Delegation Tasks"}
        </h2>
        <p className="text-purple-600 text-sm">
          {userRole === "admin"
            ? `Showing ${filteredTasks.length} delegation tasks from all users`
            : `Showing ${filteredTasks.length} delegation tasks for ${currentUser}`}
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-800 text-center">
          {error}{" "}
          <button
            onClick={fetchData}
            className="underline ml-2 hover:text-red-600"
          >
            Try again
          </button>
        </div>
      )}

      {loading && (
        <div className="p-8 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500 mb-2"></div>
          <p className="text-purple-600">Loading delegation data...</p>
        </div>
      )}

      <div
        className="hidden sm:block overflow-x-auto"
        style={{ maxHeight: "calc(100vh - 220px)" }}
      >
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0 z-20">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.label}
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${column.bg || ""
                    } ${column.minWidth || ""} ${column.key ? "cursor-pointer hover:bg-gray-100" : ""
                    }`}
                  onClick={() => requestSort(column.key)}
                >
                  <div className="flex items-center">
                    {column.label}
                    {sortConfig.key === column.key && (
                      <span className="ml-1">
                        {sortConfig.direction === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-200">
            {filteredTasks.length > 0 ? (
              filteredTasks.map((task) => (
                <tr key={task._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {task.Timestamp || "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {task["Task ID"] || "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {task.Department || "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {task["Given By"] || "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {task.Name || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 min-w-[300px] max-w-[400px]">
                    <div className="whitespace-normal break-words">
                      {task["Task Description"] || "—"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 bg-yellow-50">
                    {task["Task End Date"] || "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${task.Freq === "Daily"
                        ? "bg-blue-100 text-blue-800"
                        : task.Freq === "Weekly"
                          ? "bg-green-100 text-green-800"
                          : task.Freq === "Monthly"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                    >
                      {task.Freq || "—"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {task["Enable Reminders"] || "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {task["Require Attachment"] || "—"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-4 text-center text-gray-500"
                >
                  {searchTerm || nameFilter || freqFilter
                    ? "No delegation tasks matching your filters"
                    : loading
                      ? "Loading..."
                      : userRole === "admin"
                        ? "No delegation tasks available"
                        : "No delegation tasks assigned to you"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Delegation Tasks Table - Mobile Card View */}
      <div
        className="sm:hidden space-y-4 p-4"
        style={{ maxHeight: "calc(100vh - 220px)", overflowY: "auto" }}
      >
        {loading ? (
          <div className="p-8 text-center">
            {/* <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500 mb-2"></div>
            <p className="text-purple-600">Loading delegation data...</p> */}
          </div>
        ) : filteredTasks.length > 0 ? (
          filteredTasks.map((task) => (
            <div
              key={task._id}
              className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:bg-gray-50"
            >
              <div className="space-y-3">
                {/* Timestamp */}
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="font-medium text-gray-700">Timestamp:</span>
                  <div className="text-sm text-gray-500 break-words">
                    {task.Timestamp || "—"}
                  </div>
                </div>

                {/* Task ID */}
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="font-medium text-gray-700">Task ID:</span>
                  <div className="text-sm font-medium text-gray-900 break-words">
                    {task["Task ID"] || "—"}
                  </div>
                </div>

                {/* Department */}
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="font-medium text-gray-700">Department:</span>
                  <div className="text-sm text-gray-500 break-words">
                    {task.Department || "—"}
                  </div>
                </div>

                {/* Given By */}
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="font-medium text-gray-700">Given By:</span>
                  <div className="text-sm text-gray-500 break-words">
                    {task["Given By"] || "—"}
                  </div>
                </div>

                {/* Name */}
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="font-medium text-gray-700">Name:</span>
                  <div className="text-sm text-gray-500 break-words">
                    {task.Name || "—"}
                  </div>
                </div>

                {/* Task Description */}
                <div className="flex justify-between items-start border-b pb-2">
                  <span className="font-medium text-gray-700">
                    Task Description:
                  </span>
                  <div className="text-sm text-gray-500 break-words text-right max-w-[60%]">
                    {task["Task Description"] || "—"}
                  </div>
                </div>

                {/* Task End Date */}
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="font-medium text-gray-700">End Date:</span>
                  <div className="text-sm text-gray-500 break-words bg-yellow-50 px-2 py-1 rounded">
                    {task["Task End Date"] || "—"}
                  </div>
                </div>

                {/* Frequency */}
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="font-medium text-gray-700">Frequency:</span>
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${task.Freq === "Daily"
                      ? "bg-blue-100 text-blue-800"
                      : task.Freq === "Weekly"
                        ? "bg-green-100 text-green-800"
                        : task.Freq === "Monthly"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                  >
                    {task.Freq || "—"}
                  </span>
                </div>

                {/* Enable Reminders */}
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="font-medium text-gray-700">Reminders:</span>
                  <div className="text-sm text-gray-500 break-words">
                    {task["Enable Reminders"] || "—"}
                  </div>
                </div>

                {/* Require Attachment */}
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-700">Attachment:</span>
                  <div className="text-sm text-gray-500 break-words">
                    {task["Require Attachment"] || "—"}
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center text-gray-500 py-8">
            {searchTerm || nameFilter || freqFilter
              ? "No delegation tasks matching your filters"
              : loading
                ? "Loading..."
                : userRole === "admin"
                  ? "No delegation tasks available"
                  : "No delegation tasks assigned to you"}
          </div>
        )}
      </div>
    </div>
  );
}
