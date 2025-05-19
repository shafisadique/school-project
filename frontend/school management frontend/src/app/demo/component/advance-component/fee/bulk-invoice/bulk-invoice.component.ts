import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { FeeInvoiceService } from '../fee-invoice.service';
import { ClassSubjectService } from '../../class-subject-management/class-subject.service';
import { AcademicYearService } from '../../academic-year/academic-year.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-bulk-invoice',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bulk-invoice.component.html',
  styleUrls: ['./bulk-invoice.component.scss']
})
export class BulkInvoiceComponent {
  classStructure: any[] = [];
  sections: string[] = [];
  selectedSections: string[] = [];
  selectedClass = '';
  selectedMonth = '';
  academicYear: any;
  isGenerating = false;
  result: any = null;

  constructor(
    private authService: AuthService,
    private feeInvoiceService: FeeInvoiceService,
    private classService: ClassSubjectService,
    private academicYearService: AcademicYearService
  ) {}

  async ngOnInit() {
    const schoolId = this.authService.getSchoolId();
    if (schoolId) {
      this.academicYear = await this.academicYearService.getActiveAcademicYear(schoolId).toPromise();
      this.classStructure = await this.classService.getClassesBySchool(schoolId).toPromise();
    }
  }

  onClassSelect() {
    const selectedClass = this.classStructure.find(c => c.name === this.selectedClass);
    this.sections = selectedClass?.sections || [];
    this.selectedSections = [];
  }

  toggleSection(section: string) {
    const index = this.selectedSections.indexOf(section);
    if (index > -1) this.selectedSections.splice(index, 1);
    else this.selectedSections.push(section);
  }

  async generateBulkInvoices() {
    if (!this.selectedClass || !this.selectedMonth || !this.academicYear) return;
    this.isGenerating = true;
    this.result = null;
    const schoolId = this.authService.getSchoolId();
    try {
      const response = await this.feeInvoiceService.generateBulkInvoices({
        schoolId,
        className: this.selectedClass,
        month: this.selectedMonth,
        academicYearId: this.academicYear._id,
        sections: this.selectedSections
      }).toPromise();
      this.result = { success: true, ...response, academicYear: this.academicYear.name };
    } catch (error) {
      this.result = { success: false, error: error.error?.error || 'Failed to generate invoices' };
    } finally {
      this.isGenerating = false;
    }
  }
}