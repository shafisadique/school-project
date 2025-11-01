import { Component } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { TimetableService } from '../timetable.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-student-timetable',
  imports: [FormsModule,CommonModule],
  templateUrl: './student-timetable.component.html',
  styleUrl: './student-timetable.component.scss'
})
export class StudentTimetableComponent {
timetable: any[] = [];
  grid: any[][] = [];
  timeSlots: { start: string; end: string }[] = [];
  days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  academicYears: any[] = [];
  selectedYearId = '';
  schoolId = localStorage.getItem('schoolId') || '';

  constructor(
    private timetableService: TimetableService,
    private toastr: ToastrService
  ) {}

  ngOnInit() {
    this.loadAcademicYears();
  }

  loadAcademicYears() {
    this.timetableService.getAcademicYears(this.schoolId).subscribe({
      next: (years) => {
        this.academicYears = years;
        this.timetableService.getActiveAcademicYear(this.schoolId).subscribe({
          next: (active) => {
            if (active?._id) {
              this.selectedYearId = active._id;
              this.loadTimetable();
            }
          }
        });
      }
    });
  }

  loadTimetable() {
    this.timetableService.getStudentTimetable(this.selectedYearId).subscribe({
      next: (data) => {
        this.timetable = data;
        this.buildGrid();
      },
      error: () => this.toastr.error('Failed to load timetable')
    });
  }

  buildGrid() {
    const slots = new Set<string>();
    this.timetable.forEach(t => slots.add(`${t.startTime}-${t.endTime}`));

    this.timeSlots = Array.from(slots)
      .map(s => {
        const [start, end] = s.split('-');
        return { start, end };
      })
      .sort((a, b) => a.start.localeCompare(b.start));

    this.grid = this.days.map(() => Array(this.timeSlots.length).fill(null));

    this.timetable.forEach(t => {
      const dayIdx = this.days.indexOf(t.day);
      const slotIdx = this.timeSlots.findIndex(s => s.start === t.startTime && s.end === t.endTime);
      if (dayIdx !== -1 && slotIdx !== -1) {
        this.grid[dayIdx][slotIdx] = {
          subject: t.subjectId.name,
          teacher: t.teacherId.name,
          room: t.room
        };
      }
    });
  }

  onYearChange() {
    this.loadTimetable();
  }
}
