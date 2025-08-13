import { Component, OnInit } from '@angular/core';
import { TeacherService } from '../teacher.service';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-teacher-details',
  imports: [CommonModule],
  templateUrl: './teacher-details.component.html',
  styleUrls: ['./teacher-details.component.scss'],
  standalone: true
})
export class TeacherDetailsComponent implements OnInit {
  teachers: any[] = [];
  backendUrl = 'http://localhost:5000';

  constructor(private teacherService: TeacherService, private router: Router) {}

  ngOnInit(): void {
    this.loadTeachers();
  }

  loadTeachers() {
    this.teacherService.getTeachersBySchool().subscribe({
      next: (response: any) => {
        this.teachers = response.data.filter((t: any) => t.status); // Show only active teachers
      },
      error: (err) => {
        console.error('Error loading teachers:', err);
      }
    });
  }

   getImageUrl(profileImage: string): string {
    if (!profileImage) return 'assets/default-avatar.png';
    const cleanPath = profileImage.replace(/^.*[\\\/]uploads[\\\/]/, '');
    return `${this.backendUrl}/uploads/${cleanPath}`;
  }

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

  editTeacher(teacherId: string) {
    this.router.navigate([`teacher/teacher-update/${teacherId}`]);
  }

 deleteTeacher(teacherId: string) {
  if (confirm('Are you sure you want to soft delete this teacher?')) {
    this.teacherService.deleteTeacher(teacherId).subscribe({
      next: () => {
        this.loadTeachers(); // Reload the list
      },
      error: (err) => {
        console.error('Error deleting teacher:', err);
        // Optionally show a user-friendly message
        alert('Failed to delete teacher. Please try again or contact support.');
      }
    });
  }
}
}