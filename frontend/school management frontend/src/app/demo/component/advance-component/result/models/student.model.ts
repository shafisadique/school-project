export interface Student {
    _id: string;
    name: string;
    rollNo: string;
    classId: { _id: string; name: string };
    academicYearId: string;
    status: 'Active' | 'Promoted' | 'Repeated';
  }