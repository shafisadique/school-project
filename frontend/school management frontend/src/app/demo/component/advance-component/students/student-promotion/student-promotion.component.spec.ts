import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StudentPromotionComponent } from './student-promotion.component';

describe('StudentPromotionComponent', () => {
  let component: StudentPromotionComponent;
  let fixture: ComponentFixture<StudentPromotionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentPromotionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StudentPromotionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
