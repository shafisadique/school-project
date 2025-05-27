export interface PromotionRule {
    _id: string;
    classId: string; // The class to which this rule applies (e.g., 9A)
    academicYearId: string; // The academic year for this rule
    schoolId: string; // The school to which this rule applies
    minPercentage: number; // Minimum overall percentage to pass (e.g., 50%)
    maxFailedSubjects: number; // Maximum subjects a student can fail and still be promoted (e.g., 1)
    repeatClassOnFailure: boolean; // If true, student repeats the class if they fail
    passingMarksPerSubject?: number; // Optional: Minimum marks per subject to pass (e.g., 40)
  }