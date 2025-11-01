export interface Invoice {
  _id: string;
  totalAmount: number;
  remainingDue: number;
  status: string;
  dueDate: Date;
  studentId: {
    _id: string;
    name: string;
    admissionNo: string;
  };
  // Add other fields as needed
}

export interface ApiResponse<T> {
  data: T;
  message: string;
}