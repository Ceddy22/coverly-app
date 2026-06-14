import { useEffect, useState } from "react";

export default function Dashboard() {
  const [teacherName, setTeacherName] = useState("");
  const [schedule, setSchedule] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [agenda, setAgenda] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchTeacherSchedule = async () => {
    try {
      setLoading(true);
      setError("");

      const user = JSON.parse(localStorage.getItem("user"));

      if (!user) {
        setError("No user is logged in.");
        return;
      }

      const response = await fetch(`/api/schedule/${user.username}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to load schedule");
      }

      const data = await response.json();

      setTeacherName(data.teacher_name || user.name || user.username);
      setSchedule(data.schedule || []);

      const meetingItems = (data.schedule || []).filter((item) =>
        item.category?.toLowerCase().includes("meeting")
      );

      setMeetings(meetingItems);

      const agendaItems = (data.schedule || []).filter((item) =>
        item.category?.toLowerCase().includes("agenda")
      );

      setAgenda(agendaItems);
    } catch (error) {
      console.error("Dashboard schedule error:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeacherSchedule();
  }, []);

  const isPrepPeriod = (item) => {
    const category = item.category?.toLowerCase() || "";
    const subject = item.subject?.toLowerCase() || "";

    // Also check each weekday cell in case the CSV marks 'Prep' there
    const dayFields = [
      item.monday,
      item.tuesday,
      item.wednesday,
      item.thursday,
      item.friday,
    ];

    const dayContainsPrep = dayFields.some((d) => {
      return (d || "").toString().toLowerCase().includes("prep");
    });

    return category.includes("prep") || subject.includes("prep") || dayContainsPrep;
  };

  return (
    <div className="p-6 bg-[#F6FAFD] min-h-screen">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold text-[#001B3D]">
          Welcome, {teacherName || "Teacher"}
        </h1>

        <p className="text-gray-600 mt-1">
          Here is your schedule, meetings, and agenda for today.
        </p>
      </div>

      {loading && <p className="text-gray-600">Loading dashboard...</p>}

      {error && <p className="text-red-500 mb-4">{error}</p>}

      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Panel: Meetings */}
          <div className="bg-white rounded-lg shadow p-4 border border-[#D6EAF8]">
            <h2 className="text-xl font-bold text-[#001B3D] mb-4">
              Meetings
            </h2>

            {meetings.length === 0 ? (
              <p className="text-gray-600">No meetings found.</p>
            ) : (
              <div className="space-y-3">
                {meetings.map((meeting, index) => (
                  <div
                    key={index}
                    className="border-l-4 border-[#1F6FB2] bg-[#EAF6FF] p-3 rounded"
                  >
                    <p className="font-semibold text-[#001B3D]">
                      {meeting.subject}
                    </p>

                    <p className="text-sm text-gray-700">
                      Period: {meeting.period}
                    </p>

                    <p className="text-sm text-gray-700">
                      Time: {meeting.time}
                    </p>

                    <p className="text-sm text-gray-700">
                      Room: {meeting.room}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Middle Panel: Teacher Schedule */}
          <div className="bg-white rounded-lg shadow p-4 border border-[#D6EAF8] lg:col-span-2">
            <h2 className="text-xl font-bold text-[#001B3D] mb-4">
              My Schedule
            </h2>

            {schedule.length === 0 ? (
              <p className="text-gray-600">No schedule found.</p>
            ) : (
              <div className="space-y-3">
                {schedule.map((item, index) => {
                  const prep = isPrepPeriod(item);

                  return (
                    <div key={index}>
                      <div
                        className={`grid grid-cols-1 md:grid-cols-2 gap-3 items-center border rounded-lg p-3 hover:bg-[#F6FAFD] ${
                          prep ? "bg-[#EAF6FF] border-[#1F6FB2]" : ""
                        }`}
                      >
                        <div>
                          <p className="text-sm text-gray-500">Period</p>
                          <p className="font-bold text-[#001B3D] flex items-center gap-2">
                            <span>{item.period || "—"}</span>
                            {prep && (
                              <span className="bg-[#F9C74F] text-[#001B3D] text-xs font-semibold px-2 py-1 rounded">
                                Prep
                              </span>
                            )}
                          </p>
                        </div>

                        <div>
                          <p className="text-sm text-gray-500">Time</p>
                          <p className="font-semibold">{item.time || "—"}</p>
                        </div>
                      </div>

                      {item.override_notes && (
                        <div className="text-sm text-gray-700 bg-[#FFF8E6] p-2 rounded mt-2 border">
                          <p className="font-semibold">Note: {item.override_notes}</p>
                          {item.override_created_by && (
                            <p className="text-xs text-gray-500">Changed by: {item.override_created_by}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Panel: Agenda */}
          <div className="bg-white rounded-lg shadow p-4 border border-[#D6EAF8]">
            <h2 className="text-xl font-bold text-[#001B3D] mb-4">
              Agenda
            </h2>

            {agenda.length === 0 ? (
              <div className="space-y-3">
                <div className="bg-[#EAF6FF] p-3 rounded">
                  <p className="font-semibold text-[#001B3D]">
                    Review today’s schedule
                  </p>
                  <p className="text-sm text-gray-600">
                    Check your classes, meetings, and prep periods.
                  </p>
                </div>

                <div className="bg-[#EAF6FF] p-3 rounded">
                  <p className="font-semibold text-[#001B3D]">
                    Submit attendance updates
                  </p>
                  <p className="text-sm text-gray-600">
                    Mark absence or notify admin if needed.
                  </p>
                </div>

                <div className="bg-[#EAF6FF] p-3 rounded">
                  <p className="font-semibold text-[#001B3D]">
                    Check prep time
                  </p>
                  <p className="text-sm text-gray-600">
                    Review available prep periods.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {agenda.map((item, index) => (
                  <div
                    key={index}
                    className="bg-[#EAF6FF] p-3 rounded border-l-4 border-[#F9C74F]"
                  >
                    <p className="font-semibold text-[#001B3D]">
                      {item.subject}
                    </p>
                    <p className="text-sm text-gray-700">
                      {item.time} — Room {item.room}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}