import { inject } from '@angular/core';
import type { Routes } from '@angular/router';
import { autenticadoGuard, claveAlDiaGuard, invitadoGuard, permisoGuard } from './core/guards';
import { SessionService } from './core/session.service';

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
        children: [
          {
            path: '',
            pathMatch: 'full',
            canMatch: [() => inject(SessionService).tiene('documentos.ver')],
            loadComponent: () =>
              import('./pages/worker-detail/overview/legajo-overview.component').then((m) => m.LegajoOverviewComponent),
          },
          {
            path: '',
            pathMatch: 'full',
            redirectTo: 'record',
          },
          {
            path: 'record',
            loadComponent: () => import('./pages/worker-detail/record/worker-record.component').then((m) => m.WorkerRecordComponent),
          },
          {
            path: 'missing',
            canMatch: [permisoGuard('reportes.ver')],
            loadComponent: () => import('./pages/worker-detail/missing/legajo-missing.component').then((m) => m.LegajoMissingComponent),
          },
          {
            path: 'history',
            canMatch: [permisoGuard('auditoria.ver')],
            loadComponent: () => import('./pages/worker-detail/history/legajo-history.component').then((m) => m.LegajoHistoryComponent),
          },
          {
            path: 'sections/:numero',
            canMatch: [permisoGuard('documentos.ver')],
            loadComponent: () =>
              import('./pages/worker-detail/section/legajo-section.component').then((m) => m.LegajoSectionComponent),
          },
          {
            path: '**',
            redirectTo: '',
          },
        ],
      },
      {
        path: 'bulk-upload',
        title: 'Carga masiva - Legajos de Personal',
        canMatch: [permisoGuard('carga_masiva.usar')],
        loadComponent: () => import('./pages/batches/batches.component').then((m) => m.BatchesComponent),
      },
      {
        path: 'bulk-upload/:id',
        title: 'Lote de carga - Legajos de Personal',
        canMatch: [permisoGuard('carga_masiva.usar')],
        loadComponent: () => import('./pages/batch-detail/batch-detail.component').then((m) => m.BatchDetailComponent),
      },
      {
        path: 'search',
        title: 'Búsqueda avanzada - Legajos de Personal',
        canMatch: [permisoGuard('personal.ver')],
        loadComponent: () => import('./pages/search/search.component').then((m) => m.SearchComponent),
      },
      {
        path: 'reports',
        title: 'Reportes - Legajos de Personal',
        canMatch: [permisoGuard('reportes.ver')],
        loadComponent: () => import('./pages/reports/reports.component').then((m) => m.ReportsComponent),
        children: [
          {
            path: '',
            pathMatch: 'full',
            redirectTo: 'staff',
          },
          {
            path: 'staff',
            loadComponent: () => import('./pages/reports/staff/staff-report.component').then((m) => m.StaffReportComponent),
          },
          {
            path: 'missing-summary',
            loadComponent: () =>
              import('./pages/reports/missing-summary/missing-summary-report.component').then((m) => m.MissingSummaryReportComponent),
          },
          {
            path: 'missing',
            loadComponent: () => import('./pages/reports/missing/missing-report.component').then((m) => m.MissingReportComponent),
          },
          {
            path: 'expiring',
            loadComponent: () => import('./pages/reports/expiring/expiring-report.component').then((m) => m.ExpiringReportComponent),
          },
          {
            path: 'digitization',
            loadComponent: () =>
              import('./pages/reports/digitization/digitization-report.component').then((m) => m.DigitizationReportComponent),
          },
          {
            path: 'progress',
            loadComponent: () => import('./pages/reports/progress/progress-report.component').then((m) => m.ProgressReportComponent),
          },
          {
            path: '**',
            redirectTo: 'staff',
          },
        ],
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
      {
        path: 'audit',
        title: 'Auditoría - Legajos de Personal',
        canMatch: [permisoGuard('auditoria.ver')],
        loadComponent: () => import('./pages/audit/audit.component').then((m) => m.AuditComponent),
      },
      {
        path: 'backups',
        title: 'Copias de seguridad - Legajos de Personal',
        canMatch: [permisoGuard('backup.gestionar')],
        loadComponent: () => import('./pages/backups/backups.component').then((m) => m.BackupsComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
