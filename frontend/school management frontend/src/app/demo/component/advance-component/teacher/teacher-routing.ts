import { Routes } from '@angular/router';
import { AuthGuard } from 'src/app/theme/shared/guard/auth.guard';
import { TeacherApplyLeaveComponent } from './teacher-apply-leave/teacher-apply-leave.component';
import { AdminApproveLeaveComponent } from './admin-approve-leave/admin-approve-leave.component';
import { TeacherAttendanceComponent } from './teacher-attendance/teacher-attendance.component';
import { AdminTeacherAbsenceComponent } from './admin-teacher-absence/admin-teacher-absence.component';

export const teacherRoutes: Routes = [
  { path: '', redirectTo: '/teacher/teacher-details', pathMatch: 'full' },
  { path: 'teacher-details', loadComponent: () => import('./teacher-details/teacher-details.component').then(m => m.TeacherDetailsComponent) },
  { path: 'teacher-create', loadComponent: () => import('./teacher-create/teacher-create.component').then(m => m.TeacherCreateComponent) },
  { path: 'teacher-create/:teacherId', loadComponent: () => import('./teacher-create/teacher-create.component').then(m => m.TeacherCreateComponent) },
  {
    path: 'apply-leave',
    component: TeacherApplyLeaveComponent,
    canActivate: [AuthGuard],
    data: { roles: ['teacher'] }
  },
  { path: 'attendance', component: TeacherAttendanceComponent },
  { path: 'admin/teacher-absences',canActivate: [AuthGuard],
    data: { roles: ['admin'] }, component: AdminTeacherAbsenceComponent },
  {
    path: 'approve-leaves',
    component: AdminApproveLeaveComponent,
    canActivate: [AuthGuard],
    data: { roles: ['admin'] }
  }
];