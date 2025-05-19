import {  Routes } from "@angular/router";


export const academicYearRouter:Routes =[
    {
        path: 'details',
        loadComponent: () => import('./academic-year/academic-year.component').then((c) => c.AcademicYearComponent)
      },
]