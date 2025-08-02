import { Component, OnInit } from '@angular/core';
import { TeacherService } from '../teacher.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-teacher-details',
  imports: [CommonModule],
  templateUrl: './teacher-details.component.html',
  styleUrls: ['./teacher-details.component.scss']
})
export class TeacherDetailsComponent implements OnInit {
  teachers: any[] = [];
  backendUrl = 'http://localhost:5000';

  constructor(private teacherService: TeacherService) {}

  ngOnInit(): void {
    this.loadTeachers();
  }

  loadTeachers() {
    this.teacherService.getTeachersBySchool().subscribe({
      next: (teachers: any) => {
        this.teachers = teachers.data.filter((t: any) => t.status); // Show only active teachers
      },
      error: (err) => {
        console.error('Error loading teachers:', err);
      }
    });
  }

  getImageUrl(profileImage: string): string {
    return profileImage ? `${this.backendUrl}/uploads/${profileImage}` : 'assets/default-avatar.png';
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
    // Navigate to teacher-create component with teacherId as param
    // Example: this.router.navigate(['/teacher-create', teacherId]);
    console.log('Edit teacher:', teacherId);
  }

  

  deleteTeacher(teacherId: string) {
    if (confirm('Are you sure you want to soft delete this teacher?')) {
      this.teacherService.deleteTeacher(teacherId).subscribe({
        next: () => {
          this.loadTeachers();
        },
        error: (err) => console.error('Error deleting teacher:', err)
      });
    }
  }
}