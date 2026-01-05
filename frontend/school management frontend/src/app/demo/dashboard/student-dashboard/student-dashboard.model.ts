// models/student-dashboard.model.ts — FINAL 100% CORRECT

export interface Holiday {
  _id: string;
  title: string;
  date: string;
}

export interface Assignment {
  _id: string;
  subject: string;
  dueDate: string;
}

export interface Payment {
  amount: number;
  method: string;
  date: string;
}

export interface FeeInvoice {
  _id: string;
  month: string;
  totalAmount: number;
  paidAmount: number;
  remainingDue: number;
  status: string;
  dueDate: string;
  paymentHistory: Payment[];
}

// FINAL CORRECT INTERFACE — HAS ALL FIELDS FROM BACKEND
export interface StudentDashboardData {
  _id: string;
  admissionNo: string;
  name: string;
  section: string[];
  rollNo: string;
  className: string;
  photo: string;

  todayAttendance: string;
  holidayName?: string;

  allHolidays: Holiday[];
  pendingAssignments: Assignment[];

  // THESE WERE MISSING — NOW ADDED!
  feeInvoices: FeeInvoice[];
  totalFee: number;
  totalPaid: number;
  totalDue: number;
}