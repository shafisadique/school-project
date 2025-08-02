import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from 'src/app/theme/shared/service/auth.service';

@Component({
  selector: 'app-auth-register',
  standalone: true,
  imports: [RouterModule, ReactiveFormsModule, CommonModule],
  templateUrl: './auth-register.component.html',
  styleUrls: ['./auth-register.component.scss']
})
export class AuthRegisterComponent implements OnInit {
  step = signal(1);
  formData = signal<any>({});
  isSubmitting = signal(false); // Add submission guard

  schoolForm: FormGroup;
  passwordForm: FormGroup;
  addressForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private http: HttpClient,
    private authService: AuthService,
    private toastr: ToastrService
  ) {
    this.schoolForm = this.fb.group({
      schoolName: ['', Validators.required],
      adminName: ['', Validators.required],
      username: ['', [Validators.required, Validators.minLength(4)]],
      email: ['', [Validators.required, Validators.email]],
      mobileNo: ['', [Validators.required, Validators.pattern('^\\+?[1-9]\\d{9,14}$')]] // Validate mobile number
    });

    this.passwordForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });

    this.addressForm = this.fb.group({
      street: ['', Validators.required],
      city: ['', Validators.required],
      state: ['', Validators.required],
      country: ['', Validators.required],
      postalCode: ['', Validators.required]
    });
  }

  ngOnInit(): void {}

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { mismatch: true };
  }

  nextStep() {
    if (this.step() === 1) {
      this.schoolForm.markAllAsTouched();
      if (this.schoolForm.valid) {
        this.formData.set({ ...this.formData(), ...this.schoolForm.value });
        this.step.set(2);
      }
    } else if (this.step() === 2) {
      this.passwordForm.markAllAsTouched();
      if (this.passwordForm.valid) {
        this.formData.set({ ...this.formData(), ...this.passwordForm.value });
        this.step.set(3);
      }
    } else if (this.step() === 3) {
      this.addressForm.markAllAsTouched();
      if (this.addressForm.valid && !this.isSubmitting()) {
        this.formData.set({ ...this.formData(), address: this.addressForm.value });
        this.submitForm();
      }
    }
  }

  prevStep() {
    if (this.step() > 1) {
      this.step.set(this.step() - 1);
    }
  }

  submitForm() {
    if (this.isSubmitting()) return; // Prevent multiple submissions
    this.isSubmitting.set(true);

    const { confirmPassword, ...cleanData } = this.formData();
    const finalData = {
      ...cleanData,
      activeAcademicYear: 'someAcademicYearId', // Replace with dynamic value or API call if needed
      createdBy: 'currentUserId' // Replace with actual user ID from auth service
    };

    this.authService.registerSchool(finalData).subscribe({
      next: (res: any) => {
        this.toastr.success('Registration Successful! Redirecting...', 'Success');
        setTimeout(() => {
          this.router.navigate(['/auth/login']);
          this.isSubmitting.set(false); // Reset after navigation
        }, 2000);
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'Registration Failed', 'Error');
        console.error('Registration Failed', err);
        this.isSubmitting.set(false); // Reset on error
      }
    });
  }

  get f() { return this.schoolForm.controls; }
  get p() { return this.passwordForm.controls; }
  get a() { return this.addressForm.controls; }
}