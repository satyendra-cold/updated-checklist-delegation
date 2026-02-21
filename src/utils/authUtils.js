/**
 * Authentication Utilities
 * 
 * This module provides helper functions for authentication and authorization.
 * 
 * PRODUCTION MODE: FORCE_SUPER_ADMIN = false
 * - Users will have access based on their actual role from sessionStorage
 * - Role-based access control is enforced
 * 
 * DEVELOPMENT/TESTING MODE: Set FORCE_SUPER_ADMIN = true to grant full access
 */

// ✅ PRODUCTION READY - Set to false for proper role-based access control
const FORCE_SUPER_ADMIN = false;

/**
 * Get the current user's role
 * When FORCE_SUPER_ADMIN is true, always returns 'super_admin' for full access
 * @returns {string} The user role
 */
export const getUserRole = () => {
    if (FORCE_SUPER_ADMIN) {
        return 'super_admin';
    }
    return sessionStorage.getItem('role') || 'user';
};

/**
 * Check if the current user has admin privileges
 * @returns {boolean} True if user has admin privileges
 */
export const isAdminUser = () => {
    if (FORCE_SUPER_ADMIN) {
        return true;
    }
    const role = sessionStorage.getItem('role');
    return ['admin', 'superadmin', 'super_admin', 'super admin'].includes(role);
};

/**
 * Check if the current user is a super admin
 * @returns {boolean} True if user is super admin
 */
export const isSuperAdmin = () => {
    if (FORCE_SUPER_ADMIN) {
        return true;
    }
    const role = sessionStorage.getItem('role');
    return ['superadmin', 'super_admin', 'super admin'].includes(role);
};

/**
 * Get the current username
 * @returns {string} The username
 */
export const getUsername = () => {
    return sessionStorage.getItem('username') || '';
};

/**
 * Check if a specific role is allowed based on allowed roles list
 * When FORCE_SUPER_ADMIN is true, always returns true for full access
 * @param {string[]} allowedRoles - Array of allowed roles
 * @returns {boolean} True if access is allowed
 */
export const hasAccess = (allowedRoles = []) => {
    if (FORCE_SUPER_ADMIN) {
        return true;
    }
    if (allowedRoles.length === 0) {
        return true;
    }
    const role = sessionStorage.getItem('role');
    return allowedRoles.includes(role);
};

/**
 * Check if user should see all data (bypass user-specific filtering)
 * When FORCE_SUPER_ADMIN is true, always returns true
 * @returns {boolean} True if user can see all data
 */
export const canSeeAllData = () => {
    if (FORCE_SUPER_ADMIN) {
        return true;
    }
    return isAdminUser();
};

/**
 * Initialize session with super_admin privileges
 * Call this on app load to ensure proper session setup
 */
export const initializeSuperAdminSession = () => {
    if (FORCE_SUPER_ADMIN) {
        // Set super_admin role in sessionStorage for components that read directly
        const currentRole = sessionStorage.getItem('role');
        if (currentRole && currentRole !== 'super_admin') {
            // Store original role for reference
            sessionStorage.setItem('originalRole', currentRole);
        }
        sessionStorage.setItem('role', 'super_admin');
        sessionStorage.setItem('isAdmin', 'true');
        sessionStorage.setItem('department', 'all');
    }
};

export default {
    getUserRole,
    isAdminUser,
    isSuperAdmin,
    getUsername,
    hasAccess,
    canSeeAllData,
    initializeSuperAdminSession,
};
