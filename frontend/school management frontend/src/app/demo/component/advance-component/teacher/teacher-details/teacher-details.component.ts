import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, forkJoin } from 'rxjs'; // Import Subscription and forkJoin
import { Teacher } from '../teacher.interface';
import { TeacherService } from '../teacher.service';
import { ToastrService } from 'ngx-toastr';
import { takeUntil } from 'rxjs/operators';

@Component({
 selector: 'app-teacher-details',
 imports: [CommonModule, FormsModule],
 templateUrl: './teacher-details.component.html',
 styleUrls: ['./teacher-details.component.scss'],
 standalone: true
})
export class TeacherDetailsComponent implements OnInit, OnDestroy {
 teachers: Teacher[] = [];
 selectedTeaches: Teacher[] = [];
 searchQuery = '';
private destroy$ = new Subject<void>();
 constructor(private teacherService: TeacherService, private router: Router, private toastr: ToastrService) {}

 ngOnInit(): void {
  this.loadTeachers();
 }

 ngOnDestroy(): void {
  this.destroy$.next();
  this.destroy$.complete();
 }

 loadTeachers() {
  this.teacherService.getTeachersBySchool().pipe(takeUntil(this.destroy$)).subscribe({
   next: (response: any) => {
    this.teachers = response.data;
    this.selectedTeaches = []; // Clear selection on load
   },
   error: (err) => {
    console.error('Error loading teachers:', err);
   }
  });
 }
 
 // Checkbox Selection Logic
 isTeacherSelected(teacher: Teacher): boolean {
  return this.selectedTeaches.some(t => t._id === teacher._id);
 }

 toggleTeacherSelection(teacher: Teacher, event: Event): void {
  const isChecked = (event.target as HTMLInputElement).checked;
  if (isChecked) {
   this.selectedTeaches.push(teacher);
  } else {
   this.selectedTeaches = this.selectedTeaches.filter(t => t._id !== teacher._id);
  }
 }

 isAllSelected(): boolean {
  return this.teachers.length > 0 && this.teachers.length === this.selectedTeaches.length;
 }

 toggleAllSelection(event: Event): void {
  const isChecked = (event.target as HTMLInputElement).checked;
  if (isChecked) {
   this.selectedTeaches = [...this.teachers];
  } else {
   this.selectedTeaches = [];
  }
 }

   getImageUrl(profileImage: string):any {
    if (!profileImage || profileImage.trim() === '') {
      return 'assets/avtart-new.png';
    }
     if (profileImage.startsWith('http')) {
    return profileImage;

  }
    const backendUrl = 'https://school-management-backend-khaki.vercel.app'; // Your backend URL
  return `${backendUrl}/api/proxy-image/${encodeURIComponent(profileImage)}`;
  }

 onUpdateTeacher(): void {
  if (this.selectedTeaches.length === 1) {
   const teacherId = this.selectedTeaches[0]._id;
   this.router.navigate(['/teacher/teacher-update', teacherId]);
  }
 }
 
 onDeleteTeacher(): void {
  if (this.selectedTeaches.length === 0) {
   return;
  }
 
  if (confirm('Are you sure you want to soft delete the selected teacher(s)?')) {
   const deleteRequests = this.selectedTeaches.map(teacher => 
    this.teacherService.deleteTeacher(teacher._id)
   );
 
   forkJoin(deleteRequests).subscribe({
    next: () => {
     this.toastr.success('Selected teacher(s) deleted successfully!', 'Success');
     this.loadTeachers();
    },
    error: (err) => {
     console.error('Error deleting teacher(s):', err);
     this.toastr.error('Failed to delete one or more teachers. Please try again.', 'Error');
    }
   });
  }
 }

 downloadExcel(): void {}
 onSearch(): void {}

 getInitials(name: string): string {
  return name.split(' ').map(part => part[0]).join('').toUpperCase().substring(0, 2);
 }

 handleImageError(event: Event) {
  const img = event.target as HTMLImageElement;
  img.style.display = 'none';
  const container = img.parentElement;
  if (container) {
   container.querySelector('.avatar-placeholder')?.classList.remove('d-none');
  }
 }

 createTeacher(): void {
   this.router.navigate(['/teacher/teacher-create']);
  }
}