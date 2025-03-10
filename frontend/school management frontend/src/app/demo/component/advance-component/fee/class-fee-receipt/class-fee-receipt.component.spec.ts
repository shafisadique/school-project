import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClassFeeReceiptComponent } from './class-fee-receipt.component';

describe('ClassFeeReceiptComponent', () => {
  let component: ClassFeeReceiptComponent;
  let fixture: ComponentFixture<ClassFeeReceiptComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClassFeeReceiptComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClassFeeReceiptComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
