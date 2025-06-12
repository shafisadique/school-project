import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { StudentService } from '../student.service';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { ClassSubjectService } from '../../class-subject-management/class-subject.service';
import { AcademicYearService } from '../../academic-year/academic-year.service';

@Component({
  selector: 'app-student-promotion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './student-promotion.component.html',
  styleUrl: './student-promotion.component.scss'
})
export class StudentPromotionComponent implements OnInit {
  classes: any[] = [];
  selectedClassId: string = '';
  academicYear: any = null; // Active academic year
  availableAcademicYears: any[] = []; // List of all academic years
  selectedNextAcademicYearId: string = ''; // Selected next academic year ID
  students: any[] = [];
  results: any[] = [];
  studentResultsMap: Map<string, any> = new Map();
  manualPromotions: string[] = [];

  constructor(
    private studentService: StudentService,
    private academicYearService: AcademicYearService,
    private authService: AuthService,
    private classSubjectService: ClassSubjectService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.loadInitialData();
  }

  loadInitialData(): void {
    const schoolId = this.authService.getSchoolId();
    if (!schoolId) {
      this.toastr.error('School ID not found. Please log in again.');
      return;
    }

    // Fetch active academic year
    this.studentService.getActiveAcademicYear(schoolId).subscribe({
      next: (res) => {
        this.academicYear = res;
        console.log('Active Academic Year:', this.academicYear);
      },
      error: (err) => {
        this.toastr.error('Failed to load active academic year: ' + err.message);
      }
    });

    // Fetch all academic years
    this.academicYearService.getAllAcademicYears(schoolId).subscribe({
      next: (res) => {
        this.availableAcademicYears = res || [];
        console.log('Available Academic Years:', this.availableAcademicYears);
      },
      error: (err) => {
        this.toastr.error('Failed to load academic years: ' + err.message);
      }
    });

    // Fetch classes
    this.classSubjectService.getClassesBySchool(schoolId).subscribe({
      next: (res) => {
        this.classes = res || [];
        console.log('Classes:', this.classes);
      },
      error: (err) => {
        this.toastr.error('Failed to load classes: ' + err.message);
      }
    });
  }

  onClassChange(): void {
    if (!this.selectedClassId || !this.academicYear?._id) {
      this.students = [];
      this.results = [];
      this.studentResultsMap.clear();
      this.manualPromotions = [];
      return;
    }

    this.studentService.getStudentsByClass(this.selectedClassId, this.academicYear._id).subscribe({
      next: (res) => {
        this.students = res.students || res.data || [];
        console.log('Students:', this.students);
        this.loadResults();
      },
      error: (err) => {
        this.toastr.error('Failed to load students: ' + err.message);
        this.students = [];
      }
    });
  }

  loadResults(): void {
    this.studentService.getResultsByClassAndAcademicYear(this.selectedClassId, this.academicYear._id).subscribe({
      next: (res) => {
        this.results = res || [];
        console.log('Results:', this.results);

        this.studentResultsMap.clear();
        this.results.forEach(result => {
          this.studentResultsMap.set(result.studentId._id.toString(), result);
        });

        this.manualPromotions = [];
      },
      error: (err) => {
        this.toastr.error('Failed to load results: ' + err.message);
        this.results = [];
        this.studentResultsMap.clear();
      }
    });
  }

  getStudentStatus(studentId: string): string {
    const result = this.studentResultsMap.get(studentId);
    return result ? result.status : 'No Result';
  }

  toggleManualPromotion(studentId: string): void {
    const index = this.manualPromotions.indexOf(studentId);
    if (index > -1) {
      this.manualPromotions.splice(index, 1);
    } else {
      this.manualPromotions.push(studentId);
    }
  }

  isSelectedForManualPromotion(studentId: string): boolean {
    return this.manualPromotions.includes(studentId);
  }

  promoteStudents(): void {
    if (!this.selectedClassId || !this.academicYear?._id || !this.selectedNextAcademicYearId) {
      this.toastr.error('Please select a class, an active academic year, and a next academic year.');
      return;
    }

    if (this.students.length === 0) {
      this.toastr.error('No students to promote.');
      return;
    }

    const promotionData = {
      classId: this.selectedClassId,
      academicYearId: this.academicYear._id,
      nextAcademicYearId: this.selectedNextAcademicYearId,
      manualPromotions: this.manualPromotions
    };

    this.studentService.promoteStudents(promotionData).subscribe({
      next: (res) => {
        this.toastr.success('Students promoted successfully!');
        console.log('Promotion Response:', res);

        const promotedCount = res.data.promotedStudents.length;
        const failedCount = res.data.failedStudents.length;
        const manuallyPromotedCount = res.data.manuallyPromotedStudents.length;

        this.toastr.info(
          `Promotion Summary: <br>` +
          `Automatically Promoted: ${promotedCount}<br>` +
          `Manually Promoted: ${manuallyPromotedCount}<br>` +
          `Not Promoted (Failed): ${failedCount}<br>` +
          `Next Class: ${res.data.nextClass}<br>` +
          `Next Academic Year: ${res.data.nextAcademicYear}`,
          'Summary',
          { enableHtml: true, timeOut: 10000 }
        );

        // Reset the form after promotion
        this.selectedClassId = '';
        this.selectedNextAcademicYearId = '';
        this.students = [];
        this.results = [];
        this.studentResultsMap.clear();
        this.manualPromotions = [];
      },
      error: (err) => {
        this.toastr.error('Failed to promote students: ' + err.message);
      }
    });
  }
}