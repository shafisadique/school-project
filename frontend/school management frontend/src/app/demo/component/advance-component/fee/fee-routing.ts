import { Routes } from "@angular/router";
import { PaidInvoiceListComponent } from "./paid-invoice-list/paid-invoice-list.component";

export const feeRoutes: Routes = [
    {path:'fee-structure',loadComponent:()=> import('./fee-structure/fee-structure.component').then((m)=> m.FeeStructureComponent)},
    {path:'pay-student-fee',loadComponent:()=>import('./fee-payment/fee-payment.component').then((m)=>m.FeePaymentComponent)},
    {path:'bulk-generate-invoice',loadComponent:()=>import('./bulk-invoice/bulk-invoice.component').then((m)=>m.BulkInvoiceComponent)},
    {path:'bulk-invoice-list',loadComponent:()=>import('./bulk-invoice-list/bulk-invoice-list.component').then((m)=>m.BulkInvoiceListComponent)},
    {path:'payment/:invoiceId', loadComponent: () => import('./fee-payment/fee-payment.component').then((m) => m.FeePaymentComponent) },
    {path:'fee-collection-reports', loadComponent: () => import('./cash-report/cash-report.component').then((m) => m.CashReportComponent) },
    {path:'fee-receipt',loadComponent:()=>import('./class-fee-receipt/class-fee-receipt.component').then((m)=>m.ClassFeeReceiptComponent)},
    // {path:'feebulk', loadComponent: () => import('./fee-bulk-invoice/fee-bulk-invoice.component').then((m) => m.FeeBulkInvoiceComponent) },
    // {path:'paid-invoice-list', component: PaidInvoiceListComponent },

]