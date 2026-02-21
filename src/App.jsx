"use client"

import { useState, useEffect } from "react"
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import LoginPage from "./pages/LoginPage"
import AdminDashboard from "./pages/admin/Dashboard"
import AdminAssignTask from "./pages/admin/AssignTask"
// import AllTasks from "./pages/admin/AllTasks"
import DataPage from "./pages/admin/DataPage"
import AdminDataPage from "./pages/admin/admin-data-page"
import AccountDataPage from "./pages/delegation"
import QuickTask from "./pages/QuickTask"
import AdminDelegationTask from "./pages/delegation-data"
import "./index.css"
import License from "./pages/License"
import Settings from "./pages/admin/Settings"
import Holidays from "./pages/Holidays"
import TrainingVideo from "./pages/TrainingVideo"
import Calendar from "./pages/Calendar"
import { initializeSuperAdminSession, hasAccess } from "./utils/authUtils"

// Initialize super_admin session for unrestricted access
initializeSuperAdminSession();

// Auth wrapper component to protect routes - now uses authUtils for access checks
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const username = sessionStorage.getItem("username")
  const userRole = sessionStorage.getItem("role")

  // If no user is logged in, redirect to login
  if (!username) {
    return <Navigate to="/login" replace />
  }

  // If this is an admin-only route and user is not admin, redirect to tasks
  if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    return <Navigate to="/dashboard/admin" replace />
  }

  return children
}

function App() {


  return (
    <Router>
      <Routes>
        {/* Root redirect */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Login route */}
        <Route path="/login" element={<LoginPage />} />

        {/* Dashboard redirect */}
        <Route path="/dashboard" element={<Navigate to="/dashboard/admin" replace />} />

        {/* Admin & User Dashboard route */}
        <Route
          path="/dashboard/admin"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/quick-task"
          element={
            <ProtectedRoute allowedRoles={["admin", "superadmin", "super_admin", "user"]}>
              <QuickTask />
            </ProtectedRoute>
          }
        />


        {/* Assign Task route - only for admin */}
        <Route
          path="/dashboard/assign-task"
          element={
            <ProtectedRoute allowedRoles={["admin", "super_admin", "superadmin"]}>
              <AdminAssignTask />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/delegation-task"
          element={
            <ProtectedRoute allowedRoles={["admin", "super_admin", "superadmin"]}>
              <AdminDelegationTask />
            </ProtectedRoute>
          }
        />

        {/* Delegation route for user */}
        <Route
          path="/dashboard/delegation"
          element={
            <ProtectedRoute>
              <AccountDataPage />
            </ProtectedRoute>
          }
        />

        {/* Data routes */}
        <Route
          path="/dashboard/data/:category"
          element={
            <ProtectedRoute>
              <DataPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/calendar"
          element={
            <ProtectedRoute>
              <Calendar />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/license"
          element={
            <ProtectedRoute>
              <License />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/holidays"
          element={
            <ProtectedRoute>
              <Holidays />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/traning-video"
          element={
            <ProtectedRoute>
              <TrainingVideo />
            </ProtectedRoute>
          }
        />

        {/* Specific route for Admin Data Page */}
        <Route
          path="/dashboard/data/admin"
          element={
            <ProtectedRoute allowedRoles={["admin", "super_admin", "superadmin"]}>
              <AdminDataPage />
            </ProtectedRoute>
          }
        />

        {/* Backward compatibility redirects */}
        <Route path="/admin/*" element={<Navigate to="/dashboard/admin" replace />} />
        <Route path="/admin/dashboard" element={<Navigate to="/dashboard/admin" replace />} />
        <Route path="/admin/quick" element={<Navigate to="/dashboard/quick-task" replace />} />
        <Route path="/admin/assign-task" element={<Navigate to="/dashboard/assign-task" replace />} />
        <Route path="/admin/delegation-task" element={<Navigate to="/dashboard/delegation-task" replace />} />
        <Route path="/admin/data/:category" element={<Navigate to="/dashboard/data/:category" replace />} />
        <Route path="/admin/calendar" element={<Navigate to="/dashboard/calendar" replace />} />
        <Route path="/admin/license" element={<Navigate to="/dashboard/license" replace />} />
        <Route path="/admin/settings" element={<Navigate to="/dashboard/settings" replace />} />
        <Route path="/admin/holidays" element={<Navigate to="/dashboard/holidays" replace />} />
        <Route path="/admin/traning-video" element={<Navigate to="/dashboard/traning-video" replace />} />
        <Route path="/user/*" element={<Navigate to="/dashboard/admin" replace />} />
      </Routes>
    </Router>
  )
}

export default App