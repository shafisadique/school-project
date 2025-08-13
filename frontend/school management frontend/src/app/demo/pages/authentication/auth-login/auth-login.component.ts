import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-auth-login',
  standalone: true,
  imports: [RouterModule, CommonModule, FormsModule, ReactiveFormsModule],
  providers: [],
  templateUrl: './auth-login.component.html',
  styleUrl: './auth-login.component.scss'
})
export class AuthLoginComponent {
  serverErrors: any = {};
  public loginForm: FormGroup;
  validationError = false;
  isLoading = false;
  isDisable = false;

  constructor(
    private fb: FormBuilder,
    public router: Router,
    private authService: AuthService,
    private toastrService: ToastrService
  ) {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
  }

  onLoggedin(e: Event) {
    e.preventDefault();
    this.isLoading = true;
    this.isDisable = true;

    const { username, password } = this.loginForm.value;
    this.authService.login(username, password).subscribe({
      next: (res: any) => {
        console.log(res.message)
        const role = this.authService.getUserRole();
        if (role === 'superadmin') {
          this.router.navigate(['/auth/register']);
        } else if (role === 'admin') {
          this.router.navigate(['/']);
          // this.router.navigate(['/admin/dashboard']);
        } else {
          this.router.navigate(['/']);
        }
        this.toastrService.success('Login Success', 'Welcome!');
        this.isLoading = false;
        this.isDisable = false;
      },
    error: (errorResponse) => {
        // Log full error response to console first
        console.log('Backend Error Response:', JSON.stringify(errorResponse, null, 2));

        // Extract error message, default to 'Login Failed'
        const errorMessage = errorResponse.error?.message || 'Login Failed';

        // Display specific error messages based on status and message
        if (errorResponse.status === 403 && errorMessage === 'You are not part of the school') {
          this.toastrService.error(errorMessage, 'Teacher Access Denied');
        } else if (errorResponse.status === 401) {
          this.toastrService.error(errorMessage, 'Authentication Failed');
        } else if (errorResponse.status === 400) {
          this.toastrService.error(errorMessage, 'Invalid Input');
        } else if (errorResponse.status === 0) {
          this.toastrService.error('Network Error', 'Connection Failed');
        } else if (errorResponse.status === 500) {
          this.toastrService.error('Server Error', 'Please try again later');
        } else {
          this.toastrService.error(errorMessage, 'Login Failed');
        }

        // Store error for template display
        this.serverErrors = { message: errorMessage };
        this.isLoading = false;
        this.isDisable = false;
      }
     
    });
  }
}