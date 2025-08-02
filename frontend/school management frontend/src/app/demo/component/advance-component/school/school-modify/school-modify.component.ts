import { Component, OnInit, AfterViewChecked } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SchoolService } from '../school.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-school-modify',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './school-modify.component.html',
  styleUrl: './school-modify.component.scss'
})
export class SchoolModifyComponent implements OnInit, AfterViewChecked {
  schoolForm!: FormGroup;
  schoolId: string | null = null;
  academicYear: string[] = ['2024-2025', '2025-2026'];
  selectedFile: File | null = null;
  backendUrl = 'http://localhost:5000'; // Explicitly define backend URL

  constructor(private fb: FormBuilder, private schoolService: SchoolService) {}

  ngOnInit(): void {
    this.initForm();
    this.schoolId = localStorage.getItem('schoolId');
    if (!this.schoolId) {
      console.error('No schoolId found in localStorage');
      this.fetchSchoolByUser();
    } else {
      this.fetchSchool();
    }
  }

  ngAfterViewChecked() {
    console.log('Current logo value:', this.schoolForm.get('logo')?.value); // Debug image URL
  }

  initForm() {
    this.schoolForm = this.fb.group({
      name: new FormControl('', Validators.required),
      street: new FormControl('', Validators.required),
      city: new FormControl('', Validators.required),
      contact: new FormControl('', [
        Validators.required,
        Validators.pattern(/^\+?[1-9]\d{9,14}$/)
      ]),
      academicYear: new FormControl('', Validators.required),
      logo: new FormControl('') // Initialize with empty string
    });
  }

  fetchSchool() {
    if (!this.schoolId) {
      console.error('School ID is required');
      return;
    }
    this.schoolService.getSchoolById(this.schoolId).subscribe({
      next: (data) => {
        console.log('Fetched school data with logo:', data);
        this.patchFormValues(data);
      },
      error: (err) => console.error('Error fetching school by ID:', err)
    });
  }

  fetchSchoolByUser() {
    this.schoolService.getMySchool().subscribe({
      next: (data) => {
        console.log('Fetched school data by user with logo:', data);
        if (data && data._id) {
          this.schoolId = data._id;
          localStorage.setItem('schoolId', this.schoolId);
          this.patchFormValues(data);
        }
      },
      error: (err) => console.error('Error fetching school by user:', err)
    });
  }

  patchFormValues(data: any) {
    console.log('Raw data received:', data); // Log full data for inspection
    let logoUrl = data.logo || ''; // Default to empty string if undefined
    if (logoUrl && !logoUrl.startsWith('http')) {
      logoUrl = `${this.backendUrl}${logoUrl.startsWith('/') ? '' : '/'}${logoUrl}`; // Ensure proper path
    }
    console.log('Patching logo value:', logoUrl);
    this.schoolForm.patchValue({
      name: data.name || '',
      street: data.address?.street || '',
      city: data.address?.city || '',
      contact: data.contact || data.mobileNo || '',
      academicYear: data.academicYear || (data.activeAcademicYear?.year || this.academicYear[0]),
      logo: logoUrl || ''
    }, { emitEvent: false }); // Prevent unnecessary change detection
  }

  updateSchool() {
    if (this.schoolForm.invalid) {
      console.warn('Form is invalid:', this.schoolForm.errors);
      return;
    }

    const schoolData = {
      schoolName: this.schoolForm.value.name,
      address: {
        street: this.schoolForm.value.street,
        city: this.schoolForm.value.city
      },
      mobileNo: this.schoolForm.value.contact,
      academicYear: this.schoolForm.value.academicYear
    };

    this.schoolService.updateSchool(this.schoolId!, schoolData).subscribe({
      next: (response) => {
        alert('School updated successfully!');
        this.fetchSchool();
      },
      error: (err) => console.error('Error updating school:', err)
    });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.schoolForm.get('logo')?.setValue(e.target.result); // Preview
      };
      reader.readAsDataURL(file);
    }
  }

  uploadLogo() {
    if (!this.selectedFile) {
      alert('Please select an image first!');
      return;
    }
    console.log('Attempting to upload logo for schoolId:', this.schoolId, 'with file:', this.selectedFile);
    this.schoolService.uploadLogo(this.schoolId!, this.selectedFile).subscribe({
      next: (response) => {
        console.log('Upload response:', response);
        alert('Logo uploaded successfully!');
        this.schoolForm.get('logo')?.setValue(response.logoUrl); // Use the full backend URL
        this.fetchSchool(); // Refresh data
      },
      error: (err) => {
        console.error('Error uploading logo:', err); // Detailed error logging
        alert('Failed to upload logo. Check console for details.');
      }
    });
  }
}