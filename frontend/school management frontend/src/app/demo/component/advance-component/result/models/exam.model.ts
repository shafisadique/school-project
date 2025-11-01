export interface Subject {
    _id: string;
    name: string;
  }
  
  export interface ExamPaper {
    subjectId: Subject;
    subjectType: 'Written' | 'Practical' | 'Oral';
    maxMarks: number;
    minMarks: number;
    paperCode: string;
    paperStartDateTime: string;
    paperEndDateTime: string;
    roomNo: string;
    gradeCriteria: string;
  }
  
  export interface Class {
    _id: string;
    name: string;
  }
  
  export interface Exam {
    _id: string;
    academicYearId: string;
    classId: Class;
    examTitle: string;
    examCenter: string;
    startDate: string;
    endDate: string;
    examStatus: 'Scheduled' | 'Ongoing' | 'Completed';
    examPapers: ExamPaper[];
    examDate:any
  }