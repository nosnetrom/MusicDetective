import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DefaultContent } from './default-content';

describe('DefaultContent', () => {
  let component: DefaultContent;
  let fixture: ComponentFixture<DefaultContent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DefaultContent],
      // The template uses routerLink, which needs the router's services (e.g. ActivatedRoute).
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(DefaultContent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
