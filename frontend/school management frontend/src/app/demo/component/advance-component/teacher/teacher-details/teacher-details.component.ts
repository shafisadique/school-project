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
  backendUrl = 'http://localhost:5000'; // Base URL for proxy or local fallback

  constructor(private teacherService: TeacherService, private router: Router) {}

  ngOnInit(): void {
    this.loadTeachers();
  }

  loadTeachers() {
    this.teacherService.getTeachersBySchool().subscribe({
      next: (response: any) => {
        this.teachers = response.data.filter((t: any) => t.status); // Show only active teachers
        console.log('Loaded Teachers with profileImage:', this.teachers.map(t => ({ name: t.name, profileImage: t.profileImage }))); // Debug log
      },
      error: (err) => {
        console.error('Error loading teachers:', err);
      }
    });
  }
getImageUrl(profileImage: string): string {
  console.log('Profile Image:', profileImage);
  if (!profileImage || profileImage.trim() === '') {
    console.log('No profile image, using default');
    return 'assets/default-avatar.png';
  }

  const bucketName = 'school-bucket'; // Matches R2_BUCKET_NAME
  let key = '';

  if (profileImage.includes('r2.cloudflarestorage.com')) {
    const urlParts = profileImage.split(`/${bucketName}/`);
    console.log('URL Parts:', urlParts);
    if (urlParts.length > 1) {
      key = urlParts[1]; // e.g., 'teachers/1755961433261-teacher.png'
    }
  } else if (profileImage.startsWith('teachers/')) {
    key = profileImage; // Handle relative paths like 'teachers/1754664158015.png'
  } else {
    console.log('Invalid URL format, using default');
    return 'assets/default-avatar.png';
  }

  const proxyUrl = `${this.backendUrl}/api/proxy-image/${key}`;
  console.log('Proxy URL:', proxyUrl);
  return proxyUrl;
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
    console.log('Image load error for:', img.alt, 'URL:', img.src); // Enhanced debug log
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
          alert('Failed to delete teacher. Please try again or contact support.');
        }
      });
    }
  }
}