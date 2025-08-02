export interface SubjectResult {
  subjectId: { _id: string; name: string };
  marksObtained: number;
  maxMarks: number;
}

export interface Result {
  _id: string;
  studentId: { _id: string; name: string; rollNo: string; id?: string }; // Optional id for compatibility
  examId: string;
  subjects: SubjectResult[]; // Array for compiled results
  marksObtained?: number; // Optional for partial results
  totalMarksObtained?: number; // Optional, calculated for compiled results
  totalMaxMarks?: number; // Optional, calculated for compiled results
  percentage?: number; // Optional, calculated for compiled results
  grade?: string; // Optional, derived from percentage
  status?: string; // Optional, derived from grade or marks
  subjectId?:string;
}