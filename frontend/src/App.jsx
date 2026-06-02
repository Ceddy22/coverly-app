import { HashRouter, Routes, Route, Link, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import LoginPage from "./pages/LoginPage";
import AboutPage from "./pages/AboutPage";
import Dashboard from "./pages/Dashboard";
import Admin_Dashboard from "./pages/Admin_Dashboard";
import ProtectedRoute from "./ProtectedRoute";
import SchedulePage from "./pages/SchedulePage";
import AdminSchedulePage from "./pages/Admin_SchedulePage";
import StaffPage from "./pages/StaffPage";
import SubstitutePage from "./pages/sTeacherPage";
import AbsentPage from "./pages/AbsentPage";
import MessagesPage from "./pages/MessagesPage";
import coverlyWatermarklogo from "./assets/coverly-wordmark.png";
import notificationIcon from "./assets/notification.png";
import bellIcon from "./assets/bell(1).png";

const getStoredUser = () => {
  try {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      return null;
    }

    return JSON.parse(storedUser);
  } catch (error) {
    console.error("Invalid user data in localStorage:", error);
    localStorage.removeItem("user");
    return null;
  }
};

export default function App() {
  const [user, setUser] = useState(getStoredUser());
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [showNotificationDropdown, setShowNotificationDropdown] =
    useState(false);

  const fetchUnreadNotifications = async () => {
    if (!user?.username) return;

    try {
      const response = await fetch(
        `/api/notifications/${user.username}/unread-count`
      );

      if (!response.ok) {
        throw new Error("Failed to load notification count");
      }

      const data = await response.json();
      setUnreadCount(data.unread_count || 0);
    } catch (error) {
      console.error("Notification count error:", error);
    }
  };

  const fetchNotifications = async () => {
    if (!user?.username) return;

    try {
      const response = await fetch(`/api/notifications/${user.username}`);

      if (!response.ok) {
        throw new Error("Failed to load notifications");
      }

      const data = await response.json();
      setNotifications(data.notifications || []);
    } catch (error) {
      console.error("Notification loading error:", error);
    }
  };

  const handleNotificationClick = async () => {
    const nextDropdownState = !showNotificationDropdown;

    setShowNotificationDropdown(nextDropdownState);

    if (nextDropdownState) {
      await fetchNotifications();
      await fetchUnreadNotifications();
    }
  };

  const handleMarkNotificationRead = async (notificationId) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: "PUT",
      });

      if (!response.ok) {
        throw new Error("Failed to mark notification as read");
      }

      await fetchNotifications();
      await fetchUnreadNotifications();
    } catch (error) {
      console.error("Mark notification read error:", error);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    if (!user?.username) return;

    try {
      const response = await fetch(
        `/api/notifications/${user.username}/read-all`,
        {
          method: "PUT",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to mark all notifications as read");
      }

      await fetchNotifications();
      await fetchUnreadNotifications();
    } catch (error) {
      console.error("Mark all notifications read error:", error);
    }
  };

  useEffect(() => {
    fetchUnreadNotifications();

    const interval = setInterval(() => {
      fetchUnreadNotifications();
    }, 10000);

    return () => clearInterval(interval);
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    setUser(null);
    window.location.href = "/#/login";
  };

  return (
    <HashRouter>
      <div className="flex min-h-screen bg-gray-100">
        {user && (
          <aside
            className={`${
              sidebarOpen ? "w-64" : "w-0"
            } bg-[#001B3D] text-white transition-all duration-300 overflow-hidden`}
          >
            <div className="p-4">
              <div className="mb-8 flex justify-center">
                <img
                  src={coverlyWatermarklogo}
                  alt="Coverly Logo"
                  className="w-40 h-auto object-contain"
                />
              </div>

              <div className="flex flex-col gap-3">
                {user.role === "teacher" && (
                  <>
                    <Link
                      to="/dashboard"
                      className="hover:bg-[#1F6FB2] px-3 py-2 rounded"
                    >
                      Dashboard
                    </Link>

                    <Link
                      to="/schedule"
                      className="hover:bg-[#1F6FB2] px-3 py-2 rounded"
                    >
                      Schedule
                    </Link>

                    <Link
                      to="/absent"
                      className="hover:bg-[#1F6FB2] px-3 py-2 rounded"
                    >
                      Absent
                    </Link>

                    <Link
                      to="/messages"
                      className="hover:bg-[#1F6FB2] px-3 py-2 rounded"
                    >
                      Messages
                    </Link>
                  </>
                )}

                {user.role === "admin" && (
                  <>
                    <Link
                      to="/admin_dashboard"
                      className="hover:bg-[#1F6FB2] px-3 py-2 rounded"
                    >
                      Admin Dashboard
                    </Link>

                    <Link
                      to="/staff"
                      className="hover:bg-[#1F6FB2] px-3 py-2 rounded"
                    >
                      Staff
                    </Link>

                    <Link
                      to="/substitute_teachers"
                      className="hover:bg-[#1F6FB2] px-3 py-2 rounded"
                    >
                      Substitutes
                    </Link>

                    <Link
                      to="/admin_schedule"
                      className="hover:bg-[#1F6FB2] px-3 py-2 rounded"
                    >
                      Admin Schedule
                    </Link>

                    <Link
                      to="/messages"
                      className="hover:bg-[#1F6FB2] px-3 py-2 rounded"
                    >
                      Messages
                    </Link>
                  </>
                )}

                <button
                  onClick={handleLogout}
                  className="bg-[#F9C74F] text-[#001B3D] font-semibold hover:bg-[#F6B82F] px-3 py-2 rounded text-left mt-4"
                >
                  Logout
                </button>
              </div>
            </div>
          </aside>
        )}

        <div className="flex-1">
          <header className="bg-[#F6FAFD] shadow p-4 flex items-center justify-between border-b border-[#D6EAF8]">
            <div className="flex items-center gap-4">
              {user && (
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="bg-[#1F6FB2] text-white px-3 py-2 rounded hover:bg-[#155A91]"
                >
                  {sidebarOpen ? "Hide Menu" : "Show Menu"}
                </button>
              )}

              {!user && <Link to="/login">Log In</Link>}

              {user && (
                <p className="font-semibold">
                  Logged in as {user.name || user.username}
                </p>
              )}
            </div>

            {user && (
              <div className="relative">
                <button
                  onClick={handleNotificationClick}
                  className="relative bg-white border border-[#D6EAF8] rounded-full p-2 hover:bg-[#EAF6FF]"
                  title={
                    unreadCount > 0
                      ? `${unreadCount} unread notification(s)`
                      : "No new notifications"
                  }
                >
                  <img
                    src={unreadCount > 0 ? notificationIcon : bellIcon}
                    alt={
                      unreadCount > 0
                        ? "Unread notifications"
                        : "No notifications"
                    }
                    className="w-8 h-8 object-contain"
                  />

                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full min-w-5 h-5 flex items-center justify-center px-1">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {showNotificationDropdown && (
                  <div className="absolute right-0 mt-3 w-96 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b bg-[#F6FAFD]">
                      <h2 className="font-bold text-[#001B3D]">
                        Notifications
                      </h2>

                      {notifications.length > 0 && (
                        <button
                          onClick={handleMarkAllNotificationsRead}
                          className="text-sm text-[#1F6FB2] hover:underline"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="text-gray-600 text-sm p-4">
                          No notifications yet.
                        </p>
                      ) : (
                        notifications.map((notification) => (
                          <div
                            key={notification.id}
                            className={`p-4 border-b ${
                              notification.is_read === 0
                                ? "bg-[#EAF6FF]"
                                : "bg-white"
                            }`}
                          >
                            <div className="flex justify-between gap-3">
                              <div>
                                <h3 className="font-semibold text-[#001B3D]">
                                  {notification.title}
                                </h3>

                                <p className="text-sm text-gray-700 mt-1">
                                  {notification.message}
                                </p>

                                <p className="text-xs text-gray-500 mt-2">
                                  {notification.type} •{" "}
                                  {notification.created_at}
                                </p>
                              </div>

                              {notification.is_read === 0 && (
                                <button
                                  onClick={() =>
                                    handleMarkNotificationRead(notification.id)
                                  }
                                  className="text-xs text-[#1F6FB2] hover:underline whitespace-nowrap"
                                >
                                  Mark read
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </header>

          <main className="p-4">
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />

              <Route path="/login" element={<LoginPage setUser={setUser} />} />

              <Route path="/about" element={<AboutPage />} />

              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin_dashboard"
                element={
                  <ProtectedRoute role="admin">
                    <Admin_Dashboard />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/schedule"
                element={
                  <ProtectedRoute>
                    <SchedulePage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/staff"
                element={
                  <ProtectedRoute role="admin">
                    <StaffPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/substitute_teachers"
                element={
                  <ProtectedRoute role="admin">
                    <SubstitutePage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin_schedule"
                element={
                  <ProtectedRoute role="admin">
                    <AdminSchedulePage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/absent"
                element={
                  <ProtectedRoute>
                    <AbsentPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/messages"
                element={
                  <ProtectedRoute>
                    <MessagesPage />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </HashRouter>
  );
}