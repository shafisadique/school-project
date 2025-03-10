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
  imports: [ReactiveFormsModule, CommonModule, CardComponent,NgSelectComponent,NgSelectModule],
  templateUrl: './teacher-create.component.html',
  styleUrl: './teacher-create.component.scss'
})
export class TeacherCreateComponent {
  teacherForm!: FormGroup;
  submitted = false;
  serverErrors: any = {};
  subjectsList: string[] = ['Mathematics', 'Science', 'English', 'History', 'Geography', 'Physics', 'Chemistry', 'Biology'];
  selectedFile: File | null = null;
  imagePreview: string | null = null;
  fileError: string | null = null; // ✅ Holds error messages for file validation

  constructor(private fb: FormBuilder, private teacherService: TeacherService, private toastr: ToastrService) {}

  ngOnInit() {
    this.teacherForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]], // Only 10-digit numbers allowed
      designation: ['', Validators.required],
      subjects: [[], Validators.required], // Array for multiple subjects
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
      // ✅ Allowed image types
      const allowedTypes = ['image/png', 'image/jpg', 'image/jpeg'];
      if (!allowedTypes.includes(file.type)) {
        this.toastr.error('Only PNG, JPG, and JPEG files are allowed.', 'Invalid File Type');
        this.selectedFile = null;
        this.imagePreview = null;
        return;
      }
  
      // ✅ Maximum file size: 2MB (adjust if needed)
      const maxSizeInMB = 2;
      if (file.size > maxSizeInMB * 1024 * 1024) {
        this.toastr.error(`File size must be less than ${maxSizeInMB}MB.`, 'File Too Large');
        this.selectedFile = null;
        this.imagePreview = null;
        return;
      }
  
      this.selectedFile = file;
  
      // ✅ Generate image preview
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
    formData.append('email', this.teacherForm.value.email);
    formData.append('phone', this.teacherForm.value.phone);
    formData.append('designation', this.teacherForm.value.designation);
    formData.append('gender', this.teacherForm.value.gender);
    formData.append('subjects', JSON.stringify(this.teacherForm.value.subjects)); // ✅ Convert to JSON String
    formData.append('profileImage', this.selectedFile); // ✅ Attach file
  
    this.teacherService.createTeacher(formData).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.Response) {
          this.toastr.success(event.body.message || 'Teacher added successfully!', 'Success');
          this.teacherForm.reset();
          this.imagePreview = null;
          this.selectedFile = null;
          this.submitted = false;
        }
      },
      error: (err) => {
        this.toastr.error(err.message, 'Upload Failed');
      }
    });
  }
  

  private handleServerError(error: any): void {
    console.error(error);
    
    if (error?.error) {
      this.serverErrors = error.error;

      // Show backend error message
      const errorMessage = error.error.message || 'An unexpected error occurred.';
      this.toastr.error(errorMessage, 'Error', { closeButton: true, progressBar: true });
    } else {
      this.toastr.error('An unexpected error occurred.', 'Error');
    }
  }
}
