import { useEffect, useRef, useState } from "react";

export default function AdminSchedulePage() {
  const [schedule, setSchedule] = useState([]);
  const [teacherName, setTeacherName] = useState("All Teachers");
  const [username, setUsername] = useState("user1");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const fileInputRef = useRef(null);

  const API_HOST_URL = import.meta.env.VITE_API_HOST_URL;
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

  const fetchAllSchedules = async () => {
    try {
      setLoading(true);
      setError("");
      setSuccessMessage("");

      const response = await fetch(`/api/schedules`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to load all schedules");
      }

      const data = await response.json();

      setSchedule(data.schedules || []);
      setTeacherName("All Teachers");
    } catch (error) {
      console.error("All schedules error:", error);
      setError(error.message);
      setSchedule([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      setError("");
      setSuccessMessage("");

      const response = await fetch(
        `/api/schedule/${username}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to load schedule");
      }

      const data = await response.json();

      setSchedule(data.schedule || []);
      setTeacherName(data.teacher_name || username);
    } catch (error) {
      console.error("Schedule error:", error);
      setError(error.message);
      setSchedule([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllSchedules();
  }, []);

  const handleImportScheduleClick = () => {
    fileInputRef.current.click();
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];

    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      setError("Please upload a CSV file.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setImporting(true);
      setError("");
      setSuccessMessage("");

      const response = await fetch(
        `/api/schedule/upload-csv`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to upload CSV");
      }

      const data = await response.json();

      setSuccessMessage(
        `${data.message}. Rows added: ${data.rows_added}, Rows skipped: ${
          data.rows_skipped || 0
        }`
      );

      await fetchAllSchedules();
    } catch (error) {
      console.error("CSV upload error:", error);
      setError(error.message);
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  const handlePrepTime = () => {
    console.log("Prep Time clicked");
  };

  const handleAttendance = () => {
    console.log("Attendance clicked");
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Admin Schedule</h1>

      <div className="flex gap-3 mb-6">
        <button
          onClick={handleImportScheduleClick}
          disabled={importing}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
        >
          {importing ? "Importing..." : "Import Schedule"}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          className="hidden"
        />

        <button
          onClick={handlePrepTime}
          className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
        >
          Prep Time
        </button>

        <button
          onClick={handleAttendance}
          className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700"
        >
          Attendance
        </button>
      </div>

      {successMessage && (
        <p className="text-green-600 mb-4">{successMessage}</p>
      )}

      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <label className="block font-semibold mb-2">
          Search schedule by username
        </label>

        <div className="flex gap-2">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="border rounded px-3 py-2 w-full"
            placeholder="Example: user1"
          />

          <button
            onClick={fetchSchedule}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Search
          </button>

          <button
            onClick={fetchAllSchedules}
            className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-800"
          >
            Show All
          </button>
        </div>
      </div>

      {loading && <p className="text-gray-600">Loading schedule...</p>}

      {error && <p className="text-red-500 mb-4">{error}</p>}

      {!loading && !error && (
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">
            Schedule for {teacherName}
          </h2>

          {schedule.length === 0 ? (
            <p className="text-gray-600">No schedule found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border border-gray-300 text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-2">Teacher</th>
                    <th className="border p-2">Period</th>
                    <th className="border p-2">Time</th>
                    <th className="border p-2">Category</th>
                    <th className="border p-2">Subject</th>
                    <th className="border p-2">Room</th>
                    <th className="border p-2">Monday</th>
                    <th className="border p-2">Tuesday</th>
                    <th className="border p-2">Wednesday</th>
                    <th className="border p-2">Thursday</th>
                    <th className="border p-2">Friday</th>
                  </tr>
                </thead>

                <tbody>
                  {schedule.map((item, index) => (
                    <tr key={item.id || index}>
                      <td className="border p-2 font-semibold">
                        {item.teacher_name}
                      </td>
                      <td className="border p-2 text-center">{item.period}</td>
                      <td className="border p-2">{item.time}</td>
                      <td className="border p-2">{item.category}</td>
                      <td className="border p-2">{item.subject}</td>
                      <td className="border p-2 text-center">{item.room}</td>
                      <td className="border p-2">{item.monday}</td>
                      <td className="border p-2">{item.tuesday}</td>
                      <td className="border p-2">{item.wednesday}</td>
                      <td className="border p-2">{item.thursday}</td>
                      <td className="border p-2">{item.friday}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}