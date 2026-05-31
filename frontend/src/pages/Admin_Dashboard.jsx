import { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";

export default function Admin_Dashboard() {
  const [reply, setReply] = useState("");
  const [teachers, setTeachers] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);

  const teachersPerPage = 3;

  const promptOptions = [
    { id: "attendance_summary", label: "Summarize Attendance" },
  ];

  const getTodayDate = () => {
    return new Date().toISOString().split("T")[0];
  };

  const fetchDashboardData = async () => {
    try {
      const usersResponse = await fetch(`/api/users`);
      const usersData = await usersResponse.json();

      const attendanceResponse = await fetch(`/api/attendance`);
      const attendanceData = await attendanceResponse.json();

      const schedulesResponse = await fetch(`/api/schedules`);
      const schedulesData = await schedulesResponse.json();

      const teacherUsers = (usersData.users || []).filter(
        (user) => user.role === "teacher"
      );

      setTeachers(teacherUsers);
      setAttendance(attendanceData.attendance || []);
      setSchedules(schedulesData.schedules || []);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handlePromptClick = async (promptId) => {
    try {
      const response = await fetch(`/api/admin-prompt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt_id: promptId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Prompt request failed");
      }

      setReply(data.reply);
    } catch (err) {
      console.error(err);
      setReply("Something went wrong.");
    }
  };

  const getTeacherSchedule = (teacher) => {
    return schedules
      .filter(
        (item) =>
          item.teacher_name?.toLowerCase() === teacher.name?.toLowerCase()
      )
      .sort((a, b) => Number(a.period) - Number(b.period));
  };

  const getTodayAttendanceRecord = (teacher) => {
    const today = getTodayDate();

    return attendance.find(
      (item) =>
        (item.username === teacher.username ||
          item.teacher_name?.toLowerCase() === teacher.name?.toLowerCase()) &&
        item.date === today
    );
  };

  const isTeacherAbsentToday = (teacher) => {
    const record = getTodayAttendanceRecord(teacher);
    return record?.status === "absent";
  };

  const getTeacherRedBlockCount = (teacher) => {
    const teacherSchedule = getTeacherSchedule(teacher);
    const isAbsent = isTeacherAbsentToday(teacher);

    if (!isAbsent) return 0;

    return teacherSchedule.length;
  };

  const sortedTeachers = [...teachers].sort((a, b) => {
    const redBlocksA = getTeacherRedBlockCount(a);
    const redBlocksB = getTeacherRedBlockCount(b);

    return redBlocksB - redBlocksA;
  });

  const paginatedTeachers = sortedTeachers.slice(
    currentPage * teachersPerPage,
    currentPage * teachersPerPage + teachersPerPage
  );

  const totalPages = Math.ceil(sortedTeachers.length / teachersPerPage);

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6FAFD] p-6">
      <h1 className="text-3xl font-bold text-[#001B3D] mb-6">
        Admin Dashboard
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* LEFT PANEL: CALENDAR */}
        <div className="bg-white p-4 rounded-xl shadow border border-[#D6EAF8]">
          <h2 className="text-xl font-bold text-[#001B3D] mb-4">Calendar</h2>

          <div className="h-[390px]">
            <FullCalendar
              plugins={[dayGridPlugin]}
              initialView="dayGridMonth"
              height="100%"
              events={[
                { title: "Meeting", date: "2026-04-14" },
                { title: "Field Day", date: "2026-04-15" },
              ]}
            />
          </div>
        </div>

        {/* RIGHT PANEL: ATTENDANCE CHART */}
        <div className="bg-white p-4 rounded-xl shadow border border-[#D6EAF8]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-[#001B3D]">
                Teacher Attendance
              </h2>
              <p className="text-sm text-gray-600">
                Period blocks for today. Mostly absent teachers appear first.
              </p>
            </div>

            <button
              onClick={fetchDashboardData}
              className="bg-[#1F6FB2] text-white px-3 py-2 rounded hover:bg-[#155A91]"
            >
              Refresh
            </button>
          </div>

          {paginatedTeachers.length === 0 ? (
            <p className="text-gray-600">No teachers found.</p>
          ) : (
            <div className="space-y-3">
              {paginatedTeachers.map((teacher) => {
                const teacherSchedule = getTeacherSchedule(teacher);
                const isAbsent = isTeacherAbsentToday(teacher);
                const attendanceRecord = getTodayAttendanceRecord(teacher);

                return (
                  <div
                    key={teacher.id}
                    className="border rounded-lg p-3 bg-[#F6FAFD]"
                  >
                    <div className="mb-2">
                      <div className="flex justify-between items-center gap-2">
                        <div>
                          <h3 className="font-bold text-sm text-[#001B3D]">
                            {teacher.name}
                          </h3>

                          <p className="text-xs text-gray-600">
                            {teacher.username}
                          </p>
                        </div>

                        <span
                          className={`px-2 py-1 rounded-full text-white text-xs font-semibold ${
                            isAbsent ? "bg-red-600" : "bg-green-600"
                          }`}
                        >
                          {isAbsent ? "Absent" : "Present"}
                        </span>
                      </div>

                      {attendanceRecord?.reason && (
                        <p className="text-xs text-gray-600 mt-1">
                          Reason: {attendanceRecord.reason}
                        </p>
                      )}
                    </div>

                    {teacherSchedule.length === 0 ? (
                      <p className="text-gray-600 text-xs">
                        No schedule periods found.
                      </p>
                    ) : (
                      <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1.5">
                        {teacherSchedule.map((periodItem, index) => (
                          <div
                            key={periodItem.id || index}
                            title={`Period ${periodItem.period} - ${
                              isAbsent ? "Absent" : "Present"
                            }`}
                            className={`rounded-md py-2 text-center text-white text-sm font-bold ${
                              isAbsent ? "bg-red-600" : "bg-green-600"
                            }`}
                          >
                            {periodItem.period}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="flex justify-between items-center pt-3">
                <button
                  onClick={handlePreviousPage}
                  disabled={currentPage === 0}
                  className="bg-gray-700 text-white px-4 py-2 rounded disabled:bg-gray-400"
                >
                  Previous
                </button>

                <p className="text-sm text-gray-600">
                  Page {currentPage + 1} of {totalPages || 1}
                </p>

                <button
                  onClick={handleNextPage}
                  disabled={currentPage >= totalPages - 1}
                  className="bg-gray-700 text-white px-4 py-2 rounded disabled:bg-gray-400"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI TEXTBOX UNDER BOTH PANELS */}
      <div className="bg-white p-4 rounded-xl shadow border border-[#D6EAF8]">
        <h2 className="text-xl font-bold text-[#001B3D] mb-4">
          Admin AI Assistant
        </h2>

        <div className="mb-4">
          {promptOptions.map((prompt) => (
            <button
              key={prompt.id}
              onClick={() => handlePromptClick(prompt.id)}
              className="px-4 py-3 bg-[#1F6FB2] text-white rounded-xl hover:bg-[#155A91] transition"
            >
              {prompt.label}
            </button>
          ))}
        </div>

        <div className="border rounded-xl p-4 bg-[#F6FAFD] min-h-[180px] overflow-y-auto">
          {reply ? (
            <p className="text-gray-800 whitespace-pre-wrap">{reply}</p>
          ) : (
            <p className="text-gray-500">
              Select Summarize Attendance to get a response.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}