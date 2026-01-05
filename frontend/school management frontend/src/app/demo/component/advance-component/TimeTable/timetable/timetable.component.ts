import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TimetableService } from '../timetable.service';
import { CommonModule } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { SchoolService } from '../../school/school.service';

@Component({
  selector: 'app-timetable',
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './timetable.component.html',
  styleUrls: ['./timetable.component.scss'],
  standalone: true
})
export class TimetableComponent implements OnInit {
  timetableForm!: FormGroup;
selectedSubjectId: string = '';
selectedTeacherId: string = '';
  timetableList: any[] = [];
  assignments: any[] = [];
  academicYears: any[] = [];
  selectedAcademicYearId: string = '';
  selectedClassId: string = '';
  days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Lunch / Break'];
  dynamicTimeSlots: { start: string; end: string }[] = []; // Dynamically generated time slots
  selectedSchoolId = '';
  filteredAssignments: any[] = [];
  filteredTeachers: any[] = [];
  timetableGrid: any[][] = [];
  lunchStartTime: string = '12:30 PM';
  lunchEndTime: string = '01:10 PM';
  lunchDuration: string = '40 Minutes';

  constructor(
    private fb: FormBuilder,
    private timetableService: TimetableService,
    private toastr: ToastrService,
    private schoolService :SchoolService
  ) {}

  ngOnInit(): void {
    this.selectedSchoolId = localStorage.getItem('schoolId') || '';
    if (!this.selectedSchoolId) {
      this.toastr.error('School ID not found. Please log in again.', 'Error');
      return;
    }
    this.initForm();
    this.loadAcademicYears();
    this.loadSchoolLunchBreak();
  }

  initForm() {
    this.timetableForm = this.fb.group({
      academicYearId: ['', Validators.required],
      classId: ['', Validators.required],
      subjectId: ['', Validators.required],
      teacherId: ['', Validators.required],
      day: ['', Validators.required],
      startTime: ['', Validators.required],
      endTime: ['', Validators.required],
      room: ['', Validators.required]
    });

    this.timetableForm.get('academicYearId')?.valueChanges.subscribe(academicYearId => {
      this.selectedAcademicYearId = academicYearId;
      if (academicYearId) {
        this.loadTimetable();
        this.loadAssignments();
      } else {
        this.timetableList = [];
        this.assignments = [];
        this.filteredAssignments = [];
        this.filteredTeachers = [];
        this.dynamicTimeSlots = [];
        this.timetableGrid = [];
      }
      this.timetableForm.patchValue({ classId: '', subjectId: '', teacherId: '' });
    });

    this.timetableForm.get('classId')?.valueChanges.subscribe(classId => {
      this.selectedClassId = classId;
      this.filterAssignments(classId);
      this.buildTimetableGrid();
    });

    this.timetableForm.get('subjectId')?.valueChanges.subscribe(subjectId => {
      this.filteredTeachers = this.filteredAssignments.filter(a => a.subjectId === subjectId);
      this.timetableForm.patchValue({ teacherId: '' });
    });
  }

  loadAcademicYears() {
    this.timetableService.getAcademicYears(this.selectedSchoolId).subscribe({
      next: (years) => {
        this.academicYears = years;
        if (years.length === 0) {
          this.toastr.warning('No academic years found for this school.', 'Warning');
          return;
        }
        this.timetableService.getActiveAcademicYear(this.selectedSchoolId).subscribe({
          next: (activeYear) => {
            if (!activeYear || !activeYear._id) {
              this.toastr.warning('No active academic year found.', 'Warning');
              return;
            }
            this.selectedAcademicYearId = activeYear._id;
            this.timetableForm.patchValue({ academicYearId: this.selectedAcademicYearId });
          },
          error: (err) => {
            this.toastr.error('Error fetching active academic year: ' + (err.error?.message || 'Unknown error'), 'Error');
          }
        });
      },
      error: (err) => {
        this.toastr.error('Error fetching academic years: ' + (err.error?.message || 'Unknown error'), 'Error');
      }
    });
  }

  loadTimetable() {
    if (!this.selectedAcademicYearId) return;
    this.timetableService.getTimetableBySchool(this.selectedSchoolId, this.selectedAcademicYearId).subscribe({
      next: (data) => {
        this.timetableList = data;
        this.buildTimetableGrid();
      },
      error: (err) => {
        this.toastr.error('Error fetching timetable: ' + (err.error?.message || 'Unknown error'), 'Error');
      }
    });
  }

  loadAssignments() {
    if (!this.selectedAcademicYearId) return;
    this.timetableService.getCombinedAssignments(this.selectedSchoolId, this.selectedAcademicYearId).subscribe({
      next: (assignments) => {
        this.assignments = assignments;
        if (assignments.length === 0) {
          this.toastr.warning('No assignments found for this academic year.', 'Warning');
        }
        this.filteredAssignments = [];
        this.filteredTeachers = [];
        this.timetableForm.patchValue({ classId: '', subjectId: '', teacherId: '' });
      },
      error: (err) => {
        this.toastr.error('Error fetching assignments: ' + (err.error?.message || 'Unknown error'), 'Error');
      }
    });
  }

  filterAssignments(classId: string) {
    if (!classId) {
      this.filteredAssignments = [];
      this.filteredTeachers = [];
      this.timetableForm.patchValue({ subjectId: '', teacherId: '' });
      return;
    }
    this.filteredAssignments = this.assignments.filter(a => a.classId === classId);
    this.filteredTeachers = [];
    this.timetableForm.patchValue({ subjectId: '', teacherId: '' });
  }

  buildTimetableGrid() {
    if (!this.selectedClassId || !this.timetableList.length) {
      this.dynamicTimeSlots = [];
      this.timetableGrid = [];
      return;
    }

    // Filter timetable entries for the selected class
    const classTimetable = this.timetableList.filter(entry => entry.classId._id === this.selectedClassId);

    // Extract unique time slots from the timetable entries
    const timeSlotSet = new Set<string>();
    classTimetable.forEach(entry => {
      const timeSlot = `${entry.startTime}-${entry.endTime}`;
      timeSlotSet.add(timeSlot);
    });

    // Convert to array and sort by start time
    this.dynamicTimeSlots = Array.from(timeSlotSet)
      .map(slot => {
        const [start, end] = slot.split('-');
        return { start, end };
      })
      .sort((a, b) => a.start.localeCompare(b.start));

    // Initialize the grid: rows = days, columns = dynamic time slots
    this.timetableGrid = this.days.map(() => Array(this.dynamicTimeSlots.length).fill(null));

    // Populate the grid
    classTimetable.forEach(entry => {
      const dayIndex = this.days.indexOf(entry.day);
      const timeSlotIndex = this.dynamicTimeSlots.findIndex(slot => slot.start === entry.startTime && slot.end === entry.endTime);
      if (dayIndex !== -1 && timeSlotIndex !== -1) {
        this.timetableGrid[dayIndex][timeSlotIndex] = {
          subject: entry.subjectId?.name || 'N/A',
          teacher: entry.teacherId?.name || 'N/A',
          room: entry.room || 'N/A',
          id: entry._id
        };
      }
    });
  }

  onSubmit() {
    if (this.timetableForm.invalid) {
      this.toastr.error('Please fill all required fields', 'Error');
      return;
    }

    const newTimetable = {
      schoolId: this.selectedSchoolId,
      academicYearId: this.selectedAcademicYearId,
      classId: this.timetableForm.value.classId,
      subjectId: this.timetableForm.value.subjectId,
      teacherId: this.timetableForm.value.teacherId,
      day: this.timetableForm.value.day,
      startTime: this.timetableForm.value.startTime,
      endTime: this.timetableForm.value.endTime,
      room: this.timetableForm.value.room,
    };

    this.timetableService.createTimetable(newTimetable).subscribe({
      next: (response) => {
        this.toastr.success('Timetable entry added successfully', 'Success');
        this.loadTimetable();
        this.timetableForm.reset({ academicYearId: this.selectedAcademicYearId, classId: this.selectedClassId });
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'Error adding timetable entry', 'Error');
      }
    });
  }

  deleteTimetable(id: string) {
    if (confirm('Are you sure you want to delete this entry?')) {
      this.timetableService.deleteTimetable(id).subscribe({
        next: () => {
          this.toastr.success('Timetable entry deleted successfully', 'Success');
          this.loadTimetable();
        },
        error: (err) => {
          this.toastr.error('Error deleting timetable entry: ' + (err.error?.message || 'Unknown error'), 'Error');
        }
      });
    }
  }

  getClasses() {
    return [...new Map(this.assignments.map(a => [a.classId, { _id: a.classId, name: a.className }])).values()];
  }

  getSubjects() {
    return [...new Map(this.filteredAssignments.map(a => [a.subjectId, { subjectId: a.subjectId, subjectName: a.subjectName }])).values()];
  }

  formatSubject(subject: string): string {
  if (!subject) return 'N/A';
  const match = subject.match(/^(.*?)\s*\((.*)\)$/);
  if (match) {
    return `<div>${match[1]}</div><small>(${match[2]})</small>`;
  }
  return subject;
}

loadSchoolLunchBreak() {
  const schoolId = localStorage.getItem('schoolId');
  if (!schoolId) return;

  this.schoolService.getSchoolById(schoolId).subscribe({
    next: (school: any) => {
      if (school?.schoolTiming?.lunchBreak) {
        const lunch = school.schoolTiming.lunchBreak; // "12:00 - 12:30"
        const [start, end] = lunch.split(' - ');
        
        this.lunchStartTime = this.formatTime24to12(start.trim()); // "12:00" → "12:00 PM"
        this.lunchEndTime = this.formatTime24to12(end.trim());     // "12:30" → "12:30 PM"

        // Calculate duration
        const [h1, m1] = start.split(':').map(Number);
        const [h2, m2] = end.split(':').map(Number);
        const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
        this.lunchDuration = `${diff} Minutes`;
      }
    },
    error: (err) => {
      console.log('Lunch break not set, using default');
    }
  });
}

// Helper: Convert 24-hour "13:30" → "01:30 PM"
formatTime24to12(time: string): string {
  const [hour, minute] = time.split(':').map(Number);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
}

getSelectedClassName(): string {
  const cls = this.getClasses().find(c => c._id === this.selectedClassId);
  return cls?.name || '';
}

  printTimetable() {
    const printContent = document.getElementById('printable-timetable')?.outerHTML || '';
    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow?.document.write(`
      <html>
        <head>
          <title>Timetable - ${this.getSelectedClassName()}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #333; padding: 10px; text-align: center; font-size: 14px; }
            th { background: #333; color: white; }
            .lunch-row { background: #d4edda !important; }
            .lunch-text { font-weight: bold; color: #0f5132; }
            @media print { body { -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <h1>Timetable - ${this.getSelectedClassName()}</h1>
          ${printContent}
        </body>
      </html>
    `);
    printWindow?.document.close();
    printWindow?.focus();
    setTimeout(() => printWindow?.print(), 500);
  }
}