import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StudentProgressReportComponent } from './student-progress-report.component';

describe('StudentProgressReportComponent', () => {
  let component: StudentProgressReportComponent;
  let fixture: ComponentFixture<StudentProgressReportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentProgressReportComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StudentProgressReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
