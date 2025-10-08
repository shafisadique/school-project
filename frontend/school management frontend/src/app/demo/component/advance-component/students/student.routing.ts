import { Routes } from "@angular/router";

export const studentRoutes: Routes = [
  {
    path: '',
    redirectTo: '/student/student-details',
    pathMatch: 'full'
  },
  {
    path: 'student-details',
    loadComponent: () => import('./student-details/student-details.component').then((m) => m.StudentDetailsComponent)
  },
  {
    path: 'student-create',
    loadComponent: () => import('./student-create/student-create.component').then((m) => m.StudentCreateComponent)
  },
  {
    path: 'student-update/:id',
    loadComponent: () => import('./student-update/student-update.component').then((m) => m.StudentUpdateComponent)
  },
  {
    path: 'student-promotion',
    loadComponent: () => import('./student-promotion/student-promotion.component').then((m) => m.StudentPromotionComponent)
  },
{
    path: 'student-progress-reports-weekly',
    loadComponent: () => import('./student-progress-report/student-progress-report.component').then((m) => m.StudentProgressReportComponent)
  }
];