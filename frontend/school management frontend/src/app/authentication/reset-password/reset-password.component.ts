import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule,RouterModule],
  template: `
    <div class="auth-main">
      <div class="auth-wrapper v3">
        <div class="auth-form">
          <div class="card my-5">
            <div class="card-body">
              <h3 class="text-center mb-4">Set Your Password</h3>
              <form [formGroup]="resetForm" (ngSubmit)="onSubmit()">
                <div class="mb-3">
                  <input type="password" formControlName="newPassword" 
                         placeholder="New Password" 
                         class="form-control p-2 border rounded"
                         [class.is-invalid]="f['newPassword']?.invalid && f['newPassword']?.touched">
                  <div *ngIf="f['newPassword']?.invalid && f['newPassword']?.touched" class="invalid-feedback">
                    <div *ngIf="f['newPassword']?.errors?.['required']">Password is required</div>
                    <div *ngIf="f['newPassword']?.errors?.['minlength']">Minimum 6 characters required</div>
                  </div>
                </div>
                <div class="mb-3">
                  <input type="password" formControlName="confirmPassword" 
                         placeholder="Confirm Password" 
                         class="form-control p-2 border rounded"
                         [class.is-invalid]="f['confirmPassword']?.invalid && f['confirmPassword']?.touched">
                  <div *ngIf="f['confirmPassword']?.invalid && f['confirmPassword']?.touched" class="invalid-feedback">
                    Confirm password is required
                  </div>
                </div>
                <div *ngIf="resetForm.errors?.['mismatch'] && resetForm.touched" class="text-danger mb-3">
                  Passwords do not match
                </div>
                <div class="d-grid">
                  <button type="submit" [disabled]="resetForm.invalid || isSubmitting" 
                          class="btn btn-primary">
                    Set Password
                  </button>
                </div>
              </form>
              <a [routerLink]="['/auth/login']" class="link-primary mt-3 d-block text-center">Back to Login</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-main { display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .auth-wrapper { width: 100%; max-width: 500px; padding: 15px; }
    .auth-form { background: #fff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .card { border: none; }
    .btn-primary { background-color: #1a73e8; border-color: #1a73e8; }
    .link-primary { color: #1a73e8; }
  `]
})
export class ResetPasswordComponent implements OnInit {
  resetForm: FormGroup;
  isSubmitting = false;
  token: string | null = null;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private toastr: ToastrService
  ) {
    this.resetForm = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token');
    if (!this.token) {
      this.toastr.error('Invalid or missing reset token', 'Error');
      this.router.navigate(['/auth/login']);
    }
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('newPassword')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { mismatch: true };
  }

  get f() { return this.resetForm.controls; }

  onSubmit() {
    if (this.resetForm.invalid || this.isSubmitting || !this.token) return;
    this.isSubmitting = true;

    this.authService.resetPassword({ 
      token: this.token, 
      newPassword: this.resetForm.value.newPassword, 
      confirmPassword: this.resetForm.value.confirmPassword 
    }).subscribe({
      next: () => {
        this.toastr.success('Password set successfully! Please login.', 'Success');
        this.router.navigate(['/auth/login']);
        this.isSubmitting = false;
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'Failed to set password', 'Error');
        this.isSubmitting = false;
      }
    });
  }
}