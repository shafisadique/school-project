import { Routes } from "@angular/router";

export const teacherRoutes: Routes = [
    {
        path: '',
        redirectTo: '/teacher/teacher-details',
        pathMatch: 'full'
      },

  {path:'teacher-details',loadComponent:()=> import('./teacher-details/teacher-details.component').then((m)=> m.TeacherDetailsComponent)},
  {path:'teacher-create',loadComponent:()=> import('./teacher-create/teacher-create.component').then((m)=> m.TeacherCreateComponent)}

]