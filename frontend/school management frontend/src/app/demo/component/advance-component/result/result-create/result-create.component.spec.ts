import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResultCreateComponent } from './result-create.component';

describe('ResultCreateComponent', () => {
  let component: ResultCreateComponent;
  let fixture: ComponentFixture<ResultCreateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResultCreateComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ResultCreateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
