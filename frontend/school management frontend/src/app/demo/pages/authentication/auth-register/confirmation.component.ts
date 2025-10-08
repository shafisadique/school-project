import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-confirmation',
  template: `
    <div class="card text-center">
      <h2>Congratulations!</h2>
      <p>Your school, {{ schoolName }}, has been successfully registered.</p>
      <p>Check your email ({{ email }}) and {{ channel }} ({{ mobileNo }}) for your login credentials.</p>
      <button class="btn btn-primary" (click)="router.navigate(['/auth/login'])">Go to Login</button>
    </div>
  `,
  styles: [`
    .card {
      max-width: 500px;
      margin: 50px auto;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
  `]
})
export class ConfirmationComponent {
  schoolName: string;
  email: string;
  mobileNo: string;
  channel: string;

  constructor(private route: ActivatedRoute, public router: Router) {
    this.schoolName = this.route.snapshot.queryParams['schoolName'] || 'Your School';
    this.email = this.route.snapshot.queryParams['email'] || 'your email';
    this.mobileNo = this.route.snapshot.queryParams['mobileNo'] || 'your mobile number';
    this.channel = this.route.snapshot.queryParams['preferredChannel'] === 'sms' ? 'SMS' : this.route.snapshot.queryParams['preferredChannel'] === 'whatsapp' ? 'WhatsApp' : 'SMS/WhatsApp';
  }
}