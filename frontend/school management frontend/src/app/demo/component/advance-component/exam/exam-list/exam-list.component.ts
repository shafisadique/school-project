import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { Exam } from '../exam.model';
import { ExamService } from '../exam.service';

@Component({
  selector: 'app-exam-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './exam-list.component.html',
  styleUrls: ['./exam-list.component.scss']
})
export class ExamListComponent implements OnInit {
  exams: Exam[] = [];
  schoolId: string | null = null;
  activeAcademicYearId: string | null = null; // New field
  expandedRows: { [key: string]: boolean } = {};

  constructor(
    private examService: ExamService,
    private authService: AuthService,
    private toastr: ToastrService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.schoolId = this.authService.getSchoolId();
    this.activeAcademicYearId = this.authService.getActiveAcademicYearId(); // Assuming this method exists
    if (!this.schoolId || !this.activeAcademicYearId) {
      this.toastr.error('School ID or Active Academic Year is missing. Please log in again.', 'Error');
      this.router.navigate(['/auth/login']);
      return;
    }

    this.loadExams();
  }

  loadExams(): void {
    this.examService.getExamsBySchool(this.schoolId!, this.activeAcademicYearId!).subscribe({
      next: (exams) => {
        this.exams = exams;
      },
      error: (err) => {
        this.toastr.error('Failed to load exams. Please try again.', 'Error');
      }
    });
  }

  toggleRow(examId: string): void {
    this.expandedRows[examId] = !this.expandedRows[examId];
  }

  deleteExam(examId: string): void {
    if (confirm('Are you sure you want to delete this exam?')) {
      this.examService.deleteExam(examId).subscribe({
        next: () => {
          this.toastr.success('Exam deleted successfully!', 'Success');
          this.exams = this.exams.filter(exam => exam._id !== examId);
        },
        error: (err) => {
          this.toastr.error('Failed to delete exam. Please try again.', 'Error');
        }
      });
    }
  }

  editExam(examId: string): void {
    this.router.navigate(['/exams-&-progress/edit-exam', examId]);
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  }
}