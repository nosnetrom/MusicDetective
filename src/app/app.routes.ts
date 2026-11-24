import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { AppInfo } from './app-info';

export const routes: Routes = [
    {
        path: 'about',
        loadComponent: () => import('./about/about').then(m => m.About),
        title: () => `About ${inject(AppInfo).title()}`,
    },
    {
        path: 'privacy',
        loadComponent: () => import('./privacy/privacy').then(m => m.Privacy),
        title: () => `${inject(AppInfo).title()}: Privacy & Legal`,
    },
    {
        // Paths are relative to their parent, so the home page is '' (never '/').
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./default-content/default-content').then(m => m.DefaultContent),
        title: () => `${inject(AppInfo).title()}: Home`
    },
    {
        // '**' matches any URL not matched above. Keep it last: the router uses the first match.
        path: '**',
        loadComponent: () => import('./page-not-found/page-not-found').then(m => m.PageNotFound),
        title: 'Page Not Found'
    }
];
