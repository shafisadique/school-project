import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { StudentService } from '../student.service';
import { ClassSubjectService } from '../../class-subject-management/class-subject.service';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CardComponent } from 'src/app/theme/shared/components/card/card.component';

interface ParentDetails {
  fatherName?: string;
  motherName?: string;
  fatherPhone?: string;
  motherPhone?: string;
}

@Component({
  selector: 'app-student-update',
  templateUrl: './student-update.component.html',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, CardComponent],
  standalone: true,
  styleUrls: ['./student-update.component.scss']
})
export class StudentUpdateComponent implements OnInit {
  studentForm!: FormGroup;
  submitted = false;
  classList: any[] = [];
  sectionList: any[] = ['A', 'B', 'C'];
  selectedFile: File | null = null;
  imagePreview: string | null = null;
  fileError: string | null = null;
  serverErrors: any = {};
  schoolId = localStorage.getItem('schoolId');
  studentId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private classSubjectService: ClassSubjectService,
    private studentService: StudentService,
    private toastr: ToastrService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.studentId = this.route.snapshot.paramMap.get('id');
    if (!this.studentId) {
      this.toastr.error('Invalid student ID', 'Error');
      this.router.navigate(['/student/details']);
      return;
    }

    this.studentForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      email: [''],
      phone: [''],
      // [Validators.required, Validators.pattern('^(?:\\+91)?[0-9]{10}$')]
      dateOfBirth: ['', Validators.required],
      city: ['', Validators.required],
      state: ['', Validators.required],
      country: ['', Validators.required],
      classId: ['', Validators.required],
      section: ['', Validators.required],
      address: ['', Validators.required],
      gender: ['', Validators.required],
      usesTransport: [false, [Validators.required]],
      usesHostel: [false, [Validators.required]],
      fatherName: ['', Validators.minLength(2)],
      motherName: ['', Validators.minLength(2)],
      fatherPhone: ['', Validators.pattern('^(?:\\+91)?[0-9]{10}$')],
      motherPhone: ['', Validators.pattern('^(?:\\+91)?[0-9]{10}$')],
      status: [true] // Add status field
    }, { 
      validators: this.atLeastOneParentValidator
    });

    this.loadClasses();
    this.loadStudent();
  }

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
      },
      error: (err) => console.error('Error fetching classes:', err)
    });
  }

  loadStudent() {
    if (this.studentId) {
      this.studentService.getStudentById(this.studentId).subscribe({
        next: (student) => {
          console.log(student)
          this.studentForm.patchValue({
            name: student.name,
            email: student.email,
            phone: student.phone,
            dateOfBirth: new Date(student.dateOfBirth).toISOString().split('T')[0],
            city: student.city,
            state: student.state,
            country: student.country,
            classId: student.classId?._id || student.classId,
            section: student.section[0], // Assuming section is an array
            address: student.address,
            gender: student.gender,
            usesTransport: student.feePreferences.usesTransport,
            usesHostel: student.feePreferences.usesHostel,
            fatherName: student.parents?.fatherName || '',
            motherName: student.parents?.motherName || '',
            fatherPhone: student.parents?.fatherPhone || '',
            motherPhone: student.parents?.motherPhone || '',
            status: student.status // Set the status
          });
          this.imagePreview = student.profileImage
            ? `http://localhost:5000${student.profileImage}`
            : null;
        },
        error: (err) => {
          this.toastr.error('Error loading student details', 'Error');
          this.router.navigate(['/student/details']);
        }
      });
    }
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

    if (this.studentForm.invalid) {
      return;
    }

    const updateData: any = {
      name: this.studentForm.value.name || '',
      email: this.studentForm.value.email || '',
      phone: this.studentForm.value.phone || '',
      dateOfBirth: this.studentForm.value.dateOfBirth || '',
      city: this.studentForm.value.city || '',
      state: this.studentForm.value.state || '',
      country: this.studentForm.value.country || '',
      classId: this.studentForm.value.classId || '',
      gender: this.studentForm.value.gender || '',
      address: this.studentForm.value.address || '',
      section: [this.studentForm.value.section],
      usesTransport: this.studentForm.value.usesTransport,
      usesHostel: this.studentForm.value.usesHostel,
      status: this.studentForm.value.status // Include status
    };

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
      updateData.parents = parents;
    }

    if (this.studentId) {
      this.studentService.updateStudent(this.studentId, updateData).subscribe({
        next: (res) => {
          // If a new profile image is selected, upload it separately
          if (this.selectedFile) {
            const formData = new FormData();
            formData.append('profileImage', this.selectedFile);
            this.studentService.uploadStudentPhoto(this.studentId!, formData).subscribe({
              next: () => {
                this.toastr.success('Student updated successfully!', 'Success');
                this.router.navigate(['/student/student-details']);
              },
              error: (err) => {
                this.toastr.error('Student updated, but failed to upload profile picture', 'Warning');
                this.router.navigate(['/student/student-details']);
              }
            });
          } else {
            this.toastr.success('Student updated successfully!', 'Success');
            this.router.navigate(['/student/details']);
          }
        },
        error: (err) => {
          let errorMessage = err.error.message || 'Error updating student';
          this.serverErrors = { message: errorMessage };
          this.toastr.error(errorMessage, 'Error');
        }
      });
    }
  }
}