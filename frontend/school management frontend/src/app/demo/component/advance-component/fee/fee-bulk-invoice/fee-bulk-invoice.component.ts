// fee-bulk-invoice.component.ts
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { FeeService } from '../fee.service';
import { ClassSubjectService } from '../../class-subject-management/class-subject.service';
import { AcademicYearService } from '../../academic-year/academic-year.service';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-fee-bulk-invoice',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './fee-bulk-invoice.component.html',
  styleUrl: './fee-bulk-invoice.component.scss'
})
export class FeeBulkInvoiceComponent {
  form: FormGroup;
  classes: any[] = [];
  academicYears: any[] = [];
  students: any[] = []; // Declare the students array
  months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  isLoading = false;

  constructor(
    private fb: FormBuilder,
    private feeService: FeeService,
    private classService: ClassSubjectService,
    private yearService: AcademicYearService,
    private toastr: ToastrService,
    private authService: AuthService
  ) {
    this.form = this.fb.group({
      classId: ['', Validators.required],
      academicYearId: ['', Validators.required],
      month: ['', Validators.required],
      monthsAhead: [1, [Validators.required, Validators.min(1)]], // New field for advance invoices
      isExamMonth: [false]
    });

    this.loadClasses();
    this.loadAcademicYears();
  }

  loadClasses() {
    this.classService.getClassesBySchool(this.authService.getSchoolId()).subscribe({
      next: (classes) => this.classes = classes,
      error: () => this.toastr.error('Failed to load classes')
    });
  }

  loadAcademicYears() {
    this.yearService.getAllAcademicYears(this.authService.getSchoolId()).subscribe({
      next: (years) => this.academicYears = years,
      error: () => this.toastr.error('Failed to load academic years')
    });
  }

  generateInvoices() {
    if (this.form.invalid) {
      this.toastr.error('Please fill all required fields');
      return;
    }

    this.isLoading = true;
    const { classId, academicYearId, month, monthsAhead, isExamMonth } = this.form.value;
    const className = this.classes.find(c => c._id === classId)?.name;

    if (monthsAhead > 1) {
      // Generate advance invoices for a specific student (for demo, use the first student)
      this.feeService.generateAdvanceInvoices({
        schoolId: this.authService.getSchoolId(),
        studentId: this.students[0]?._id || '', // Replace with dynamic student selection if needed
        monthsAhead
      }).subscribe({
        next: (res) => {
          this.isLoading = false;
          this.toastr.success(`Generated ${res.data?.length || 0} advance invoices successfully`);
        },
        error: (err) => {
          this.isLoading = false;
          this.toastr.error(err.error?.message || 'Failed to generate advance invoices');
        }
      });
    } else {
      // Generate single-month invoices
      this.feeService.generateInvoices({
        schoolId: this.authService.getSchoolId(),
        classId,
        className,
        month,
        academicYearId,
        isExamMonth
      }).subscribe({
        next: (res) => {
          this.isLoading = false;
          this.toastr.success(`Generated ${res.data?.length || 0} invoices successfully`);
        },
        error: (err) => {
          this.isLoading = false;
          this.toastr.error(err.error?.message || 'Failed to generate invoices');
        }
      });
    }
  }
}