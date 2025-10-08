
import { Routes } from "@angular/router";
import { AssignRollNumbersComponent } from "../assign-roll-numbers/assign-roll-numbers.component";

export const classSubjectManagementRoute:Routes = [
    {path:'list',loadComponent:()=> import('./class-subject/class-subject.component').then((m)=> m.ClassSubjectComponent)},
    {path:'combined-class-and-subject',loadComponent:()=>import('./combined-class-subject-management/combined-class-subject-management.component').then((m)=>m.CombinedClassSubjectManagementComponent)},
    { path: 'assign-roll-numbers', component: AssignRollNumbersComponent },
]