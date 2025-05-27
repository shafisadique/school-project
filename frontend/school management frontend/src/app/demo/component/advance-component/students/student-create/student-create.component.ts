import { Component } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { StudentService } from '../student.service';
import { CommonModule } from '@angular/common';
import { CardComponent } from 'src/app/theme/shared/components/card/card.component';
import { ClassSubjectService } from '../../class-subject-management/class-subject.service';
interface ParentDetails {
  fatherName?: string;
  motherName?: string;
  fatherPhone?: string;
  motherPhone?: string;
}
@Component({
  selector: 'app-student-create',
  templateUrl: './student-create.component.html',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, CardComponent],
  standalone: true,
  styleUrl: './student-create.component.scss'
})
export class StudentCreateComponent {
  studentForm!: FormGroup;
  submitted = false;
  classList: any[] = [];
  sectionList: any[] = ['A', 'B', 'C'];
  selectedFile: File | null = null;
  imagePreview: string | null = null;
  fileError: string | null = null;
  serverErrors: any = {};
  sessionList = ['2023-2024', '2024-2025', '2025-2026'];
  schoolId = localStorage.getItem('schoolId');

  constructor(
    private fb: FormBuilder,
    private classSubjectService: ClassSubjectService,
    private studentService: StudentService,
    private toastr: ToastrService
  ) {}

  ngOnInit() {    
    this.studentForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      email: [''],
      phone: ['', [Validators.required, Validators.pattern('^(?:\\+91)?[0-9]{10}$')]],
      dateOfBirth: ['', Validators.required], // Added Date of Birth
      city: ['', Validators.required], // Added City
      state: ['', Validators.required], // Added State
      country: ['', Validators.required], // Added Country
      classId: ['', Validators.required],
      section: ['', Validators.required],
      address: ['', Validators.required],
      gender: ['', Validators.required],
      usesTransport: [false, [Validators.required]],
      usesHostel: [false, [Validators.required]],
      fatherName: ['', Validators.minLength(2)], // Made optional
      motherName: ['', Validators.minLength(2)], // Made optional
      fatherPhone: ['', Validators.pattern('^(?:\\+91)?[0-9]{10}$')], // Made optional
      motherPhone: ['', Validators.pattern('^(?:\\+91)?[0-9]{10}$')] // Made optional
    }, { 
      validators: this.atLeastOneParentValidator // Custom validator for parents
    });
    this.loadClasses();
  }

  // Custom validator to ensure at least one parent's details are provided
  atLeastOneParentValidator(formGroup: FormGroup) {
    const fatherName = formGroup.get('fatherName')?.value;
    const motherName = formGroup.get('motherName')?.value;
    const fatherPhone = formGroup.get('fatherPhone')?.value;
    const motherPhone = formGroup.get('motherPhone')?.value;

    if (!fatherName && !motherName) {
      return { noParentProvided: true };
    }
    if (fatherName && !fatherPhone) {
      formGroup.get('fatherPhone')?.setErrors({ requiredIfFather: true });
    }
    if (motherName && !motherPhone) {
      formGroup.get('motherPhone')?.setErrors({ requiredIfMother: true });
    }
    return null;
  }

  get f() {
    return this.studentForm.controls;
  }

  loadClasses() {
    this.classSubjectService.getClassesBySchool(this.schoolId).subscribe({
      next: (classes) => {
        this.classList = classes;
        console.log(classes);
      },
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
    formData.append('dateOfBirth', this.studentForm.value.dateOfBirth || '');
    formData.append('city', this.studentForm.value.city || '');
    formData.append('state', this.studentForm.value.state || '');
    formData.append('country', this.studentForm.value.country || '');
    formData.append('classId', this.studentForm.value.classId || '');
    formData.append('gender', this.studentForm.value.gender || '');
    formData.append('address', this.studentForm.value.address || '');
    formData.append('profileImage', this.selectedFile);
    formData.append('usesTransport', this.studentForm.value.usesTransport.toString());
    formData.append('usesHostel', this.studentForm.value.usesHostel.toString());
    formData.append('section', JSON.stringify([this.studentForm.value.section]));
  
    // Define parents with the ParentDetails interface
    const parents: ParentDetails = {};
    if (this.studentForm.value.fatherName?.trim()) {
      parents.fatherName = this.studentForm.value.fatherName;
    }
    if (this.studentForm.value.motherName?.trim()) {
      parents.motherName = this.studentForm.value.motherName;
    }
    if (this.studentForm.value.fatherPhone?.trim()) {
      parents.fatherPhone = this.studentForm.value.fatherPhone;
    }
    if (this.studentForm.value.motherPhone?.trim()) {
      parents.motherPhone = this.studentForm.value.motherPhone;
    }
    if (Object.keys(parents).length > 0) {
      formData.append('parents', JSON.stringify(parents));
    }
  
    this.studentService.getActiveAcademicYear(schoolId).subscribe({
      next: (activeYear) => {
        formData.append('academicYearId', activeYear._id);
  
        this.studentService.createStudent(formData).subscribe({
          next: (res) => {
            this.toastr.success('Student added successfully!', 'Success');
            this.studentForm.reset();
            this.imagePreview = null;
            this.submitted = false;
          },
          error: (err) => {
            console.log('Server error:', err);
            let errorMessage = err.error.message || 'Error adding student';
            if (err.error.message.includes('At least one parent')) {
              errorMessage = 'At least one parent\'s name (father or mother) must be provided.';
            } else if (err.error.message.includes('Father\'s phone number')) {
              errorMessage = 'Father\'s phone number is required if father\'s name is provided.';
            } else if (err.error.message.includes('Mother\'s phone number')) {
              errorMessage = 'Mother\'s phone number is required if mother\'s name is provided.';
            }
            this.serverErrors = { message: errorMessage };
            this.toastr.error(errorMessage, 'Error');
          }
        });
      },
      error: (err) => {
        this.toastr.error('Error fetching active academic year', 'Error');
      }
    });
  }
}