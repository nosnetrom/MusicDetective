import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppInfo } from '../app-info';

@Component({
  imports: [RouterLink],
  selector: 'app-privacy',
  // Shares the About page's styles so the two info pages look the same.
  styleUrl: '../about/about.css',
  templateUrl: './privacy.html',
})
export class Privacy {
  protected readonly title = inject(AppInfo).title;
  protected readonly author = inject(AppInfo).author;
}
