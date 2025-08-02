import { Route } from "@angular/router";
import { ResultListComponent } from "./result-list/result-list.component";
import { AuthGuard } from "src/app/theme/shared/guard/auth.guard";
import { TeacherResultEntryComponent } from "./teacher-result-entry/teacher-result-entry.component";
import { AdminResultsComponent } from "./admin-results/admin-results.component";

export const resultRouter :Route[]=[
{ path: 'result-list', component: ResultListComponent, canActivate: [AuthGuard], data: { roles: ['teacher', 'admin'] } },
{ 
    path: 'admin-results', 
    component: AdminResultsComponent, 
    canActivate: [AuthGuard], 
    data: { roles: ['admin'] } 
  },
{ path: 'create-result', component: TeacherResultEntryComponent, canActivate: [AuthGuard], data: { roles: ['teacher', 'admin'] } }

]