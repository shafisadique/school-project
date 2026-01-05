import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AttendanceService } from '../attendance.service';
import { ToastrService } from 'ngx-toastr';
import { ActivatedRoute } from '@angular/router';
import { SchoolService } from '../../advance-component/school/school.service';

interface School {
  name: string;
  address: { city: string; state: string };
}

@Component({
  selector: 'app-monthly-attendance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './monthly-attendance.component.html',
  styleUrls: ['./monthly-attendance.component.scss']
})
export class MonthlyAttendanceComponent implements OnInit {
  classId!: string;
  academicYearId!: string;

  students: any[] = [];
  loading = false;

  viewMode: 'monthly' | 'weekly' = 'monthly';

  // Monthly
  selectedMonth: Date = new Date();
  selectedMonthStr = '';
  daysInMonth = 0;

  // Weekly
  selectedWeekStr = '';
  currentWeekStart = new Date();
  weekEnd = new Date();

  // Days to show
  visibleDays: number[] = [];

  attendanceData: any[] = [];

  totalPresent = 0;
  totalAbsent = 0;
  workingDays = 0;
  attendancePercentage = 0;

  school: School = { name: "Children's Public School", address: { city: 'Katihar', state: 'Bihar' } };

  constructor(
    private attendanceService: AttendanceService,
    private toastr: ToastrService,
    private route: ActivatedRoute,
    private schoolService: SchoolService
  ) {}

  ngOnInit(): void {
    this.classId = this.route.snapshot.queryParams['classId'] || '';
    this.academicYearId = this.route.snapshot.queryParams['academicYearId'] || localStorage.getItem('activeAcademicYearId') || '';

    if (!this.classId || !this.academicYearId) {
      this.toastr.error('Missing parameters');
      return;
    }

    this.loadSchoolData();
    this.initCurrentMonth();
    this.loadStudents();
  }

  loadSchoolData() {
    this.schoolService.getMySchoolForTeacher().subscribe({
      next: (res: any) => {
        this.school = {
          name: res.name || "Children's Public School",
          address: { city: res.address?.city || 'Katihar', state: res.address?.state || 'Bihar' }
        };
      }
    });
  }

  initCurrentMonth() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    this.selectedMonth = new Date(year, today.getMonth(), 1);
    this.daysInMonth = new Date(year, month, 0).getDate();
    this.selectedMonthStr = `${year}-${month.toString().padStart(2, '0')}`;
    this.updateVisibleDays();
  }
  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }
  loadStudents() {
    this.loading = true;
    this.attendanceService.getStudentsByClass(this.classId).subscribe({
      next: (res: any) => {
        this.students = (Array.isArray(res) ? res : res?.students || []).map((s: any) => ({
          _id: s._id,
          name: s.name
        }));
        this.loadAttendance();
      },
      error: () => {
        this.loading = false;
        this.toastr.error('Failed to load students');
      }
    });
  }

  loadAttendance() {
    this.loading = true;
    let start: Date, end: Date;

    if (this.viewMode === 'monthly') {
      const y = this.selectedMonth.getFullYear();
      const m = this.selectedMonth.getMonth();
      start = new Date(Date.UTC(y, m, 1));
      end = new Date(Date.UTC(y, m + 1, 1));
    } else {
      start = new Date(this.currentWeekStart);
      end = new Date(this.currentWeekStart);
      end.setDate(end.getDate() + 6);
    }

    this.attendanceService.getAttendanceHistory(this.classId, this.academicYearId, {
      startDate: start.toISOString(),
      endDate: end.toISOString()
    }).subscribe({
      next: (data: any) => {
        this.attendanceData = Array.isArray(data) ? data : [];
        this.updateStudentAttendance();
        this.calculateTotals();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  updateStudentAttendance() {
    this.students.forEach(student => {
      student.attendance = {};
      this.visibleDays.forEach(day => {
        const date = this.viewMode === 'monthly'
          ? new Date(this.selectedMonth.getFullYear(), this.selectedMonth.getMonth(), day)
          : new Date(this.currentWeekStart);
        
        if (this.viewMode === 'weekly') {
          date.setDate(date.getDate() + day - 1);
        }

        const iso = date.toISOString().split('T')[0];
        const record = this.attendanceData.find((r: any) => 
          new Date(r.date).toISOString().split('T')[0] === iso
        );
        const status = record?.students.find((s: any) => s.studentId._id === student._id)?.status || '-';
        student.attendance[day] = status;
      });
    });
  }

  getStatus(student: any, day: number): string {
    return student.attendance?.[day] || '-';
  }

  getStudentTotal(student: any, type: 'Present' | 'Absent'): number {
    return Object.values(student.attendance || {}).filter((s: any) => s === type).length;
  }

  getStudentPercentage(student: any): number {
    const total = Object.keys(student.attendance || {}).length;
    const present = this.getStudentTotal(student, 'Present');
    return total > 0 ? Math.round((present / total) * 100) : 0;
  }

  isHoliday(day: number): boolean {
    const date = this.viewMode === 'monthly'
      ? new Date(this.selectedMonth.getFullYear(), this.selectedMonth.getMonth(), day)
      : new Date(this.currentWeekStart);
    
    if (this.viewMode === 'weekly') {
      date.setDate(date.getDate() + day - 1);
    }
    return date.getDay() === 0; // Sunday
  }

  updateVisibleDays() {
    if (this.viewMode === 'monthly') {
      this.visibleDays = Array.from({ length: this.daysInMonth }, (_, i) => i + 1);
    } else {
      this.visibleDays = [1, 2, 3, 4, 5, 6];
      this.setCurrentWeek();
    }
  }

  setCurrentWeek() {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    this.currentWeekStart = new Date(today.setDate(diff));
    this.weekEnd = new Date(this.currentWeekStart);
    this.weekEnd.setDate(this.weekEnd.getDate() + 5);
  }

  onMonthChange() {
    if (!this.selectedMonthStr) return;
    const [y, m] = this.selectedMonthStr.split('-').map(Number);
    this.selectedMonth = new Date(y, m - 1, 1);
    this.daysInMonth = new Date(y, m, 0).getDate();
    this.updateVisibleDays();
    this.loadAttendance();
  }

  onWeekChange() {
    if (!this.selectedWeekStr) return;
    const [year, week] = this.selectedWeekStr.split('-W');
    const date = new Date(Number(year), 0, (Number(week) - 1) * 7 + 1);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    this.currentWeekStart = new Date(date.setDate(diff));
    this.weekEnd = new Date(this.currentWeekStart);
    this.weekEnd.setDate(this.weekEnd.getDate() + 5);
    this.updateVisibleDays();
    this.loadAttendance();
  }

  setViewMode(mode: 'monthly' | 'weekly') {
    this.viewMode = mode;
    if (mode === 'weekly') this.setCurrentWeek();
    this.updateVisibleDays();
    this.loadAttendance();
  }

  calculateTotals() {
    this.totalPresent = this.students.reduce((s, st) => s + this.getStudentTotal(st, 'Present'), 0);
    this.totalAbsent = this.students.reduce((s, st) => s + this.getStudentTotal(st, 'Absent'), 0);
    this.workingDays = this.visibleDays.filter(d => !this.isHoliday(d)).length;
    this.attendancePercentage = this.students.length && this.workingDays
      ? Math.round((this.totalPresent / (this.students.length * this.workingDays)) * 100)
      : 0;
  }

  getAcademicYear(): string {
    return `${this.selectedMonth.getFullYear()}-${this.selectedMonth.getFullYear() + 1}`;
  }

  // Helper for Weekly View
  getWeekDayName(day: number): string {
    const date = new Date(this.currentWeekStart);
    date.setDate(date.getDate() + day - 1);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }

  getWeekDayDate(day: number): Date {
    const date = new Date(this.currentWeekStart);
    date.setDate(date.getDate() + day - 1);
    return date;
  }

  print() {
    window.print();
  }
}