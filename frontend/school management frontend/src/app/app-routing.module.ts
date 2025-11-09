// angular import
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

// Project import
import { AdminComponent } from './theme/layouts/admin-layout/admin-layout.component';
import { GuestLayoutComponent } from './theme/layouts/guest-layout/guest-layout.component';
import { AuthGuard } from './theme/shared/guard/auth.guard';
import { PageNotFoundComponent } from './theme/shared/page-not-found/page-not-found.component';
import { ReportsComponent } from './demo/component/advance-component/reports/reports/reports.component';
import { ConfirmationComponent } from './demo/pages/authentication/auth-register/confirmation.component';

export const routes: Routes = [
  {
    path: 'auth/login',
    loadComponent: () => import('./demo/pages/authentication/auth-login/auth-login.component').then((c) => c.AuthLoginComponent)
  },
  // {
  //   path: 'auth/register',data: { roles: ['superadmin'] },canActivate:[AuthGuard],
  //   loadComponent: () => import('./demo/pages/authentication/auth-register/auth-register.component').then((c) => c.AuthRegisterComponent)
  // },
  {
    path: 'auth/forgot-password',
    loadComponent: () => import('./authentication/forgot-password/forgot-password.component').then((c) => c.ForgotPasswordComponent)
  },
  {
    path: 'auth/reset-password',
    loadComponent: () => import('./authentication/reset-password/reset-password.component').then((c) => c.ResetPasswordComponent)
  },
  {
    path: 'settings/change-password',
    loadComponent: () => import('./authentication/change-password/change-password.component').then((c) => c.ChangePasswordComponent), canActivate:[AuthGuard]
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
        path: 'teacher-dashboard',
        canActivate:[AuthGuard],
        loadComponent: () => import('./demo/dashboard/teacher-dashboard/teacher-dashboard/teacher-dashboard.component').then((c) => c.TeacherDashboardComponent)
      },
      {
        path: 'subscription-management',data: { roles: ['superadmin'] },
        canActivate: [AuthGuard],
        loadComponent: () => import('./demo/component/subscription-management/subscription-management/subscription-management.component').then(c => c.SubscriptionManagementComponent)
      },
      {
        path:'route',
        canActivate:[AuthGuard],
        loadChildren:()=>import('./demo/component/route/route-routing').then((c)=>c.RouteRoutes)
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
    { path: 'confirmation', component: ConfirmationComponent },
      {
        path: 'academic-year',
        canActivate:[AuthGuard],
        loadChildren: () => import('./demo/component/advance-component/academic-year/academic-year.routing').then((c) => c.academicYearRouter)
      },
      {
        path: 'class-&-subject-management',
        canActivate:[AuthGuard],data: { roles: ['admin'] },
        loadChildren: () => import('./demo/component/advance-component/class-subject-management/class-subject.routing').then((c) => c.classSubjectManagementRoute)
      },
      {
        path: 'exams-&-progress',
        canActivate:[AuthGuard],
        loadChildren: () => import('./demo/component/advance-component/exam/exam-routing').then((c) => c.ExamRoutes)
      },
      {
        path: 'result',
        canActivate:[AuthGuard],
        loadChildren: () => import('./demo/component/advance-component/result/result.router').then((c) => c.resultRouter)
      },
      {
        path: 'announcement',
        canActivate:[AuthGuard],
        loadComponent: () => import('./demo/component/advance-component/announcement-create/announcement-create.component').then((c) => c.AnnouncementCreateComponent)
      },
      {
        path: 'admin/reports',
        component: ReportsComponent,
        canActivate: [AuthGuard], // Your existing guard
        data: { roles: ['admin'] } // Admin only
      },
      {
        path: 'settings/profile',
        loadComponent: () => import('./authentication/profile/profile.component').then((c) => c.ProfileComponent), canActivate:[AuthGuard]
      },
      {
        path: 'holiday-calendar',
        canActivate: [AuthGuard],data: { roles: ['admin'] },
        loadComponent: () => import('./demo/component/advance-component/holidays/holiday-calendar/holiday-calendar.component').then(c => c.HolidayCalendarComponent)
      },
      {
        path: 'assignment-details', // Define the assignment route
        canActivate: [AuthGuard],
        loadComponent: () => import('./demo/component/advance-component/assignment-management/assignment-details/assignment-details.component').then(c => c.AssignmentDetailsComponent)
      },
     {
    path: 'student-assignments-list',
    canActivate: [AuthGuard],
    data: { roles: ['student'] },
    loadComponent: () =>
      import('./demo/component/advance-component/assignment-management/student-assignments-list/student-assignments-list.component')
        .then(c => c.StudentAssignmentsListComponent)
  },

  // ── STUDENT ASSIGNMENT DETAILS (with :id) ────────
  {
    path: 'my-assignment-details/:id',
    canActivate: [AuthGuard],
    data: { roles: ['student'] },
    loadComponent: () =>
      import('./demo/component/advance-component/assignment-management/student-assignment-details/student-assignment-details.component')
        .then(c => c.StudentAssignmentDetailsComponent)
  },

      {
        path: 'my-assignment/:id', // Define the assignment route
        canActivate: [AuthGuard],
        loadComponent: () => import('./demo/component/advance-component/assignment-management/assignment-details/assignment-details.component').then(c => c.AssignmentDetailsComponent)
      },
      {
            path: 'assignment-create', // Define the assignment route
            canActivate: [AuthGuard],
            loadComponent: () => import('./demo/component/advance-component/assignment-management/assignment-create/assignment-create.component').then(c => c.AssignmentCreateComponent)
          }
    ]
  },
  {
    path: '',
    component: GuestLayoutComponent,
    children: []
  },
  { path: '**', component: PageNotFoundComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
