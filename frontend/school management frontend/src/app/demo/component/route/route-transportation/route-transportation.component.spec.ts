import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RouteTransportationComponent } from './route-transportation.component';

describe('RouteTransportationComponent', () => {
  let component: RouteTransportationComponent;
  let fixture: ComponentFixture<RouteTransportationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouteTransportationComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RouteTransportationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
