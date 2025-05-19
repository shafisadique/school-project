import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssignRollNumbersComponent } from './assign-roll-numbers.component';

describe('AssignRollNumbersComponent', () => {
  let component: AssignRollNumbersComponent;
  let fixture: ComponentFixture<AssignRollNumbersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssignRollNumbersComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AssignRollNumbersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
