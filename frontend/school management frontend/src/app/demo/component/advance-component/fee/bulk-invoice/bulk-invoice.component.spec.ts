import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BulkInvoiceComponent } from './bulk-invoice.component';

describe('BulkInvoiceComponent', () => {
  let component: BulkInvoiceComponent;
  let fixture: ComponentFixture<BulkInvoiceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BulkInvoiceComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BulkInvoiceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
