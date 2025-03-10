


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
    _id: string;
    baseFee: number;
    feeBreakdown: {
      tuitionFee: number;
      examFee: number;
      transportFee: number;
      hostelFee: number;
      miscFee: number;
    };
  }