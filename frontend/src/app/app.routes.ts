import type { Routes } from '@angular/router';
import { autenticadoGuard, claveAlDiaGuard, invitadoGuard, permisoGuard } from './core/guards';

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
      {
        path: '',
        pathMatch: 'full',
        title: 'Inicio - Legajos de Personal',
        loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent),
      },
      {
        path: 'workers',
        title: 'Personal - Legajos de Personal',
        canMatch: [permisoGuard('personal.ver')],
        loadComponent: () => import('./pages/workers/workers.component').then((m) => m.WorkersComponent),
      },
      {
        path: 'workers/:id',
        title: 'Legajo del trabajador - Legajos de Personal',
        canMatch: [permisoGuard('personal.ver')],
        loadComponent: () => import('./pages/worker-detail/worker-detail.component').then((m) => m.WorkerDetailComponent),
      },
      {
        path: 'profile',
        title: 'Mi perfil - Legajos de Personal',
        loadComponent: () => import('./pages/profile/profile.component').then((m) => m.ProfileComponent),
      },
      {
        path: 'users',
        title: 'Usuarios - Legajos de Personal',
        canMatch: [permisoGuard('usuarios.gestionar')],
        loadComponent: () => import('./pages/users/users.component').then((m) => m.UsersComponent),
      },
      {
        path: 'catalogs',
        title: 'Catálogos - Legajos de Personal',
        canMatch: [permisoGuard('catalogos.gestionar')],
        loadComponent: () => import('./pages/catalogs/catalogs.component').then((m) => m.CatalogsComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
