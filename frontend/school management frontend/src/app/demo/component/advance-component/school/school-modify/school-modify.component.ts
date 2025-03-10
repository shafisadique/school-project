import { Component, OnInit } from '@angular/core';
import { SchoolService } from '../school.service';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-school-modify',
  imports: [CommonModule,FormsModule,ReactiveFormsModule],
  standalone:true,
  templateUrl: './school-modify.component.html',
  styleUrl: './school-modify.component.scss'
})
export class SchoolModifyComponent implements OnInit{
  schoolId:any;
  academicYear:any[]=['2024-2025', '2025-2026']
  schoolForm = this.fb.group({
    name: new FormControl(''),
    street: new FormControl(''),
    city: new FormControl(''),
    contact:new FormControl(''),
    academicYear:new FormControl(''),
    logo: new FormControl('') // ✅ Store image URL
  });

  selectedFile: File | null = null;

  constructor(private fb: FormBuilder, private schoolService: SchoolService) {}

  ngOnInit() {
    this.schoolId=localStorage.getItem('schoolId')
    this.fetchSchool();
  }

  fetchSchool() {
    this.schoolService.getMySchool().subscribe({
      next: (data) => {
        this.schoolForm.patchValue({
          name: data.name,
          street: data.address?.street,
          city: data.address?.city,
          academicYear:data.academicYear,
          contact:data.contact,
          logo: data.logo // ✅ Set existing logo
        });
      },
      error: (err) => console.error('Error fetching school:', err)
    });
  }

  updateSchool() {
    const schoolData = {
      name: this.schoolForm.value.name,
      address: {
        street: this.schoolForm.value.street,
        city: this.schoolForm.value.city
      },
      academicYear:this.schoolForm.value.academicYear,
      contact:this.schoolForm.value.contact
    };

    this.schoolService.updateSchool(this.schoolId, schoolData).subscribe({
      next: () => alert('School updated successfully!'),
      error: (err) => console.error('Error updating school:', err)
    });
  }

  // ✅ Handle File Selection
  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;

      // ✅ Preview Image Before Uploading
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.schoolForm.controls['logo'].setValue(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  }

  // ✅ Upload Logo
  uploadLogo() {
    if (!this.selectedFile) {
      alert('Please select an image first!');
      return;
    }

    this.schoolService.uploadLogo(this.schoolId, this.selectedFile).subscribe({
      next: (response) => {
        alert('Logo uploaded successfully!');
        this.schoolForm.controls['logo'].setValue(response.logoUrl); // ✅ Set new logo URL
      },
      error: (err) => console.error('Error uploading logo:', err)
    });
  }
}
