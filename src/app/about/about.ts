import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppInfo } from '../app-info';

@Component({
  imports: [RouterLink],
  selector: 'app-about',
  styleUrl: './about.css',
  templateUrl: './about.html',
})
export class About {
  protected readonly title = inject(AppInfo).title;
}
