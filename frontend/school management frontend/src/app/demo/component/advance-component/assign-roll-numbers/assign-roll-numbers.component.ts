// assign-roll-numbers.component.ts (updated for production: added OnDestroy, proper subscription handling)

import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core'; // Added OnDestroy
import { FormsModule } from '@angular/forms';
import { ClassSubjectService } from '../class-subject-management/class-subject.service';
import { ToastrService } from 'ngx-toastr';
import { Subscription } from 'rxjs'; // Added for subscriptions

interface Class {
  _id: string;
  name: string;
  sections: string[];
  subjects?: any[];
}

interface Student {
  _id: string;
  admissionNo: string;
  name: string;
  classId?: { _id: string; name: string };
  section: string[];
  rollNo: string;
  newRollNo?: string;
}

@Component({
  selector: 'app-assign-roll-numbers',
  imports: [CommonModule, FormsModule],
  templateUrl: './assign-roll-numbers.component.html',
  styleUrls: ['./assign-roll-numbers.component.scss']
})
export class AssignRollNumbersComponent implements OnInit, OnDestroy { // Added OnDestroy
  classes: Class[] = [];
  selectedClassId: string | null = null;
  selectedClassName: string | null = null;
  students: Student[] = [];
  message: string | null = null;
  error: string | null = null;
  loading: boolean = false;

  private subscriptions = new Subscription(); // Track all subscriptions

  constructor(
    private classSubjectService: ClassSubjectService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.fetchClasses();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe(); // Clean up all subscriptions
  }

  fetchClasses(): void {
    const schoolId = localStorage.getItem('schoolId');
    if (!schoolId) {
      this.error = 'School ID not found. Please log in again.';
      this.toastr.error(this.error, 'Error');
      return;
    }

    const sub = this.classSubjectService.getClassesBySchool(schoolId).subscribe({
      next: (classes: Class[]) => {
        this.classes = classes;
        this.error = null; // Clear any previous error
      },
      error: (err) => {
        this.error = 'Error fetching classes: ' + (err.error?.message || err.message);
        this.toastr.error(this.error, 'Error');
      }
    });

    this.subscriptions.add(sub); // Add to tracked subscriptions
  }

  fetchStudents(classId: string): void {
    const academicYearId = localStorage.getItem('activeAcademicYearId');
    if (!academicYearId) {
      this.error = 'Active academic year not found. Please log in again or select an academic year.';
      this.toastr.error(this.error, 'Error');
      return;
    }

    this.loading = true;
    this.error = null; // Clear previous errors

    const sub = this.classSubjectService.getStudentsByClass(classId, academicYearId).subscribe({
      next: (response: { students: Student[] }) => {
        this.students = response.students.map(student => ({
          ...student,
          newRollNo: student.rollNo || ''
        }));
        if (this.students.length === 0) {
          this.toastr.info('No students found for this class.', 'Info');
        }
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Error fetching students: ' + (err.error?.message || err.message);
        this.toastr.error(this.error, 'Error');
        this.students = [];
        this.loading = false;
      }
    });

    this.subscriptions.add(sub);
  }

  assignRollNumbers(): void {
    if (!this.selectedClassId) {
      this.error = 'Please select a class';
      this.toastr.warning(this.error, 'Warning');
      return;
    }

    this.loading = true;
    this.message = null;
    this.error = null;

    const sub = this.classSubjectService.assignRollNumbers(this.selectedClassId).subscribe({
      next: (response: any) => {
        this.loading = false;
        this.message = response.message;
        this.toastr.success(this.message, 'Success');
        if (this.selectedClassId) {
          this.fetchStudents(this.selectedClassId);
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = 'Error assigning roll numbers: ' + (err.error?.message || err.message);
        this.toastr.error(this.error, 'Error');
      }
    });

    this.subscriptions.add(sub);
  }

  assignRollNumbersAlphabetically(): void {
    if (!this.selectedClassId) {
      this.error = 'Please select a class';
      this.toastr.warning(this.error, 'Warning');
      return;
    }

    this.loading = true;
    this.message = null;
    this.error = null;

    const sub = this.classSubjectService.assignRollNumbersAlphabetically(this.selectedClassId).subscribe({
      next: (response: any) => {
        this.loading = false;
        this.message = response.message;
        this.toastr.success(this.message, 'Success');
        if (this.selectedClassId) {
          this.fetchStudents(this.selectedClassId);
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = 'Error assigning roll numbers alphabetically: ' + (err.error?.message || err.message);
        this.toastr.error(this.error, 'Error');
      }
    });

    this.subscriptions.add(sub);
  }

  assignRollNumberToStudent(student: Student): void {
    if (!student.newRollNo) {
      this.error = `Please enter a roll number for ${student.name} (Admission No: ${student.admissionNo})`;
      this.toastr.warning(this.error, 'Warning');
      return;
    }

    this.loading = true;
    this.message = null;
    this.error = null;

    const sub = this.classSubjectService.assignRollNumberToStudent(student._id, student.newRollNo).subscribe({
      next: (response: any) => {
        this.loading = false;
        this.message = response.message || 'Roll number assigned successfully';
        this.toastr.success(this.message, 'Success');
        // Refresh the specific student's rollNo from response
        if (response.student) {
          const index = this.students.findIndex(s => s._id === student._id);
          if (index > -1) {
            this.students[index].rollNo = response.student.rollNo;
            this.students[index].newRollNo = response.student.rollNo;
          }
        }
        if (this.selectedClassId) {
          this.fetchStudents(this.selectedClassId); // Optional full refresh
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = 'Error assigning roll number: ' + (err.error?.message || err.message);
        this.toastr.error(this.error, 'Error');
      }
    });

    this.subscriptions.add(sub);
  }

  onClassChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedClassId = target.value;
    this.selectedClassName = this.classes.find(cls => cls._id === this.selectedClassId)?.name || null;
    this.students = [];
    this.message = null;
    this.error = null;
    if (this.selectedClassId) {
      this.fetchStudents(this.selectedClassId);
    }
  }
}