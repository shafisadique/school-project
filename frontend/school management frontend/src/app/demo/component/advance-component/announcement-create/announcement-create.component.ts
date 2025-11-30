import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { environment } from 'src/environments/environment';
import { AnnouncementService } from './announcement.service';

interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
}

@Component({
  selector: 'app-announcement-create',
  standalone: true,
  imports: [RouterModule, ReactiveFormsModule, CommonModule],
  templateUrl: './announcement-create.component.html',
  styleUrls: ['./announcement-create.component.scss']
})
export class AnnouncementCreateComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private toastr = inject(ToastrService);
  private router = inject(Router);
  private http = inject(HttpClient);
  private announcementService = inject(AnnouncementService);
  form: FormGroup = this.fb.group({
    title: ['', [Validators.required]],
    body: ['', [Validators.required]]
  });

  schoolId = this.authService.getUserSchoolId();
  loading = false;
  activeToggle = ''; // 'teacher', 'student', 'parent'
  users: User[] = []; // Loaded list
  selectedUsers: string[] = []; // Selected IDs

  toggles = [
    { key: 'teacher', label: 'Teachers' },
    { key: 'student', label: 'Students' },
    { key: 'parent', label: 'Parents' }
  ];

  onToggleChange(key: string) {
    if (this.activeToggle === key) {
      this.activeToggle = '';
      this.users = [];
      this.selectedUsers = [];
      return;
    }
    this.activeToggle = key;
    this.loadUsers(key);
  }

  loadUsers(key: string) {
    this.loading = true;
    this.selectedUsers = []; // Reset
    let url = `${environment.apiUrl}/api/${key}s/list?all=true&schoolId=${this.schoolId}`;
    if (key === 'parent') url = `${environment.apiUrl}/api/students/list?all=true&schoolId=${this.schoolId}`; // Use students for parents

    this.http.get<any>(url).subscribe({
      next: (res) => {
        if (key === 'parent') {
          // Extract parents from students
          this.users = res.students.map((s: any) => ({
            _id: s._id, // Use student ID for selection
            name: `Parent of ${s.name}`,
            email: s.email,
            phone: s.parents?.fatherPhone || s.parents?.motherPhone
          })).filter((u: User) => u.phone); // Only with phone
        } else if (key === 'teacher') {
          this.users = res.data.map((t: any) => ({
            _id: t.userId._id,        // ← SEND USER ID!
            name: t.name,
            email: t.email,
            phone: t.phone
          }));
        }else {
          this.users = res.students || res.data || []; // Handle both keys
        }
        this.loading = false; // Stop loading
      },
      error: (err) => {
        this.toastr.error('Load failed');
        this.loading = false; // Stop loading on error
      }
    });
  }

  selectAll(event: any) {
    const checked = event.target.checked;
    this.users.forEach(user => {
      if (checked) {
        if (!this.selectedUsers.includes(user._id)) this.selectedUsers.push(user._id);
      } else {
        const index = this.selectedUsers.indexOf(user._id);
        if (index > -1) this.selectedUsers.splice(index, 1);
      }
    });
  }

  onUserToggle(userId: string, event: any) {
    const checked = event.target.checked;
    if (checked) {
      if (!this.selectedUsers.includes(userId)) this.selectedUsers.push(userId);
    } else {
      const index = this.selectedUsers.indexOf(userId);
      if (index > -1) this.selectedUsers.splice(index, 1);
    }
  }

  isUserSelected(userId: string): boolean {
    return this.selectedUsers.includes(userId);
  }

  isAllSelected(): boolean {
    return this.users.length > 0 && this.selectedUsers.length === this.users.length;
  }

  getSelectedCount(): number {
    return this.selectedUsers.length;
  }

  onSubmit() {
    if (this.form.invalid || this.selectedUsers.length === 0) {
      this.toastr.warning('Fill form and select users');
      return;
    }
    this.loading = true;
    const payload = {
      ...this.form.value,
      body: this.form.value.body,
      // schoolId: this.schoolId,
      // targetUsers: this.selectedUsers
    };

    if (this.activeToggle) {
    payload.targetRoles = [this.activeToggle]; // "teacher", "student", "parent"
  }

  // YE PEHLE SE HAI — USER IDS BHEJEGA
  if (this.selectedUsers.length > 0) {
    payload.targetUsers = this.selectedUsers;
  }

  console.log('FINAL PAYLOAD →', payload);
    this.announcementService.create(payload).subscribe({
      next: () => {
        this.toastr.success(`Sent to ${this.selectedUsers.length} users!`);
        this.router.navigate(['/announcement']);
      },
      error: (err) => this.toastr.error('Failed'),
      complete: () => this.loading = false
    });
  }

  get f() { return this.form.controls; }
}