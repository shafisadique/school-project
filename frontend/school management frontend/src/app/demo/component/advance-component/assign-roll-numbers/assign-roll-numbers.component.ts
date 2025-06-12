import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClassSubjectService } from '../class-subject-management/class-subject.service';
import { ToastrService } from 'ngx-toastr';

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
  classId?: { _id: string; name: string }; // Updated to match populated classId
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
export class AssignRollNumbersComponent implements OnInit {
  classes: Class[] = [];
  selectedClassId: string | null = null;
  selectedClassName: string | null = null; // Added to display class name
  students: Student[] = [];
  message: string | null = null;
  error: string | null = null;
  loading: boolean = false;

  constructor(private classSubjectService: ClassSubjectService,private toastr:ToastrService) {}

  ngOnInit(): void {
    this.fetchClasses();
  }

  fetchClasses(): void {
    const schoolId = localStorage.getItem('schoolId');
    if (!schoolId) {
      this.error = 'School ID not found. Please log in again.';
      return;
    }

    this.classSubjectService.getClassesBySchool(schoolId).subscribe({
      next: (classes: Class[]) => {
        this.classes = classes;
      },
      error: (err) => {
        this.error = 'Error fetching classes: ' + (err.error?.message || err.message);
      }
    });
  }

fetchStudents(classId: string): void {
    const academicYearId = localStorage.getItem('activeAcademicYearId'); // Get from localStorage
    if (!academicYearId) {
      this.error = 'Active academic year not found. Please log in again or select an academic year.';
      this.toastr.error(this.error, 'Error');
      return;
    }

    this.loading = true;
    this.classSubjectService.getStudentsByClass(classId, academicYearId).subscribe({
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
  }

  assignRollNumbers(): void {
    if (!this.selectedClassId) {
      this.error = 'Please select a class';
      return;
    }

    this.loading = true;
    this.message = null;
    this.error = null;

    this.classSubjectService.assignRollNumbers(this.selectedClassId).subscribe({
      next: (response: any) => {
        this.loading = false;
        this.message = response.message;
        if (this.selectedClassId) {
          this.fetchStudents(this.selectedClassId);
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = 'Error assigning roll numbers: ' + (err.error?.message || err.message);
      }
    });
  }

  assignRollNumbersAlphabetically(): void {
    if (!this.selectedClassId) {
      this.error = 'Please select a class';
      return;
    }

    this.loading = true;
    this.message = null;
    this.error = null;

    this.classSubjectService.assignRollNumbersAlphabetically(this.selectedClassId).subscribe({
      next: (response: any) => {
        this.loading = false;
        this.message = response.message;
        if (this.selectedClassId) {
          this.fetchStudents(this.selectedClassId);
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = 'Error assigning roll numbers alphabetically: ' + (err.error?.message || err.message);
      }
    });
  }

  assignRollNumberToStudent(student: Student): void {
    if (!student.newRollNo) {
      this.error = `Please enter a roll number for ${student.name} (Admission No: ${student.admissionNo})`;
      return;
    }

    this.loading = true;
    this.message = null;
    this.error = null;

    this.classSubjectService.assignRollNumberToStudent(student._id, student.newRollNo).subscribe({
      next: (response: any) => {
        this.loading = false;
        this.message = response.message || 'Roll number assigned successfully';
        if (this.selectedClassId) {
          this.fetchStudents(this.selectedClassId);
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = 'Error assigning roll number: ' + (err.error?.message || err.message);
      }
    });
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