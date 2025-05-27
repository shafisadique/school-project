export interface SubjectResult {
    subjectId: { _id: string; name: string };
    marksObtained: number;
    maxMarks: number;
  }
  
  export interface Result {
    _id: string;
    studentId: { _id: string; name: string; rollNo: string };
    examId: string; // Changed to string since backend doesn’t populate examId with examTitle
    subjects: SubjectResult[];
    totalMarksObtained: number;
    totalMaxMarks: number;
    percentage: number;
    grade: string;
    status: string;
  }