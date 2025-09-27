import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { Result } from '../models/result.model';
import { AcademicYear } from '../models/academic-year.model';
import { ExamService } from '../../exam/exam.service';
import { AcademicYearService } from '../../academic-year/academic-year.service';
import { ResultService } from '../result.service';
import { Exam } from '../models/exam.model';

@Component({
  selector: 'app-result-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './result-list.component.html',
  styleUrls: ['./result-list.component.scss']
})
export class ResultListComponent implements OnInit {
  exams: Exam[] = [];
  academicYears: AcademicYear[] = [];
  selectedExamId: string = '';
  selectedAcademicYearId: string = '';
  results: any[] = [];
  schoolId: string | null = null;
  expandedRows: { [key: string]: boolean } = {};
  isLoadingAcademicYears: boolean = false;
  isLoadingExams: boolean = false;
  isLoadingResults: boolean = false;

  constructor(
    private examService: ExamService,
    private academicYearService: AcademicYearService,
    private resultService: ResultService,
    private authService: AuthService,
    private toastr: ToastrService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.schoolId = this.authService.getSchoolId();
    if (!this.schoolId) {
      this.toastr.error('School ID missing. Log in again.', 'Error');
      this.router.navigate(['/auth/login']);
      return;
    }

    this.isLoadingAcademicYears = true;
    this.academicYearService.getAllAcademicYears(this.schoolId).subscribe({
      next: (years) => {
        this.academicYears = years;
        if (years.length === 0) {
          this.toastr.warning('No academic years found.', 'Warning');
          this.isLoadingAcademicYears = false;
          return;
        }
        this.academicYearService.getActiveAcademicYear(this.schoolId!).subscribe({
          next: (activeYear) => {
            this.selectedAcademicYearId = activeYear._id;
            this.loadExams();
          },
          error: (err) => {
            console.error('Active year error:', err);
            this.toastr.error('Failed to load active year.', 'Error');
            this.isLoadingAcademicYears = false;
          },
          complete: () => this.isLoadingAcademicYears = false
        });
      },
      error: (err) => {
        console.error('Years error:', err);
        this.toastr.error('Failed to load years.', 'Error');
        this.isLoadingAcademicYears = false;
      }
    });
  }

  loadExams(): void {
    if (!this.selectedAcademicYearId) {
      this.exams = [];
      this.results = [];
      return;
    }

    this.isLoadingExams = true;
    const role = this.authService.getUserRole();
    if (role === 'admin') {
      this.examService.getExamsBySchool(this.schoolId!, this.selectedAcademicYearId).subscribe({
        next: (exams) => { this.exams = exams; this.selectedExamId = exams.length > 0 ? exams[0]._id : ''; this.loadResults(); },
        error: (err) => { console.error(err); this.toastr.error('Failed to load exams.', 'Error'); this.exams = []; },
        complete: () => this.isLoadingExams = false
      });
    } else if (role === 'teacher') {
      this.resultService.getExamsByTeacher().subscribe({
        next: (exams) => { 
          this.exams = exams; 
          this.selectedExamId = exams.length > 0 ? exams[0]._id : ''; 
          this.loadResults(); 
        },
        error: (err) => { console.error(err); this.toastr.error('Failed to load exams.', 'Error'); this.exams = []; },
        complete: () => this.isLoadingExams = false
      });
    }
  }

  loadResults(): void {
    if (!this.selectedExamId) {
      this.results = [];
      return;
    }

    this.isLoadingResults = true;
    this.resultService.getResultsByExam(this.selectedExamId).subscribe({
      next: (results) => {
        console.log('Results fetched:', results); // Debug log
        this.results = results.map(r => {
          if (r.subjects.length === 0 && r.marksObtained && r.subjectId) {
            // Handle partial results using subjectId
            return {
              ...r,
              subjects: [{ subjectId: r.subjectId, marksObtained: r.marksObtained, maxMarks: 100 }],
              totalMarksObtained: r.marksObtained,
              totalMaxMarks: 100,
              percentage: (r.marksObtained / 100) * 100,
              grade: r.marksObtained >= 40 ? 'Pass' : 'Fail',
              status: r.marksObtained >= 40 ? 'Pass' : 'Fail'
            };
          }
          // Handle compiled results
          const totalMarksObtained = r.subjects.reduce((sum, s) => sum + (s.marksObtained || 0), 0);
          const totalMaxMarks = r.subjects.reduce((sum, s) => sum + (s.maxMarks || 0), 0);
          const percentage = totalMaxMarks > 0 ? (totalMarksObtained / totalMaxMarks) * 100 : 0;
          return {
            ...r,
            totalMarksObtained,
            totalMaxMarks,
            percentage,
            grade: percentage >= 40 ? 'Pass' : 'Fail',
            status: percentage >= 40 ? 'Pass' : 'Fail'
          };
        }); // Removed the filter to keep all transformed results
        if (this.results.length === 0) this.toastr.info('No results found.', 'Info');
      },
      error: (err) => {
        console.error('Results error:', err);
        this.toastr.error('Failed to load results.', 'Error');
        this.results = [];
      },
      complete: () => this.isLoadingResults = false
    });
  }

  getExamDisplayName(exam: any): string {
    return `${exam.examTitle} - ${exam.classId?.name || 'Unknown Class'}`;
  }

  onAcademicYearChange(): void {
    this.selectedExamId = '';
    this.loadExams();
  }

  onExamChange(): void {
    this.loadResults();
  }

  toggleRow(resultId: string): void {
    this.expandedRows[resultId] = !this.expandedRows[resultId];
  }

  navigateToCreateResult(): void {
    if (this.selectedExamId) {
      this.router.navigate(['/create-result'], { queryParams: { examId: this.selectedExamId } });
    } else {
      this.toastr.warning('Select an exam first.', 'Warning');
    }
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  }
}