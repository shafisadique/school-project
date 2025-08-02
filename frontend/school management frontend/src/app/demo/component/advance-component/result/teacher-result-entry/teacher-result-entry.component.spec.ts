import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeacherResultEntryComponent } from './teacher-result-entry.component';

describe('TeacherResultEntryComponent', () => {
  let component: TeacherResultEntryComponent;
  let fixture: ComponentFixture<TeacherResultEntryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeacherResultEntryComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TeacherResultEntryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
