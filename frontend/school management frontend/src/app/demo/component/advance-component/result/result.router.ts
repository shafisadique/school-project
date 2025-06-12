import { Route } from "@angular/router";
import { ResultListComponent } from "./result-list/result-list.component";
import { ResultCreateComponent } from "./result-create/result-create.component";

export const resultRouter :Route[]=[
 {path:'result-list',component:ResultListComponent} ,
 {path:'create-result',component:ResultCreateComponent} ,

]