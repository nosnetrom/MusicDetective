import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DefaultContent } from './default-content';

describe('DefaultContent', () => {
  let component: DefaultContent;
  let fixture: ComponentFixture<DefaultContent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DefaultContent],
    }).compileComponents();

    fixture = TestBed.createComponent(DefaultContent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
