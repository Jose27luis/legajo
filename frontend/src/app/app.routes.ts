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
    loadComponent: () => import('./pages/cambiar-clave/cambiar-clave.component').then((m) => m.CambiarClaveComponent),
  },
  {
    path: '',
    canMatch: [autenticadoGuard, claveAlDiaGuard],
    loadComponent: () => import('./components/marco/marco.component').then((m) => m.MarcoComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'profile' },
      {
        path: 'profile',
        title: 'Mi perfil - Legajos de Personal',
        loadComponent: () => import('./pages/perfil/perfil.component').then((m) => m.PerfilComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
