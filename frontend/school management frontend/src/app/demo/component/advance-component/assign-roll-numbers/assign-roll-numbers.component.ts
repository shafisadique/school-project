import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClassSubjectService } from '../class-subject-management/class-subject.service';

interface Class {
  _id: string;
  name: string;
  sections: string[];
  subjects?: any[];
}

interface Student {
  _id: string;
  admissionNo: string; // Added to distinguish students with the same name
  name: string;
  className: string;
  section: string[];
  rollNo: string;
  newRollNo?: string; // For manual roll number input
}

@Component({
  selector: 'app-assign-roll-numbers',
  imports: [CommonModule,FormsModule],
  templateUrl: './assign-roll-numbers.component.html',
  styleUrl: './assign-roll-numbers.component.scss'
})

export class AssignRollNumbersComponent implements OnInit {
  classes: Class[] = [];
  selectedClass: string | null = null;
  students: Student[] = [];
  message: string | null = null;
  error: string | null = null;
  loading: boolean = false;

  constructor(private classSubjectService: ClassSubjectService) {}

  ngOnInit(): void {
    this.fetchClasses();
  }

  // Fetch the list of classes for the user's school
  fetchClasses(): void {
    const schoolId = localStorage.getItem('schoolId'); // Adjust based on how you store schoolId
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

  // Fetch students for the selected class
  fetchStudents(className: string): void {
    this.classSubjectService.getStudentsByClass(className).subscribe({
      next: (students: Student[]) => {
        this.students = students.map(student => ({
          ...student,
          newRollNo: student.rollNo || '' // Initialize newRollNo for manual input
        }));
      },
      error: (err) => {
        this.error = 'Error fetching students: ' + (err.error?.message || err.message);
      }
    });
  }

  // Assign roll numbers by creation order
  assignRollNumbers(): void {
    if (!this.selectedClass) {
      this.error = 'Please select a class';
      return;
    }

    this.loading = true;
    this.message = null;
    this.error = null;

    this.classSubjectService.assignRollNumbers(this.selectedClass).subscribe({
      next: (response: any) => {
        this.loading = false;
        this.message = response.message;
        this.fetchStudents(this.selectedClass!); // Refresh the student list
      },
      error: (err) => {
        this.loading = false;
        this.error = 'Error assigning roll numbers: ' + (err.error?.message || err.message);
      }
    });
  }

  // Assign roll numbers alphabetically
  assignRollNumbersAlphabetically(): void {
    if (!this.selectedClass) {
      this.error = 'Please select a class';
      return;
    }

    this.loading = true;
    this.message = null;
    this.error = null;

    this.classSubjectService.assignRollNumbersAlphabetically(this.selectedClass).subscribe({
      next: (response: any) => {
        this.loading = false;
        this.message = response.message;
        this.fetchStudents(this.selectedClass!); // Refresh the student list
      },
      error: (err) => {
        this.loading = false;
        this.error = 'Error assigning roll numbers alphabetically: ' + (err.error?.message || err.message);
      }
    });
  }

  // Assign a roll number to a specific student
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
        this.message = response.message;
        if (this.selectedClass) {
          this.fetchStudents(this.selectedClass); // Refresh the student list
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = 'Error assigning roll number: ' + (err.error?.message || err.message);
      }
    });
  }

  // Handle class selection
  onClassChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedClass = target.value;
    this.students = [];
    this.message = null;
    this.error = null;
    if (this.selectedClass) {
      this.fetchStudents(this.selectedClass);
    }
  }
}