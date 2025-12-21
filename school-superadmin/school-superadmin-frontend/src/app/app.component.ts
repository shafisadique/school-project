import { Component, HostListener } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from './shared/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterModule,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  constructor(private authService: AuthService) {}

  @HostListener('document:mousemove')
  @HostListener('document:keypress')
  @HostListener('document:click')
  @HostListener('document:touchstart')
  resetTimer() {
    this.authService.resetSessionTimer();
  }
  title = 'Angular Ecommerce Dashboard | TailAdmin';
}
