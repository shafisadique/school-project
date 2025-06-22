import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FeeBulkInvoiceComponent } from './fee-bulk-invoice.component';

describe('FeeBulkInvoiceComponent', () => {
  let component: FeeBulkInvoiceComponent;
  let fixture: ComponentFixture<FeeBulkInvoiceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeeBulkInvoiceComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FeeBulkInvoiceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
