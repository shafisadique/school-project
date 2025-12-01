import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ClassSubjectService } from '../class-subject.service';
import { CommonModule } from '@angular/common';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-class-subject',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './class-subject.component.html',
  styleUrls: ['./class-subject.component.scss']
})
export class ClassSubjectComponent implements OnInit {
  classForm!: FormGroup;
  subjectForm!: FormGroup;
  classes: any[] = [];
  subjects: any[] = [];
  teachers: any[] = [];
  schoolId!: string;
  loading: boolean = false;

  classList: string[] = [
    'Playgroup', 'Pre-Nursery', 'Nursery', 'Lower KG (LKG)', 'Upper KG (UKG)',
  'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
  'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'
  ];
 classSubjects: string[] = [
  // Core Academic Subjects
  'English',
  'English Reading',
  'English Writing',
  'English Rhymes',
  'English Conversation',
  'English Language & Literature',

  'Hindi',
  'Hindi Reading',
  'Hindi Writing',
  'Hindi Rhymes',
  'Hindi Course-A',
  'Hindi Course-B',

  'Mathematics',
  'Mathematics (Standard)',
  'Mathematics (Basic)',
  'Vedic Maths',

  'Science',
  'Science (Physics, Chemistry, Biology)',
  'Environmental Studies (EVS)',

  'Social Science (SST)',
  'Social Science (History, Geography, Civics, Economics)',

  // Third Language / Sanskrit / Regional
  'Sanskrit',
  'Urdu',
  'Bengali',
  'Tamil',
  'Telugu',
  'Kannada',
  'Malayalam',
  'Marathi',
  'Gujarati',
  'Punjabi',
  'Odia',
  'Assamese',
  'Nepali',
  'Arabic',
  'Persian',

  // Foreign Languages
  'French',
  'German',
  'Spanish',

  // Computer & IT Subjects
  'Computer Science',
  'Computer Applications',
  'Computer Applications (165)',
  'Information Technology (402)',
  'Foundation of IT',
  'Artificial Intelligence (417)',
  'Coding',
  'Robotics',

  // Arts & Creativity
  'Art & Craft',
  'Drawing / Art & Craft',
  'Colouring',
  'Painting',
  'Art Education',

  // Music & Dance
  'Music',
  'Music (Vocal/Instrumental)',
  'Music & Dance',
  'Dance',

  // Physical & Health Education
  'Physical Education (PT)',
  'Physical & Health Education',
  'Yoga',
  'Indoor Games',
  'Outdoor Games',

  // Moral & Value Education
  'Moral Science / Value Education',
  'Value Education',
  'Life Skills',
  'Health & Wellness',

  // General Awareness
  'General Knowledge (GK)',
  'General Knowledge',
  'Story Telling',

  // Skill Development
  'Handwriting Improvement',
  'Public Speaking',
  'Personality Development',
  'Abacus',

  // Others
  'Home Science',
  'Work Experience',
  'SUPW (Socially Useful Productive Work)',
  'Library'
].filter((subject, index, array) => array.indexOf(subject) === index)  // Removes any accidental duplicates
 .sort(); // Alphabetically sorted for clean UI

  constructor(
    private fb: FormBuilder,
    private classSubjectService: ClassSubjectService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.schoolId = localStorage.getItem('schoolId') || '';

    if (!this.schoolId) {
      this.toastr.error('No school ID found in localStorage!', 'Error');
      return;
    }

    this.loadClasses();
    this.loadSubjects();
    this.loadTeachers();

    this.classForm = this.fb.group({
      name: ['', Validators.required],
      sections: ['', Validators.required],
      schoolId: [this.schoolId],
    });

    this.subjectForm = this.fb.group({
      name: ['', Validators.required],
      schoolId: [this.schoolId]
    });
  }

  loadClasses() {
    this.loading = true;
    this.classSubjectService.getClassesBySchool(this.schoolId).subscribe({
      next: (response) => {
        this.classes = response;
        this.loading = false;
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'Error fetching classes', 'Error');
        this.loading = false;
      }
    });
  }

  loadSubjects() {
    this.loading = true;
    this.classSubjectService.getSubjects(this.schoolId).subscribe({
      next: (response) => {
        this.subjects = response;
        this.loading = false;
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'Error fetching subjects', 'Error');
        this.loading = false;
      }
    });
  }

  loadTeachers() {
    this.loading = true;
    this.classSubjectService.getTeachers(this.schoolId).subscribe({
      next: (response) => {
        this.teachers = response;
        this.loading = false;
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'Error fetching teachers', 'Error');
        this.loading = false;
      }
    });
  }

  addClass() {
    if (this.classForm.invalid) {
      this.toastr.error('Please fill all required fields', 'Error');
      return;
    }

    this.loading = true;
    const classData = {
      name: this.classForm.value.name,
      sections: this.classForm.value.sections.split(',').map((s: string) => s.trim()),
      schoolId: this.schoolId,
    };

    this.classSubjectService.createClass(classData).subscribe({
      next: () => {
        this.toastr.success('Class added successfully', 'Success');
        this.loadClasses();
        this.classForm.reset({ schoolId: this.schoolId });
        this.loading = false;
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'Error adding class', 'Error');
        this.loading = false;
      }
    });
  }

  addSubject() {
    if (this.subjectForm.invalid) {
      this.toastr.error('Please fill all required fields', 'Error');
      return;
    }

    this.loading = true;
    const subjectData = {
      name: this.subjectForm.value.name,
      schoolId: this.schoolId
    };

    this.classSubjectService.createSubject(subjectData).subscribe({
      next: () => {
        this.toastr.success('Subject added successfully', 'Success');
        this.loadSubjects();
        this.subjectForm.reset({ schoolId: this.schoolId });
        this.loading = false;
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'Error adding subject', 'Error');
        this.loading = false;
      }
    });
  }

  getAttendanceTeacher(teacher: any): string {
    if (!teacher) {
      return 'Not assigned';
    }
    return `${teacher.name} (ID: ${teacher._id})`;
  }

  getSubstituteTeachers(substituteTeachers: any[]): string {
    if (!substituteTeachers || substituteTeachers.length === 0) {
      return 'None';
    }
    return substituteTeachers.map(teacher => `${teacher.name} (ID: ${teacher._id})`).join(', ');
  }
}