// components/student-result/student-result.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';  // Add formatDate here
import { ResultService } from '../result.service';
import { FormsModule } from '@angular/forms';

interface SubjectResult {
  subjectId: { _id: string; name: string };
  marksObtained: number;
  maxMarks: number;
  percentage: number;
  passed: boolean;
}

interface ExamResult {
  _id: string;
  examId: { examTitle: string; startDate: string };
  totalMarksObtained: number;
  totalMaxMarks: number;
  percentage: number;
  grade: string;
  status: string;
  subjects: SubjectResult[];
  publishedAt: string;
}

interface ApiResponse {
  success: boolean;
  message: string;
  data: ExamResult[];
}

@Component({
  selector: 'app-student-result',
  templateUrl: './student-result.component.html',
  imports: [CommonModule,FormsModule],
  styleUrls: ['./student-result.component.scss']
})
export class StudentResultComponent implements OnInit {
  response: ApiResponse | null = null;
  results: ExamResult[] = [];
  loading = true;
  noResultMessage = 'Result not announced yet.';

  constructor(private resultService: ResultService) {}  // Remove DatePipe injection

  ngOnInit(): void {
    this.loadResults();
  }

  loadResults(): void {
    this.loading = true;
    this.resultService.getMyResults().subscribe({
      next: (res) => {
        this.response = res;
        this.results = res.data;
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.response = {
          success: false,
          message: 'Failed to load results. Please try again.',
          data: []
        };
        this.loading = false;
      }
    });
  }

  formatDate(date: string): string {
    // Use formatDate function directly (no injection needed)
    // 'mediumDate' matches your original pipe format; adjust locale if needed (e.g., inject LOCALE_ID)
    return formatDate(date, 'mediumDate', 'en-US') || '';
  }
}