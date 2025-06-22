import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CashReportComponent } from './cash-report.component';

describe('CashReportComponent', () => {
  let component: CashReportComponent;
  let fixture: ComponentFixture<CashReportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CashReportComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CashReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
