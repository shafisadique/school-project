import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { FeeService } from '../fee.service';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { ClassSubjectService } from '../../class-subject-management/class-subject.service';
import { StudentService } from '../../students/student.service';
import { Router } from '@angular/router';
import { CardComponent } from 'src/app/theme/shared/components/card/card.component';
import { FilterByStudentIdPipe } from 'src/app/theme/shared/interceptor/filter-by-student-id.pipe';

@Component({
  selector: 'app-bulk-invoice',
  standalone: true,
  imports: [CommonModule, FormsModule, CardComponent],
  providers: [DatePipe],
  templateUrl: './bulk-invoice.component.html',
  styleUrls: ['./bulk-invoice.component.scss']
})
export class BulkInvoiceComponent implements OnInit {
  schoolId: string | null = null;
  activeAcademicYearId: string | null = null;
  classList: { id: string; name: string }[] = [];
  selectedClassId: string = '';
  selectedClassName: string = '';
  month: string = '';
  students: any[] = [];
  customSchedules: { studentId: string; paymentSchedule: string; customPaymentDetails?: string }[] = [];
  paymentOptions: string[] = ['Monthly', 'BiMonthly', 'Quarterly', 'Custom'];
  isGenerating: boolean = false;
  isExamMonth: boolean = false;
  miscalculationStudents: boolean[] = []; // Array to track miscalculation for each student

  constructor(
    private feeService: FeeService,
    private authService: AuthService,
    private classSubjectService: ClassSubjectService,
    private studentService: StudentService,
    private toastr: ToastrService,
    private datePipe: DatePipe,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.schoolId = this.authService.getSchoolId();
    this.activeAcademicYearId = this.authService.getActiveAcademicYearId();
    if (this.schoolId) {
      if (!this.activeAcademicYearId || !this.isValidObjectId(this.activeAcademicYearId)) {
        this.toastr.error('No valid active academic year found. Please set an active academic year.');
        return;
      }
      this.loadClasses();
    } else {
      this.toastr.error('School ID not found. Please log in again.');
    }
  }

  private isValidObjectId(id: string): boolean {
    const objectIdPattern = /^[0-9a-fA-F]{24}$/;
    return objectIdPattern.test(id);
  }

  loadClasses(): void {
    this.classSubjectService.getClassesBySchool(this.schoolId!).subscribe({
      next: (classes: any[]) => {
        this.classList = classes.map(c => ({ id: c._id, name: c.name }));
        if (this.classList.length === 0) {
          this.toastr.warning('No classes found for this school.');
        }
      },
      error: (err) => {
        console.error('Error loading classes:', err);
        this.toastr.error(err.message || 'Failed to load classes.');
      }
    });
  }

  loadStudents(): void {
    if (!this.selectedClassId || !this.activeAcademicYearId) {
      this.toastr.error('Please select a class and ensure an active academic year is set.');
      return;
    }
    this.studentService.fetchStudentsByClassForInvoices(this.selectedClassId, this.activeAcademicYearId).subscribe({
      next: (students: any[]) => {
        this.students = students;
        this.customSchedules = this.students.map(student => ({
          studentId: student._id.toString(),
          paymentSchedule: 'Monthly',
          customPaymentDetails: ''
        }));
        this.miscalculationStudents = new Array(students.length).fill(false); // Initialize with false for each student
        if (this.students.length === 0) {
          this.toastr.warning('No students found for the selected class.');
        }
      },
      error: (err) => {
        console.error('Error loading students:', err);
        this.toastr.error(err.message || 'Failed to load students.');
        this.students = [];
      }
    });
  }

  updateClassSelection(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const selectedClass = this.classList.find(cls => cls.id === target.value);
    if (selectedClass) {
      this.selectedClassId = selectedClass.id;
      this.selectedClassName = selectedClass.name;
      this.loadStudents();
    }
  }

  updatePaymentSchedule(studentId: string, event: Event): void {
    const target = event.target as HTMLSelectElement;
    const schedule = target.value as 'Monthly' | 'BiMonthly' | 'Quarterly' | 'Custom';
    const scheduleEntry = this.customSchedules.find(cs => cs.studentId === studentId.toString());
    if (scheduleEntry) {
      scheduleEntry.paymentSchedule = schedule;
      if (schedule !== 'Custom') {
        scheduleEntry.customPaymentDetails = '';
      }
    }
  }

  updateCustomDetails(studentId: string, event: Event): void {
    const target = event.target as HTMLInputElement;
    const details = target.value;
    const scheduleEntry = this.customSchedules.find(cs => cs.studentId === studentId.toString());
    if (scheduleEntry) {
      scheduleEntry.customPaymentDetails = details;
    }
  }

  private convertToMonthName(monthValue: string): string {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthIndex = parseInt(monthValue.split('-')[1], 10) - 1;
    return monthNames[monthIndex] || '';
  }

  generateInvoices(): void {
    if (!this.validate()) return;
    this.isGenerating = true;

    // Filter out the default 'Quarterly' schedules
    const filteredCustomSchedules = this.customSchedules.filter(cs => cs.paymentSchedule !== 'Quarterly');

    const formattedMonth = this.convertToMonthName(this.month);

    // Collect student IDs where miscalculation is selected
    const miscalculationStudents = this.miscalculationStudents
      .map((selected, index) => selected ? this.students[index]._id.toString() : null)
      .filter(id => id !== null);

    const data = {
      schoolId: this.schoolId,
      classId: this.selectedClassId,
      className: this.selectedClassName,
      month: formattedMonth,
      academicYearId: this.activeAcademicYearId,
      customSchedules: filteredCustomSchedules,
      isExamMonth: this.isExamMonth,
      miscalculationStudents: miscalculationStudents // Send array of student IDs
    };
    this.feeService.generateInvoices(data).subscribe({
      next: (res) => {
        this.toastr.success(res.message);
        this.router.navigate(['fee/bulk-invoice-list'], {
          queryParams: { classId: this.selectedClassId, month: this.month }
        });
      },
      error: (err) => {
        console.error('Generate invoices error:', err);
        const errorMessage = err.error?.message || err.message || 'An unknown error occurred while generating invoices.';
        this.toastr.error(errorMessage);
        this.isGenerating = false;
      },
      complete: () => {
        this.isGenerating = false;
      }
    });
  }

  private validate(): boolean {
    if (!this.selectedClassId) {
      this.toastr.error('Please select a class');
      return false;
    }
    if (!this.month) {
      this.toastr.error('Please select a month');
      return false;
    }
    if (!this.activeAcademicYearId) {
      this.toastr.error('No active academic year set. Please set an active academic year.');
      return false;
    }
    const customEntries = this.customSchedules.filter(cs => cs.paymentSchedule === 'Custom');
    for (const entry of customEntries) {
      if (!entry.customPaymentDetails) {
        this.toastr.error('Please provide custom payment details for all custom schedules.');
        return false;
      }
    }
    return true;
  }

  get minMonth(): string {
    return this.datePipe.transform(new Date(), 'yyyy-MM') || '';
  }

  get maxMonth(): string {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    return this.datePipe.transform(date, 'yyyy-MM') || '';
  }

  resetForm(): void {
    this.selectedClassId = '';
    this.selectedClassName = '';
    this.month = '';
    this.students = [];
    this.customSchedules = [];
    this.isGenerating = false;
    this.isExamMonth = false;
    this.miscalculationStudents = []; // Reset miscalculation array
  }
}