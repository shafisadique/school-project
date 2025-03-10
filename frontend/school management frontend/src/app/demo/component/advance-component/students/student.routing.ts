import { Routes } from "@angular/router";

export const studentRoutes: Routes = [
    {
        path: '',
        redirectTo: '/student/student-details',
        pathMatch: 'full'
      },

  {path:'student-details',loadComponent:()=> import('./student-details/student-details.component').then((m)=> m.StudentDetailsComponent)},
  {path:'student-create',loadComponent:()=> import('./student-create/student-create.component').then((m)=> m.StudentCreateComponent)}

]