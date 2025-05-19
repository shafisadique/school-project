import { Component, OnInit } from '@angular/core';
import { StudentService } from '../student.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-student-details',
  imports: [CommonModule],
  templateUrl: './student-details.component.html',
  styleUrl: './student-details.component.scss'
})
export class StudentDetailsComponent implements OnInit{
  students: any[] = [];
  backendUrl = 'http://localhost:5000';

  constructor(private studentService: StudentService) {}

  ngOnInit(): void {
    this.loadStudents();
  }

loadStudents(){
  this.studentService.getStudent().subscribe({
    next:(students:any)=>{
      this.students = students.data;
    }
  })
}

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
