import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BulkInvoiceListComponent } from './bulk-invoice-list.component';

describe('BulkInvoiceListComponent', () => {
  let component: BulkInvoiceListComponent;
  let fixture: ComponentFixture<BulkInvoiceListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BulkInvoiceListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BulkInvoiceListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
