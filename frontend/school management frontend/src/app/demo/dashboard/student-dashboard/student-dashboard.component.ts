// student-dashboard.component.ts — FINAL 100% WORKING
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StudentDashboardService } from './student-dashboard.service';
import { StudentDashboardData } from './student-dashboard.model';

@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './student-dashboard.component.html',
  styleUrls: ['./student-dashboard.component.scss']
})
export class StudentDashboardComponent implements OnInit {
  student: StudentDashboardData | null = null;
  loading = true;
  error = '';

  constructor(private dashboardService: StudentDashboardService) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.loading = true;
    this.error = '';

    this.dashboardService.getDashboardData().subscribe({
      next: (response) => {
        console.log('Dashboard data:', response);
        this.student = response.data;  // ← NOW 100% CORRECT
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Unable to load dashboard. Please try again.';
        this.loading = false;
        console.error(err);
      }
    });
  }

  refresh(): void {
    this.loadDashboard();
  }
  // Add this method inside your component class
formatMonth(monthStr: string): string {
  const date = new Date(monthStr);
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
}

getTodayHolidayName(): string {
  const today = new Date().toLocaleDateString('en-GB');
  const holiday = this.student?.allHolidays.find(h => 
    h.date.includes(today.split('/').join(' '))
  );
  return holiday?.title || 'Holiday';
}
// ──────── FINAL WORKING getImageUrl() ────────
getImageUrl(profileImage: string | undefined): string {
  if (!profileImage) return 'assets/avtart-new.png';
  return `/api/proxy-image/${encodeURIComponent(profileImage)}`;
}
}