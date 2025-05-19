import { Component } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { StudentService } from '../student.service';
import { CommonModule } from '@angular/common';
import { CardComponent } from 'src/app/theme/shared/components/card/card.component';
import { ClassSubjectService } from '../../class-subject-management/class-subject.service';

@Component({
  selector: 'app-student-create',
  templateUrl: './student-create.component.html',
  imports:[CommonModule,FormsModule,ReactiveFormsModule,CardComponent],
  standalone:true,
  styleUrl: './student-create.component.scss'
})
export class StudentCreateComponent {
  studentForm!: FormGroup;
  submitted = false;
  classList: any[] = [];
  sectionList:any[]= ['A','B','C']
  selectedFile: File | null = null;
  imagePreview: string | null = null;
  fileError: string | null = null;
  serverErrors: any = {};
  sessionList = ['2023-2024', '2024-2025', '2025-2026'];
  schoolId =localStorage.getItem('schoolId')
  constructor(private fb: FormBuilder,private classSubjectService:ClassSubjectService, private studentService: StudentService, private toastr: ToastrService) {}

  ngOnInit() {    
    this.studentForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      email: [''],
      phone: ['', [Validators.required, Validators.pattern('^(?:\\+91)?[0-9]{10}$')]],
      classId: ['', Validators.required], // Changed from className to classId
      section:['',Validators.required],
      address: ['', Validators.required],
      gender: ['', Validators.required],
      usesTransport:[false,[Validators.required]],
      usesHostel:[false,[Validators.required]]
    });
    this.loadClasses()
  }

  get f() {
    return this.studentForm.controls;
  }
  loadClasses() {
    this.classSubjectService.getClassesBySchool(this.schoolId).subscribe({
      next: (classes) => {this.classList = classes;console.log(classes)},
      error: (err) => console.error('Error fetching classes:', err)
    });
  }

  onFileSelect(event: any) {
    const file = event.target.files[0];

    if (file) {
      const allowedTypes = ['image/png', 'image/jpg', 'image/jpeg'];
      if (!allowedTypes.includes(file.type)) {
        this.fileError = 'Only PNG, JPG, and JPEG files are allowed.';
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        this.fileError = 'File size must be less than 2MB.';
        return;
      }

      this.selectedFile = file;
      this.fileError = null;

      const reader = new FileReader();
      reader.onload = () => {
        this.imagePreview = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  onSubmit() {
    this.submitted = true;
  
    console.log('Form Valid:', this.studentForm.valid);
    console.log('Form Values:', this.studentForm.value);
  
    if (this.studentForm.invalid || !this.selectedFile) {
      this.fileError = !this.selectedFile ? 'Profile picture is required.' : null;
      return;
    }
    const schoolId = localStorage.getItem('schoolId');
  
    const formData = new FormData();
    formData.append('name', this.studentForm.value.name || '');
    formData.append('email', this.studentForm.value.email || '');
    formData.append('phone', this.studentForm.value.phone || '');
    formData.append('classId', this.studentForm.value.classId || ''); // Changed from className to classId
    formData.append('gender', this.studentForm.value.gender || '');
    formData.append('address', this.studentForm.value.address || '');
    formData.append('profileImage', this.selectedFile);
    formData.append('usesTransport', this.studentForm.value.usesTransport.toString());
    formData.append('usesHostel', this.studentForm.value.usesHostel.toString());
    formData.append('section', JSON.stringify([this.studentForm.value.section])); // Convert to array for the schema
  
    this.studentService.getActiveAcademicYear(schoolId).subscribe({
      next: (activeYear) => {
        formData.append('academicYearId', activeYear._id);
  
        // Add admissionNo (generate a simple one for now, e.g., based on timestamp)
        formData.append('admissionNo', `ADM-${Date.now()}`);
  
        this.studentService.createStudent(formData).subscribe({
          next: (res) => {
            this.toastr.success('Student added successfully!', 'Success');
            this.studentForm.reset();
            this.imagePreview = null;
            this.submitted = false;
          },
          error: (err) => {
            this.toastr.error(err.error.message || 'Error adding student', 'Error');
          }
        });
      },
      error: (err) => {
        this.toastr.error('Error fetching active academic year', 'Error');
      }
    });
  }

}
