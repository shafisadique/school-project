import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HolidayCalendarComponent } from './holiday-calendar.component';

describe('HolidayCalendarComponent', () => {
  let component: HolidayCalendarComponent;
  let fixture: ComponentFixture<HolidayCalendarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HolidayCalendarComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HolidayCalendarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
