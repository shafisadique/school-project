import { Routes } from "@angular/router";



export const feeRoutes: Routes = [
    {path:'fee-structure',loadComponent:()=> import('./fee-structure/fee-structure.component').then((m)=> m.FeeStructureComponent)},
    {path:'pay-student-fee',loadComponent:()=>import('./fee-payment/fee-payment.component').then((m)=>m.FeePaymentComponent)},
    {path:'bulk-generate-invoice',loadComponent:()=>import('./bulk-invoice/bulk-invoice.component').then((m)=>m.BulkInvoiceComponent)},
    {path:'bulk-invoice-list',loadComponent:()=>import('./bulk-invoice-list/bulk-invoice-list.component').then((m)=>m.BulkInvoiceListComponent)},
    {path:'fee-receipt',loadComponent:()=>import('./class-fee-receipt/class-fee-receipt.component').then((m)=>m.ClassFeeReceiptComponent)},
    {path:'notify-parents',loadComponent:()=>import('./fee-payment/fee-payment.component').then((m)=>m.FeePaymentComponent)}
]