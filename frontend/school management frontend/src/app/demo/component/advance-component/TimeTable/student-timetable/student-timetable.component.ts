import { Component, OnInit } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { TimetableService } from '../timetable.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

// Define interfaces for strong typing
export interface Subject {
  _id: string;
  name: string;
}

export interface Teacher {
  _id: string;
  name: string;
}

export interface TimetableEntry {
  _id: string;
  schoolId: string;
  classId: string;
  subjectId: Subject;
  teacherId: Teacher;
  academicYearId: string;
  day: string;
  startTime: string;
  endTime: string;
  room: string;
  __v?: number;
}

export interface TimeSlot {
  start: string;
  end: string;
}

@Component({
  selector: 'app-student-timetable',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './student-timetable.component.html',
  styleUrls: ['./student-timetable.component.scss']
})
export class StudentTimetableComponent implements OnInit {

  timetable: TimetableEntry[] = [];
  grid: ({ subject: string; teacher: string; room: string } | null)[][] = [];
  timeSlots: TimeSlot[] = [];
  days: string[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  academicYears: { _id: string; name?: string }[] = [];
  selectedYearId = '';
  schoolId = localStorage.getItem('schoolId') || '';

  constructor(
    private timetableService: TimetableService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.loadAcademicYears();
  }

  loadAcademicYears(): void {
    this.timetableService.getAcademicYears(this.schoolId).subscribe({
      next: (years: { _id: string; name?: string }[]) => {
        this.academicYears = years;

        this.timetableService.getActiveAcademicYear(this.schoolId).subscribe({
          next: (active: { _id?: string }) => {
            if (active?._id) {
              this.selectedYearId = active._id;
              this.loadTimetable();
            }
          }
        });
      },
      error: () => this.toastr.error('Failed to load academic years')
    });
  }

  loadTimetable(): void {
    this.timetableService.getStudentTimetable(this.selectedYearId).subscribe({
      next: (data: TimetableEntry[]) => {
        this.timetable = data;
        this.buildGrid();
      },
      error: () => this.toastr.error('Failed to load timetable')
    });
  }

  buildGrid(): void {
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

  onYearChange(): void {
    this.loadTimetable();
  }
}
