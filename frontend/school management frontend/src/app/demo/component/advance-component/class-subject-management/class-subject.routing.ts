
import { Routes } from "@angular/router";

export const classSubjectManagementRoute:Routes = [
    {path:'',loadComponent:()=> import('./class-subject/class-subject.component').then((m)=> m.ClassSubjectComponent)},
    {path:'combined-class-and-subject',loadComponent:()=>import('./combined-class-subject-management/combined-class-subject-management.component').then((m)=>m.CombinedClassSubjectManagementComponent)}
]