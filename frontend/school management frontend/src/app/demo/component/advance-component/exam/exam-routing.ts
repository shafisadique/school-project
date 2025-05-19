import { Routes } from "@angular/router";
import { ExamListComponent } from "./exam-list/exam-list.component";
import { CreateExamComponent } from "./create-exam/create-exam.component";

export const ExamRoutes: Routes = [
  {path:'',component:ExamListComponent},
  {path:'create-exam',component:CreateExamComponent}

]