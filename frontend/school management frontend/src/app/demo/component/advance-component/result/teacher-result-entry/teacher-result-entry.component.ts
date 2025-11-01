import { Component, OnInit, ChangeDetectorRef, TrackByFunction } from '@angular/core'; // NEW: ChangeDetectorRef for force update
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { ExamService } from '../../exam/exam.service';
import { ResultService } from '../result.service';
import { StudentService } from '../../students/student.service';
import { AcademicYearService } from '../../academic-year/academic-year.service';
import { ClassSubjectService } from '../../class-subject-management/class-subject.service';
import { Exam } from '../models/exam.model';
import { Result } from '../models/result.model';

@Component({
  selector: 'app-teacher-result-entry',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './teacher-result-entry.component.html',
  styleUrls: ['./teacher-result-entry.component.scss']
})
export class TeacherResultEntryComponent implements OnInit {
  exams: Exam[] = [];
  selectedExamId: string = '';
  selectedExam: Exam | null = null;
  students: any[] = [];
  selectedStudentId: string = '';
  selectedStudent: any = null;
  subjects: any[] = []; // { subjectId: { _id, name }, maxMarks }
  marksForm: FormGroup;
  selectedAcademicYearId: string = '';
  selectedClassId: string = '';
  schoolId: string | null = null;
  isLoading: boolean = false;
trackBySubjectId: TrackByFunction<any>;

  constructor(
    private examService: ExamService,
    private resultService: ResultService,
    private studentService: StudentService,
    private academicYearService: AcademicYearService,
    private classSubjectService: ClassSubjectService,
    private authService: AuthService,
    private toastr: ToastrService,
    public router: Router,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef // NEW: For force change detection
  ) {
    this.marksForm = this.fb.group({}); // Dynamic form for marks
  }

  ngOnInit(): void {
    this.schoolId = this.authService.getSchoolId();
    if (!this.schoolId) {
      this.toastr.error('School ID is missing. Please log in again.', 'Error');
      this.router.navigate(['/auth/login']);
      return;
    }
    this.loadActiveYearAndExams();
  }

  loadActiveYearAndExams(): void {
    this.isLoading = true;
    this.academicYearService.getActiveAcademicYear(this.schoolId!).subscribe({
      next: (activeYear) => {
        this.selectedAcademicYearId = activeYear._id;
        this.loadExams();
      },
      error: (err) => this.handleError('active academic year', err),
      complete: () => this.isLoading = false
    });
  }

  loadExams(): void {
    this.isLoading = true;
    this.examService.getExamsForResultEntry().subscribe({
      next: (response: any) => {
        console.log('Full Response from getExamsForResultEntry:', response); // Debug: Check exams
        this.exams = response.exams || response;
        if (this.exams.length === 0) {
          this.toastr.info('No exams available for your assigned subjects.', 'Info');
        }
      },
      error: (err) => this.handleError('exams', err),
      complete: () => this.isLoading = false
    });
  }

  onExamChange(): void {
    this.selectedStudentId = '';
    this.selectedStudent = null;
    this.subjects = [];
    this.marksForm = this.fb.group({}); // Reset form
    this.selectedExam = this.exams.find(exam => exam._id === this.selectedExamId) || null;
    console.log('Selected Exam:', this.selectedExam); // Debug: Check exam data
    if (this.selectedExam) {
      this.selectedClassId = this.selectedExam.classId._id;
      // FIXED: Ensure name is extracted correctly (paper.subjectId.name)
      this.subjects = this.selectedExam.examPapers.map((paper: any) => ({
        subjectId: { 
          _id: paper.subjectId._id, 
          name: paper.subjectId.name || 'Unknown' // Ensure name
        },
        maxMarks: paper.maxMarks
      }));
      console.log('Mapped Subjects:', this.subjects); // Debug: Check subjects with names
      this.buildMarksForm();
      this.loadStudents();
      this.cdr.detectChanges(); // NEW: Force change detection for *ngFor
    }
  }

  buildMarksForm(): void {
    const formControls = {};
    this.subjects.forEach(subject => {
      formControls[subject.subjectId._id] = [0, [Validators.required, Validators.min(0), Validators.max(subject.maxMarks)]];
    });
    this.marksForm = this.fb.group(formControls);
    console.log('Marks Form Controls:', formControls); // Debug: Check form
  }

  loadStudents(): void {
    if (!this.selectedClassId || !this.selectedAcademicYearId) return;
    this.isLoading = true;
    this.classSubjectService.getStudentsByClass(this.selectedClassId, this.selectedAcademicYearId).subscribe({
      next: (response: any) => {
        this.students = response.students || response;
        if (this.students.length === 0) {
          this.toastr.info('No students found for the selected class.', 'Info');
        }
      },
      error: (err) => this.handleError('students', err),
      complete: () => this.isLoading = false
    });
  }

  onStudentChange(): void {
    this.selectedStudent = this.students.find(s => s._id === this.selectedStudentId) || null;
    if (this.selectedStudent) {
      this.resultService.getPartialResults(this.selectedStudent._id, this.selectedExamId).subscribe({
        next: (partialResults: any[]) => {
          partialResults.forEach(pr => {
            const control = this.marksForm.get(pr.subjectId._id);
            if (control) control.setValue(pr.marksObtained);
          });
          console.log('Partial Results Loaded:', partialResults); // Debug: Check names
        },
        error: (err) => this.handleError('partial results', err)
      });
    }
  }

  submitMarks(): void {
    if (this.marksForm.invalid) {
      this.toastr.warning('Please fill all marks correctly (0 to max marks).', 'Validation Error');
      this.markInvalidFields();
      return;
    }

    this.isLoading = true;
    const partialResults = this.subjects.map(subject => ({
      studentId: this.selectedStudent._id,
      examId: this.selectedExam._id,
      classId: this.selectedClassId,
      subjectId: subject.subjectId._id,
      marksObtained: this.marksForm.value[subject.subjectId._id]
    }));
    // Batch submit
    const submitPromises = partialResults.map(pr => this.resultService.createPartialResult(pr).toPromise());
    Promise.all(submitPromises).then(() => {
      this.toastr.success('Marks submitted successfully!', 'Success');
      this.marksForm.reset();
      this.onStudentChange();
    }).catch(err => this.handleError('submitting marks', err)).finally(() => {
      this.isLoading = false;
    });
  }

  getTotalObtained(): number {
    return this.subjects.reduce((sum, subject) => {
      const value = this.marksForm.get(subject.subjectId._id)?.value || 0;
      return sum + value;
    }, 0);
  }

  getTotalMax(): number {
    return this.subjects.reduce((sum, subject) => sum + subject.maxMarks, 0);
  }

  getOverallPercentage(): number {
    const totalMax = this.getTotalMax();
    if (totalMax === 0) return 0;
    return (this.getTotalObtained() / totalMax) * 100;
  }

  private markInvalidFields(): void {
    Object.keys(this.marksForm.controls).forEach(key => {
      const control = this.marksForm.get(key);
      if (control && control.invalid) {
        control.markAsTouched();
      }
    });
  }

  private handleError(type: string, err: any): void {
    console.error(`Error ${type}:`, err); // Keep console for debugging
    // FIXED: Extract and display backend error message in Toastr
    let errorMessage = `Failed to ${type}. Please try again.`;
    if (err?.error?.error) {
      errorMessage = err.error.error; // Backend-specific message, e.g., "Error creating partial result: Result already exists..."
    } else if (err?.message) {
      errorMessage = err.message;
    } else if (err?.error) {
      errorMessage = typeof err.error === 'string' ? err.error : JSON.stringify(err.error);
    }
    this.toastr.error(errorMessage, `${type.charAt(0).toUpperCase() + type.slice(1)} Error`);
    this.isLoading = false;
  }

  navigateToResultList(): void {
    this.router.navigate(['result/result-list']);
  }

  // FIXED: Implement trackBySubjectId as declared
  // trackBySubjectId(index: number, subject: any): string {
  //   return subject.subjectId._id;
  // }
}