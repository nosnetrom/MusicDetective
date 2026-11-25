import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { App } from './app';

/** Stand-in for the routed pages; these tests only care about the app shell around them. */
@Component({ template: '' })
class Blank {}

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      // The template uses routerLink, which needs the router's services (e.g. ActivatedRoute).
      providers: [
        provideRouter([
          { path: '', component: Blank },
          { path: 'about', component: Blank },
        ]),
      ],
    })
      .compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Hi, I’m MusicDetective');
  });

  it('shows search results only on the home page', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    const results = () => (fixture.nativeElement as HTMLElement).querySelector('#divResults');

    await router.navigateByUrl('/');
    await fixture.whenStable();
    expect(results()).not.toBeNull();

    await router.navigateByUrl('/about');
    await fixture.whenStable();
    expect(results()).toBeNull();

    await router.navigateByUrl('/');
    await fixture.whenStable();
    expect(results()).not.toBeNull();
  });
});
