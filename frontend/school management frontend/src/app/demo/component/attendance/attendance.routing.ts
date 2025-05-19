import { Routes } from "@angular/router";

export const AttendanceRoute: Routes = [
    {
        path: '',
        loadComponent: () => import('./attendance.component').then((m) => m.AttendanceComponent)
    }
];