import type { Routes } from '@angular/router';
import { autenticadoGuard, claveAlDiaGuard, invitadoGuard } from './core/guards';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Iniciar sesión - Legajos de Personal',
    canMatch: [invitadoGuard],
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'change-password',
    title: 'Crea tu contraseña - Legajos de Personal',
    canMatch: [autenticadoGuard],
    loadComponent: () => import('./pages/change-password/change-password.component').then((m) => m.ChangePasswordComponent),
  },
  {
    path: '',
    canMatch: [autenticadoGuard, claveAlDiaGuard],
    loadComponent: () => import('./components/layout/layout.component').then((m) => m.LayoutComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'profile' },
      {
        path: 'profile',
        title: 'Mi perfil - Legajos de Personal',
        loadComponent: () => import('./pages/profile/profile.component').then((m) => m.ProfileComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
