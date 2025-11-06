// create-exam.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { AcademicYear, Class, Exam, ExamPaper, Subject } from '../exam.model';
import { AcademicYearService } from '../../academic-year/academic-year.service';
import { ClassSubjectService } from '../../class-subject-management/class-subject.service';
import { ExamService } from '../exam.service';

@Component({
  selector: 'app-create-exam',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-exam.component.html',
  styleUrls: ['./create-exam.component.scss']
})
export class CreateExamComponent implements OnInit {
  academicYears: AcademicYear[] = [];
  classes: Class[] = [];
  subjects: Subject[] = [];
  selectedAcademicYearId: string = '';
  selectedClassId: string = '';
  schoolId: string | null = null;
  exam: Partial<Exam> = {
    examTitle: '',
    examCenter: '',
    startDate: '',
    endDate: '',
    examStatus: 'Scheduled',
    examPapers: []
  };

  constructor(
    private academicYearService: AcademicYearService,
    private classSubjectService: ClassSubjectService,
    private examService: ExamService,
    private authService: AuthService,
    private toastr: ToastrService,
    private router: Router
  ) {
    const role = this.authService.getUserRole();
    if (role !== 'admin') {
      this.toastr.error('You do not have permission to create exams.', 'Authorization Error');
      this.router.navigate(['/dashboard/default']);
    }
  }

  ngOnInit(): void {
    this.schoolId = this.authService.getSchoolId();
    if (!this.schoolId) {
      this.toastr.error('School ID is missing. Please log in again.', 'Error');
      this.router.navigate(['/auth/login']);
      return;
    }

    this.academicYearService.getAllAcademicYears(this.schoolId).subscribe({
      next: (years) => {
        this.academicYears = years;
        this.academicYearService.getActiveAcademicYear(this.schoolId!).subscribe({
          next: (activeYear) => {
            this.selectedAcademicYearId = activeYear._id;
            this.loadClasses();
            this.loadSubjects();
          },
          error: () => {
            this.toastr.error('Failed to load active academic year.', 'Error');
          }
        });
      },
      error: () => {
        this.toastr.error('Failed to load academic years.', 'Error');
      }
    });
  }

  loadClasses(): void {
    this.classSubjectService.getClassesBySchool(this.schoolId!).subscribe({
      next: (classes) => {
        this.classes = classes;
        if (classes.length > 0) {
          this.selectedClassId = classes[0]._id;
        }
      },
      error: (err) => {
        this.toastr.error('Failed to load classes.', 'Error');
      }
    });
  }

  loadSubjects(): void {
    this.classSubjectService.getSubjects(this.schoolId!).subscribe({
      next: (subjects) => {
        this.subjects = subjects;
      },
      error: (err) => {
        this.toastr.error('Failed to load subjects.', 'Error');
      }
    });
  }

  onAcademicYearChange(): void {
    this.loadClasses();
  }

  addExamPaper(): void {
    const newPaper: ExamPaper = {
      subjectId: '',
      subjectType: 'Written',
      maxMarks: 100,
      minMarks: 40,
      paperCode: `SUB-${(this.exam.examPapers?.length || 0) + 1}`,
      paperStartDateTime: '',
      paperEndDateTime: '',
      roomNo: '',
      gradeCriteria: 'A+: 90-100, A: 80-89, B+:70-79, B:60-69,C+:50-59,C:40-49'
    };
    this.exam.examPapers = this.exam.examPapers || [];
    this.exam.examPapers.push(newPaper);
  }

  removeExamPaper(index: number): void {
    this.exam.examPapers?.splice(index, 1);
  }

  createExam(): void {
    if (!this.selectedClassId || !this.selectedAcademicYearId || !this.exam.examTitle || !this.exam.examCenter || 
        !this.exam.startDate || !this.exam.endDate || !this.exam.examStatus || !this.exam.examPapers?.length) {
      this.toastr.error('Please fill in all required fields and add at least one exam paper.', 'Validation Error');
      return;
    }

    const examStartDate = new Date(this.exam.startDate);
    const examEndDate = new Date(this.exam.endDate);
    if (examStartDate > examEndDate) {
      this.toastr.error('Exam start date cannot be after end date.', 'Validation Error');
      return;
    }

    for (const paper of this.exam.examPapers) {
      const paperStartDateTime = new Date(paper.paperStartDateTime);
      const paperEndDateTime = new Date(paper.paperEndDateTime);
      if (paperStartDateTime < examStartDate || paperEndDateTime > examEndDate) {
        this.toastr.error(`Paper ${paper.paperCode}: Date-time must be within exam date range.`, 'Validation Error');
        return;
      }
      if (paperStartDateTime > paperEndDateTime) {
        this.toastr.error(`Paper ${paper.paperCode}: Start date-time cannot be after end date-time.`, 'Validation Error');
        return;
      }
      if (paper.minMarks > paper.maxMarks) {
        this.toastr.error(`Paper ${paper.paperCode}: Min marks cannot be greater than max marks.`, 'Validation Error');
        return;
      }
    }

    const examData: Partial<Exam> = {
      schoolId: this.schoolId!,
      classId: this.selectedClassId,
      academicYearId: this.selectedAcademicYearId,
      examTitle: this.exam.examTitle,
      examCenter: this.exam.examCenter,
      startDate: new Date(this.exam.startDate).toISOString(),
      endDate: new Date(this.exam.endDate).toISOString(),
      examStatus: this.exam.examStatus,
      examPapers: this.exam.examPapers?.map(paper => ({
        ...paper,
        paperStartDateTime: new Date(paper.paperStartDateTime).toISOString(),
        paperEndDateTime: new Date(paper.paperEndDateTime).toISOString()
      }))
    };

    this.examService.createExam(examData).subscribe({
      next: (response) => {
        this.toastr.success('Exam created successfully!', 'Success');
        this.exam = {
          examTitle: '',
          examCenter: '',
          startDate: '',
          endDate: '',
          examStatus: 'Scheduled',
          examPapers: []
        };
        this.selectedClassId = this.classes[0]?._id || '';
        this.router.navigate(['/exams-&-progress/exam-list']);
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'Failed to create exam. Please try again.', 'Error');
      }
    });
  }

  updatePaperCode(data: ExamPaper) {
    // Implement logic to update paper code if needed (currently a placeholder)
  }
}