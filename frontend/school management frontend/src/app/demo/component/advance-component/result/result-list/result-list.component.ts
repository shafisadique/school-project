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
  exams: any[] = [];
  academicYears: AcademicYear[] = [];
  selectedExamId: string = '';
  selectedAcademicYearId: string = '';
  results: Result[] = [];
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
      this.toastr.error('School ID is missing. Please log in again.', 'Authentication Error');
      this.router.navigate(['/auth/login']);
      return;
    }

    // Fetch academic years
    this.isLoadingAcademicYears = true;
    this.academicYearService.getAllAcademicYears(this.schoolId).subscribe({
      next: (years) => {
        this.academicYears = years;
        if (years.length === 0) {
          this.toastr.warning('No academic years found. Please create one first.', 'Warning');
          this.isLoadingAcademicYears = false;
          return;
        }
        this.academicYearService.getActiveAcademicYear(this.schoolId!).subscribe({
          next: (activeYear) => {
            this.selectedAcademicYearId = activeYear._id;
            localStorage.setItem('activeAcademicYearId', this.selectedAcademicYearId);
            this.loadExams();
          },
          error: (err) => {
            console.error('Error fetching active academic year:', err);
            this.toastr.error('Failed to load active academic year. Please select one manually.', 'Error');
            this.isLoadingAcademicYears = false;
          },
          complete: () => {
            this.isLoadingAcademicYears = false;
          }
        });
      },
      error: (err) => {
        console.error('Error fetching academic years:', err);
        this.toastr.error('Failed to load academic years. Please try again.', 'Error');
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
    this.examService.getExamsBySchool(this.schoolId!, this.selectedAcademicYearId).subscribe({
      next: (exams) => {
        this.exams = exams;
        if (exams.length > 0) {
          this.selectedExamId = exams[0]._id;
          this.loadResults();
        } else {
          this.results = [];
          this.toastr.info('No exams found for the selected academic year.', 'Info');
        }
      },
      error: (err) => {
        console.error('Error fetching exams:', err);
        this.toastr.error('Failed to load exams. Please try again.', 'Error');
        this.exams = [];
        this.results = [];
      },
      complete: () => {
        this.isLoadingExams = false;
      }
    });
  }

  loadResults(): void {
    if (!this.selectedExamId) {
      this.results = [];
      return;
    }

    this.isLoadingResults = true;
    this.resultService.getResultsByExam(this.selectedExamId).subscribe({
      next: (results) => {
        this.results = results;
        if (results.length === 0) {
          this.toastr.info('No results found for the selected exam.', 'Info');
        }
      },
      error: (err) => {
        console.error('Error fetching results:', err);
        this.toastr.error('Failed to load results. Please try again.', 'Error');
        this.results = [];
      },
      complete: () => {
        this.isLoadingResults = false;
      }
    });
  }

  // New method to format the exam display name with class name
  getExamDisplayName(exam: any): string {
    const className = exam.classId?.name || 'Unknown Class';
    return `${exam.examTitle} - ${className}`;
  }

  onAcademicYearChange(): void {
    localStorage.setItem('activeAcademicYearId', this.selectedAcademicYearId);
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
      this.router.navigate(['/create-result']);
    }
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  }
}