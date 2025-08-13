import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SchoolSubscriptionManagementComponent } from './school-subscription-management.component';

describe('SchoolSubscriptionManagementComponent', () => {
  let component: SchoolSubscriptionManagementComponent;
  let fixture: ComponentFixture<SchoolSubscriptionManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SchoolSubscriptionManagementComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SchoolSubscriptionManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
