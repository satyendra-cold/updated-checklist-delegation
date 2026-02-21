"use client"
import { useEffect, useState, useCallback } from "react";
import { format } from 'date-fns';
import { Search, ChevronDown, Filter, CloudCog } from "lucide-react";
import AdminLayout from "../components/layout/AdminLayout";
import DelegationPage from "./delegation-data";

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
    const [userRole, setUserRole] = useState(null);
    const [dropdownOpen, setDropdownOpen] = useState({
        name: false,
        frequency: false,
        department: false
    });
    const [departments, setDepartments] = useState([]);
    const [selectedDepartment, setSelectedDepartment] = useState('');
    const [departmentsLoading, setDepartmentsLoading] = useState(true);

    console.log("departments", departments);

    const CONFIG = {
        SHEET_ID: "1YCLFppf8OrwZjKjhVyVB77s63vFQUylXzEniWLeatW0/",
        WHATSAPP_SHEET: "Whatsapp", // For login credentials and user roles
        CHECKLIST_SHEET: "Unique task", // For checklist tasks
        DELEGATION_SHEET: "Delegation", // For delegation tasks
        MASTER_SHEET: "master", // For department list
        PAGE_CONFIG: {
            title: "Task Management",
            description: "Showing your tasks"
        }
    };

    const fetchDepartments = useCallback(async () => {
        try {
            setDepartmentsLoading(true);
            console.log("Fetching departments..."); // Debug log
            const masterSheetUrl = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:json&sheet=${CONFIG.MASTER_SHEET}`;
            const response = await fetch(masterSheetUrl);
            const text = await response.text();
            console.log("Raw response:", text); // Debug log

            const jsonStart = text.indexOf('{');
            const jsonEnd = text.lastIndexOf('}') + 1;
            const jsonData = text.substring(jsonStart, jsonEnd);
            console.log("Parsed JSON:", jsonData); // Debug log
            const data = JSON.parse(jsonData);

            if (data?.table?.rows) {
                console.log("Found rows:", data.table.rows); // Debug log
                const departments = new Set();
                // Skip header row and get unique departments from column A
                data.table.rows.slice(1).forEach((row) => {
                    if (row.c && row.c[0]?.v) {
                        console.log("Found department:", row.c[0].v); // Debug log
                        departments.add(row.c[0].v);
                    }
                });
                const deptArray = Array.from(departments).sort();
                // console.log("Final departments:", deptArray); // Debug log
                setDepartments(deptArray);
            } else {
                console.log("No rows found in master sheet"); // Debug log
                setDepartments([]);
            }
        } catch (err) {
            console.error("Error fetching departments:", err);
            setDepartments([]);
        } finally {
            setDepartmentsLoading(false);
        }

    }, [CONFIG.SHEET_ID, CONFIG.MASTER_SHEET]);


    // Auto-detect current user from login session and get role from Whatsapp sheet
    const fetchCurrentUser = useCallback(async () => {
        try {
            setUserLoading(true);
            setError(null);

            // Get user data from your login system (sessionStorage)
            const loggedInUsername = sessionStorage.getItem('username');

            console.log("Session data found:");
            console.log("Username from session:", loggedInUsername);

            if (!loggedInUsername) {
                throw new Error("No user logged in. Please log in to access tasks.");
            }

            // Fetch user role from Whatsapp sheet
            const whatsappSheetUrl = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:json&sheet=${CONFIG.WHATSAPP_SHEET}`;
            const response = await fetch(whatsappSheetUrl);
            const text = await response.text();

            const jsonStart = text.indexOf('{');
            const jsonEnd = text.lastIndexOf('}') + 1;
            const jsonData = text.substring(jsonStart, jsonEnd);
            const data = JSON.parse(jsonData);

            if (data?.table?.rows) {
                let foundUser = null;

                // Skip header row and search for user
                data.table.rows.slice(1).forEach((row) => {
                    if (row.c) {
                        const doerName = row.c[2]?.v || ""; // Column C - Doer's Name
                        const role = row.c[4]?.v || "user"; // Column E - Role

                        // Match by username (case-insensitive)
                        if (doerName.toLowerCase().trim() === loggedInUsername.toLowerCase().trim()) {
                            foundUser = {
                                name: doerName,
                                role: role.toLowerCase().trim(),
                                department: row.c[0]?.v || "", // Column A - Department
                                givenBy: row.c[1]?.v || "", // Column B - Given By
                                email: row.c[5]?.v || "" // Column F - ID/Email
                            };
                        }
                    }
                });

                if (foundUser) {
                    setCurrentUser(foundUser.name);
                    setUserRole(foundUser.role);
                    console.log("User found in Whatsapp sheet:", foundUser);
                } else {
                    throw new Error(`User "${loggedInUsername}" not found in Whatsapp sheet. Please contact administrator.`);
                }
            } else {
                throw new Error("Could not fetch user data from Whatsapp sheet");
            }
        } catch (err) {
            console.error("Error fetching user:", err);
            setError(err.message);
        } finally {
            setUserLoading(false);
        }
    }, []);

    const fetchChecklistData = useCallback(async () => {
        if (!currentUser || userLoading) return;

        try {
            setLoading(true);

            // Determine which sheet to use based on selected department
            const sheetName = selectedDepartment || CONFIG.CHECKLIST_SHEET;

            // Fetch from Checklist sheet (Unique task or department sheet)
            const checklistUrl = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:json&sheet=${sheetName}`;
            const response = await fetch(checklistUrl);
            const text = await response.text();

            const jsonStart = text.indexOf('{');
            const jsonEnd = text.lastIndexOf('}') + 1;
            const jsonData = text.substring(jsonStart, jsonEnd);
            const data = JSON.parse(jsonData);

            if (data?.table?.rows) {
                const rows = data.table.rows.slice(1); // Skip header
                const transformedData = rows.map((row, rowIndex) => {
                    const baseData = {
                        _id: `checklist_${rowIndex}_${Math.random().toString(36).substring(2, 15)}`,
                        _rowIndex: rowIndex + 2,
                        // Map columns from Checklist sheet based on your structure
                        Department: row.c[0]?.v || "",
                        'Given By': row.c[1]?.v || "",
                        Name: row.c[2]?.v || "",
                        'Task Description': row.c[3]?.v || "",
                        'Task End Date': formatDate(row.c[4]?.v),
                        Freq: row.c[5]?.v || "",
                        'Enable Reminders': row.c[6]?.v || "",
                        'Require Attachment': row.c[7]?.v || "",
                        Task: 'Checklist'
                    };
                    return baseData;
                });

                console.log(`Total checklist tasks:`, transformedData.length);
                console.log("User role:", userRole, "Current user:", currentUser);

                // Apply role-based filtering
                let filteredData;
                if (userRole === 'admin') {
                    // Admin sees all tasks
                    filteredData = transformedData;
                    console.log("Admin access: showing all checklist tasks");
                } else {
                    // Regular user sees only their tasks
                    filteredData = transformedData.filter(item => {
                        const itemName = (item.Name || '').toString().toLowerCase().trim();
                        const itemGivenBy = (item['Given By'] || '').toString().toLowerCase().trim();
                        const currentUserLower = currentUser.toLowerCase().trim();

                        const isAssignedToUser = itemName === currentUserLower;
                        const isGivenByUser = itemGivenBy === currentUserLower;

                        return isAssignedToUser || isGivenByUser;
                    });
                    console.log(`User access: filtered checklist tasks for ${currentUser}:`, filteredData.length);
                }

                setTasks(filteredData);
            } else {
                throw new Error("Invalid checklist data format");
            }
        } catch (err) {
            console.error("Checklist fetch error:", err);
            setError(err.message || "Failed to load checklist data");
        } finally {
            setLoading(false);
        }
    }, [currentUser, userRole, userLoading, selectedDepartment]);

    const fetchDelegationData = useCallback(async () => {
        if (!currentUser || userLoading) return;

        try {
            setDelegationLoading(true);

            // Fetch from Delegation sheet
            const delegationUrl = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:json&sheet=${CONFIG.DELEGATION_SHEET}`;
            const response = await fetch(delegationUrl);
            const text = await response.text();

            const jsonStart = text.indexOf('{');
            const jsonEnd = text.lastIndexOf('}') + 1;
            const jsonData = text.substring(jsonStart, jsonEnd);
            const data = JSON.parse(jsonData);

            if (data?.table?.rows) {
                const rows = data.table.rows.slice(1); // Skip header
                const transformedData = rows.map((row, rowIndex) => {
                    const baseData = {
                        _id: `delegation_${rowIndex}_${Math.random().toString(36).substring(2, 15)}`,
                        _rowIndex: rowIndex + 2,
                        // Map columns from Delegation sheet
                        Timestamp: formatDate(row.c[0]?.v),
                        'Task ID': row.c[1]?.v || "",
                        Department: row.c[2]?.v || "",
                        'Given By': row.c[3]?.v || "",
                        Name: row.c[4]?.v || "",
                        'Task Description': row.c[5]?.v || "",
                        'Task End Date': formatDate(row.c[6]?.v),
                        Freq: row.c[7]?.v || "",
                        'Enable Reminders': row.c[8]?.v || "",
                        'Require Attachment': row.c[9]?.v || "",
                    };
                    return baseData;
                });

                console.log(`Total delegation tasks:`, transformedData.length);

                // Apply role-based filtering
                let filteredData;
                if (userRole === 'admin') {
                    // Admin sees all tasks
                    filteredData = transformedData;
                    console.log("Admin access: showing all delegation tasks");
                } else {
                    // Regular user sees only their tasks
                    filteredData = transformedData.filter(item => {
                        const itemName = (item.Name || '').toString().toLowerCase().trim();
                        const itemGivenBy = (item['Given By'] || '').toString().toLowerCase().trim();
                        const currentUserLower = currentUser.toLowerCase().trim();

                        const isAssignedToUser = itemName === currentUserLower;
                        const isGivenByUser = itemGivenBy === currentUserLower;

                        return isAssignedToUser || isGivenByUser;
                    });
                    console.log(`User access: filtered delegation tasks for ${currentUser}:`, filteredData.length);
                }

                setDelegationTasks(filteredData);
            } else {
                throw new Error("Invalid delegation data format");
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
            const date = new Date(dateValue);
            return isNaN(date.getTime()) ? dateValue : format(date, 'dd/MM/yyyy HH:mm');
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

    const allNames = [
        ...new Set([
            ...tasks.map(task => task.Name),
            ...delegationTasks.map(task => task.Name)
        ])
    ].filter(name => name && typeof name === 'string' && name.trim() !== '');

    const allFrequencies = [
        ...new Set([
            ...tasks.map(task => task.Freq),
            ...delegationTasks.map(task => task.Freq)
        ])
    ].filter(freq => freq && typeof freq === 'string' && freq.trim() !== '');

    const filteredChecklistTasks = tasks.filter(task => {
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

    // Auto-detect user on component mount
    // After the fetchDepartments call in useEffect, add:
    useEffect(() => {
        fetchCurrentUser();
        fetchDepartments().catch(err => {
        });
    }, [fetchCurrentUser, fetchDepartments]);

    // Fetch task data when user is loaded
    useEffect(() => {
        if (currentUser && userRole && !userLoading) {
            console.log("Fetching data for user:", currentUser, "with role:", userRole);
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
                            <div className="relative">
                                {/* <button
                  className={`px-4 py-2 text-sm font-medium ${activeTab === 'checklist' ? 'bg-purple-600 text-white' : 'bg-white text-purple-600 hover:bg-purple-50'} flex items-center gap-1`}
                  onClick={() => {
                    setActiveTab('checklist');
                    toggleDropdown('department');
                  }}
                >
                  {selectedDepartment || 'Select Department'}
                  <ChevronDown size={16} className={`transition-transform ${dropdownOpen.department ? 'rotate-180' : ''}`} />
                </button> */}

                                <select name="" id="" className={`px-4 py-2 text-sm font-medium ${activeTab === 'checklist' ? 'bg-purple-600 text-white' : 'bg-white text-purple-600 hover:bg-purple-50'} flex items-center gap-1`}>
                                    <option value="">Select Department</option>
                                    {departments.map((item) => (
                                        <option value={item} key={item}>{item}</option>
                                    ))}
                                </select>
                                {dropdownOpen.department && (
                                    <div className="absolute z-50 mt-1 w-56 rounded-md bg-white shadow-lg border border-gray-200 max-h-60 overflow-y-auto">
                                        <div className="py-1">
                                            <button
                                                onClick={() => {
                                                    setSelectedDepartment('');
                                                    setDropdownOpen(prev => ({ ...prev, department: false }));
                                                }}
                                                className={`block w-full text-left px-4 py-2 text-sm ${!selectedDepartment ? 'bg-purple-100 text-purple-900' : 'text-gray-700 hover:bg-gray-100'}`}
                                            >
                                                All Departments
                                            </button>
                                            {departmentsLoading ? (
                                                <div className="px-4 py-2 text-sm text-gray-500">Loading departments...</div>
                                            ) : departments.length > 0 ? (
                                                departments.map((dept, index) => (
                                                    <button
                                                        key={`${dept}-${index}`}
                                                        onClick={() => {
                                                            setSelectedDepartment(dept);
                                                            setDropdownOpen(prev => ({ ...prev, department: false }));
                                                        }}
                                                        className={`block w-full text-left px-4 py-2 text-sm ${selectedDepartment === dept ? 'bg-purple-100 text-purple-900' : 'text-gray-700 hover:bg-gray-100'}`}
                                                    >
                                                        {dept}
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="px-4 py-2 text-sm text-gray-500">No departments found</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <button
                                className={`px-4 py-2 text-sm font-medium ${activeTab === 'delegation' ? 'bg-purple-600 text-white' : 'bg-white text-purple-600 hover:bg-purple-40'}`}
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

                        <div className="flex gap-2">
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
                                            {allNames.map(name => (
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
                                            {allFrequencies.map(freq => (
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

            {loading && activeTab === 'checklist' && (
                <div className="mt-8 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500 mb-2"></div>
                    <p className="text-purple-600">Loading checklist data...</p>
                </div>
            )}

            {delegationLoading && activeTab === 'delegation' && (
                <div className="mt-8 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500 mb-2"></div>
                    <p className="text-purple-600">Loading delegation data...</p>
                </div>
            )}

            {currentUser && (
                <>
                    {activeTab === 'checklist' ? (
                        <div className="mt-4 rounded-lg border border-purple-200 shadow-md bg-white overflow-hidden">
                            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 p-4">
                                <h2 className="text-purple-700 font-medium">
                                    {userRole === 'admin' ? 'All Checklist Tasks' : 'My Checklist Tasks'}
                                    {selectedDepartment && ` (${selectedDepartment})`}
                                </h2>
                                <p className="text-purple-600 text-sm">
                                    {userRole === 'admin' ? 'Showing all tasks from all users' : CONFIG.PAGE_CONFIG.description}
                                </p>
                            </div>

                            <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50 sticky top-0 z-20">
                                        <tr>
                                            {[
                                                { key: 'Department', label: 'Department' },
                                                { key: 'Given By', label: 'Given By' },
                                                { key: 'Name', label: 'Name' },
                                                { key: 'Task Description', label: 'Task Description', minWidth: 'min-w-[300px]' },
                                                { key: 'Task End Date', label: 'End Date', bg: 'bg-yellow-50' },
                                                { key: 'Freq', label: 'Frequency' },
                                                { key: 'Enable Reminders', label: 'Reminders' },
                                                { key: 'Require Attachment', label: 'Attachment' },
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
                                        {filteredChecklistTasks.length > 0 ? (
                                            filteredChecklistTasks.map((task) => (
                                                <tr key={task._id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                        {task.Department || "—"}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {task['Given By'] || "—"}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {task.Name || "—"}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-500 min-w-[300px] max-w-[400px]">
                                                        <div className="whitespace-normal break-words">
                                                            {task['Task Description'] || "—"}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 bg-yellow-50">
                                                        {task['Task End Date'] || "—"}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        <span className={`px-2 py-1 rounded-full text-xs ${task.Freq === 'Daily' ? 'bg-blue-100 text-blue-800' :
                                                            task.Freq === 'Weekly' ? 'bg-green-100 text-green-800' :
                                                                task.Freq === 'Monthly' ? 'bg-purple-100 text-purple-800' :
                                                                    'bg-gray-100 text-gray-800'
                                                            }`}>
                                                            {task.Freq || "—"}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {task['Enable Reminders'] || "—"}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {task['Require Attachment'] || "—"}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                                                    {searchTerm || nameFilter || freqFilter
                                                        ? "No tasks matching your filters"
                                                        : userRole === 'admin' ? "No tasks available" : "No tasks assigned to you"}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
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
                        />
                    )}
                </>
            )}
        </AdminLayout>
    );
}