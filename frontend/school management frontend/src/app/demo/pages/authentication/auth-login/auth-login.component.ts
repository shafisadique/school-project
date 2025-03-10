import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-auth-login',
  standalone: true, // Mark the component as standalone
  imports: [RouterModule, CommonModule, FormsModule, ReactiveFormsModule], // No need for HttpClientModule
  providers: [], // Provide HttpClient here
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
      username: ["", [Validators.required, Validators.email]],
      password: ["", Validators.required],
    });
  }

  onLoggedin(e: Event) {
    this.isLoading = true;
    this.isDisable = true;

    const { username, password } = this.loginForm.value;
    // const transformedUsername = username.toUpperCase();
    this.authService.login(username, password).subscribe({
      next: (res) => {
        this.router.navigate(['/']);
      },
      error: (errorResponse) => {
        this.toastrService.error(errorResponse.message);
        if (errorResponse.error?.msg === 'Invalid Username or Password') {
          this.toastrService.error('Login Error', errorResponse.error.msg);
        } else if (errorResponse.status === 0) {
          this.toastrService.error('Network Error', 'Connection failed. Please check your network or try again later.');
        } else if (errorResponse.status === 500) {
          this.toastrService.error('Server Error', 'There is an issue on the server. Please try again later.');
        } else {
          this.toastrService.error('Unexpected Error', 'Something went wrong. Please try again.');
        }
        console.error('Login Error:', errorResponse);
        this.serverErrors = errorResponse.error;
      },
    });
  }
}