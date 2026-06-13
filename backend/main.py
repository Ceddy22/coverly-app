import csv
import io
import os
import sqlite3
from datetime import date, datetime

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pydantic_ai import Agent
from pydantic_ai.models.openrouter import OpenRouterModel
from pydantic_ai.providers.openrouter import OpenRouterProvider


load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

model = OpenRouterModel(
    "google/gemma-4-26b-a4b-it:free",
    provider=OpenRouterProvider(api_key=OPENROUTER_API_KEY),
)

agent = Agent(model)

DB_FILE = os.getenv("DB_FILE", "test_schedule.db")
CSV_FILE = "schedule.csv"
ATTENDANCE_LOG_FILE = "attendance_changes.txt"

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "https://thirsty-ether-dissuade.ngrok-free.dev",
        "coverly-app-kohl.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class LoginRequest(BaseModel):
    username: str
    password: str


class ScheduleCreate(BaseModel):
    teacher_name: str
    category: str
    subject: str
    room: str
    period: str
    time: str
    monday: str
    tuesday: str
    wednesday: str
    thursday: str
    friday: str


class PromptRequest(BaseModel):
    prompt_id: str


class StaffCreate(BaseModel):
    name: str
    role: str = "teacher"
    email: str | None = None


class UserCreate(BaseModel):
    username: str
    password: str
    role: str
    name: str | None = None
    staff_id: int | None = None


class AttendanceCreate(BaseModel):
    username: str | None = None
    staff_id: int | None = None
    date: str | None = None
    status: str = "absent"
    reason: str | None = None
    submitted_by: str | None = None


class AttendanceOverride(BaseModel):
    status: str
    reason: str | None = None
    overridden_by: str


class MessageCreate(BaseModel):
    sender_username: str
    recipient_username: str
    subject: str | None = None
    body: str


class ScheduleOverrideCreate(BaseModel):
    username: str | None = None
    teacher_name: str | None = None
    period: str
    date: str  # YYYY-MM-DD
    new_category: str | None = None
    new_subject: str | None = None
    new_room: str | None = None
    notes: str | None = None
    created_by: str


PROMPTS = {
    "attendance_summary": "Summarize today's attendance records for an administrator.",
    "parent_email": "Write a professional parent notification email.",
    "school_announcement": "Write a short school announcement for staff and students.",
    "schedule_conflicts": "Review the school schedule and identify possible conflicts.",
}


def get_db_connection():
    connection = sqlite3.connect(DB_FILE, timeout=10, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL;")
    connection.execute("PRAGMA busy_timeout = 10000;")
    return connection


def log_attendance_change(
    action,
    changed_by,
    staff_name,
    attendance_date,
    old_status=None,
    new_status=None,
    reason=None,
):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    log_message = (
        f"[{timestamp}] "
        f"Action: {action} | "
        f"Changed By: {changed_by} | "
        f"Staff: {staff_name} | "
        f"Date: {attendance_date} | "
        f"Old Status: {old_status or 'None'} | "
        f"New Status: {new_status or 'None'} | "
        f"Reason: {reason or 'None'}\n"
    )

    with open(ATTENDANCE_LOG_FILE, "a", encoding="utf-8") as log_file:
        log_file.write(log_message)


def create_notification_with_cursor(
    cursor,
    title,
    message,
    recipient_username=None,
    recipient_staff_id=None,
    notification_type="info",
):
    cursor.execute(
        """
        INSERT INTO notifications (
            recipient_username,
            recipient_staff_id,
            title,
            message,
            type
        )
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            recipient_username,
            recipient_staff_id,
            title,
            message,
            notification_type,
        ),
    )


def get_staff_info_for_attendance(cursor, username=None, staff_id=None):
    if staff_id is not None:
        cursor.execute(
            """
            SELECT *
            FROM staff
            WHERE id = ?
            """,
            (staff_id,),
        )

        staff_member = cursor.fetchone()

        if staff_member is None:
            raise HTTPException(status_code=404, detail="Staff member not found")

        cursor.execute(
            """
            SELECT *
            FROM users
            WHERE staff_id = ?
            """,
            (staff_id,),
        )

        user = cursor.fetchone()

        return {
            "staff_id": staff_member["id"],
            "username": user["username"] if user else None,
            "teacher_name": staff_member["name"],
        }

    if username is not None:
        cursor.execute(
            """
            SELECT *
            FROM users
            WHERE username = ?
            """,
            (username,),
        )

        user = cursor.fetchone()

        if user is None:
            raise HTTPException(status_code=404, detail="User not found")

        return {
            "staff_id": user["staff_id"],
            "username": user["username"],
            "teacher_name": user["name"],
        }

    raise HTTPException(
        status_code=400,
        detail="You must provide either username or staff_id",
    )


def create_tables():
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS staff (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            role TEXT DEFAULT 'teacher',
            email TEXT,
            active INTEGER DEFAULT 1
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL,
            name TEXT NOT NULL,
            staff_id INTEGER,
            FOREIGN KEY (staff_id) REFERENCES staff(id)
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS schedules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            teacher_name TEXT NOT NULL,
            category TEXT,
            subject TEXT,
            room TEXT,
            period TEXT,
            time TEXT,
            monday TEXT,
            tuesday TEXT,
            wednesday TEXT,
            thursday TEXT,
            friday TEXT
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS schedule_overrides (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            teacher_name TEXT NOT NULL,
            period TEXT NOT NULL,
            date TEXT NOT NULL,
            new_category TEXT,
            new_subject TEXT,
            new_room TEXT,
            notes TEXT,
            created_by TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            staff_id INTEGER,
            username TEXT,
            teacher_name TEXT NOT NULL,
            date TEXT NOT NULL,
            status TEXT NOT NULL,
            reason TEXT,
            submitted_by TEXT NOT NULL,
            overridden_by TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(staff_id, date),
            FOREIGN KEY (staff_id) REFERENCES staff(id)
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            recipient_username TEXT,
            recipient_staff_id INTEGER,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            type TEXT DEFAULT 'info',
            is_read INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_username TEXT NOT NULL,
            recipient_username TEXT NOT NULL,
            subject TEXT,
            body TEXT NOT NULL,
            is_read INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    connection.commit()
    connection.close()


def seed_users():
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        INSERT OR IGNORE INTO staff (
            name,
            role,
            email
        )
        VALUES (?, ?, ?)
        """,
        (
            "Ms A. Garcia",
            "teacher",
            None,
        ),
    )

    cursor.execute(
        """
        SELECT id
        FROM staff
        WHERE name = ?
        """,
        ("Ms A. Garcia",),
    )

    garcia_staff = cursor.fetchone()
    garcia_staff_id = garcia_staff["id"] if garcia_staff else None

    starter_users = [
        {
            "username": "admin1",
            "password": "1234",
            "role": "admin",
            "name": "---",
            "staff_id": None,
        },
        {
            "username": "user1",
            "password": "abcd",
            "role": "teacher",
            "name": "Ms A. Garcia",
            "staff_id": garcia_staff_id,
        },
    ]

    for user in starter_users:
        cursor.execute(
            """
            INSERT OR IGNORE INTO users (
                username,
                password,
                role,
                name,
                staff_id
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                user["username"],
                user["password"],
                user["role"],
                user["name"],
                user["staff_id"],
            ),
        )

    connection.commit()
    connection.close()


create_tables()
seed_users()


@app.post("/api/login")
def login(login_data: LoginRequest):
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT *
        FROM users
        WHERE username = ?
        AND password = ?
        """,
        (
            login_data.username,
            login_data.password,
        ),
    )

    user = cursor.fetchone()
    connection.close()

    if user is None:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    return {
        "message": "Login successful",
        "username": user["username"],
        "role": user["role"],
        "name": user["name"],
        "staff_id": user["staff_id"],
    }


@app.post("/api/attendance")
def mark_absent(attendance: AttendanceCreate):
    attendance_date = attendance.date or str(date.today())

    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        staff_info = get_staff_info_for_attendance(
            cursor,
            username=attendance.username,
            staff_id=attendance.staff_id,
        )

        submitted_by = attendance.submitted_by or staff_info["username"] or "unknown"

        cursor.execute(
            """
            INSERT INTO attendance (
                staff_id,
                username,
                teacher_name,
                date,
                status,
                reason,
                submitted_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                staff_info["staff_id"],
                staff_info["username"],
                staff_info["teacher_name"],
                attendance_date,
                attendance.status,
                attendance.reason,
                submitted_by,
            ),
        )

        create_notification_with_cursor(
            cursor,
            recipient_username="admin1",
            title="New Absence Submitted",
            message=f"{staff_info['teacher_name']} submitted an absence for {attendance_date}.",
            notification_type="attendance",
        )

        connection.commit()

        log_attendance_change(
            action="SUBMIT_ABSENCE",
            changed_by=submitted_by,
            staff_name=staff_info["teacher_name"],
            attendance_date=attendance_date,
            old_status=None,
            new_status=attendance.status,
            reason=attendance.reason,
        )

    except sqlite3.IntegrityError:
        connection.rollback()
        raise HTTPException(
            status_code=400,
            detail="Attendance already submitted for this staff member on this date",
        )

    finally:
        connection.close()

    return {
        "message": "Attendance submitted successfully",
        "attendance": {
            "staff_id": staff_info["staff_id"],
            "username": staff_info["username"],
            "teacher_name": staff_info["teacher_name"],
            "date": attendance_date,
            "status": attendance.status,
            "reason": attendance.reason,
            "submitted_by": submitted_by,
        },
    }


@app.post("/api/admin/attendance")
def admin_mark_absent(attendance: AttendanceCreate):
    attendance_date = attendance.date or str(date.today())

    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        staff_info = get_staff_info_for_attendance(
            cursor,
            username=attendance.username,
            staff_id=attendance.staff_id,
        )

        submitted_by = attendance.submitted_by or "admin"

        cursor.execute(
            """
            INSERT INTO attendance (
                staff_id,
                username,
                teacher_name,
                date,
                status,
                reason,
                submitted_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                staff_info["staff_id"],
                staff_info["username"],
                staff_info["teacher_name"],
                attendance_date,
                attendance.status,
                attendance.reason,
                submitted_by,
            ),
        )

        if staff_info["username"]:
            create_notification_with_cursor(
                cursor,
                recipient_username=staff_info["username"],
                recipient_staff_id=staff_info["staff_id"],
                title="Attendance Updated",
                message=f"An admin marked you {attendance.status} for {attendance_date}.",
                notification_type="attendance",
            )

        connection.commit()

        log_attendance_change(
            action="ADMIN_MARK_ATTENDANCE",
            changed_by=submitted_by,
            staff_name=staff_info["teacher_name"],
            attendance_date=attendance_date,
            old_status=None,
            new_status=attendance.status,
            reason=attendance.reason,
        )

    except sqlite3.IntegrityError:
        connection.rollback()
        raise HTTPException(
            status_code=400,
            detail="Attendance already exists for this staff member on this date. Use override instead.",
        )

    finally:
        connection.close()

    return {
        "message": "Admin marked attendance successfully",
        "attendance": {
            "staff_id": staff_info["staff_id"],
            "username": staff_info["username"],
            "teacher_name": staff_info["teacher_name"],
            "date": attendance_date,
            "status": attendance.status,
            "reason": attendance.reason,
            "submitted_by": submitted_by,
        },
    }


@app.put("/api/admin/attendance/{attendance_id}")
def override_attendance(attendance_id: int, override: AttendanceOverride):
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT *
        FROM attendance
        WHERE id = ?
        """,
        (attendance_id,),
    )

    record = cursor.fetchone()

    if record is None:
        connection.close()
        raise HTTPException(status_code=404, detail="Attendance record not found")

    old_status = record["status"]

    cursor.execute(
        """
        UPDATE attendance
        SET status = ?,
            reason = ?,
            overridden_by = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        (
            override.status,
            override.reason,
            override.overridden_by,
            attendance_id,
        ),
    )

    if record["username"]:
        create_notification_with_cursor(
            cursor,
            recipient_username=record["username"],
            recipient_staff_id=record["staff_id"],
            title="Attendance Overridden",
            message=f"Your attendance for {record['date']} was changed from {old_status} to {override.status}.",
            notification_type="attendance",
        )

    connection.commit()
    connection.close()

    log_attendance_change(
        action="OVERRIDE_ATTENDANCE",
        changed_by=override.overridden_by,
        staff_name=record["teacher_name"],
        attendance_date=record["date"],
        old_status=old_status,
        new_status=override.status,
        reason=override.reason,
    )

    return {
        "message": "Attendance record overridden successfully",
        "attendance_id": attendance_id,
        "old_status": old_status,
        "new_status": override.status,
        "reason": override.reason,
        "overridden_by": override.overridden_by,
    }


@app.get("/api/attendance")
def get_attendance_records():
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT *
        FROM attendance
        ORDER BY date DESC, teacher_name
        """
    )

    rows = cursor.fetchall()
    connection.close()

    attendance_records = []

    for row in rows:
        attendance_records.append(dict(row))

    return {"attendance": attendance_records}


@app.get("/api/attendance/{username}")
def get_user_attendance(username: str):
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT *
        FROM attendance
        WHERE username = ?
        ORDER BY date DESC
        """,
        (username,),
    )

    rows = cursor.fetchall()
    connection.close()

    return {"attendance": [dict(row) for row in rows]}


@app.get("/api/staff/{staff_id}/attendance")
def get_staff_attendance(staff_id: int):
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT *
        FROM attendance
        WHERE staff_id = ?
        ORDER BY date DESC
        """,
        (staff_id,),
    )

    rows = cursor.fetchall()
    connection.close()

    return {"attendance": [dict(row) for row in rows]}


@app.get("/api/attendance-log")
def get_attendance_log():
    try:
        with open(ATTENDANCE_LOG_FILE, "r", encoding="utf-8") as log_file:
            logs = log_file.readlines()

        return {"logs": logs}

    except FileNotFoundError:
        return {"logs": []}


@app.post("/api/schedule")
def create_schedule(schedule: ScheduleCreate):
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        INSERT INTO schedules (
            teacher_name,
            category,
            subject,
            room,
            period,
            time,
            monday,
            tuesday,
            wednesday,
            thursday,
            friday
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            schedule.teacher_name,
            schedule.category,
            schedule.subject,
            schedule.room,
            schedule.period,
            schedule.time,
            schedule.monday,
            schedule.tuesday,
            schedule.wednesday,
            schedule.thursday,
            schedule.friday,
        ),
    )

    connection.commit()
    connection.close()

    return {"message": "Schedule added successfully"}


@app.get("/api/schedule/{username}")
def get_schedule(username: str):
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT *
        FROM users
        WHERE username = ?
        """,
        (username,),
    )

    user = cursor.fetchone()

    if user is None:
        connection.close()
        raise HTTPException(status_code=404, detail="User not found")

    teacher_name = user["name"]

    cursor.execute(
        """
        SELECT *
        FROM schedules
        WHERE teacher_name = ?
        """,
        (teacher_name,),
    )

    rows = cursor.fetchall()

    # fetch any overrides for today for this teacher
    today_str = str(date.today())
    cursor.execute(
        """
        SELECT *
        FROM schedule_overrides
        WHERE teacher_name = ?
        AND date = ?
        """,
        (teacher_name, today_str),
    )

    overrides = cursor.fetchall()
    connection.close()

    schedule = []

    # build a map of period -> override for today
    override_map = {}
    for o in overrides:
        override_map[o["period"]] = dict(o)

    for row in rows:
        item = dict(row)

        # apply override if present for this period
        ov = override_map.get(item.get("period"))
        if ov:
            # set category/subject/room to override values if provided
            if ov.get("new_category"):
                item["category"] = ov.get("new_category")
            if ov.get("new_subject"):
                item["subject"] = ov.get("new_subject")
            if ov.get("new_room"):
                item["room"] = ov.get("new_room")

            # attach override meta so frontend can show notes
            item["override_notes"] = ov.get("notes")
            item["override_created_by"] = ov.get("created_by")
            item["override_date"] = ov.get("date")

            # also replace the weekday cell corresponding to today's weekday
            weekday = date.fromisoformat(ov.get("date")).strftime("%A").lower()
            if weekday in ["monday", "tuesday", "wednesday", "thursday", "friday"]:
                # prefer new_subject for the day's cell
                item[weekday] = ov.get("new_subject") or "Meeting"

        schedule.append(item)

    return {
        "teacher_name": teacher_name,
        "schedule": schedule,
    }


@app.get("/api/schedules")
def get_all_schedules():
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT *
        FROM schedules
        ORDER BY teacher_name, period
        """
    )

    rows = cursor.fetchall()
    connection.close()

    return {"schedules": [dict(row) for row in rows]}


@app.post("/api/schedule/upload-csv")
async def upload_schedule_csv(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV file")

    connection = None

    try:
        contents = await file.read()
        decoded_file = contents.decode("utf-8-sig")

        csv_reader = csv.DictReader(io.StringIO(decoded_file))

        required_columns = [
            "Teacher Name",
            "Category",
            "Class/Subject",
            "Room Number",
            "Period",
            "Time",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
        ]

        for column in required_columns:
            if column not in csv_reader.fieldnames:
                raise HTTPException(
                    status_code=400,
                    detail=f"Missing CSV column: {column}",
                )

        connection = get_db_connection()
        cursor = connection.cursor()

        rows_added = 0
        rows_skipped = 0

        for row in csv_reader:
            teacher_name = row["Teacher Name"].strip()
            category = row["Category"].strip()
            subject = row["Class/Subject"].strip()
            room = row["Room Number"].strip()
            period = row["Period"].strip()
            time = row["Time"].strip()
            monday = row["Monday"].strip()
            tuesday = row["Tuesday"].strip()
            wednesday = row["Wednesday"].strip()
            thursday = row["Thursday"].strip()
            friday = row["Friday"].strip()

            cursor.execute(
                """
                INSERT OR IGNORE INTO staff (
                    name,
                    role
                )
                VALUES (?, ?)
                """,
                (
                    teacher_name,
                    "teacher",
                ),
            )

            cursor.execute(
                """
                SELECT COUNT(*) AS count
                FROM schedules
                WHERE teacher_name = ?
                AND category = ?
                AND subject = ?
                AND room = ?
                AND period = ?
                AND time = ?
                AND monday = ?
                AND tuesday = ?
                AND wednesday = ?
                AND thursday = ?
                AND friday = ?
                """,
                (
                    teacher_name,
                    category,
                    subject,
                    room,
                    period,
                    time,
                    monday,
                    tuesday,
                    wednesday,
                    thursday,
                    friday,
                ),
            )

            existing_row = cursor.fetchone()

            if existing_row["count"] > 0:
                rows_skipped += 1
                continue

            cursor.execute(
                """
                INSERT INTO schedules (
                    teacher_name,
                    category,
                    subject,
                    room,
                    period,
                    time,
                    monday,
                    tuesday,
                    wednesday,
                    thursday,
                    friday
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    teacher_name,
                    category,
                    subject,
                    room,
                    period,
                    time,
                    monday,
                    tuesday,
                    wednesday,
                    thursday,
                    friday,
                ),
            )

            rows_added += 1

        create_notification_with_cursor(
            cursor,
            recipient_username="admin1",
            title="Schedule CSV Imported",
            message=f"Schedule import completed. Rows added: {rows_added}. Rows skipped: {rows_skipped}.",
            notification_type="schedule",
        )

        connection.commit()

        return {
            "message": "CSV uploaded successfully",
            "rows_added": rows_added,
            "rows_skipped": rows_skipped,
        }

    except UnicodeDecodeError:
        raise HTTPException(
            status_code=400,
            detail="Could not read file. Make sure it is a valid CSV file.",
        )

    except HTTPException:
        raise

    except Exception as e:
        if connection:
            connection.rollback()
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        if connection:
            connection.close()


@app.post("/api/admin/schedule/override")
def create_schedule_override(override: ScheduleOverrideCreate):
    connection = get_db_connection()
    cursor = connection.cursor()

    # resolve teacher_name if username provided
    teacher_name = override.teacher_name
    if not teacher_name and override.username:
        cursor.execute(
            """
            SELECT name FROM users WHERE username = ?
            """,
            (override.username,),
        )
        user = cursor.fetchone()
        if user is None:
            connection.close()
            raise HTTPException(status_code=404, detail="User not found")

        teacher_name = user["name"]

    if not teacher_name:
        connection.close()
        raise HTTPException(status_code=400, detail="teacher_name or username is required")

    # insert override
    cursor.execute(
        """
        INSERT INTO schedule_overrides (
            teacher_name,
            period,
            date,
            new_category,
            new_subject,
            new_room,
            notes,
            created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            teacher_name,
            override.period,
            override.date,
            override.new_category,
            override.new_subject,
            override.new_room,
            override.notes,
            override.created_by,
        ),
    )

    # notify the user if possible
    cursor.execute(
        """
        SELECT username, staff_id FROM users WHERE name = ?
        """,
        (teacher_name,),
    )

    user_row = cursor.fetchone()
    if user_row:
        create_notification_with_cursor(
            cursor,
            recipient_username=user_row["username"],
            recipient_staff_id=user_row["staff_id"],
            title="Schedule Override",
            message=f"A temporary schedule change was made for {override.date}: {override.new_subject or 'Meeting'} (Period {override.period}). Reason: {override.notes or 'None'}",
            notification_type="schedule",
        )

    connection.commit()
    connection.close()

    return {"message": "Schedule override created"}


@app.post("/api/users")
def create_user(user: UserCreate):
    connection = get_db_connection()
    cursor = connection.cursor()

    staff_id = user.staff_id
    user_name = user.name

    if staff_id is not None:
        cursor.execute(
            """
            SELECT *
            FROM staff
            WHERE id = ?
            """,
            (staff_id,),
        )

        staff_member = cursor.fetchone()

        if staff_member is None:
            connection.close()
            raise HTTPException(status_code=404, detail="Staff member not found")

        user_name = staff_member["name"]

    if not user_name:
        connection.close()
        raise HTTPException(
            status_code=400,
            detail="A user must have either a name or a valid staff_id",
        )

    try:
        cursor.execute(
            """
            INSERT INTO users (
                username,
                password,
                role,
                name,
                staff_id
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                user.username,
                user.password,
                user.role,
                user_name,
                staff_id,
            ),
        )

        create_notification_with_cursor(
            cursor,
            recipient_username=user.username,
            recipient_staff_id=staff_id,
            title="Account Created",
            message="Your Coverly account has been created.",
            notification_type="account",
        )

        connection.commit()

    except sqlite3.IntegrityError:
        connection.rollback()
        raise HTTPException(status_code=400, detail="Username already exists")

    finally:
        connection.close()

    return {
        "message": "User created successfully",
        "user": {
            "username": user.username,
            "role": user.role,
            "name": user_name,
            "staff_id": staff_id,
        },
    }


@app.get("/api/users")
def get_users():
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT 
            users.id,
            users.username,
            users.role,
            users.name,
            users.staff_id,
            staff.email
        FROM users
        LEFT JOIN staff
        ON users.staff_id = staff.id
        ORDER BY users.name
        """
    )

    rows = cursor.fetchall()
    connection.close()

    return {"users": [dict(row) for row in rows]}


@app.get("/api/staff")
def get_staff():
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT *
        FROM staff
        WHERE active = 1
        ORDER BY name
        """
    )

    rows = cursor.fetchall()
    connection.close()

    return {"staff": [dict(row) for row in rows]}


@app.post("/api/staff")
def create_staff(staff: StaffCreate):
    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            INSERT INTO staff (
                name,
                role,
                email
            )
            VALUES (?, ?, ?)
            """,
            (
                staff.name,
                staff.role,
                staff.email,
            ),
        )

        connection.commit()

    except sqlite3.IntegrityError:
        connection.rollback()
        raise HTTPException(status_code=400, detail="Staff member already exists")

    staff_id = cursor.lastrowid
    connection.close()

    return {
        "message": "Staff member created successfully",
        "staff": {
            "id": staff_id,
            "name": staff.name,
            "role": staff.role,
            "email": staff.email,
        },
    }


@app.get("/api/staff/{staff_id}/schedule")
def get_staff_schedule(staff_id: int):
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT *
        FROM staff
        WHERE id = ?
        """,
        (staff_id,),
    )

    staff_member = cursor.fetchone()

    if staff_member is None:
        connection.close()
        raise HTTPException(status_code=404, detail="Staff member not found")

    teacher_name = staff_member["name"]

    cursor.execute(
        """
        SELECT *
        FROM schedules
        WHERE teacher_name = ?
        ORDER BY period
        """,
        (teacher_name,),
    )

    rows = cursor.fetchall()
    connection.close()

    return {
        "staff": dict(staff_member),
        "schedule": [dict(row) for row in rows],
    }


@app.get("/api/notifications/{username}")
def get_user_notifications(username: str):
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT *
        FROM notifications
        WHERE recipient_username = ?
        ORDER BY created_at DESC
        """,
        (username,),
    )

    rows = cursor.fetchall()
    connection.close()

    return {"notifications": [dict(row) for row in rows]}


@app.get("/api/notifications/{username}/unread-count")
def get_unread_notification_count(username: str):
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT COUNT(*) AS count
        FROM notifications
        WHERE recipient_username = ?
        AND is_read = 0
        """,
        (username,),
    )

    row = cursor.fetchone()
    connection.close()

    return {"unread_count": row["count"]}


@app.put("/api/notifications/{notification_id}/read")
def mark_notification_read(notification_id: int):
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        UPDATE notifications
        SET is_read = 1
        WHERE id = ?
        """,
        (notification_id,),
    )

    connection.commit()
    connection.close()

    return {"message": "Notification marked as read"}


@app.put("/api/notifications/{username}/read-all")
def mark_all_notifications_read(username: str):
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        UPDATE notifications
        SET is_read = 1
        WHERE recipient_username = ?
        """,
        (username,),
    )

    connection.commit()
    connection.close()

    return {"message": "All notifications marked as read"}


@app.post("/api/messages")
def send_message(message: MessageCreate):
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT *
        FROM users
        WHERE username = ?
        """,
        (message.sender_username,),
    )

    sender = cursor.fetchone()

    if sender is None:
        connection.close()
        raise HTTPException(status_code=404, detail="Sender not found")

    cursor.execute(
        """
        SELECT *
        FROM users
        WHERE username = ?
        """,
        (message.recipient_username,),
    )

    recipient = cursor.fetchone()

    if recipient is None:
        connection.close()
        raise HTTPException(status_code=404, detail="Recipient not found")

    cursor.execute(
        """
        INSERT INTO messages (
            sender_username,
            recipient_username,
            subject,
            body
        )
        VALUES (?, ?, ?, ?)
        """,
        (
            message.sender_username,
            message.recipient_username,
            message.subject,
            message.body,
        ),
    )

    create_notification_with_cursor(
        cursor,
        recipient_username=message.recipient_username,
        recipient_staff_id=recipient["staff_id"],
        title="New Message",
        message=f"You received a message from {message.sender_username}.",
        notification_type="message",
    )

    connection.commit()
    message_id = cursor.lastrowid
    connection.close()

    return {
        "message": "Message sent successfully",
        "message_id": message_id,
    }


@app.get("/api/messages/inbox/{username}")
def get_inbox(username: str):
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT *
        FROM messages
        WHERE recipient_username = ?
        ORDER BY created_at DESC
        """,
        (username,),
    )

    rows = cursor.fetchall()
    connection.close()

    return {"messages": [dict(row) for row in rows]}


@app.get("/api/messages/sent/{username}")
def get_sent_messages(username: str):
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT *
        FROM messages
        WHERE sender_username = ?
        ORDER BY created_at DESC
        """,
        (username,),
    )

    rows = cursor.fetchall()
    connection.close()

    return {"messages": [dict(row) for row in rows]}


@app.put("/api/messages/{message_id}/read")
def mark_message_read(message_id: int):
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        UPDATE messages
        SET is_read = 1
        WHERE id = ?
        """,
        (message_id,),
    )

    connection.commit()
    connection.close()

    return {"message": "Message marked as read"}


@app.post("/api/admin-prompt")
async def admin_prompt(data: PromptRequest):
    if data.prompt_id not in PROMPTS:
        raise HTTPException(status_code=400, detail="Invalid prompt")

    selected_prompt = PROMPTS[data.prompt_id]

    try:
        result = await agent.run(selected_prompt)
        return {"reply": result.output}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))