import {  Routes } from "@angular/router";


export const schoolRoute:Routes=[
    {path:'school-modify',loadComponent:()=> import('./school-modify/school-modify.component').then((m)=> m.SchoolModifyComponent)},

]