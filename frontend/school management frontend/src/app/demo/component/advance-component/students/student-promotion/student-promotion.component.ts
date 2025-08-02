import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { StudentService } from '../student.service';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { ClassSubjectService } from '../../class-subject-management/class-subject.service';
import { AcademicYearService } from '../../academic-year/academic-year.service';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-student-promotion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  animations: [
    trigger('slideInOut', [
      transition(':enter', [
        style({ transform: 'translateY(-100%)', opacity: 0 }),
        animate('300ms ease-out', style({ transform: 'translateY(0)', opacity: 1 })),
      ]),
      transition(':leave', [
        animate('300ms ease-in', style({ transform: 'translateY(-100%)', opacity: 0 })),
      ]),
    ]),
  ],
  templateUrl: './student-promotion.component.html',
  styleUrls: ['./student-promotion.component.scss']
})
export class StudentPromotionComponent implements OnInit {
  classes: any[] = [];
  selectedClassId: string = '';
  nextClassId: string = '';
  academicYear: any = null;
  availableAcademicYears: any[] = [];
  selectedNextAcademicYearId: string = '';
  students: any[] = [];
  isPromotedManually: boolean = false;
  selectAll: boolean = false;
  isLoading: boolean = false;
  selectedStudentsCount: number = 0;
  nextClassName: string = '';
  nextAcademicYearName: string = '';

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

    this.studentService.getActiveAcademicYear(schoolId).subscribe({
      next: (res) => this.academicYear = res,
      error: (err) => this.toastr.error('Failed to load active academic year: ' + err.message)
    });

    this.academicYearService.getAllAcademicYears(schoolId).subscribe({
      next: (res) => this.availableAcademicYears = res || [],
      error: (err) => this.toastr.error('Failed to load academic years: ' + err.message)
    });

    this.classSubjectService.getClassesBySchool(schoolId).subscribe({
      next: (res) => this.classes = res || [],
      error: (err) => this.toastr.error('Failed to load classes: ' + err.message)
    });
  }

  onClassChange(): void {
    if (!this.selectedClassId || !this.academicYear?._id) {
      this.students = [];
      this.selectAll = false;
      this.selectedStudentsCount = 0;
      return;
    }
    this.isLoading = true;
    this.studentService.getStudentsByClass(this.selectedClassId, this.academicYear._id).subscribe({
      next: (res) => {
        this.students = (res.students || res.data || []).map(student => ({
          ...student,
          isSelected: false
        }));
        this.selectAll = false;
        this.selectedStudentsCount = 0;
        this.isLoading = false;
      },
      error: (err) => {
        this.toastr.error('Failed to load students: ' + err.message);
        this.students = [];
        this.selectAll = false;
        this.selectedStudentsCount = 0;
        this.isLoading = false;
      }
    });
  }

  toggleSelectAll(): void {
    this.students = this.students.map(student => ({
      ...student,
      isSelected: this.selectAll
    }));
    this.selectedStudentsCount = this.selectAll ? this.students.length : 0;
  }

  updateSelectAll(): void {
    this.selectAll = this.students.length > 0 && this.students.every(student => student.isSelected);
    this.selectedStudentsCount = this.students.filter(student => student.isSelected).length;
  }

  openConfirmDialog(): void {
    this.selectedStudentsCount = this.students.filter(student => student.isSelected).length;
    if (this.selectedStudentsCount === 0) {
      this.toastr.error('Please select at least one student to promote.');
      return;
    }
    this.nextClassName = this.classes.find(cls => cls._id === this.nextClassId)?.name || 'Unknown';
    this.nextAcademicYearName = this.availableAcademicYears.find(year => year._id === this.selectedNextAcademicYearId)?.name || 'Unknown';
    const modal = new (window as any).bootstrap.Modal(document.getElementById('confirmPromotionModal'));
    modal.show();
  }

  promoteStudents(): void {
    if (!this.selectedClassId || !this.academicYear?._id || !this.selectedNextAcademicYearId || !this.nextClassId) {
      this.toastr.error('Please select a class, an active academic year, a next academic year, and a next class.');
      return;
    }

    const selectedStudents = this.students.filter(student => student.isSelected);
    if (selectedStudents.length === 0) {
      this.toastr.error('No students selected for promotion.');
      return;
    }

    this.isLoading = true;
    const promotionData = {
      classId: this.selectedClassId,
      academicYearId: this.academicYear._id,
      nextAcademicYearId: this.selectedNextAcademicYearId,
      nextClassId: this.nextClassId,
      studentIds: selectedStudents.map(student => student._id),
      isPromotedManually: this.isPromotedManually
    };

    this.studentService.promoteStudents(promotionData).subscribe({
      next: (res) => {
        this.toastr.success('Students promoted successfully!');
        const { promotedStudents, failedStudents, nextClass, nextAcademicYear } = res.data;
        this.toastr.info(
          `Promotion Summary: <br>` +
          `Promoted: ${promotedStudents.length}<br>` +
          `Not Promoted: ${failedStudents.length}<br>` +
          `Next Class: ${nextClass}<br>` +
          `Next Academic Year: ${nextAcademicYear}`,
          'Summary',
          { enableHtml: true, timeOut: 10000 }
        );
        this.selectedClassId = '';
        this.nextClassId = '';
        this.selectedNextAcademicYearId = '';
        this.students = [];
        this.isPromotedManually = false;
        this.selectAll = false;
        this.selectedStudentsCount = 0;
        this.isLoading = false;
        const modal = (window as any).bootstrap.Modal.getInstance(document.getElementById('confirmPromotionModal'));
        modal.hide();
      },
      error: (err) => {
        this.toastr.error('Failed to promote students: ' + err.message);
        this.isLoading = false;
      }
    });
  }
}