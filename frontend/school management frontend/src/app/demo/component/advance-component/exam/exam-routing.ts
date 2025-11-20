  import { Routes } from "@angular/router";
  import { ExamListComponent } from "./exam-list/exam-list.component";
  import { CreateExamComponent } from "./create-exam/create-exam.component";
  import { AuthGuard } from "src/app/theme/shared/guard/auth.guard";
  import { ModifyExamComponent } from "./modify-exam/modify-exam.component";
import { CanCreateExamGuard } from "src/app/theme/shared/guard/can-create-exam.guard";

  export const ExamRoutes: Routes = [
    { path:'exam-list',component:ExamListComponent},
    { path:'create-exam',component:CreateExamComponent,canActivate: [AuthGuard,CanCreateExamGuard], data: { roles: ['admin'] }},
    { path: 'edit-exam/:examId', component: ModifyExamComponent, canActivate: [AuthGuard,CanCreateExamGuard], data: { roles: ['admin'] } } // New route
  ]