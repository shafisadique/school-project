// import { Component, OnInit } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { FormsModule } from '@angular/forms';
// import { ToastrService } from 'ngx-toastr';
// import { Router } from '@angular/router';
// import { SubscriptionService } from '../subscription.service';

// @Component({
//   selector: 'app-school-subscription-management',
//   standalone: true,
//   imports: [CommonModule, FormsModule],
//   templateUrl: './school-subscription-management.component.html',
//   styleUrls: ['./school-subscription-management.component.scss']
// })
// export class SchoolSubscriptionManagementComponent implements OnInit {
//   requestForm = {
//     name: '',
//     address: '',
//     adminEmail: '',
//     adminName: ''
//   };
//   approveForm = {
//     pendingSchoolId: '',
//     planType: 'trial'
//   };
//   pendingSchools: any[] = [];
//   isLoading: boolean = false;
//   error: string = '';

//   constructor(
//     private subscriptionService: SubscriptionService,
//     private toastr: ToastrService,
//     private router: Router
//   ) {}

//   ngOnInit() {
//     this.loadPendingSchools();
//   }

//   loadPendingSchools() {
//     this.isLoading = true;
//     this.subscriptionService.getPendingSchools().subscribe({
//       next: (data) => {
//         this.pendingSchools = data.filter((school: any) => school.status === 'pending');
//         this.isLoading = false;
//       },
//       error: (err) => {
//         this.error = err.error?.message || 'Failed to load pending schools';
//         this.toastr.error(this.error);
//         this.isLoading = false;
//       }
//     });
//   }

//   requestSchool() {
//     if (!this.requestForm.name || !this.requestForm.address || !this.requestForm.adminEmail || !this.requestForm.adminName) {
//       this.toastr.error('All fields are required');
//       return;
//     }

//     this.isLoading = true;
//     this.subscriptionService.requestSchool(this.requestForm).subscribe({
//       next: (res: any) => {
//         this.toastr.success(res.message);
//         this.requestForm = { name: '', address: '', adminEmail: '', adminName: '' }; // Reset form
//         this.loadPendingSchools(); // Refresh list
//         this.isLoading = false;
//       },
//       error: (err) => {
//         this.error = err.error?.message || 'Failed to request school';
//         this.toastr.error(this.error);
//         this.isLoading = false;
//       }
//     });
//   }

//   approveSchoolRequest() {
//     if (!this.approveForm.pendingSchoolId || !this.approveForm.planType) {
//       this.toastr.error('Pending School ID and Plan Type are required');
//       return;
//     }

//     this.isLoading = true;
//     this.subscriptionService.approveSchoolRequest(this.approveForm).subscribe({
//       next: (res: any) => {
//         this.toastr.success(res.message);
//         this.approveForm.pendingSchoolId = ''; // Reset pendingSchoolId
//         this.loadPendingSchools(); // Refresh list
//         this.isLoading = false;
//       },
//       error: (err) => {
//         this.error = err.error?.message || 'Failed to approve school request';
//         this.toastr.error(this.error);
//         this.isLoading = false;
//       }
//     });
//   }
// }