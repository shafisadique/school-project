// create-exam.component.ts — PRODUCTION LEVEL (Angular 18+ Best Practices)
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { AcademicYearService } from '../../academic-year/academic-year.service';
import { ClassSubjectService } from '../../class-subject-management/class-subject.service';
import { ExamService } from '../exam.service';

import { AcademicYear, Class, Exam, ExamPaper, Subject } from '../exam.model';
import { CardComponent } from 'src/app/theme/shared/components/card/card.component';

@Component({
  selector: 'app-create-exam',
  standalone: true,
  imports: [CommonModule, FormsModule,CardComponent],
  templateUrl: './create-exam.component.html',
  styleUrls: ['./create-exam.component.scss']
})
export class CreateExamComponent implements OnInit {
  // Services
  private destroyRef = inject(DestroyRef);
  private authService = inject(AuthService);
  private academicYearService = inject(AcademicYearService);
  private classSubjectService = inject(ClassSubjectService);
  private examService = inject(ExamService);
  private toastr = inject(ToastrService);
  public router = inject(Router);

  // Data
  academicYears: AcademicYear[] = [];
  classes: Class[] = [];
  subjects: Subject[] = [];
  selectedAcademicYearId = '';
  selectedClassId = '';
  schoolId: string | null = null;
  loading = false;

  exam: Partial<Exam> = {
    examTitle: '',
    examCenter: '',
    startDate: '',
    endDate: '',
    examStatus: 'Scheduled' as const,
    examPapers: []
  };

  ngOnInit(): void {
    // Role guard (still good to have)
    if (this.authService.getUserRole() !== 'admin') {
      this.toastr.error('Access denied.', 'Unauthorized');
      this.router.navigate(['/dashboard/default']);
      return;
    }

    this.schoolId = this.authService.getSchoolId();
    if (!this.schoolId) {
      this.toastr.error('Session expired. Please login again.', 'Error');
      this.router.navigate(['/auth/login']);
      return;
    }

    this.loadInitialData();
  }

  private loadInitialData(): void {
    this.academicYearService.getAllAcademicYears(this.schoolId!)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (years) => {
          this.academicYears = years;

          // Load active year and then classes/subjects
          this.academicYearService.getActiveAcademicYear(this.schoolId!)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (active) => {
                this.selectedAcademicYearId = active._id;
                this.loadClassesAndSubjects();
              },
              error: () => this.toastr.error('Failed to load active academic year')
            });
        },
        error: () => this.toastr.error('Failed to load academic years')
      });
  }

  private loadClassesAndSubjects(): void {
    // Load both in parallel
    this.classSubjectService.getClassesBySchool(this.schoolId!)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(classes => this.classes = classes);

    this.classSubjectService.getSubjects(this.schoolId!)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(subjects => this.subjects = subjects);
  }

  onAcademicYearChange(): void {
    this.loadClassesAndSubjects();
  }

  getSubjectName(subjectId: string): string {
    return this.subjects.find(s => s._id === subjectId)?.name || 'Select Subject';
  }

  updatePaperCode(paper: ExamPaper): void {
    if (!paper.subjectId) {
      paper.paperCode = '';
      return;
    }

    const subject = this.subjects.find(s => s._id === paper.subjectId);
    if (!subject) return;

    const prefix = subject.name.slice(0, 3).toUpperCase();
    const index = (this.exam.examPapers?.indexOf(paper) ?? 0) + 1;
    paper.paperCode = `${prefix}-${100 + index}`; // e.g., MAT-101
  }

  addExamPaper(): void {
    const paper: ExamPaper = {
      subjectId: '',
      subjectType: 'Written',
      maxMarks: 100,
      minMarks: 33,
      paperCode: '',
      paperStartDateTime: '',
      paperEndDateTime: '',
      roomNo: '',
      gradeCriteria: 'A+:90-100,A:80-89,B+:70-79,B:60-69,C+:50-59,C:40-49,F:0-39'
    };

    this.exam.examPapers ??= [];
    this.exam.examPapers.push(paper);
  }

  removeExamPaper(index: number): void {
    this.exam.examPapers?.splice(index, 1);
    // Update codes for remaining papers
    this.exam.examPapers?.forEach(p => {
      if (p.subjectId) this.updatePaperCode(p);
    });
  }

  createExam(): void {
    if (this.loading) return; // Prevent double click

    // Basic required validation
    if (!this.selectedClassId || !this.selectedAcademicYearId ||
        !this.exam.examTitle?.trim() || !this.exam.examCenter?.trim() ||
        !this.exam.startDate || !this.exam.endDate || !this.exam.examPapers?.length) {
      this.toastr.warning('Please fill all required fields and add at least one paper');
      return;
    }

    // Date validation
    const examStart = new Date(this.exam.startDate);
    const examEnd = new Date(this.exam.endDate);
    if (examStart >= examEnd) {
      this.toastr.error('Exam end date must be after start date');
      return;
    }

    // Paper validation
    for (const paper of this.exam.examPapers!) {
      if (!paper.subjectId || !paper.paperStartDateTime || !paper.paperEndDateTime ||
          !paper.roomNo?.trim() || paper.maxMarks < 1 || paper.minMarks > paper.maxMarks) {
        this.toastr.error('Please complete all paper details correctly');
        return;
      }

      const pStart = new Date(paper.paperStartDateTime);
      const pEnd = new Date(paper.paperEndDateTime);
      if (pStart < examStart || pEnd > examEnd || pStart >= pEnd) {
        this.toastr.error(`Paper timing must be within exam dates: ${paper.paperCode || 'Unknown'}`);
        return;
      }
    }

    this.loading = true;

    const payload: Partial<Exam> = {
      classId: this.selectedClassId,
      academicYearId: this.selectedAcademicYearId,
      examTitle: this.exam.examTitle!.trim(),
      examCenter: this.exam.examCenter!.trim(),
      startDate: new Date(this.exam.startDate).toISOString(),
      endDate: new Date(this.exam.endDate).toISOString(),
      examStatus: this.exam.examStatus,
      examPapers: this.exam.examPapers!.map(p => ({
        ...p,
        paperStartDateTime: new Date(p.paperStartDateTime).toISOString(),
        paperEndDateTime: new Date(p.paperEndDateTime).toISOString()
      }))
    };

    this.examService.createExam(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toastr.success('Exam created successfully!');
          this.router.navigate(['/exams-&-progress/exam-list']);
        },
        error: (err) => {
          this.loading = false;
          const msg = err.error?.message || 'Failed to create exam';
          this.toastr.error(msg);
        },
        complete: () => this.loading = false
      });
  }
}