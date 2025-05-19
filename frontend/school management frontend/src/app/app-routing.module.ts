// angular import
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

// Project import
import { AdminComponent } from './theme/layouts/admin-layout/admin-layout.component';
import { GuestLayoutComponent } from './theme/layouts/guest-layout/guest-layout.component';
import { AuthGuard } from './theme/shared/guard/auth.guard';

export const routes: Routes = [
  {
    path: 'auth/login',
    loadComponent: () => import('./demo/pages/authentication/auth-login/auth-login.component').then((c) => c.AuthLoginComponent)
  },
  {
    path: 'auth/register',
    loadComponent: () => import('./demo/pages/authentication/auth-register/auth-register.component').then((c) => c.AuthRegisterComponent)
  },

  
  {
    path: '',
    component: AdminComponent,
    children: [
      {
        path: '',
        redirectTo: '/dashboard/default',
        pathMatch: 'full'
      },
      {
        path: 'dashboard/default',
        canActivate:[AuthGuard],
        loadComponent: () => import('./demo/dashboard/default/default.component').then((c) => c.DefaultComponent)
      },
      {
        path: 'teacher',
        canActivate:[AuthGuard],
        loadChildren: () => import('./demo/component/advance-component/teacher/teacher-routing').then((c) => c.teacherRoutes)
      },
      {
        path: 'student',
        canActivate:[AuthGuard],
        loadChildren: () => import('./demo/component/advance-component/students/student.routing').then((c) => c.studentRoutes)
      },

      {
        path: 'fee',
        canActivate:[AuthGuard],
        loadChildren: () => import('./demo/component/advance-component/fee/fee-routing').then((c) => c.feeRoutes)
      },
      {
        path: 'school',
        canActivate:[AuthGuard],
        loadChildren: () => import('./demo/component/advance-component/school/school-routing').then((c) => c.schoolRoute)
      },
      {
        path: 'time-table',
        canActivate:[AuthGuard],
        loadChildren: () => import('./demo/component/advance-component/TimeTable/timetable.router').then((c) => c.timeTableRoutes)
      },
      {
        path: 'attendance',
        canActivate: [AuthGuard],
        loadChildren: () => import('./demo/component/attendance/attendance.routing').then((c) => c.AttendanceRoute )
    },
      {
        path: 'academic-year',
        canActivate:[AuthGuard],
        loadChildren: () => import('./demo/component/advance-component/academic-year/academic-year.routing').then((c) => c.academicYearRouter)
      },
      {
        path: 'class-&-subject-management',
        canActivate:[AuthGuard],
        loadChildren: () => import('./demo/component/advance-component/class-subject-management/class-subject.routing').then((c) => c.classSubjectManagementRoute)
      },
      // {
      //   path: 'exams-&-progress',
      //   canActivate:[AuthGuard],
      //   loadChildren: () => import('./demo/component/advance-component/ex').then((c) => c.classSubjectManagementRoute)
      // },
    ]
  },
  {
    path: '',
    component: GuestLayoutComponent,
    children: [
      // {
      //   path: 'login',
      //   loadComponent: () => import('./demo/pages/authentication/auth-login/auth-login.component').then((c) => c.AuthLoginComponent)
      // },
      // {
      //   path: 'register',
      //   loadComponent: () =>
      //     import('./demo/pages/authentication/auth-register/auth-register.component').then((c) => c.AuthRegisterComponent)
      // }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
