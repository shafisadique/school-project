import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { TeacherService } from '../teacher.service';
import { CardComponent } from "../../../../../theme/shared/components/card/card.component";
import { NgSelectComponent, NgSelectModule } from '@ng-select/ng-select';
import { HttpEventType } from '@angular/common/http';

@Component({
  selector: 'app-teacher-update',
  imports: [ReactiveFormsModule, CommonModule, CardComponent, NgSelectModule],
  templateUrl: './teacher-update.component.html',
  styleUrls: ['./teacher-update.component.scss'],
  standalone: true
})
export class TeacherUpdateComponent implements OnInit {
  teacherForm!: FormGroup;
  submitted = false;
  serverErrors: any = {};
  subjectsList: string[] = ['English', 'Hindi', 'Mathematics', 'Environmental Science', 'General Knowledge', 'Arts', 'Science', 'Social Science', 'Music'];
  selectedFile: File | null = null;
  imagePreview: string | null = null;
  fileError: string | null = null;
  teacherId!: string;

  constructor(
    private fb: FormBuilder,
    private teacherService: TeacherService,
    private toastr: ToastrService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.teacherId = this.route.snapshot.paramMap.get('teacherId')!;
    this.initForm();
    this.loadTeacherDetails();
  }

  initForm() {
  this.teacherForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    username: [''], // Make optional by removing required validator
    email: ['', [Validators.required, Validators.email]],
    password: [''],
    phone: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
    designation: ['', Validators.required],
    subjects: [[], Validators.required],
    gender: ['', Validators.required]
  });
}

loadTeacherDetails() {
  this.teacherService.getTeacher(this.teacherId).subscribe({
    next: (teacher: any) => {
      this.teacherForm.patchValue({
        name: teacher.data.name,
        username: teacher.data.name || '', // Fallback to name if username is missing
        email: teacher.data.email,
        phone: teacher.data.phone,
        designation: teacher.data.designation,
        subjects: teacher.data.subjects,
        gender: teacher.data.gender
      });
      this.imagePreview = teacher.data.profileImage ? `http://localhost:5000/Uploads/${teacher.data.profileImage}` : null;
      console.log(this.imagePreview)
    },
    error: (err) => {
      this.toastr.error('Failed to load teacher details.', 'Error');
      console.error(err);
    }
  });
}

  get f() { return this.teacherForm.controls; }

  onFileSelect(event: any) {
    const file = event.target.files[0];
    if (file) {
      const allowedTypes = ['image/png', 'image/jpg', 'image/jpeg'];
      if (!allowedTypes.includes(file.type)) {
        this.toastr.error('Only PNG, JPG, and JPEG files are allowed.', 'Invalid File Type');
        this.selectedFile = null;
        this.imagePreview = null;
        this.fileError = 'Only PNG, JPG, and JPEG files are allowed.';
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        this.toastr.error('File size must be less than 2MB.', 'File Too Large');
        this.selectedFile = null;
        this.imagePreview = null;
        this.fileError = 'File size must be less than 2MB.';
        return;
      }
      this.selectedFile = file;
      this.fileError = null;
      const reader = new FileReader();
      reader.onload = () => { this.imagePreview = reader.result as string; };
      reader.readAsDataURL(file);
    }
  }

  onSubmit() {
    this.submitted = true;

    if (this.teacherForm.invalid) {
      return;
    }

    const formData = new FormData();
    formData.append('name', this.teacherForm.value.name);
    formData.append('username', this.teacherForm.value.username);
    formData.append('email', this.teacherForm.value.email);
    formData.append('password', this.teacherForm.value.password || ''); // Optional password update
    formData.append('phone', this.teacherForm.value.phone);
    formData.append('designation', this.teacherForm.value.designation);
    formData.append('gender', this.teacherForm.value.gender);
    formData.append('subjects', JSON.stringify(this.teacherForm.value.subjects));
    if (this.selectedFile) formData.append('profileImage', this.selectedFile);

    this.teacherService.updateTeacher(this.teacherId, formData).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.Response) {
          this.toastr.success(event.body.message || 'Teacher updated successfully!', 'Success');
          this.router.navigate(['/teacher/teacher-details']);
        }
      },
      error: (err) => this.handleServerError(err)
    });
  }

  private handleServerError(error: any): void {
    console.error(error);
    if (error?.error) {
      this.serverErrors = error.error;
      this.toastr.error(error.error.message || 'An unexpected error occurred.', 'Error');
    } else {
      this.toastr.error('An unexpected error occurred.', 'Error');
    }
  }
}