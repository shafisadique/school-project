import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CombinedClassSubjectManagementComponent } from './combined-class-subject-management.component';

describe('CombinedClassSubjectManagementComponent', () => {
  let component: CombinedClassSubjectManagementComponent;
  let fixture: ComponentFixture<CombinedClassSubjectManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CombinedClassSubjectManagementComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CombinedClassSubjectManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
