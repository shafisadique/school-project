// src/app/teacher.interface.ts

export interface UserId {
  _id: string;
  username: string;
  // Removed 'password' for security (handle separately if needed for portals)
}

export interface AcademicYear {
  _id: string;
  name?: string; // Added for display (e.g., year name)
}

export interface Teacher {
  _id: string;
  userId: UserId;
  name: string;
  email: string;
  portalUsername:any;
  phone: string;
  designation?: string; // Made optional if not always set
  subjects: string[];
  dateOfBirth?: string;
  joiningDate?: string;
  qualification?: string;
  experienceYears?: number;
  address?: string;
  bloodGroup?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  gender: string;
  schoolId: string;
  createdBy: string;
  leaveBalance: number;
  profileImage?: string; // Key or path
  profileImageUrl?: string; // Full proxy URL from backend
  academicYearId: string;
  status: boolean;
  createdAt: string;
  updatedAt: string;
  
  __v: number;
  academicYear?: AcademicYear; // Populated
}
