import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GenerateMonthlyInvoiceComponent } from './generate-monthly-invoice.component';

describe('GenerateMonthlyInvoiceComponent', () => {
  let component: GenerateMonthlyInvoiceComponent;
  let fixture: ComponentFixture<GenerateMonthlyInvoiceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GenerateMonthlyInvoiceComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GenerateMonthlyInvoiceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
