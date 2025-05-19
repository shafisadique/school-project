import { Component, OnInit } from '@angular/core';
import { TeacherService } from '../teacher.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-teacher-details',
  imports: [CommonModule],
  templateUrl: './teacher-details.component.html',
  styleUrl: './teacher-details.component.scss'
})
export class TeacherDetailsComponent implements OnInit{
  teachers: any[] = [];
  backendUrl = 'http://localhost:5000'; // ✅ Ensure correct backend URL

  constructor(private teacherService: TeacherService) {}

  ngOnInit(): void {
    this.loadTeachers();
  }

  loadTeachers() {
    this.teacherService.getTeachersBySchool().subscribe({
      next: (teachers: any) => {
        console.log(teachers);
        this.teachers = teachers.data;
      },
      error: (err) => {
        console.error('Error loading teachers:', err);
      }
    });
  }

  // ✅ Ensure correct image URL
  getImageUrl(profileImage: string): string {
    if (!profileImage) return 'assets/default-avatar.png'; // ✅ Default avatar if missing
    const cleanPath = profileImage.replace(/^.*uploads\//, '');
  console.log(`${this.backendUrl}/uploads/${cleanPath}`)
  return `${this.backendUrl}/uploads/${cleanPath}`;
  }

  getInitials(name: string): string {
    return name.split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }

  handleImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    const container = img.parentElement;
    if (container) {
      container.querySelector('.avatar-placeholder')?.classList.remove('d-none');
    }
  }

}
