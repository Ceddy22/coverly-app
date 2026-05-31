import { useState } from "react";

export default function SubstitutePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const API_HOST_URL = import.meta.env.VITE_API_HOST_URL;
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

  const subTeachers = [
    {
      id: 1,
      name: "Mr J. Williams",
      role: "Sub Teacher",
      subject: "Math",
      room: "201",
    },
    {
      id: 2,
      name: "Ms T. Johnson",
      role: "Sub Teacher",
      subject: "Science",
      room: "203",
    },
    {
      id: 3,
      name: "Mr R. Brown",
      role: "Sub Teacher",
      subject: "English",
      room: "205",
    },
    {
      id: 4,
      name: "Ms K. Smith",
      role: "Sub Teacher",
      subject: "History",
      room: "207",
    },
  ];

  const filteredSubTeachers = subTeachers.filter((teacher) =>
    teacher.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddSubTeacher = () => {
    console.log("Add new sub teacher clicked");
  };

  const handleViewSchedule = (teacher) => {
    console.log("View schedule for:", teacher.name);
  };

  const handleEmailSchedule = (teacher) => {
    console.log("Email schedule to:", teacher.name);
  };

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Sub Teachers</h1>
          <p className="text-gray-600">
            Search substitute teachers, view schedules, and email schedules.
          </p>
        </div>

        <button
          onClick={handleAddSubTeacher}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Add New Sub Teacher
        </button>
      </div>

      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <label className="block font-semibold mb-2">
          Search sub teacher by name
        </label>

        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border rounded px-3 py-2 w-full"
          placeholder="Example: Mr J. Williams"
        />
      </div>

      {filteredSubTeachers.length === 0 ? (
        <p className="text-gray-600">No sub teacher found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSubTeachers.map((teacher) => (
            <div
              key={teacher.id}
              className="bg-white rounded-lg shadow p-4 border"
            >
              <h2 className="text-xl font-bold mb-2">{teacher.name}</h2>

              <p className="text-gray-700">
                <span className="font-semibold">Role:</span> {teacher.role}
              </p>

              <p className="text-gray-700">
                <span className="font-semibold">Subject:</span>{" "}
                {teacher.subject}
              </p>

              <p className="text-gray-700 mb-4">
                <span className="font-semibold">Room:</span> {teacher.room}
              </p>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleViewSchedule(teacher)}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  View Schedule
                </button>

                <button
                  onClick={() => handleEmailSchedule(teacher)}
                  className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
                >
                  E-mail Schedule
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

//Show SubTeacher Schedule 