// result-create.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ExamService } from '../../exam/exam.service';
import { ResultService } from '../result.service';
import { StudentService } from '../../students/student.service';
import { AcademicYearService } from '../../academic-year/academic-year.service';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { Result, SubjectResult } from '../models/result.model';
import { AcademicYear } from '../models/academic-year.model';
import { Exam, ExamPaper } from '../models/exam.model';
import { ClassSubjectService } from '../../class-subject-management/class-subject.service';

@Component({
  selector: 'app-result-create',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './result-create.component.html',
  styleUrls: ['./result-create.component.scss']
})
// result-create.component.ts
export class ResultCreateComponent implements OnInit {
  exams: Exam[] = [];
  students: any[] = [];
  classes: any[] = [];
  academicYears: AcademicYear[] = [];
  selectedAcademicYearId: string = '';
  selectedClassId: string = '';
  selectedExamId: string = '';
  selectedStudentId: string = '';
  schoolId: string | null = null;
  subjects: SubjectResult[] = [];
  selectedExam: Exam | null = null;
  isLoading: boolean = false;

  constructor(
    private examService: ExamService,
    private studentService: StudentService,
    private academicYearService: AcademicYearService,
    private resultService: ResultService,
    private authService: AuthService,
    private classSubjectService: ClassSubjectService,
    private toastr: ToastrService,
    public router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.schoolId = this.authService.getSchoolId();
    if (!this.schoolId) {
      this.toastr.error('School ID is missing.', 'Error');
      this.router.navigate(['/auth/login']);
      return;
    }

    this.isLoading = true;
    this.loadClasses();
    this.academicYearService.getAllAcademicYears(this.schoolId).subscribe({
      next: (years) => {
        this.academicYears = years;
        if (years.length > 0) {
          this.academicYearService.getActiveAcademicYear(this.schoolId!).subscribe({
            next: (activeYear) => {
              this.selectedAcademicYearId = activeYear._id;
              this.loadExams(); // Load exams after setting academic year
            },
            error: (err) => this.handleError('active academic year', err),
            complete: () => (this.isLoading = false)
          });
        } else {
          this.toastr.warning('No academic years found.', 'Warning');
          this.isLoading = false;
        }
      },
      error: (err) => this.handleError('academic years', err)
    });
  }

  loadClasses(): void {
    if (!this.schoolId) return;
    this.classSubjectService.getClassesBySchool(this.schoolId).subscribe({
      next: (classes) => {
        this.classes = classes;
        if (classes.length === 0) this.toastr.info('No classes found.', 'Info');
      },
      error: (err) => this.handleError('classes', err)
    });
  }

  loadExams(): void {
    if (!this.selectedAcademicYearId || !this.selectedClassId) {
      this.exams = [];
      this.selectedExamId = '';
      this.subjects = [];
      return;
    }
    this.isLoading = true;
    this.examService.getExamsByTeacher(this.selectedClassId, this.selectedAcademicYearId).subscribe({
      next: (exams) => {
        this.exams = exams;
        this.selectedExamId = ''; // Reset exam selection
        this.subjects = [];
        if (exams.length === 0) {
          this.toastr.info('No exams found for the selected class.', 'Info');
        } else {
          this.onExamChange(); // Auto-select the first exam if available
        }
      },
      error: (err) => this.handleError('exams', err),
      complete: () => (this.isLoading = false)
    });
  }

  onAcademicYearChange(): void {
    this.selectedClassId = '';
    this.selectedExamId = '';
    this.selectedStudentId = '';
    this.subjects = [];
    this.exams = [];
    this.selectedExam = null;
    this.students = [];
    this.loadExams();
  }

  onClassChange(): void {
    this.selectedExamId = '';
    this.selectedStudentId = '';
    this.subjects = [];
    this.exams = [];
    this.selectedExam = null;
    this.students = [];
    if (!this.selectedClassId || !this.selectedAcademicYearId) {
      console.log('No class or academic year selected.');
      return;
    }
    this.loadExams(); // Load exams for the selected class
    this.loadStudents();
  }

  loadStudents(): void {
    if (!this.selectedClassId || !this.selectedAcademicYearId) return;
    this.isLoading = true;
    this.classSubjectService.getStudentsByClass(this.selectedClassId, this.selectedAcademicYearId).subscribe({
      next: (response) => {
        this.students = response.students || response;
        if (this.students.length === 0) this.toastr.info('No students found.', 'Info');
      },
      error: (err) => this.handleError('students', err),
      complete: () => (this.isLoading = false)
    });
  }

  onExamChange(): void {
    this.selectedStudentId = '';
    this.subjects = [];
    this.students = [];
    this.selectedExam = this.exams.find(exam => exam._id === this.selectedExamId) || null;
    if (this.selectedExam) {
      this.selectedClassId = this.selectedExam.classId._id; // Ensure class matches exam
      this.subjects = this.selectedExam.examPapers.map((paper: ExamPaper) => ({
        subjectId: { _id: paper.subjectId._id, name: paper.subjectId.name },
        marksObtained: 0,
        maxMarks: paper.maxMarks
      }));
      this.loadStudents(); // Reload students for the exam's class
    }
  }

  createResult(): void {
    if (!this.selectedStudentId || !this.selectedExamId || !this.selectedClassId || !this.subjects.length) {
      this.toastr.error('Please fill all required fields.', 'Validation Error');
      return;
    }
    const resultData:any = {
      studentId: this.selectedStudentId,
      examId: this.selectedExamId,
      classId: this.selectedClassId,
      subjects: this.subjects,
      academicYearId: this.selectedAcademicYearId
    };
    this.isLoading = true;
    this.resultService.createResult(resultData).subscribe({
      next: () => {
        this.toastr.success('Result created successfully!', 'Success');
        this.resetForm();
        this.router.navigate(['/result/result-list']);
      },
      error: (err) => this.handleError('creating result', err),
      complete: () => (this.isLoading = false)
    });
  }

  resetForm(): void {
    this.selectedExamId = '';
    this.selectedClassId = '';
    this.selectedStudentId = '';
    this.subjects = [];
    this.exams = [];
    this.selectedExam = null;
    this.students = [];
    this.loadClasses();
  }

  private handleError(type: string, err: any): void {
    console.error(`Error fetching ${type}:`, err);
    this.toastr.error(`Failed to load ${type}. Please try again.`, 'Error');
    if (type === 'exams') this.exams = [];
    this.isLoading = false;
  }
}