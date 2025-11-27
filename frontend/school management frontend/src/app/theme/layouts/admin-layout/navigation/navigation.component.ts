// navigation.component.ts → FINAL WORKING 100%
import { Component, OnInit, inject, output } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { NavContentComponent } from './nav-content/nav-content.component';
import { SchoolService } from 'src/app/demo/component/advance-component/school/school.service';
import { BehaviorSubject, interval, startWith, Subject, switchMap, takeUntil } from 'rxjs';

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [CommonModule, AsyncPipe, NavContentComponent],
  templateUrl: './navigation.component.html',
  styleUrls: ['./navigation.component.scss']
})
export class NavigationComponent implements OnInit {
  NavCollapsedMob = output<void>();
  private schoolService = inject(SchoolService);

  windowWidth = window.innerWidth;
  navCollapsedMob = false;

  schoolLogoUrl$ = new BehaviorSubject<string>('/assets/edglobe.jpeg');

  ngOnInit(): void {
    // this.loadSchoolLogoWithRetry();
  }

  navCollapseMob() {
    if (this.windowWidth < 1025) {
      this.NavCollapsedMob.emit();
    }
  }

  // THIS IS THE MAGIC — POLL UNTIL LOGO LOADS
  private loadSchoolLogoWithRetry(): void {
    interval(2000) // Try every 2 seconds
      .pipe(
        startWith(0),
        switchMap(() => this.schoolService.getMySchool()),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (school: any) => {
          if (school?.logo && school.logo.trim()) {
            const url = `https://edglobe.vercel.app/api/proxy-image/${encodeURIComponent(school.logo)}`;
            console.log('Logo loaded in nav:', url);
            this.schoolLogoUrl$.next(url);
            // Stop polling once loaded
            this.destroy$.next();
            this.destroy$.complete();
          }
        },
        error: () => {
          // Keep trying...
        }
      });
  }

  onLogoError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.src = '/assets/edglobe.jpeg';
  }

  private destroy$ = new Subject<void>();
}