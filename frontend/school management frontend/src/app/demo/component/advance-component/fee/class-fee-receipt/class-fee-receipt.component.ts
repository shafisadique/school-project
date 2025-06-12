import { Component } from '@angular/core';
import { FeeService } from '../fee.service';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { FormsModule } from '@angular/forms';
import { ClassSubjectService } from '../../class-subject-management/class-subject.service';
import { CommonModule } from '@angular/common';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-class-fee-receipt',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './class-fee-receipt.component.html',
  styleUrls: ['./class-fee-receipt.component.scss']
})
export class ClassFeeReceiptComponent {
  classList: string[] = [];
  selectedClass = '';
  selectedMonth = '';
  schoolId = '';

  constructor(
    private feeService: FeeService,
    private authService: AuthService,
    private classSubjectService: ClassSubjectService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.schoolId = this.authService.getSchoolId();
    if (this.schoolId) {
      this.loadClasses();
    }
  }

  loadClasses() {
    this.classSubjectService.getClassesBySchool(this.schoolId).subscribe({
      next: (classes: any[]) => this.classList = classes.map((c: any) => c.name),
      error: (err) => this.toastr.error('Error fetching classes: ' + err.message)
    });
  }

  generateReceipts() {
    if (!this.selectedClass || !this.selectedMonth) {
      this.toastr.error('Please select a class and month');
      return;
    }
    const data = {
      schoolId: this.authService.getSchoolId(),
      className: this.selectedClass,
      month: this.selectedMonth
    };
    this.feeService.generateClassReceipts(data).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `class_receipts_${this.selectedClass}_${this.selectedMonth}.zip`;
        a.click();
        this.toastr.success('Receipts generated successfully');
      },
      error: (err) => this.toastr.error('Failed to generate receipts: ' + err.message)
    });
  }
}