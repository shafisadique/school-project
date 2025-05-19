import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { TeacherService } from '../teacher.service';
import { CardComponent } from "../../../../../theme/shared/components/card/card.component";
import { NgLabelTemplateDirective, NgOptionTemplateDirective, NgSelectComponent, NgSelectModule } from '@ng-select/ng-select';
import { HttpEventType } from '@angular/common/http';

@Component({
  selector: 'app-teacher-create',
  imports: [ReactiveFormsModule, CommonModule, CardComponent, NgSelectComponent, NgSelectModule],
  templateUrl: './teacher-create.component.html',
  styleUrls: ['./teacher-create.component.scss'],
  standalone: true
})
export class TeacherCreateComponent {
  teacherForm!: FormGroup;
  submitted = false;
  serverErrors: any = {};
  subjectsList: string[] = ['English', 'Hindi', 'Mathematics', 'Environmental Science', 'General Knowledge', 'Arts', 'Science', 'Social Science', 'Music'];
  selectedFile: File | null = null;
  imagePreview: string | null = null;
  fileError: string | null = null;

  constructor(private fb: FormBuilder, private teacherService: TeacherService, private toastr: ToastrService) {}

  ngOnInit() {
    this.teacherForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      username: ['', [Validators.required, Validators.minLength(3)]], // Added username field
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]], // Added password field
      phone: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
      designation: ['', Validators.required],
      subjects: [[], Validators.required],
      gender: ['', Validators.required]
    });
  }

  // Getter for easy access to form fields in template
  get f() {
    return this.teacherForm.controls;
  }

  onFileSelect(event: any) {
    const file = event.target.files[0];
  
    if (file) {
      // Allowed image types
      const allowedTypes = ['image/png', 'image/jpg', 'image/jpeg'];
      if (!allowedTypes.includes(file.type)) {
        this.toastr.error('Only PNG, JPG, and JPEG files are allowed.', 'Invalid File Type');
        this.selectedFile = null;
        this.imagePreview = null;
        this.fileError = 'Only PNG, JPG, and JPEG files are allowed.';
        return;
      }
  
      // Maximum file size: 2MB
      const maxSizeInMB = 2;
      if (file.size > maxSizeInMB * 1024 * 1024) {
        this.toastr.error(`File size must be less than ${maxSizeInMB}MB.`, 'File Too Large');
        this.selectedFile = null;
        this.imagePreview = null;
        this.fileError = `File size must be less than ${maxSizeInMB}MB.`;
        return;
      }
  
      this.selectedFile = file;
      this.fileError = null;
  
      // Generate image preview
      const reader = new FileReader();
      reader.onload = () => {
        this.imagePreview = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  onSubmit() {
    this.submitted = true;
  
    if (this.teacherForm.invalid || !this.selectedFile) {
      this.fileError = !this.selectedFile ? 'Profile picture is required.' : null;
      return;
    }
  
    const formData = new FormData();
    formData.append('name', this.teacherForm.value.name);
    formData.append('username', this.teacherForm.value.username); // Added username
    formData.append('email', this.teacherForm.value.email);
    formData.append('password', this.teacherForm.value.password); // Added password
    formData.append('phone', this.teacherForm.value.phone);
    formData.append('designation', this.teacherForm.value.designation);
    formData.append('gender', this.teacherForm.value.gender);
    formData.append('subjects', JSON.stringify(this.teacherForm.value.subjects));
    formData.append('profileImage', this.selectedFile);

    this.teacherService.createTeacher(formData).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.Response) {
          this.toastr.success(event.body.message || 'Teacher added successfully!', 'Success');
          this.teacherForm.reset();
          this.imagePreview = null;
          this.selectedFile = null;
          this.submitted = false;
          this.serverErrors = {};
        }
      },
      error: (err) => {
        this.handleServerError(err);
      }
    });
  }

  private handleServerError(error: any): void {
    console.error(error);
    
    if (error?.error) {
      this.serverErrors = error.error;
      const errorMessage = error.error.message || 'An unexpected error occurred.';
      this.toastr.error(errorMessage, 'Error', { closeButton: true, progressBar: true });
    } else {
      this.toastr.error('An unexpected error occurred.', 'Error');
    }
  }
}