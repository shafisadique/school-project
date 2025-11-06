import { Component, OnInit } from '@angular/core';
import { ClassSubjectService } from '../../class-subject-management/class-subject.service';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { AcademicYearService } from '../../academic-year/academic-year.service';
import { ResultService } from '../result.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExamService } from '../../exam/exam.service';
import { SchoolService } from '../../school/school.service';

@Component({
  selector: 'app-admin-results',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-results.component.html',
  styleUrls: ['./admin-results.component.scss']
})
export class AdminResultsComponent implements OnInit {
  classes: any[] = [];
  selectedClassId: string = '';
  selectedAcademicYearId: string = '';
  academicYears: any[] = [];
  results: any[] = [];
  isLoading: boolean = false;
  schoolId: string | null = null;
  exams: any[] = [];
  selectedExamId: string = '';
  sortKey: string = 'percentage';
  sortOrder: string = 'desc';
  selectedResult: any = null;
  schoolDetails: any = null;
  allPublished: boolean = false;
  isPublishing: boolean = false;
  
  constructor(
    private resultService: ResultService,
    private academicYearService: AcademicYearService,
    private authService: AuthService,
    private classService: ClassSubjectService,
    private examService: ExamService,
    private toastr: ToastrService,
    private schoolService: SchoolService
  ) {}

  ngOnInit(): void {
    this.schoolId = this.authService.getSchoolId();
    if (!this.schoolId) {
      this.toastr.error('School ID missing', 'Error');
      return;
    }

    this.loadClasses();
    this.loadAcademicYears();
    this.loadSchoolDetails();
  }

  loadSchoolDetails(): void {
    const userId = this.authService.getUserId();
    if (userId) {
      this.schoolService.getMySchool().subscribe({
        next: (data) => {
          this.schoolDetails = data;
        },
        error: (err) => {
          this.toastr.error('Failed to load school details', 'Error');
          console.error('Error loading school details:', err);
        }
      });
    }
  }

  loadClasses(): void {
    this.isLoading = true;
    this.classService.getClassesBySchool(this.schoolId!).subscribe({
      next: (classes) => {
        this.classes = classes;
        if (classes.length > 0) {
          this.selectedClassId = classes[0]._id;
          this.loadExams();
        }
        this.isLoading = false;
      },
      error: (err) => {
        this.toastr.error('Failed to load classes', 'Error');
        this.isLoading = false;
      }
    });
  }

  loadAcademicYears(): void {
    this.academicYearService.getAllAcademicYears(this.schoolId!).subscribe({
      next: (years) => {
        this.academicYears = years;
        if (years.length > 0) {
          this.academicYearService.getActiveAcademicYear(this.schoolId!).subscribe({
            next: (activeYear) => {
              this.selectedAcademicYearId = activeYear._id;
              this.loadExams();
            },
            error: (err) => {
              this.toastr.error('Failed to load active year', 'Error');
              this.isLoading = false;
            }
          });
        }
      },
      error: (err) => {
        this.toastr.error('Failed to load academic years', 'Error');
        this.isLoading = false;
      }
    });
  }

loadExams(): void {
  if (!this.selectedAcademicYearId) return; // Only check academicYearId since classId filter is removed
  
  this.isLoading = true;
  this.examService.getExamsBySchool(this.schoolId!, this.selectedAcademicYearId).subscribe({
    next: (exams) => {
      console.log(exams)
      this.exams = exams; // Store all exams for the academic year
      if (this.exams.length > 0) {
        this.selectedExamId = this.exams[0]._id; // Default to the first exam
        this.loadResults();
      } else {
        this.isLoading = false;
        this.exams = []; // Ensure exams is empty if no data
        this.results = []; // Clear results if no exams
      }
    },
    error: (err) => {
      this.toastr.error('Failed to load exams', 'Error');
      this.isLoading = false;
      this.exams = []; // Clear exams on error
      this.results = []; // Clear results on error
    }
  });
}

  updatePublishStatus(): void {
    this.allPublished = this.results.length > 0 && this.results.every(r => r.isPublished === true);
  }

  loadResults(): void {
    if (!this.selectedClassId || !this.selectedAcademicYearId) return;
    
    this.isLoading = true;
    this.resultService.getAllResultsForClass(this.selectedClassId, this.selectedAcademicYearId).subscribe({
      next: (results: any[]) => {
        console.log(results)
        this.results = results
          .filter(result => result.examId._id === this.selectedExamId)
          .map(result => {
            const totalMarksObtained = result.totalMarksObtained || result.subjects?.reduce((sum, s) => sum + (s.marksObtained || 0), 0) || 0;
            const totalMaxMarks = result.totalMaxMarks || result.subjects?.reduce((sum, s) => sum + (s.maxMarks || 100), 0) || 0;
            const percentage = totalMaxMarks > 0 ? (totalMarksObtained / totalMaxMarks) * 100 : 0;
            return {
              ...result,
              totalMarksObtained,
              totalMaxMarks,
              percentage: parseFloat(percentage.toFixed(2)),
              status: percentage >= 33 ? 'Pass' : 'Fail'
            };
          });
        this.isLoading = false;
      },
      error: (err) => {
        this.toastr.error('Failed to load results', 'Error');
        this.isLoading = false;
      }
    });
  }

  publishAllResults(): void {
    if (this.allPublished || this.isPublishing) return;

    this.isPublishing = true;
    this.resultService.publishExamResults({
      examId: this.selectedExamId,
      classId: this.selectedClassId,
      academicYearId: this.selectedAcademicYearId,
      schoolId: this.schoolId
    }).subscribe({
      next: () => {
        this.toastr.success('All results published successfully!', 'Success');
        this.results = this.results.map(r => ({ ...r, isPublished: true, publishedAt: new Date() }));
        this.updatePublishStatus();
        this.isPublishing = false;
      },
      error: (err) => {
        console.error('Publish error:', err);
        this.toastr.error('Failed to publish results. Please try again.', 'Error');
        this.isPublishing = false;
      }
    });
  }

publishSingleResult(result: any): void {
  this.isPublishing = true;
  this.resultService.publishSingleResult(result.studentId._id, result.examId._id).subscribe({
    next: (response) => {
      this.toastr.success(`Published ${response.updated} result(s)!`, 'Success');
      const index = this.results.findIndex(r => 
        r.studentId._id === result.studentId._id && r.examId._id === result.examId._id
      );
      if (index !== -1) {
        this.results[index].isPublished = true;
        this.results[index].publishedAt = new Date();
        this.updatePublishStatus();
      }
      this.isPublishing = false;
    },
    error: (err) => {
      this.toastr.error('Failed to publish result.', 'Error');
      this.isPublishing = false;
    }
  });
}
// No other changes—loadResults, publishAllResults, etc. intact
  
  getExamTitle(): string {
    return this.exams.find(e => e._id === this.selectedExamId)?.examTitle || '';
  }

  sort(key: string): void {
    if (this.sortKey === key) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortOrder = 'asc';
    }
  }

  get sortedResults(): any[] {
    return [...this.results].sort((a, b) => {
      let valueA = a[this.sortKey];
      let valueB = b[this.sortKey];
      if (this.sortKey === 'studentId.name' || this.sortKey === 'studentId.rollNo') {
        valueA = a.studentId[this.sortKey.split('.')[1]];
        valueB = b.studentId[this.sortKey.split('.')[1]];
      }
      if (typeof valueA === 'string') {
        return this.sortOrder === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
      }
      return this.sortOrder === 'asc' ? valueA - valueB : valueB - valueA;
    });
  }

  openProgressCard(result: any): void {
    this.selectedResult = { ...result };
  }

  closeProgressCard(): void {
    this.selectedResult = null;
  }

  stopPropagation(event: Event): void {
    event.stopPropagation();
  }

  getGrade(percentage: number): string {
    if (percentage >= 90) return 'A';
    if (percentage >= 75) return 'B';
    if (percentage >= 60) return 'C';
    if (percentage >= 35) return 'D';
    return 'E';
  }

  getTotalPassingMarks(result: any): number {
    return result.subjects?.reduce((sum, s) => sum + (s.passingMarks || (s.maxMarks * 0.4)), 0) || 0;
  }

  onClassChange(): void {
    this.results = [];
    this.loadExams();
  }

  onAcademicYearChange(): void {
    this.results = [];
    this.loadExams();
  }

  onExamChange(): void {
    this.loadResults();
  }
}