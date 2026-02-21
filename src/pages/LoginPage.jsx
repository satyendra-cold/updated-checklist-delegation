"use client";

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const LoginPage = () => {
    const navigate = useNavigate();
    const [isDataLoading, setIsDataLoading] = useState(false);
    const [isLoginLoading, setIsLoginLoading] = useState(false);
    const [masterData, setMasterData] = useState({
        userCredentials: {}, // Object where keys are usernames and values are passwords
        userRoles: {}, // Object where keys are usernames and values are roles
    });
    const [formData, setFormData] = useState({
        username: "",
        password: "",
    });
    const [toast, setToast] = useState({ show: false, message: "", type: "" });

    // ✅ NEW: success popup state
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);

    // Function to check if a role is any variation of "inactive"
    const isInactiveRole = (role) => {
        if (!role) return false;

        // Convert to lowercase
        const normalizedRole = String(role).toLowerCase().trim();

        // Check for different variations of "inactive" status
        return (
            normalizedRole === "inactive" ||
            normalizedRole === "in active" ||
            normalizedRole === "inactiv" ||
            normalizedRole === "in activ"
        );
    };

    // Fetch master data on component mount
    useEffect(() => {
        const fetchMasterData = async () => {
            const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyGf3LdYk6MPiOs_shPU9_AW7wmRjJZ4QxMk9qYqTScsDMB7IliaWRB1HueYy7w5qxqNw/exec";
            const SHEET_NAME = "Whatsapp"; // Using the same sheet as Settings

            try {
                setIsDataLoading(true);
                const response = await fetch(`${SCRIPT_URL}?sheet=${SHEET_NAME}&action=fetch`);

                if (!response.ok) throw new Error("Failed to fetch from Apps Script");

                const responseText = await response.text();
                let parsedData;

                try {
                    parsedData = JSON.parse(responseText);
                } catch (parseError) {
                    // Robust JSON extraction if response is wrapped
                    const jsonStart = responseText.indexOf("{");
                    const jsonEnd = responseText.lastIndexOf("}");
                    if (jsonStart !== -1 && jsonEnd !== -1) {
                        parsedData = JSON.parse(responseText.substring(jsonStart, jsonEnd + 1));
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

                const userCredentials = {};
                const userRoles = {};
                const assignmentMapping = {};

                // Process rows, skip header
                const dataRows = rows.slice(1);
                dataRows.forEach((row, index) => {
                    let rowValues = [];
                    if (row.c) {
                        rowValues = row.c.map(cell => cell && cell.v !== undefined ? cell.v : "");
                    } else if (Array.isArray(row)) {
                        rowValues = row;
                    }

                    // Column A=0(Dept), B=1(Given), C=2(Name), D=3(Pass), E=4(Role)
                    const username = String(rowValues[2] || "").trim().toLowerCase();
                    const password = String(rowValues[3] || "").trim();
                    const role = String(rowValues[4] || "").trim().toLowerCase() || "user";
                    const assignPerson = String(rowValues[1] || "").trim(); // Using "Given By" for assignment if needed
                    const doerName = String(rowValues[2] || "").trim();

                    if (username && password) {
                        if (isInactiveRole(role)) return;
                        userCredentials[username] = password;
                        userRoles[username] = role;

                        if (assignPerson) {
                            const assignedNames = assignPerson.split(",").map(n => n.trim().toLowerCase());
                            assignedNames.forEach(name => {
                                if (name) {
                                    if (!assignmentMapping[name]) assignmentMapping[name] = [];
                                    if (!assignmentMapping[name].includes(doerName)) assignmentMapping[name].push(doerName);
                                }
                            });
                        }
                    }
                });

                setMasterData({ userCredentials, userRoles, assignmentMapping });
            } catch (error) {
                console.error("Error Fetching Master Data:", error);
                showToast(`Unable to load login data. Please check connection.`, "error");
            } finally {
                setIsDataLoading(false);
            }
        };

        fetchMasterData();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoginLoading(true);

        try {
            const trimmedUsername = formData.username.trim().toLowerCase();
            const trimmedPassword = formData.password.trim();

            // Check if the username exists in our credentials map
            if (trimmedUsername in masterData.userCredentials) {
                const correctPassword = masterData.userCredentials[trimmedUsername];
                const userRole = masterData.userRoles[trimmedUsername];

                // Check if password matches
                if (correctPassword === trimmedPassword) {
                    // Store user info in sessionStorage
                    sessionStorage.setItem("username", trimmedUsername);

                    // Check if user is admin - include superadmin and super_admin
                    const isAdmin = userRole === "admin" || userRole === "superadmin" || userRole === "super_admin";

                    // Set role based on the fetched role
                    sessionStorage.setItem("role", userRole); // Store the actual role

                    // For admin users, we don't want to restrict by department
                    if (isAdmin) {
                        sessionStorage.setItem("department", "all"); // Admin sees all departments
                        sessionStorage.setItem("isAdmin", "true"); // Additional flag to ensure admin permissions
                    } else {
                        sessionStorage.setItem("department", trimmedUsername);
                        sessionStorage.setItem("isAdmin", "false");
                    }

                    const assignedPersons =
                        masterData.assignmentMapping[trimmedUsername] || [];
                    sessionStorage.setItem(
                        "AssignPerson",
                        JSON.stringify(assignedPersons)
                    );

                    // ✅ NEW: show popup & delayed navigate (INSTEAD OF IMMEDIATE NAVIGATE)
                    setShowSuccessPopup(true);

                    // Set timeout for navigation based on role - UPDATED: All roles go to admin dashboard
                    setTimeout(() => {
                        navigate("/dashboard/admin");
                    }, 2000);

                    showToast(
                        `Login successful. Welcome, ${trimmedUsername}!`,
                        "success"
                    );
                    return;
                } else {
                    showToast(
                        "Username or password is incorrect. Please try again.",
                        "error"
                    );
                }
            } else {
                showToast(
                    "Username or password is incorrect. Please try again.",
                    "error"
                );
            }
        } catch (error) {
            showToast(`Login failed: ${error.message}. Please try again.`, "error");
        } finally {
            setIsLoginLoading(false);
        }
    };

    const showToast = (message, type) => {
        setToast({ show: true, message, type });
        setTimeout(() => {
            setToast({ show: false, message: "", type: "" });
        }, 5000); // Toast duration
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 p-4">
            <div className="w-full max-w-md shadow-lg border border-blue-200 rounded-lg bg-white">
                <div className="space-y-1 p-4 bg-gradient-to-r from-blue-100 to-purple-100 rounded-t-lg">
                    <div className="flex items-center justify-center mb-2">
                        <i className="fas fa-clipboard-list h-8 w-8 text-blue-600 mr-2"></i>
                        <h2 className="text-2xl font-bold text-blue-700">
                            Checklist & Delegation
                        </h2>
                    </div>
                    <p className="text-center text-blue-600">
                        Login to access your tasks and delegations
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div className="space-y-2">
                        <label
                            htmlFor="username"
                            className="flex items-center text-blue-700"
                        >
                            <i className="fas fa-user h-4 w-4 mr-2"></i>
                            Username
                        </label>
                        <input
                            id="username"
                            name="username"
                            type="text"
                            placeholder="Enter your username"
                            required
                            value={formData.username}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div className="space-y-2">
                        <label
                            htmlFor="password"
                            className="flex items-center text-blue-700"
                        >
                            <i className="fas fa-key h-4 w-4 mr-2"></i>
                            Password
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            placeholder="Enter your password"
                            required
                            value={formData.password}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 -mx-4 -mb-4 mt-4 rounded-b-lg">
                        <button
                            type="submit"
                            className="w-full py-2 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-md font-medium disabled:opacity-50"
                            disabled={isLoginLoading || isDataLoading}
                        >
                            {isLoginLoading
                                ? "Logging in..."
                                : isDataLoading
                                    ? "Loading..."
                                    : "Login"}
                        </button>
                    </div>
                </form>
                <div className="fixed left-0 right-0 bottom-0 py-1 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-center text-sm shadow-md z-10">
                    <a
                        href="https://www.botivate.in/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                    >
                        Powered by-<span className="font-semibold">Botivate</span>
                    </a>
                </div>
            </div>

            {/* Toast Notification */}
            {toast.show && (
                <div
                    className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg transition-all duration-300 ${toast.type === "success"
                        ? "bg-green-100 text-green-800 border-l-4 border-green-500"
                        : "bg-red-100 text-red-800 border-l-4 border-red-500"
                        }`}
                >
                    {toast.message}
                </div>
            )}

            {/* ✅ Success Popup Modal */}
            {showSuccessPopup && (
                <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
                    <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl transform transition-all duration-300 scale-100 opacity-100">
                        <div className="text-center">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                                <svg
                                    className="h-6 w-6 text-green-600"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M5 13l4 4L19 7"
                                    />
                                </svg>
                            </div>
                            <h3 className="mt-3 text-lg font-medium text-gray-900">
                                Login Successful!
                            </h3>
                            <div className="mt-2 px-4 py-3">
                                <p className="text-xl text-gray-600">
                                    Welcome{" "}
                                    <span className="font-semibold text-blue-600">
                                        {formData.username.trim().toLowerCase()}
                                    </span>
                                    , you have successfully logged in.
                                </p>
                            </div>
                            <div className="mt-4">
                                <div className="flex justify-center">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    Redirecting to Dashboard...
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LoginPage;
