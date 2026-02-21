import React, { useState, useEffect } from 'react'
import { FileText, ScrollText, Users, User } from 'lucide-react'
import AdminLayout from "../components/layout/AdminLayout";

const License = () => {
    const [userRole, setUserRole] = useState("")
    const [username, setUsername] = useState("")

    // Get user info from sessionStorage
    useEffect(() => {
        const storedRole = sessionStorage.getItem('role') || 'user'
        const storedUsername = sessionStorage.getItem('username') || 'User'
        setUserRole(storedRole)
        setUsername(storedUsername)
    }, [])

    return (
        <AdminLayout>
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4">
                <div className="max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="mb-6 md:mb-8">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 md:p-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg">
                                    <ScrollText className="h-5 w-5 md:h-6 md:w-6 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-xl md:text-3xl font-bold text-gray-800">License Agreement</h1>
                                    <p className="text-xs md:text-sm text-gray-600 mt-1">
                                        Software license terms and conditions
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 md:px-4 md:py-2 shadow-sm self-start md:self-auto">
                                {['admin', 'superadmin', 'super admin'].includes(userRole) ? (
                                    <Users className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
                                ) : (
                                    <User className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
                                )}
                                <span className="text-xs md:text-sm font-medium text-gray-700">
                                    {username} ({['admin', 'superadmin', 'super admin'].includes(userRole) ? "Admin" : "User"})
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* License Content */}
                    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                        <div className="p-4 md:p-6 lg:p-8">
                            <div className="flex items-center gap-3 mb-4 md:mb-6">
                                <FileText className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
                                <h2 className="text-xl md:text-2xl font-semibold text-gray-800">License Terms & Conditions</h2>
                            </div>

                            <div className="text-xs md:text-sm text-gray-600 space-y-4 md:space-y-6 h-[400px] md:h-[600px] overflow-y-auto pr-2 md:pr-4">
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 md:p-4">
                                    <p className="font-semibold text-blue-800 text-sm md:text-base">SOFTWARE LICENSE AGREEMENT</p>
                                    <p className="text-blue-700 mt-1 text-xs md:text-sm">Checklist & Delegation System</p>
                                </div>

                                <div className="space-y-3 md:space-y-4">
                                    <div className="border-l-4 border-yellow-500 pl-3 md:pl-4">
                                        <h3 className="font-semibold text-gray-800 mb-1 md:mb-2 text-sm md:text-base">1. Copyright © BOTIVATE SERVICES LLP</h3>
                                        <p className="text-gray-600">
                                            This software is specially developed by botivate for use by its clients.
                                            Unauthorized use & copying of this software will attract penalties.
                                            For support contact info is below.
                                        </p>
                                    </div>

                                    <div className="border-l-4 border-green-500 pl-3 md:pl-4">
                                        <h3 className="font-semibold text-gray-800 mb-1 md:mb-2 text-sm md:text-base">2. Data Protection & Privacy</h3>
                                        <p className="text-gray-600">
                                            We protect your data using secure methods and follow privacy laws. Your information is safe with us.
                                        </p>
                                    </div>

                                    <div className="border-l-4 border-indigo-500 pl-3 md:pl-4">
                                        <h3 className="font-semibold text-gray-800 mb-1 md:mb-2 text-sm md:text-base">3. Support & Updates</h3>
                                        <p className="text-gray-600">
                                            We offer support during business hours. Software updates and fixes will be provided regularly to improve performance and security.
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-3 md:p-4 mt-4 md:mt-6">
                                    <h4 className="font-semibold text-blue-800 mb-1 md:mb-2 text-sm md:text-base">Contact Information</h4>
                                    <p className="text-blue-700 text-xs md:text-sm">
                                        For license inquiries or technical support, please contact our support team:
                                    </p>
                                    <div className="mt-2 space-y-1">
                                        <a href="mailto:info@botivate.in" className="text-blue-600 font-medium hover:text-blue-800 transition-colors block text-xs md:text-sm">📧 info@botivate.in</a>
                                        <a href="https://www.botivate.in" target="_blank" rel="noopener noreferrer" className="text-blue-600 font-medium hover:text-blue-800 transition-colors block text-xs md:text-sm">🌐 www.botivate.in</a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    )
}

export default License