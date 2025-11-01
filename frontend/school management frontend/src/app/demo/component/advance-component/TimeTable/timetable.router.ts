import { Routes } from "@angular/router";

export const timeTableRoutes: Routes = [
    {path:'time-table-details',loadComponent:()=> import('./timetable/timetable.component').then((m)=> m.TimetableComponent)},
{
  path: 'my-timetable',
  loadComponent: () => import('./student-timetable/student-timetable.component')
    .then(m => m.StudentTimetableComponent)
}
]
