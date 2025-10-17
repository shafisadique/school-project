// src/app/theme/default/dashboard.model.ts

export interface Teacher {
  _id: string;
  name: string;
  email: string;
  subjects: string[];
  leaveBalance: number;
}

export interface ClassInfo {
  _id: string;
  name: string;
}

export interface SubjectInfo {
  _id: string;
  name: string;
}

export interface AssignmentAttachment {
  _id?: string;
  filename: string;
  url: string;
  size?: number;
  mimeType?: string;
}

export interface Assignment {
  _id: string;
  title: string;
  description: string;
  dueDate: string;
  schoolId: string;
  classId: ClassInfo;
  assignedTo: string[];
  attachments: string[]; // Array of file paths
  subjectId: SubjectInfo;
  teacherId: string;
  createdBy: string;
  status: 'pending' | 'submitted' | 'graded' | 'completed';
  submissions: any[];
  createdAt: string;
  updatedAt: string;
}

export interface LeaveRequest {
  _id: string;
  teacherId: string;
  schoolId: string;
  date: string;
  reason: string;
  substituteTeacherId?: string | null;
  status: 'Pending' | 'Approved' | 'Rejected';
  leaveType?: string | null;
  isTeacherApplied: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Holiday {
  _id: string;
  schoolId: string;
  title: string;
  date: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  _id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: string;
}

export interface StudentAttendanceRecord {
  _id: string;
  studentId: string;
  studentName: string;
  className: string;
  status: 'Present' | 'Absent' | 'On Leave' | 'Late';
  date: string;
  markedBy: string;
  createdAt: string;
}

export interface StudentAttendanceData {
  todayAttendance?: {
    present: number;
    absent: number;
    onLeave: number;
    total: number;
  };
  weeklyTrend?: Array<{
    date: string;
    present: number;
    absent: number;
    percentage: number;
  }>;
  recentRecords?: StudentAttendanceRecord[];
  classesAttended?: Array<{
    className: string;
    presentCount: number;
    totalStudents: number;
  }>;
}

export interface TeacherDashboardData {
  success: boolean;
  data: {
    teacher: Teacher;
    personalAttendanceStatus: 'Present' | 'Absent' | 'On Leave';
    pendingAssignments: Assignment[];
    recentStudentAttendance: StudentAttendanceRecord[];
    upcomingHolidays: Holiday[];
    pendingLeaves: LeaveRequest[];
    notifications: Notification[];
    isHoliday: boolean;
  };
}

// Convenience types for easier usage in components
export type DashboardResponse = TeacherDashboardData;
export type PersonalStatus = 'Present' | 'Absent' | 'On Leave';
export type AssignmentStatus = 'pending' | 'submitted' | 'graded' | 'completed';
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected';
export type AttendanceStatus = 'Present' | 'Absent' | 'On Leave' | 'Late';