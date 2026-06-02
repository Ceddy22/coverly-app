import { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";

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

export default function AbsentPage() {
  const [user] = useState(getStoredUser());
  const [absences, setAbsences] = useState([]);
  const [showPopup, setShowPopup] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchAbsences = async () => {
    if (!user?.username) {
      setError("No user is logged in.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch(`/api/attendance/${user.username}`);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to load absences");
      }

      setAbsences(data.attendance || []);
    } catch (error) {
      console.error("Absence loading error:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAbsences();
  }, []);

  const getDatesInRange = (start, end) => {
    const dates = [];
    const currentDate = new Date(start);
    const finalDate = new Date(end);

    while (currentDate <= finalDate) {
      dates.push(currentDate.toISOString().split("T")[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dates;
  };

  const handleSubmitAbsenceRange = async (e) => {
    e.preventDefault();

    if (!user?.username) {
      setError("No user is logged in.");
      return;
    }

    if (!startDate || !endDate) {
      setError("Please select a start date and end date.");
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setError("Start date cannot be after end date.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccessMessage("");

      const dates = getDatesInRange(startDate, endDate);

      for (const absenceDate of dates) {
        const response = await fetch(`/api/attendance`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: user.username,
            date: absenceDate,
            status: "absent",
            reason: reason || "No reason provided",
            submitted_by: user.username,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          const alreadySubmitted =
            data.detail ===
              "Attendance already submitted for this staff member on this date" ||
            data.detail ===
              "Attendance already submitted for this user on this date";

          if (!alreadySubmitted) {
            throw new Error(data.detail || "Failed to submit absence");
          }
        }
      }

      setSuccessMessage("Absence range submitted successfully.");
      setShowPopup(false);
      setStartDate("");
      setEndDate("");
      setReason("");

      await fetchAbsences();
    } catch (error) {
      console.error("Absence submission error:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const absenceEvents = absences
    .filter((item) => item.status === "absent")
    .map((item) => ({
      title: "Absent",
      date: item.date,
      backgroundColor: "#DC2626",
      borderColor: "#DC2626",
      textColor: "#FFFFFF",
    }));

  if (!user) {
    return (
      <div className="p-6 bg-[#F6FAFD] min-h-screen">
        <p className="text-red-600">
          No user is logged in. Please log in again.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-[#F6FAFD] min-h-screen">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#001B3D]">Absent Page</h1>
        <p className="text-gray-600 mt-1">
          View and submit your absent dates.
        </p>
      </div>

      {error && <p className="text-red-500 mb-4">{error}</p>}

      {successMessage && (
        <p className="text-green-600 mb-4">{successMessage}</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 bg-white p-4 rounded-xl shadow border border-[#D6EAF8]">
          <h2 className="text-xl font-bold text-[#001B3D] mb-4">
            My Absence Calendar
          </h2>

          {loading && <p className="text-gray-600 mb-3">Loading...</p>}

          <div className="h-[650px]">
            <FullCalendar
              plugins={[dayGridPlugin]}
              initialView="dayGridMonth"
              height="100%"
              events={absenceEvents}
            />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow border border-[#D6EAF8] h-fit">
          <h2 className="text-xl font-bold text-[#001B3D] mb-4">
            Absence Actions
          </h2>

          <button
            onClick={() => setShowPopup(true)}
            className="w-full bg-[#1F6FB2] text-white px-4 py-3 rounded-lg hover:bg-[#155A91]"
          >
            Submit Absence Range
          </button>

          <div className="mt-6">
            <h3 className="font-semibold text-[#001B3D] mb-2">
              Recent Absences
            </h3>

            {absences.filter((item) => item.status === "absent").length ===
            0 ? (
              <p className="text-gray-600 text-sm">No absences found.</p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {absences
                  .filter((item) => item.status === "absent")
                  .map((item) => (
                    <div
                      key={item.id}
                      className="bg-red-50 border border-red-200 p-2 rounded"
                    >
                      <p className="font-semibold text-red-700">
                        {item.date}
                      </p>

                      <p className="text-sm text-gray-600">
                        {item.reason || "No reason provided"}
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showPopup && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold text-[#001B3D] mb-4">
              Submit Absence Range
            </h2>

            <form onSubmit={handleSubmitAbsenceRange}>
              <div className="mb-4">
                <label className="block font-semibold mb-2">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="border rounded px-3 py-2 w-full"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block font-semibold mb-2">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="border rounded px-3 py-2 w-full"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block font-semibold mb-2">Reason</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="border rounded px-3 py-2 w-full"
                  placeholder="Example: Sick, appointment, emergency..."
                  rows="3"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowPopup(false)}
                  className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="bg-[#1F6FB2] text-white px-4 py-2 rounded hover:bg-[#155A91] disabled:bg-gray-400"
                >
                  {loading ? "Submitting..." : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}