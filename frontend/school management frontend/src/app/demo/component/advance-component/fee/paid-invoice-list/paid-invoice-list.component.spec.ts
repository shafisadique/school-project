import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaidInvoiceListComponent } from './paid-invoice-list.component';

describe('PaidInvoiceListComponent', () => {
  let component: PaidInvoiceListComponent;
  let fixture: ComponentFixture<PaidInvoiceListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaidInvoiceListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PaidInvoiceListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
