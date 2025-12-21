// student-timetable.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, finalize } from 'rxjs';
import { TimetableService } from '../timetable.service';
import { ToastrService } from 'ngx-toastr';

interface TimeSlot {
  start: string;
  end: string;
}

interface Period {
  subject: string;
  teacher: string;
  room: string;
}

interface TimetableEntry {
  day: string;
  startTime: string;
  endTime: string;
  subjectId?: { name: string };
  teacherId?: { name: string };
  room?: string;
}

interface AcademicYear {
  _id: string;
  name: string;
}

@Component({
  selector: 'app-student-timetable',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './student-timetable.component.html',
  styleUrls: ['./student-timetable.component.scss']
})
export class StudentTimetableComponent implements OnInit, OnDestroy {
  // Data
  timetable: TimetableEntry[] = [];
  grid: (Period | null)[][] = [];
  timeSlots: TimeSlot[] = [];
  
  // Constants
  readonly days: string[] = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
  ];

  // State
  academicYears: AcademicYear[] = [];
  selectedYearId = '';
  schoolId = localStorage.getItem('schoolId') || '';
  isLoading = false;

  // Subscriptions
  private subscriptions = new Subscription();

  constructor(
    private timetableService: TimetableService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.loadAcademicYears();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  /* ====================== DATA LOADING ====================== */
  private loadAcademicYears(): void {
    this.isLoading = true;

    const sub = this.timetableService.getAcademicYears(this.schoolId)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (years) => {
          this.academicYears = years;
          this.selectActiveAcademicYear();
        },
        error: () => this.toastr.error('Failed to load academic years')
      });

    this.subscriptions.add(sub);
  }

  private selectActiveAcademicYear(): void {
    const sub = this.timetableService.getActiveAcademicYear(this.schoolId)
      .subscribe({
        next: (active: any) => {
          const activeId = active?._id;
          const exists = this.academicYears.some(y => y._id === activeId);

          if (exists) {
            this.selectedYearId = activeId;
          } else if (this.academicYears.length > 0) {
            this.selectedYearId = this.academicYears[0]._id;
          }

          if (this.selectedYearId) {
            this.loadTimetable();
          }
        },
        error: () => {
          if (this.academicYears.length > 0) {
            this.selectedYearId = this.academicYears[0]._id;
            this.loadTimetable();
          }
        }
      });

    this.subscriptions.add(sub);
  }

  loadTimetable(): void {
    if (!this.selectedYearId) return;

    this.isLoading = true;

    const sub = this.timetableService.getStudentTimetable(this.selectedYearId)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (data: TimetableEntry[]) => {
          this.timetable = data || [];
          this.buildGrid();
        },
        error: () => this.toastr.error('Failed to load timetable')
      });

    this.subscriptions.add(sub);
  }

  onYearChange(): void {
    this.loadTimetable();
  }

  /* ====================== GRID BUILDING ====================== */
  private buildGrid(): void {
    // Extract unique time slots
    const slotSet = new Set<string>();
    this.timetable.forEach(entry => {
      slotSet.add(`${entry.startTime}-${entry.endTime}`);
    });

    this.timeSlots = Array.from(slotSet)
      .map(slot => {
        const [start, end] = slot.split('-');
        return { start, end };
      })
      .sort((a, b) => a.start.localeCompare(b.start));

    // Initialize empty grid
    this.grid = this.days.map(() => Array(this.timeSlots.length).fill(null));

    // Fill the grid
    this.timetable.forEach(entry => {
      const dayIndex = this.days.indexOf(entry.day);
      const slotIndex = this.timeSlots.findIndex(
        s => s.start === entry.startTime && s.end === entry.endTime
      );

      if (dayIndex !== -1 && slotIndex !== -1) {
        this.grid[dayIndex][slotIndex] = {
          subject: entry.subjectId?.name || 'Unknown Subject',
          teacher: entry.teacherId?.name || 'TBD',
          room: entry.room || ''
        };
      }
    });
  }

  /* ====================== HELPERS ====================== */
  isWeekend(day: string): boolean {
    return day === 'Saturday' || day === 'Sunday';
  }

  isToday(day: string): boolean {
    const today = new Date().toLocaleString('en-us', { weekday: 'long' });
    return day === today;
  }
}