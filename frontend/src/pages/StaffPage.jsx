import { useEffect, useState } from "react";

export default function StaffPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [staffMembers, setStaffMembers] = useState([]);
  const [users, setUsers] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);

  const [showAddStaffForm, setShowAddStaffForm] = useState(false);
  const [showUserFormForStaffId, setShowUserFormForStaffId] = useState(null);
  const [showOverrideFormForStaffId, setShowOverrideFormForStaffId] =
    useState(null);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [newStaff, setNewStaff] = useState({
    name: "",
    role: "teacher",
    email: "",
  });

  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    role: "teacher",
  });

  const [overrideData, setOverrideData] = useState({
    attendance_id: "",
    status: "present",
    reason: "",
    overridden_by: "admin1",
  });

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
  const API_HOST_URL = import.meta.env.VITE_API_HOST_URL;

  const fetchStaffUsersAndAttendance = async () => {
    try {
      setError("");

      const staffResponse = await fetch(`/api/staff`);

      if (!staffResponse.ok) {
        const errorData = await staffResponse.json();
        throw new Error(errorData.detail || "Failed to load staff members");
      }

      const staffData = await staffResponse.json();

      const usersResponse = await fetch(`/api/users`);

      if (!usersResponse.ok) {
        const errorData = await usersResponse.json();
        throw new Error(errorData.detail || "Failed to load users");
      }

      const usersData = await usersResponse.json();

      const attendanceResponse = await fetch(
        `/api/attendance`
      );

      if (!attendanceResponse.ok) {
        const errorData = await attendanceResponse.json();
        throw new Error(errorData.detail || "Failed to load attendance");
      }

      const attendanceData = await attendanceResponse.json();

      setStaffMembers(staffData.staff || []);
      setUsers(usersData.users || []);
      setAttendanceRecords(attendanceData.attendance || []);
    } catch (error) {
      console.error("Staff loading error:", error);
      setError(error.message);
    }
  };

  useEffect(() => {
    fetchStaffUsersAndAttendance();
  }, []);

  const filteredStaff = staffMembers.filter((staff) =>
    staff.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getUserForStaff = (staff) => {
    return users.find(
      (user) =>
        user.staff_id === staff.id ||
        user.name.toLowerCase() === staff.name.toLowerCase()
    );
  };

  const getAttendanceForStaff = (staff) => {
    return attendanceRecords.filter(
      (record) =>
        record.staff_id === staff.id ||
        record.teacher_name?.toLowerCase() === staff.name.toLowerCase()
    );
  };

  const getTodayDate = () => {
    return new Date().toISOString().split("T")[0];
  };

  const handleNewStaffChange = (event) => {
    const { name, value } = event.target;

    setNewStaff((prevStaff) => ({
      ...prevStaff,
      [name]: value,
    }));
  };

  const handleNewUserChange = (event) => {
    const { name, value } = event.target;

    setNewUser((prevUser) => ({
      ...prevUser,
      [name]: value,
    }));
  };

  const handleOverrideChange = (event) => {
    const { name, value } = event.target;

    setOverrideData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubmitNewStaff = async (event) => {
    event.preventDefault();

    try {
      setError("");
      setSuccessMessage("");

      const response = await fetch(`${API_BASE_URL}/api/staff`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newStaff.name,
          role: newStaff.role,
          email: newStaff.email || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to add staff member");
      }

      setSuccessMessage("Staff member added successfully.");

      setNewStaff({
        name: "",
        role: "teacher",
        email: "",
      });

      setShowAddStaffForm(false);
      await fetchStaffUsersAndAttendance();
    } catch (error) {
      console.error("Add staff error:", error);
      setError(error.message);
    }
  };

  const handleOpenCreateUserForm = (staff) => {
    setShowUserFormForStaffId(staff.id);
    setShowOverrideFormForStaffId(null);
    setError("");
    setSuccessMessage("");

    setNewUser({
      username: "",
      password: "",
      role: staff.role || "teacher",
    });
  };

  const handleCreateUserForStaff = async (event, staff) => {
    event.preventDefault();

    try {
      setError("");
      setSuccessMessage("");

      const response = await fetch(`${API_HOST_URL}/api/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: newUser.username,
          password: newUser.password,
          role: newUser.role,
          staff_id: staff.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to create user account");
      }

      setSuccessMessage(`Login account created for ${staff.name}.`);

      setNewUser({
        username: "",
        password: "",
        role: "teacher",
      });

      setShowUserFormForStaffId(null);
      await fetchStaffUsersAndAttendance();
    } catch (error) {
      console.error("Create user error:", error);
      setError(error.message);
    }
  };

  const handleOpenOverrideForm = async (staff) => {
    const staffAttendance = getAttendanceForStaff(staff);
    const adminUser = JSON.parse(localStorage.getItem("user"));

    setError("");
    setSuccessMessage("");
    setShowUserFormForStaffId(null);

    if (staffAttendance.length > 0) {
      setShowOverrideFormForStaffId(staff.id);

      setOverrideData({
        attendance_id: "",
        status: "present",
        reason: "",
        overridden_by: adminUser?.username || "admin1",
      });

      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/attendance`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            staff_id: staff.id,
            date: getTodayDate(),
            status: "absent",
            reason: "Admin marked absent from Staff Page",
            submitted_by: adminUser?.username || "admin1",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to mark staff absent");
      }

      setSuccessMessage(`${staff.name} was marked absent for today.`);
      await fetchStaffUsersAndAttendance();
    } catch (error) {
      console.error("Mark absent error:", error);
      setError(error.message);
    }
  };

  const handleSubmitAttendanceOverride = async (event, staff) => {
    event.preventDefault();

    if (!overrideData.attendance_id) {
      setError("Please select an attendance record to override.");
      return;
    }

    try {
      setError("");
      setSuccessMessage("");

      const response = await fetch(
        `${API_BASE_URL}/api/admin/attendance/${overrideData.attendance_id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: overrideData.status,
            reason: overrideData.reason || "Admin override",
            overridden_by: overrideData.overridden_by || "admin1",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to override attendance");
      }

      setSuccessMessage(`Attendance override saved for ${staff.name}.`);

      setOverrideData({
        attendance_id: "",
        status: "present",
        reason: "",
        overridden_by: "admin1",
      });

      setShowOverrideFormForStaffId(null);
      await fetchStaffUsersAndAttendance();
    } catch (error) {
      console.error("Override attendance error:", error);
      setError(error.message);
    }
  };

  const handleSubmitMeeting = (staff) => {
    console.log("Submit Meeting for:", staff.name);
  };

  const handleGiveBackPrepTime = (staff) => {
    console.log("Give back prep time for:", staff.name);
  };

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Staff Page</h1>
          <p className="text-gray-600">
            Search staff, submit meetings, and manage prep time.
          </p>
        </div>

        <button
          onClick={() => {
            setShowAddStaffForm(true);
            setError("");
            setSuccessMessage("");
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Add New Staff Member
        </button>
      </div>

      {error && <p className="text-red-500 mb-4">{error}</p>}

      {successMessage && (
        <p className="text-green-600 mb-4">{successMessage}</p>
      )}

      {showAddStaffForm && (
        <div className="bg-white p-4 rounded-lg shadow mb-6 border">
          <h2 className="text-xl font-bold mb-4">Add New Staff Member</h2>

          <form onSubmit={handleSubmitNewStaff}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block font-semibold mb-2">Name</label>
                <input
                  type="text"
                  name="name"
                  value={newStaff.name}
                  onChange={handleNewStaffChange}
                  className="border rounded px-3 py-2 w-full"
                  placeholder="Example: Ms A. Garcia"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-2">Role</label>
                <select
                  name="role"
                  value={newStaff.role}
                  onChange={handleNewStaffChange}
                  className="border rounded px-3 py-2 w-full"
                >
                  <option value="teacher">Teacher</option>
                  <option value="substitute">Substitute</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-2">Email</label>
                <input
                  type="email"
                  name="email"
                  value={newStaff.email}
                  onChange={handleNewStaffChange}
                  className="border rounded px-3 py-2 w-full"
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Save Staff Member
              </button>

              <button
                type="button"
                onClick={() => setShowAddStaffForm(false)}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <label className="block font-semibold mb-2">Search staff by name</label>

        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border rounded px-3 py-2 w-full"
          placeholder="Example: Ms A. Garcia"
        />
      </div>

      {filteredStaff.length === 0 ? (
        <p className="text-gray-600">No staff member found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStaff.map((staff) => {
            const userAccount = getUserForStaff(staff);
            const hasLogin = Boolean(userAccount);
            const staffAttendance = getAttendanceForStaff(staff);

            return (
              <div
                key={staff.id}
                className="bg-white rounded-lg shadow p-4 border"
              >
                <h2 className="text-xl font-bold mb-2">{staff.name}</h2>

                <p className="text-gray-700">
                  <span className="font-semibold">Role:</span> {staff.role}
                </p>

                <p className="text-gray-700">
                  <span className="font-semibold">Email:</span>{" "}
                  {staff.email || "No email listed"}
                </p>

                <p className="text-gray-700">
                  <span className="font-semibold">Login Account:</span>{" "}
                  {hasLogin ? userAccount.username : "Not created yet"}
                </p>

                <p className="text-gray-700 mb-4">
                  <span className="font-semibold">Attendance Records:</span>{" "}
                  {staffAttendance.length}
                </p>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleSubmitMeeting(staff)}
                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                  >
                    Submit Meeting
                  </button>

                  <button
                    onClick={() => handleGiveBackPrepTime(staff)}
                    className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
                  >
                    Give Back Prep Time
                  </button>

                  <button
                    onClick={() => handleOpenOverrideForm(staff)}
                    className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700"
                  >
                    Override / Mark Absent
                  </button>

                  {!hasLogin && (
                    <button
                      onClick={() => handleOpenCreateUserForm(staff)}
                      className="bg-[#1F6FB2] text-white px-4 py-2 rounded hover:bg-[#155A91]"
                    >
                      Create User Account
                    </button>
                  )}
                </div>

                {showOverrideFormForStaffId === staff.id && (
                  <form
                    onSubmit={(event) =>
                      handleSubmitAttendanceOverride(event, staff)
                    }
                    className="mt-4 border-t pt-4"
                  >
                    <h3 className="font-bold mb-3">
                      Override Attendance for {staff.name}
                    </h3>

                    {staffAttendance.length === 0 ? (
                      <p className="text-sm text-gray-600 mb-3">
                        No attendance records found for this staff member.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        <select
                          name="attendance_id"
                          value={overrideData.attendance_id}
                          onChange={handleOverrideChange}
                          className="border rounded px-3 py-2 w-full"
                          required
                        >
                          <option value="">Select attendance record</option>
                          {staffAttendance.map((record) => (
                            <option key={record.id} value={record.id}>
                              {record.date} - {record.status} -{" "}
                              {record.reason || "No reason"}
                            </option>
                          ))}
                        </select>

                        <select
                          name="status"
                          value={overrideData.status}
                          onChange={handleOverrideChange}
                          className="border rounded px-3 py-2 w-full"
                        >
                          <option value="present">Present</option>
                          <option value="absent">Absent</option>
                          <option value="excused">Excused</option>
                        </select>

                        <input
                          type="text"
                          name="overridden_by"
                          value={overrideData.overridden_by}
                          onChange={handleOverrideChange}
                          className="border rounded px-3 py-2 w-full"
                          placeholder="Admin username, example: admin1"
                          required
                        />

                        <textarea
                          name="reason"
                          value={overrideData.reason}
                          onChange={handleOverrideChange}
                          className="border rounded px-3 py-2 w-full"
                          placeholder="Reason for override"
                          rows="3"
                        />

                        <div className="flex gap-2">
                          <button
                            type="submit"
                            className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700"
                          >
                            Save Override
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setShowOverrideFormForStaffId(null)
                            }
                            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </form>
                )}

                {showUserFormForStaffId === staff.id && (
                  <form
                    onSubmit={(event) =>
                      handleCreateUserForStaff(event, staff)
                    }
                    className="mt-4 border-t pt-4"
                  >
                    <h3 className="font-bold mb-3">
                      Create Login for {staff.name}
                    </h3>

                    <div className="space-y-3">
                      <input
                        type="text"
                        name="username"
                        value={newUser.username}
                        onChange={handleNewUserChange}
                        className="border rounded px-3 py-2 w-full"
                        placeholder="Username"
                        required
                      />

                      <input
                        type="password"
                        name="password"
                        value={newUser.password}
                        onChange={handleNewUserChange}
                        className="border rounded px-3 py-2 w-full"
                        placeholder="Temporary password"
                        required
                      />

                      <select
                        name="role"
                        value={newUser.role}
                        onChange={handleNewUserChange}
                        className="border rounded px-3 py-2 w-full"
                      >
                        <option value="teacher">Teacher</option>
                        <option value="substitute">Substitute</option>
                        <option value="admin">Admin</option>
                      </select>

                      <div className="flex gap-2">
                        <button
                          type="submit"
                          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                        >
                          Save Login
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowUserFormForStaffId(null)}
                          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}