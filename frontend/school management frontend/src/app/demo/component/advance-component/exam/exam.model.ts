export interface Subject {
  _id: string;
  name: string;
  schoolId: string;
}

export interface Class {
  _id: string;
  name: string;
  sections: string[];
  schoolId: string;
}

export interface AcademicYear {
  _id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  schoolId: string;
}

export interface ExamPaper {
  subjectId: string;
  subjectType: 'Written' | 'Practical' | 'Oral';
  maxMarks: number;
  minMarks: number;
  paperCode: string;
  paperStartDateTime: string; // ISO string, e.g., "2025-06-01T09:00:00Z"
  paperEndDateTime: string; // ISO string, e.g., "2025-06-01T12:00:00Z"
  roomNo: string;
  gradeCriteria: string;
}

export interface Exam {
  _id:any;
  schoolId: string;
  classId: any;
  academicYearId: string;
  examTitle: string;
  examCenter: string;
  startDate: string;
  endDate: string;
  examStatus: 'Scheduled' | 'Ongoing' | 'Completed';
  examPapers: ExamPaper[];
}