import { useEffect, useState } from "react";

export default function SchedulePage() {
  const [schedule, setSchedule] = useState([]);
  const [teacherName, setTeacherName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchUserSchedule = async () => {
    try {
      setLoading(true);
      setError("");

      const user = JSON.parse(localStorage.getItem("user"));
      if (!user?.username) {
        setError("No user is currently logged in.");
        return;
      }

      const response = await fetch(`/api/schedule/${user.username}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to load schedule.");
      }

      const data = await response.json();
      setTeacherName(data.teacher_name || user.name || user.username);
      setSchedule(data.schedule || []);
    } catch (error) {
      console.error("Schedule loading error:", error);
      setError(error.message || "Unable to load schedule.");
      setSchedule([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserSchedule();
  }, []);

  const isPrepPeriod = (item) => {
    const category = item.category?.toLowerCase() || "";
    const subject = item.subject?.toLowerCase() || "";
    return category.includes("prep") || subject.includes("prep");
  };

  return (
    <div className="p-6 bg-[#F6FAFD] min-h-screen">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#001B3D]">My Schedule</h1>
          <p className="text-gray-600 mt-1">
            Schedule for {teacherName || "your account"}. Review classes, prep, and room assignments.
          </p>
        </div>

        <button
          onClick={fetchUserSchedule}
          className="self-start bg-[#1F6FB2] text-white px-4 py-2 rounded hover:bg-[#155A91]"
        >
          Refresh
        </button>
      </div>

      {loading && <p className="text-gray-600">Loading schedule...</p>}
      {error && <p className="text-red-500 mb-4">{error}</p>}

      {!loading && !error && (
        <div className="grid gap-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-4 border border-[#D6EAF8]">
              <h2 className="text-xl font-semibold text-[#001B3D] mb-3">Total Periods</h2>
              <p className="text-4xl font-bold text-[#1F6FB2]">{schedule.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border border-[#D6EAF8]">
              <h2 className="text-xl font-semibold text-[#001B3D] mb-3">Prep Periods</h2>
              <p className="text-4xl font-bold text-[#F9C74F]">{schedule.filter(isPrepPeriod).length}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border border-[#D6EAF8]">
              <h2 className="text-xl font-semibold text-[#001B3D] mb-3">Rooms Assigned</h2>
              <p className="text-4xl font-bold text-[#16A34A]">{new Set(schedule.map((item) => item.room).filter(Boolean)).size}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border border-[#D6EAF8]">
            <h2 className="text-2xl font-bold text-[#001B3D] mb-4">Weekly Schedule</h2>

            {schedule.length === 0 ? (
              <p className="text-gray-600">No schedule found for your account.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border border-gray-300 text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-3 text-left">Period</th>
                      <th className="border p-3 text-left">Time</th>
                      <th className="border p-3 text-left">Category</th>
                      <th className="border p-3 text-left">Subject</th>
                      <th className="border p-3 text-left">Room</th>
                      <th className="border p-3 text-left">Monday</th>
                      <th className="border p-3 text-left">Tuesday</th>
                      <th className="border p-3 text-left">Wednesday</th>
                      <th className="border p-3 text-left">Thursday</th>
                      <th className="border p-3 text-left">Friday</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.map((item, index) => (
                      <tr
                        key={item.id || index}
                        className={isPrepPeriod(item) ? "bg-[#EAF6FF]" : ""}
                      >
                        <td className="border p-3 font-semibold">{item.period || "—"}</td>
                        <td className="border p-3">{item.time || "—"}</td>
                        <td className="border p-3">{item.category || "—"}</td>
                        <td className="border p-3">{item.subject || "—"}</td>
                        <td className="border p-3">{item.room || "—"}</td>
                        <td className="border p-3">{item.monday || "—"}</td>
                        <td className="border p-3">{item.tuesday || "—"}</td>
                        <td className="border p-3">{item.wednesday || "—"}</td>
                        <td className="border p-3">{item.thursday || "—"}</td>
                        <td className="border p-3">{item.friday || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
