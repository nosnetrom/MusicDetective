import { Component, inject, signal } from '@angular/core';
import { AppInfo } from '../app-info';

@Component({
  imports: [],
  selector: 'app-footer',
  styleUrl: './footer.css',
  templateUrl: './footer.html',
})
export class Footer {
  protected readonly title = inject(AppInfo).title;
  protected readonly year = inject(AppInfo).year;
  protected readonly author = inject(AppInfo).author; 
}
