import { Component } from '@angular/core';
import { AcademicYear, Class, Exam } from '../exam.model';
import { ExamService } from '../exam.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-exam-list',
  imports: [CommonModule,FormsModule],
  templateUrl: './exam-list.component.html',
  styleUrl: './exam-list.component.scss'
})
export class ExamListComponent {
  exams: Exam[] = [];
  classes: Class[] = [];
  academicYears: AcademicYear[] = [];
  selectedClassId: string = '';
  selectedAcademicYearId: string = '';
  constructor(private examService: ExamService) {}
  ngOnInit(): void {
    this.examService.getClasses().subscribe({
      next: (classes) => {
        this.classes = classes;
        if (classes.length > 0) this.selectedClassId = classes[0]._id;
        this.loadExams();
      },
      error: (err) => {
        console.error('Error fetching classes:', err);
      }
    });

    this.examService.getAcademicYears().subscribe({
      next: (years) => {
        this.academicYears = years;
        if (years.length > 0) this.selectedAcademicYearId = years[0]._id;
        this.loadExams();
      },
      error: (err) => {
        console.error('Error fetching academic years:', err);
      }
    });
  }

  loadExams(): void {
    if (this.selectedClassId && this.selectedAcademicYearId) {
      this.examService.getExamHistory(this.selectedClassId, this.selectedAcademicYearId).subscribe({
        next: (exams) => {
          this.exams = exams;
        },
        error: (err) => {
          console.error('Error fetching exams:', err);
          this.exams = [];
        }
      });
    }
  }

  onClassChange(): void {
    this.loadExams();
  }

  onAcademicYearChange(): void {
    this.loadExams();
  }
}
