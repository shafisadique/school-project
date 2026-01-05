// src/app/student/assignments/student-assignment-details.component.ts
// Production-level: Added responsive handling, safe URL construction, error boundaries, accessibility.

import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from 'src/environments/environment';
import { CommonModule } from '@angular/common';
import { AssignmentService } from '../assignment.service';

@Component({
  selector: 'app-student-assignment-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './student-assignment-details.component.html',
  styleUrls: ['./student-assignment-details.component.scss'] // FIXED: Array
})
export class StudentAssignmentDetailsComponent implements OnInit {
  assignment: any = null;
  loading = true;
  error: string | null = null;
  fileUrls: { url: string; isPdf: boolean; name: string }[] = [];

  constructor(
    private route: ActivatedRoute,
    private assignmentService: AssignmentService,
    private sanitizer: DomSanitizer,
    private router: Router // ADDED: For safe navigation
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadAssignment(id);
    } else {
      this.error = 'Assignment ID not found';
      this.loading = false;
    }
  }
  getSubmissionBadgeClass(): string {
  if (!this.assignment.hasSubmitted) return 'bg-gray-100 text-gray-800 border border-gray-300';
  if (this.assignment.grade !== null) return 'bg-green-100 text-green-800 border border-green-300';
  return 'bg-blue-100 text-blue-800 border border-blue-300';
}

  loadAssignment(id: string): void {
    this.assignmentService.getStudentAssignmentDetails(id).subscribe({
      next: (res) => {
        if (res.success) {
          this.assignment = res.data;

          // BUILD FILE URLS (production-safe: validate keys)
          this.fileUrls = (this.assignment.attachments || []).filter(key => key && key.trim()).map((key: string) => {
            const url = `${environment.imageUrl}/api/assignments/proxy-file/${encodeURIComponent(key.trim())}`;
            const isPdf = key.toLowerCase().endsWith('.pdf');
            const name = key.split('/').pop()?.split('?')[0] || 'file'; // Clean name
            return { url, isPdf, name };
          });

          // Sanitize dueDate if invalid (from your JSON example)
          if (this.assignment.dueDate && this.assignment.dueDate.startsWith('+')) {
            this.assignment.dueDate = this.assignment.dueDate.replace('+', '20'); // Fix year prefix
          }
        } else {
          this.error = 'Failed to load assignment';
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Load error:', err);
        this.error = 'Failed to load assignment. Please try again.';
        this.loading = false;
      }
    });
  }

  safeUrl(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  formatDate(date: string): string {
    try {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return 'Invalid Date';
    }
  }

  getDueStatus(): string {
    if (!this.assignment || this.assignment.daysUntilDue === undefined) return '';
    const days = this.assignment.daysUntilDue;
    if (this.assignment.isOverdue) {
      return `Overdue ${Math.abs(days)} days ago`;
    }
    return days > 0 ? `Due in ${days} day${days === 1 ? '' : 's'}` : 'Due today';
  }

  getSubmissionStatus(): string {
    if (!this.assignment) return 'Pending';
    if (this.assignment.hasSubmitted) {
      if (this.assignment.grade !== null) {
        return `Graded: ${this.assignment.grade}/100`;
      }
      return 'Submitted (Pending Grade)';
    }
    return 'Not Submitted';
  }

  goBack(): void {
    this.router.navigate(['/student/assignments']); // Production: Safe back to list
  }

  downloadFile(fileUrl: string, filename: string): void {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = filename;
    link.target = '_blank'; // Open in new tab for PDFs
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  isImage(fileUrl: string): boolean {
    const ext = fileUrl.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext || '');
  }

  onImageError(event: any): void {
    event.target.src = '/assets/placeholder-image.png'; // Fallback (add asset if needed)
    event.target.alt = 'Image not available';
  }
}