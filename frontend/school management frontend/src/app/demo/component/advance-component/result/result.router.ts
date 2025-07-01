import { Route } from "@angular/router";
import { ResultListComponent } from "./result-list/result-list.component";
import { ResultCreateComponent } from "./result-create/result-create.component";
import { AuthGuard } from "src/app/theme/shared/guard/auth.guard";

export const resultRouter :Route[]=[
{ path: 'result-list', component: ResultListComponent, canActivate: [AuthGuard], data: { roles: ['teacher', 'admin'] } },
  { path: 'create-result', component: ResultCreateComponent, canActivate: [AuthGuard], data: { roles: ['teacher', 'admin'] } }

]