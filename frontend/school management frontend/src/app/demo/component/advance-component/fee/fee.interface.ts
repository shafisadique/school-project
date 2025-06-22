


 export interface Student {
    _id: string;
    name: string;
    admissionNo: string;
    className: string;
    currentSession: string;
    usesTransport: boolean;
    usesHostel: boolean;
  }
  
export interface FeeStructure {
  _id?: string;
  schoolId: string;
  academicYear: string;
  className: string;
  fees: { name: string; amount: number; type: string; frequency: string }[];
  lateFeeRules: { dailyRate: number; maxLateFee: number };
  discounts: { name: string; amount: number; type: string }[];
  createdAt?: string;
  updatedAt?: string;
}

export interface FeeEntry {
  name: string;
  amount: number;
  type: string;
  frequency: string;
}