import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AttendanceService } from '../attendance.service';
import { ToastrService } from 'ngx-toastr';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-monthly-attendance',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './monthly-attendance.component.html',
  styleUrls: ['./monthly-attendance.component.scss']
})
export class MonthlyAttendanceComponent implements OnInit {
  classId!: string;
  subjectId!: string;
  academicYearId!: string;
  attendanceForm!: FormGroup;
  students: any[] = [];
  loading: boolean = false;
  currentMonth: Date = new Date(); // June 30, 2025, 11:33 AM IST
  daysInMonth: number = 0;
  attendanceData: any[] = [];

  constructor(
    private fb: FormBuilder,
    private attendanceService: AttendanceService,
    private toastr: ToastrService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.classId = this.route.snapshot.queryParams['classId'] || '';
    this.subjectId = this.route.snapshot.queryParams['subjectId'] || '';
    this.academicYearId = this.route.snapshot.queryParams['academicYearId'] || localStorage.getItem('activeAcademicYearId') || '';

    if (!this.classId || !this.subjectId || !this.academicYearId) {
      this.toastr.error('Missing required parameters. Please try again.', 'Error');
      return;
    }

    this.initForm();
    this.loadStudents();
    this.loadAttendanceHistory();
    this.daysInMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 0).getDate(); // 30 days for June
  }

  initForm() {
    this.attendanceForm = this.fb.group({
      studentAttendances: this.fb.array([])
    });
  }

  get studentAttendances(): FormArray {
    return this.attendanceForm.get('studentAttendances') as FormArray;
  }

  loadStudents() {
    if (!this.classId) return;
    this.loading = true;
    this.attendanceService.getStudentsByClass(this.classId).subscribe({
      next: (response) => {
        this.students = Array.isArray(response) ? response.map(s => ({ _id: s._id, name: s.name, rollNo: s.rollNo })) : response?.students?.map(s => ({ _id: s._id, name: s.name, rollNo: s.rollNo })) || [];
        console.log('Loaded Students:', this.students); // Debug
        this.addStudentsToForm();
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.toastr.error(err.error?.message || 'Error fetching students', 'Error');
      }
    });
  }

  addStudentsToForm() {
    this.studentAttendances.clear();
    this.students.forEach(student => {
      this.studentAttendances.push(this.fb.group({
        studentId: [student._id],
        attendance: this.fb.group({})
      }));
    });
    this.updateAttendanceData();
  }

  loadAttendanceHistory() {
    if (!this.classId || !this.academicYearId) return;
    this.loading = true;
    const month = this.currentMonth.getMonth(); // 5 for June (0-based)
    const year = this.currentMonth.getFullYear(); // 2025
    const startDate = new Date(year, month, 1).toISOString(); // June 1, 2025
    const endDate = new Date(year, month + 1, 0).toISOString(); // June 30, 2025

    this.attendanceService.getAttendanceHistory(this.classId, this.academicYearId, { startDate, endDate }).subscribe({
      next: (history) => {
        this.attendanceData = Array.isArray(history) ? history : [];
        console.log('Fetched Attendance Data:', this.attendanceData); // Debug
        this.updateAttendanceData();
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.toastr.error(err.error?.message || 'Error fetching attendance history', 'Error');
        console.error('Attendance History Error:', err); // Debug
      }
    });
  }

  updateAttendanceData() {
    this.studentAttendances.controls.forEach((studentGroup, index) => {
      const studentId = this.students[index]?._id;
      const attendanceGroup = studentGroup.get('attendance') as FormGroup;
      for (let day = 1; day <= this.daysInMonth; day++) {
        const date = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth(), day);
        const isoDate = date.toISOString();
        const attendanceRecord = this.attendanceData.find(record => {
          const recordDate = new Date(record.date);
          return recordDate.toDateString() === date.toDateString() &&
                 record.students.some((s: any) => s.studentId._id === studentId);
        });
        const status = attendanceRecord?.students.find((s: any) => s.studentId._id === studentId)?.status || '-';
        attendanceGroup.addControl(`day${day}`, this.fb.control({ value: status, disabled: true }));
        console.log(`Student ${studentId}, Day ${day}, Status: ${status}, Record: ${JSON.stringify(attendanceRecord)}`); // Enhanced debug
      }
    });
  }

  getDaysArray(): number[] {
    return Array.from({ length: this.daysInMonth }, (_, i) => i + 1);
  }

  getAcademicYear(): string {
    const year = this.currentMonth.getFullYear();
    return `${year}-${year + 1}`; // e.g., 2025-2026
  }
}