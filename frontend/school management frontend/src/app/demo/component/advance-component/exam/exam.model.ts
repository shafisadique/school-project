// src/app/models/exam.model.ts
export interface Subject {
    _id: string;
    name: string;
  }
  
  export interface SubjectEntry {
    subjectId: Subject;
    maxMarks: number;
    date?: string;
  }
  
  export interface Exam {
    _id?: string;
    schoolId: string;
    classId: { _id: string; name: string };
    academicYearId: string;
    examName: string;
    startDate: string;
    endDate: string;
    subjects: SubjectEntry[];
    createdAt?: string;
  }
  
  export interface Class {
    _id: string;
    name: string;
  }
  
  export interface AcademicYear {
    _id: string;
    name: string;
  }
  
  export interface Subject {
    _id: string;
    name: string;
  }