import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AcademicYearService } from '../../academic-year/academic-year.service';
import { StudentAttendaceService } from 'src/app/theme/shared/service/student-attendace.service';

interface DayCell {
  date: Date | null;
  status: 'Present' | 'Absent' | 'Late' | null;
  isHoliday: boolean;
  isToday: boolean;
}

@Component({
  selector: 'app-particular-student-attendace',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './particular-student-attendace.component.html',
  styleUrls: ['./particular-student-attendace.component.scss']
})
export class ParticularStudentAttendaceComponent implements OnInit {

  // Real data from backend
  studentName = '';
  className = '';
  admissionNo = '';
  schoolName = '';
  academicYearName = '';

  summary = { present: 0, absent: 0, late: 0, totalDays: 0, percentage: 0 };
  dailyData: { [date: string]: string } = {};
  viewMode: 'weekly' | 'monthly' = 'monthly';
  loading = true;

  // For calendar
  calendarCells: DayCell[] = [];
  currentMonth = new Date();

  constructor(
    private attendanceService: StudentAttendaceService,
    private academicYearService: AcademicYearService
  ) {}

  ngOnInit(): void {
    this.loadStudentInfoAndAttendance();
  }

  loadStudentInfoAndAttendance() {
    const schoolId = localStorage.getItem('schoolId');
    if (!schoolId) return;

    this.academicYearService.getActiveAcademicYear(schoolId).subscribe({
      next: (res: any) => {
        if (res) {
          this.academicYearName = res.name || 'Current Year';
          this.schoolName = res.schoolName || 'Your School';
          this.loadAttendance(res._id);
        }
      }
    });
  }

  loadAttendance(academicYearId: string) {
    this.loading = true;
    this.attendanceService.getStudentReport(academicYearId, 'monthly').subscribe({
      next: (res) => {
        if (res.success) {
          this.summary = {
            present: res.data.summary.present || 0,
            absent: res.data.summary.absent || 0,
            late: res.data.summary.late || 0,
            totalDays: res.data.summary.totalDays || 0,
            percentage: res.data.summary.percentage || 0
          };
          this.dailyData = res.data.dailyData || {};

          // Get student info from token (you should have this)
          const user = JSON.parse(localStorage.getItem('user') || '{}');
          this.studentName = user.name || 'Student';
          this.className = user.className || 'Class';
          this.admissionNo = user.admissionNo || 'N/A';

          this.generateCalendar();
        }
        this.loading = false;
      },
      error: () => this.loading = false
    });
  }

  generateCalendar() {
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - firstDay.getDay()); // Start from Sunday

    this.calendarCells = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);

      const dateStr = date.toISOString().split('T')[0];
      const status = this.dailyData[dateStr] || null;

      this.calendarCells.push({
        date: date.getMonth() === month ? date : null,
        status: status as any,
        isHoliday: false, // You can add holiday API later
        isToday: date.toISOString().split('T')[0] === today.toISOString().split('T')[0]
      });
    }
  }

  print() {
    window.print();
  }
}