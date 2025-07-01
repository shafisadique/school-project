import { Routes } from "@angular/router";
import { MonthlyAttendanceComponent } from "./monthly-attendance/monthly-attendance.component";

export const AttendanceRoute: Routes = [
    {
        path: '',
        loadComponent: () => import('./attendance.component').then((m) => m.AttendanceComponent)
    },
    {
        path: 'monthly',
        loadComponent: () => import('./monthly-attendance/monthly-attendance.component').then((m) => m.MonthlyAttendanceComponent)
    },
];