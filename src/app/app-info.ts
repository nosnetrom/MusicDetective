import { Service, signal } from '@angular/core';

const now:Date = new Date();
const thisYr:string = now.getFullYear().toString();

@Service()
export class AppInfo {
  readonly title = signal('MusicDetective');
  readonly year = signal(thisYr);
  readonly author = signal('Nosnetrom');
}
