import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModifyExamComponent } from './modify-exam.component';

describe('ModifyExamComponent', () => {
  let component: ModifyExamComponent;
  let fixture: ComponentFixture<ModifyExamComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModifyExamComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ModifyExamComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
