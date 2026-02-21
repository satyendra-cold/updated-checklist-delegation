"use client";

import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  CheckSquare,
  ClipboardList,
  Home,
  LogOut,
  Menu,
  Database,
  ChevronDown,
  ChevronRight,
  Zap,
  FileText,
  X,
  Play,
  Pause,
  KeyRound,
  Video,
  Calendar,
  CalendarCheck,
  CirclePlus,
  BookmarkCheck,
  Settings
} from "lucide-react";

export default function AdminLayout({ children, darkMode, toggleDarkMode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDataSubmenuOpen, setIsDataSubmenuOpen] = useState(false);
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [userRole, setUserRole] = useState("");
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [headerAnimatedText, setHeaderAnimatedText] = useState("")
  const [showAnimation, setShowAnimation] = useState(false)

  // Authentication check + user info + header animation
  useEffect(() => {
    const storedUsername = sessionStorage.getItem("username")
    const storedRole = sessionStorage.getItem("role")

    if (!storedUsername) {
      navigate("/login")
      return
    }

    setUsername(storedUsername)
    setUserRole(storedRole || "user")

    // Show welcome text animation once on mount
    const hasSeenAnimation = sessionStorage.getItem("hasSeenWelcomeAnimation")
    if (!hasSeenAnimation) {
      setShowAnimation(true)
      sessionStorage.setItem("hasSeenWelcomeAnimation", "true")

      let currentIndex = 0
      const welcomeText = `Welcome, ${storedUsername}`

      const typingInterval = setInterval(() => {
        if (currentIndex <= welcomeText.length) {
          setHeaderAnimatedText(welcomeText.slice(0, currentIndex))
          currentIndex++
        } else {
          clearInterval(typingInterval)
          setShowAnimation(false)
          startHeaderAnimation(storedUsername)
        }
      }, 80)

      return () => clearInterval(typingInterval)
    } else {
      setHeaderAnimatedText(`Welcome, ${storedUsername}`)
    }
  }, [navigate])

  function startHeaderAnimation(name) {
    let currentIndex = 0
    const headerText = `Welcome, ${name}`
    const headerInterval = setInterval(() => {
      if (currentIndex <= headerText.length) {
        setHeaderAnimatedText(headerText.slice(0, currentIndex))
        currentIndex++
      } else {
        clearInterval(headerInterval)
      }
    }, 80)
  }

  const handleLogout = () => {
    navigate("/login");
  };

  const dataCategories = [
    { id: "sales", name: "Checklist", link: "/dashboard/data/sales" },
    {
      id: "approval",
      name: "Approval Pending",
      link: "/dashboard/data/approval",
    },
  ];

  const getAccessibleDepartments = () => {
    const rawRole = sessionStorage.getItem("role") || "user";
    const userRole = rawRole.toLowerCase().trim().replace(/\s+/g, '_');
    return dataCategories.filter(
      (cat) => !cat.showFor || cat.showFor.includes(userRole)
    );
  };

  const accessibleDepartments = getAccessibleDepartments();

  const routes = [
    {
      href: "/dashboard/admin",
      label: "Dashboard",
      icon: Database,
      active: location.pathname === "/dashboard/admin",
      showFor: ["admin", "super_admin", "superadmin", "user"],
    },
    {
      href: "/dashboard/quick-task",
      label: "Quick Task Checklist",
      icon: Zap,
      active: location.pathname === "/dashboard/quick-task",
      showFor: ["admin", "super_admin", "superadmin"],
    },
    {
      href: "/dashboard/assign-task",
      label: "Assign Task",
      icon: CheckSquare,
      active: location.pathname === "/dashboard/assign-task",
      showFor: ["admin", "super_admin", "superadmin"],
    },
    {
      href: "/dashboard/delegation",
      label: "Delegation",
      icon: ClipboardList,
      active: location.pathname === "/dashboard/delegation",
      showFor: ["admin", "super_admin", "superadmin", "user"],
    },
    ...accessibleDepartments.map((category) => ({
      href: category.link || `/dashboard/data/${category.id}`,
      label: category.name,
      icon: FileText,
      active:
        location.pathname ===
        (category.link || `/dashboard/data/${category.id}`),
      showFor: ["admin", "super_admin", "superadmin", "user"],
    })),
    {
      href: "/dashboard/calendar",
      label: "Calendar",
      icon: Calendar,
      active: location.pathname === "/dashboard/calendar",
      showFor: ["admin", "super_admin", "superadmin", "user"],
    },
    {
      href: "/dashboard/license",
      label: "License",
      icon: KeyRound,
      active: location.pathname === "/dashboard/license",
      showFor: ["admin", "super_admin", "superadmin", "user"],
    },
    {
      href: "/dashboard/settings",
      label: "Settings",
      icon: Settings,
      active: location.pathname === "/dashboard/settings",
      showFor: ["admin", "super_admin", "superadmin"],
    },
    {
      href: "/dashboard/holidays",
      label: "Holidays",
      icon: Calendar,
      active: location.pathname === "/dashboard/holidays",
      showFor: ["admin", "super_admin", "superadmin"],
    },
    {
      href: "/dashboard/traning-video",
      label: "Training Video",
      icon: Video,
      active: location.pathname === "/dashboard/traning-video",
      showFor: ["admin", "super_admin", "superadmin", "user"],
    },
  ];

  const getAccessibleRoutes = () => {
    const rawRole = sessionStorage.getItem("role") || "user";
    const userRole = rawRole.toLowerCase().trim().replace(/\s+/g, '_');
    return routes.filter((route) => route.showFor.includes(userRole));
  };

  const isDataPage = location.pathname.includes("/dashboard/data/");

  useEffect(() => {
    if (isDataPage && !isDataSubmenuOpen) {
      setIsDataSubmenuOpen(true);
    }
  }, [isDataPage, isDataSubmenuOpen]);

  const accessibleRoutes = getAccessibleRoutes();

  const LicenseModal = () => {
    const getYouTubeEmbedUrl = (url) => {
      const regExp =
        /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
      const match = url.match(regExp);
      return match && match[2].length === 11
        ? `https://www.youtube.com/embed/${match[2]}?autoplay=1&rel=0`
        : url;
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden">
          <div className="flex h-[80vh]"></div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-blue-50 to-purple-50">
      <aside className="hidden w-64 flex-shrink-0 border-r border-blue-200 bg-white md:flex md:flex-col">
        <div className="flex h-14 items-center border-b border-blue-200 px-4 bg-gradient-to-r from-blue-100 to-purple-100">
          <Link to="/dashboard/admin" className="flex items-center gap-2 font-semibold text-blue-700">
            <ClipboardList className="h-5 w-5 text-blue-600" />
            <span>Checklist & Delegation</span>
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          <ul className="space-y-1">
            {accessibleRoutes.map((route) => (
              <li key={route.label}>
                <Link
                  to={route.href}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${route.active
                    ? "bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700"
                    : "text-gray-700 hover:bg-blue-50"
                    }`}
                >
                  <route.icon
                    className={`h-4 w-4 ${route.active ? "text-blue-600" : ""}`}
                  />
                  {route.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t border-blue-200 p-4 bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                <span className="text-sm font-medium text-white">
                  {username ? username.charAt(0).toUpperCase() : "U"}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-blue-700">
                  {username || "User"} {userRole === "admin" ? "(Admin)" : ""}
                </p>
                <p className="text-xs text-blue-600">
                  {username
                    ? `${username.toLowerCase()}@example.com`
                    : "user@example.com"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleLogout}
                className="text-blue-700 hover:text-blue-900 p-1 rounded-full hover:bg-blue-100"
              >
                <LogOut className="h-4 w-4" />
                <span className="sr-only">Log out</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="md:hidden absolute left-4 top-3 z-50 text-blue-700 p-2 rounded-md hover:bg-blue-100"
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle menu</span>
      </button>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="fixed inset-0 bg-black/20"
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>
          <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-lg">
            <div className="flex h-14 items-center border-b border-blue-200 px-4 bg-gradient-to-r from-blue-100 to-purple-100">
              <Link
                to="/dashboard/admin"
                className="flex items-center gap-2 font-semibold text-blue-700"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <ClipboardList className="h-5 w-5 text-blue-600" />
                <span>Checklist & Delegation</span>
              </Link>
            </div>
            <nav className="flex-1 overflow-y-auto p-2 bg-white">
              <ul className="space-y-1">
                {accessibleRoutes.map((route) => (
                  <li key={route.label}>
                    <Link
                      to={route.href}
                      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${route.active
                        ? "bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700"
                        : "text-gray-700 hover:bg-blue-50"
                        }`}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <route.icon
                        className={`h-4 w-4 ${route.active ? "text-blue-600" : ""}`}
                      />
                      {route.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b border-blue-200 bg-white px-4 md:px-6">
          <div className="flex md:hidden w-8"></div>
          <h1 className="text-lg font-semibold text-blue-700">
            {headerAnimatedText}
          </h1>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gradient-to-br from-blue-50 to-purple-50">
          {children}
          <div className="fixed md:left-64 left-0 right-0 bottom-0 py-1 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-center text-sm shadow-md z-10">
            <a
              href="https://www.botivate.in/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              Powered by-<span className="font-semibold">Botivate</span>
            </a>
          </div>
        </main>
      </div>
    </div>
  );
}
