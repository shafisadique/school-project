import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { StudentService } from 'src/app/demo/component/advance-component/students/student.service';
import { AuthService } from 'src/app/theme/shared/service/auth.service';

@Component({
  selector: 'app-auth-register',
  standalone: true,
  imports: [RouterModule, ReactiveFormsModule, CommonModule],
  templateUrl: './auth-register.component.html',
  styleUrls: ['./auth-register.component.scss']
})
export class AuthRegisterComponent implements OnInit{
  step = signal(1);
  formData = signal<any>({});

  schoolForm: FormGroup;
  passwordForm: FormGroup;
  addressForm:FormGroup;

  constructor(private fb: FormBuilder, private router: Router, private http: HttpClient,private authService:AuthService,private toastr: ToastrService) {
    this.schoolForm = this.fb.group({
      schoolName: ['', Validators.required],
      adminName: ['', Validators.required],
      username: ['', [Validators.required, Validators.minLength(4)]],
      email: ['', [Validators.required, Validators.email]],
      // address: this.fb.group({
      //   street: [''],
      //   city: [''],
      //   state: [''],
      //   country: [''],
      //   postalCode: ['']
      // })
    });

    this.passwordForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });
    
    this.addressForm =this.fb.group({
      street: ['', Validators.required],
      city: ['', Validators.required],
      state: ['', Validators.required],
      country: ['', Validators.required],
      postalCode: ['', Validators.required]
    })
  }

  ngOnInit(): void {
    
  }

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
      if (this.addressForm.valid) {
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
    const { confirmPassword, ...cleanData } = this.formData();
  
  // const finalData = {
  //   ...cleanData,
  //   address: {
  //     street: this.schoolForm.get('address.street')?.value,
  //     city: this.schoolForm.get('address.city')?.value,
  //     state: this.schoolForm.get('address.state')?.value,
  //     country: this.schoolForm.get('address.country')?.value,
  //     postalCode: this.schoolForm.get('address.postalCode')?.value
  //   },
  //   username: this.schoolForm.get('username')?.value
  // };
    this.authService.registerSchool(cleanData).subscribe({
      next: (res:any) =>{
       this.toastr.success('Registration Successful! Redirecting...', 'Success'); // ✅ Show success notification

       setTimeout(() => {
         this.router.navigate(['/auth/login']); // ✅ Redirect after success
       }, 2000); // Delay to let the user see the message
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'Registration Failed', 'Error'); // ✅ Show error notification
        console.error('Registration Failed', err);
      }
    });
  }
}