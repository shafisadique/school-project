import { Component } from '@angular/core';
import { FeeReceiptService } from '../fee-receipt.service';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { FormsModule } from '@angular/forms';
import { ClassSubjectService } from '../../class-subject-management/class-subject.service';
import { CommonModule } from '@angular/common';

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
  schoolId = localStorage.getItem('schoolId');

  constructor(
    private receiptService: FeeReceiptService,
    private authService: AuthService,
    private classSubjectService: ClassSubjectService
  ) {}

  ngOnInit(): void {
    this.loadClasses();
  }

  loadClasses() {
    if (this.schoolId) {
      this.classSubjectService.getClassesBySchool(this.schoolId).subscribe({
        next: (classes) => this.classList = classes.map((c: any) => c.name),
        error: (err) => console.error('Error fetching classes:', err)
      });
    }
  }

  generateReceipts() {
    const data = {
      schoolId: this.authService.getSchoolId(),
      className: this.selectedClass,
      month: this.selectedMonth
    };
    this.receiptService.generateClassReceipts(data).subscribe(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `class_receipts_${this.selectedClass}.zip`;
      a.click();
    });
  }
}