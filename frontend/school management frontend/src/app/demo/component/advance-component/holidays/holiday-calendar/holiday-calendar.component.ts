import { Component } from '@angular/core';
import { HolidayService } from '../holiday.service';

@Component({
  selector: 'app-holiday-calendar',
  imports: [],
  templateUrl: './holiday-calendar.component.html',
  styleUrl: './holiday-calendar.component.scss'
})
export class HolidayCalendarComponent {
  holidays: any[] = [];

  constructor(private holidayService: HolidayService) {}

  ngOnInit(): void {
    this.loadHolidays();
  }

  loadHolidays() {
    const schoolId = localStorage.getItem('schoolId');
    if (!schoolId) {
      console.error('No School ID found');
      return;
    }

    this.holidayService.getHolidays(schoolId).subscribe({
      next: (data) => {
        this.holidays = data.holidays;
      },
      error: (err) => console.error('Error fetching holidays:', err)
    });
  }
}
