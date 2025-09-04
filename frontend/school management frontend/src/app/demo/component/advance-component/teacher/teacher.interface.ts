// src/app/teacher.interface.ts

export interface UserId {
  _id: string;
  username: string;
  password: string;
}

export interface AcademicYear {
  _id: string;
}

export interface Teacher {
  _id: string;
  userId: UserId;
  name: string;
  email: string;
  phone: string;
  designation: string;
  subjects: string[];
  gender: string;
  schoolId: string;
  createdBy: string;
  leaveBalance: number;
  profileImage: string;
  academicYearId: string;
  status: boolean;
  createdAt: string;
  updatedAt: string;
  __v: number;
  academicYear: AcademicYear;
}