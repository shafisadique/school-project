import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SchoolModifyComponent } from './school-modify.component';

describe('SchoolModifyComponent', () => {
  let component: SchoolModifyComponent;
  let fixture: ComponentFixture<SchoolModifyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SchoolModifyComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SchoolModifyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
