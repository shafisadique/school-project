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
export class ResultCreateComponent implements OnInit {
  exams: any[] = [];
  students: any[] = [];
  classes: any[] = [];
  academicYears: AcademicYear[] = [];
  selectedExamId: string = '';
  selectedStudentId: string = '';
  selectedClassId: string = '';
  selectedAcademicYearId: string = '';
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
      this.toastr.error('School ID is missing. Please log in again.', 'Error');
      this.router.navigate(['/auth/login']);
      return;
    }

    const user = this.authService.getUser();
    if (user?.role !== 'admin') {
      this.toastr.error('You do not have permission to access this page.', 'Authorization Error');
      this.router.navigate(['/dashboard']);
      return;
    }

    this.route.queryParams.subscribe(params => {
      this.selectedExamId = params['examId'] || '';
    });

    this.isLoading = true;
    this.loadClasses();
    this.academicYearService.getAllAcademicYears(this.schoolId).subscribe({
      next: (years) => {
        this.academicYears = years;
        if (years.length === 0) {
          this.toastr.warning('No academic years found. Please create one first.', 'Warning');
          this.isLoading = false;
          return;
        }
        this.academicYearService.getActiveAcademicYear(this.schoolId!).subscribe({
          next: (activeYear) => {
            this.selectedAcademicYearId = activeYear._id;
            localStorage.setItem('activeAcademicYearId', this.selectedAcademicYearId);
            this.loadExams();
            if (this.selectedExamId) {
              this.onExamChange();
            }
          },
          error: (err) => {
            console.error('Error fetching active academic year:', err);
            this.toastr.error('Failed to load active academic year. Please select one manually.', 'Error');
            this.isLoading = false;
          },
          complete: () => {
            this.isLoading = false;
          }
        });
      },
      error: (err) => {
        console.error('Error fetching academic years:', err);
        this.toastr.error('Failed to load academic years. Please try again.', 'Error');
        this.isLoading = false;
      }
    });
  }

  loadClasses(): void {
    if (!this.schoolId) return;

    this.classSubjectService.getClassesBySchool(this.schoolId).subscribe({
      next: (classes) => {
        console.log(classes)
        this.classes = classes;
        if (classes.length === 0) {
          this.toastr.info('No classes found for this school.', 'Info');
        }
      },
      error: (err) => {
        console.error('Error fetching classes:', err);
        this.toastr.error('Failed to load classes. Please try again.', 'Error');
        this.classes = [];
      }
    });
  }

  loadExams(): void {
    if (!this.selectedAcademicYearId) {
      this.exams = [];
      return;
    }

    this.examService.getExamsBySchool(this.schoolId!, this.selectedAcademicYearId).subscribe({
      next: (exams) => {
        this.exams = exams;
        if (exams.length === 0) {
          this.toastr.info('No exams found for the selected academic year.', 'Info');
        }
      },
      error: (err) => {
        console.error('Error fetching exams:', err);
        this.toastr.error('Failed to load exams. Please try again.', 'Error');
        this.exams = [];
      }
    });
  }

  onAcademicYearChange(): void {
    this.selectedExamId = '';
    this.selectedClassId = '';
    this.selectedStudentId = '';
    this.subjects = [];
    this.selectedExam = null;
    this.students = [];
    this.loadExams();
  }

  onExamChange(): void {
    this.selectedClassId = '';
    this.selectedStudentId = '';
    this.subjects = [];
    this.students = [];
    this.selectedExam = this.exams.find(exam => exam._id === this.selectedExamId) || null;
    if (this.selectedExam) {
      this.classes = this.classes.filter(
        classItem => classItem._id === this.selectedExam!.classId._id
      );
      if (this.classes.length === 0) {
        this.toastr.info('No classes found for this exam.', 'Info');
      }
      this.subjects = this.selectedExam.examPapers.map((paper: ExamPaper) => ({
        subjectId: { _id: paper.subjectId._id, name: paper.subjectId.name },
        marksObtained: 0,
        maxMarks: paper.maxMarks
      }));
    }
  }

onClassChange(): void {
  this.selectedStudentId = '';
  this.students = [];
  if (!this.selectedClassId || !this.selectedAcademicYearId) {
    console.log('No class or academic year selected, skipping student fetch.', {
      classId: this.selectedClassId,
      academicYearId: this.selectedAcademicYearId
    });
    return;
  }

  console.log('Fetching students for class ID:', this.selectedClassId, 'and academicYearId:', this.selectedAcademicYearId);

  this.isLoading = true;
  this.classSubjectService.getStudentsByClass(this.selectedClassId, this.selectedAcademicYearId).subscribe({
    next: (response) => {
      console.log('Raw response from getStudentsByClass:', response);
      // Adjust based on the actual response structure
      this.students = response.students || (Array.isArray(response) ? response : []);
      console.log('Updated students array:', this.students);
      if (this.students.length === 0) {
        this.toastr.info('No students found for this class.', 'Info');
      }
    },
    error: (err) => {
      console.error('Error fetching students:', err);
      this.toastr.error('Failed to load students for this class. Please try again.', 'Error');
      this.students = [];
    },
    complete: () => {
      this.isLoading = false;
    }
  });
}

  createResult(): void {
    if (!this.selectedStudentId || !this.selectedExamId || !this.selectedClassId || !this.subjects.length) {
      this.toastr.error('Please fill in all required fields.', 'Validation Error');
      return;
    }
  
    for (const subject of this.subjects) {
      if (subject.marksObtained < 0 || subject.marksObtained > subject.maxMarks) {
        this.toastr.error(
          `Marks for ${subject.subjectId.name} must be between 0 and ${subject.maxMarks}.`,
          'Validation Error'
        );
        return;
      }
    }
  
    const resultData: Partial<any> = {
      studentId: this.selectedStudentId,
      examId: this.selectedExamId,
      classId: this.selectedClassId,
      subjects: this.subjects.map(subject => ({
        subjectId: (subject.subjectId as { _id: string; name: string })._id,
        marksObtained: subject.marksObtained,
        maxMarks: subject.maxMarks
      })),
      totalMarksObtained: 0,
      totalMaxMarks: 0,
      percentage: 0,
      grade: '',
      status: ''
    };
  
    this.isLoading = true;
    this.resultService.createResult(resultData).subscribe({
      next: (result) => {
        this.toastr.success('Result created successfully!', 'Success');
        this.resetForm();
        this.router.navigate(['/result-list']);
      },
      error: (err) => {
        console.error('Error creating result:', err);
        if (err.status === 400) {
          this.toastr.error(err.error?.message || 'Invalid result data. Please check your inputs.', 'Error');
        } else if (err.status === 403) {
          this.toastr.error('You do not have permission to create this result.', 'Error');
        } else if (err.status === 409) {
          this.toastr.error('Already created result for this student', 'Error');
        } else {
          this.toastr.error('Failed to create result. Please try again later.', 'Error');
          this.isLoading = false
        }
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  resetForm(): void {
    this.selectedExamId = '';
    this.selectedClassId = '';
    this.selectedStudentId = '';
    this.subjects = [];
    this.selectedExam = null;
    this.students = [];
    this.loadClasses();
  }
}