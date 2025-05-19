// academic-year.component.ts
import { Component } from '@angular/core';
import { AcademicYearService } from '../academic-year.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from 'src/app/theme/shared/service/auth.service';

@Component({
  selector: 'app-academic-year',
  imports: [CommonModule, FormsModule],
  templateUrl: './academic-year.component.html',
  styleUrl: './academic-year.component.scss'
})
export class AcademicYearComponent {
  newAcademicYear = {
    name: '',
    startDate: '',
    endDate: ''
  };

  availableYears: any[] = [];
  currentAcademicYear: any;
  schoolId: string | null = null;

  constructor(
    private academicYearService: AcademicYearService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.schoolId = this.authService.currentSchoolId;
    if (!this.schoolId) {
      this.showError('School ID not found.');
      return;
    }
    this.loadAcademicYears();
  }

  loadAcademicYears(): void {
    if (!this.schoolId) return;

    this.academicYearService.getActiveAcademicYear(this.schoolId).subscribe({
      next: (data) => {this.currentAcademicYear = data;console.log(data)},
      error: () => this.showError('Failed to load active session')
    });

    this.academicYearService.getAllAcademicYears(this.schoolId).subscribe({
      next: (data) => {this.availableYears = data;console.log(data)},
      error: () => this.showError('Failed to load sessions')
    });
  }

  createAcademicYear(): void {
    if (!this.schoolId) return;

    const { name, startDate, endDate } = this.newAcademicYear;
    if (!name || !startDate || !endDate) {
      this.showError('All fields are required.');
      return;
    }

    const payload = {
      name,
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      schoolId: this.schoolId
    };

    this.academicYearService.createAcademicYear(payload).subscribe({
      next: () => {
        alert('Session created successfully!');
        this.newAcademicYear = { name: '', startDate: '', endDate: '' };
        this.loadAcademicYears();
      },
      error: (err) => this.showError(err.message || 'Failed to create session')
    });
  }

  activateYear(yearId: string) {
  this.academicYearService.activateAcademicYear(yearId,this.schoolId).subscribe({
    next: () => this.loadAcademicYears(),
    error: (err) => console.error('Activation failed:', err)
  });
}

  setActiveYear(yearId: string): void {
    if (!this.schoolId) return;

    this.academicYearService.setActiveAcademicYear(this.schoolId, yearId).subscribe({
      next: () => {
        alert('Active session updated!');
        this.loadAcademicYears();
      },
      error: (err) => this.showError(err.message || 'Failed to update active session')
    });
  }

  private showError(message: string): void {
    alert(message);
  }
}