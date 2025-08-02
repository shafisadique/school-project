import { Component, OnInit } from '@angular/core';
import { ExamService } from '../../exam/exam.service';
import { ResultService } from '../result.service';
import { StudentService } from '../../students/student.service';
import { AcademicYearService } from '../../academic-year/academic-year.service';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { ClassSubjectService } from '../../class-subject-management/class-subject.service';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-teacher-result-entry',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './teacher-result-entry.component.html',
  styleUrls: ['./teacher-result-entry.component.scss']
})
export class TeacherResultEntryComponent implements OnInit {
  exams: any[] = [];
  selectedExam: any = null;
  students: any[] = [];
  selectedStudentId: string = '';
  selectedStudent: any = null;
  subjects: any[] = [];
  marks: { [key: string]: number } = {};
  selectedAcademicYearId: string = '';
  selectedClassId: string = '';
  schoolId: string | null = null;
  isLoading: boolean = false;
  selectedExamId: string = ''; // Explicitly typed as string

  constructor(
    private examService: ExamService,
    private resultService: ResultService,
    private academicYearService: AcademicYearService,
    private authService: AuthService,
    private classSubjectService: ClassSubjectService,
    private toastr: ToastrService,
    public router: Router
  ) {}

  ngOnInit(): void {
    this.schoolId = this.authService.getSchoolId();
    if (!this.schoolId) {
      this.toastr.error('School ID is missing.', 'Error');
      this.router.navigate(['/auth/login']);
      return;
    }

    this.isLoading = true;
    this.academicYearService.getActiveAcademicYear(this.schoolId).subscribe({
      next: (activeYear) => {
        this.selectedAcademicYearId = activeYear._id;
        this.loadExams();
      },
      error: (err) => this.handleError('active academic year', err),
      complete: () => (this.isLoading = false)
    });
  }

loadExams(): void {
  this.isLoading = true;
  this.examService.getExamsForResultEntry().subscribe({
    next: (response:any) => {
      // Handle both object and array responses
      this.exams = response.exams || response;
      
      if (this.exams.length === 0) {
        this.toastr.info('No exams found for your assigned classes.', 'Info');
      } else {
        console.log('Exams loaded:', this.exams); // Debug log
      }
    },
    error: (err) => this.handleError('exams', err),
    complete: () => (this.isLoading = false)
  });
}

onExamChange(): void {
  this.selectedStudent = null;
  this.students = [];
  this.subjects = [];
  this.marks = {};
  
  this.selectedExam = this.exams.find(exam => exam._id === this.selectedExamId) || null;
  
  if (this.selectedExam) {
    this.selectedClassId = this.selectedExam.classId._id;
    
    // Use the exam papers directly since they're already filtered by the backend
    this.subjects = this.selectedExam.examPapers.map(paper => ({
      subjectId: { 
        _id: paper.subjectId._id, 
        name: paper.subjectId.name 
      },
      maxMarks: paper.maxMarks
    }));
    
    this.loadStudents();
  }
}

  loadStudents(): void {
    if (!this.selectedClassId || !this.selectedAcademicYearId) return;
    this.isLoading = true;
    this.classSubjectService.getStudentsByClass(this.selectedClassId, this.selectedAcademicYearId).subscribe({
      next: (response) => {
        this.students = response.students || response;
        if (this.students.length === 0) this.toastr.info('No students found.', 'Info');
        // Set selectedStudent based on selectedStudentId
        this.selectedStudent = this.students.find(s => s._id === this.selectedStudentId) || null;
      },
      error: (err) => this.handleError('students', err),
      complete: () => (this.isLoading = false)
    });
  }

  onStudentChange(): void {
    this.marks = {};
    this.selectedStudent = this.students.find(s => s._id === this.selectedStudentId) || null;
    if (this.selectedStudent) {
      this.resultService.getPartialResults(this.selectedStudent._id, this.selectedExam._id).subscribe({
        next: (partialResults) => {
          partialResults.forEach((pr: any) => {
            this.marks[pr.subjectId._id] = pr.marksObtained;
          });
        },
        error: (err) => this.handleError('partial results', err)
      });
    }
  }

  submitMarks(): void {
  if (!this.selectedStudent || !this.selectedExam || !Object.keys(this.marks).length) {
    this.toastr.error('Please select a student and enter marks.', 'Validation Error');
    return;
  }

  this.isLoading = true;
  const promises = Object.keys(this.marks).map(subjectId => {
    const marksObtained = this.marks[subjectId];
    const subject = this.subjects.find(s => s.subjectId._id === subjectId);
    if (!subject || marksObtained < 0 || marksObtained > subject.maxMarks) {
      this.toastr.error(`Invalid marks for ${subject?.subjectId.name || 'unknown subject'}.`, 'Validation Error');
      return Promise.resolve();
    }
    return this.resultService.createPartialResult({
      studentId: this.selectedStudent._id,
      examId: this.selectedExam._id,
      classId: this.selectedClassId,
      subjectId,
      marksObtained
    }).toPromise();
  });

  Promise.all(promises).then(() => {
    this.toastr.success('Marks submitted successfully!', 'Success');
    this.marks = {};
    this.onStudentChange(); // Refresh partial results
  }).catch(err => this.handleError('submitting marks', err)).finally(() => {
    this.isLoading = false;
  });
}

  private handleError(type: string, err: any): void {
    console.error(`Error fetching ${type}:`, err);
    this.toastr.error(`Failed to load ${type}. Please try again.`, 'Error');
    this.isLoading = false;
  }
}