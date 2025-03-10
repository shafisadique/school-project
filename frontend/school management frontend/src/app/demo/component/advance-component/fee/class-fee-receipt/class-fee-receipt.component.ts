import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FeeReceiptService } from '../fee-receipt.service';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-class-fee-receipt',
  imports: [CommonModule,FormsModule],
  templateUrl: './class-fee-receipt.component.html',
  styleUrl: './class-fee-receipt.component.scss'
})
export class ClassFeeReceiptComponent {
  classList: string[] = ['Pre Nursery', 'Nursery', 'LKG', 'UKG', 'Class 1','Class 2','class 3','class 4'];
  selectedClass = '';
  selectedMonth = '';

  constructor(
    private receiptService: FeeReceiptService,
    private authService: AuthService
  ) {}

  generateReceipts() {
    const data = {
      schoolId: this.authService.getSchoolId(),
      className: this.selectedClass,
      session: '2024-2025', // Get from state
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
