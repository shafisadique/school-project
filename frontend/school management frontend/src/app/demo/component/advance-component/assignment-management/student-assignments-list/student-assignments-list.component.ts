// src/app/student/assignments/student-assignments-list.component.ts
// Production-level: Added responsive cards for mobile, infinite scroll potential (not implemented), better error UX.

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AssignmentService } from '../assignment.service';

interface AssignmentItem {
  _id: string;
  title: string;
  description: string;
  dueDate: string;
  classId: { name: string };
  subjectId: { name: string };
  teacherId?: { name: string };
  hasSubmitted: boolean;
  grade?: number | null;
  isOverdue: boolean;
  daysUntilDue?: number; // OPTIONAL: Safe for undefined
}

@Component({
  selector: 'app-student-assignments-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './student-assignments-list.component.html',
  styleUrls: ['./student-assignments-list.component.scss'] // FIXED: Array
})
export class StudentAssignmentsListComponent implements OnInit {
  assignments: AssignmentItem[] = [];
  loading = true;
  error: string | null = null;
  refreshing = false; // For pull-to-refresh if added

  constructor(
    private assignmentService: AssignmentService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadAssignments();
  }

  loadAssignments(refresh = false): void {
    if (refresh) this.refreshing = true;
    this.assignmentService.getStudentAssignments().subscribe({
      next: (res) => {
        if (res.success) {
          this.assignments = res.data || [];
        } else {
          this.error = 'Failed to load assignments';
        }
        this.loading = false;
        this.refreshing = false;
      },
      error: (err) => {
        console.error('Load error:', err);
        this.error = 'Failed to load assignments. Please check your connection.';
        this.loading = false;
        this.refreshing = false;
      }
    });
  }

viewDetails(id: string): void {
  this.router.navigate(['/my-assignment-details', id]);
}

  formatDate(date: string): string {
    try {
      return new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'Invalid Date';
    }
  }

  getStatusClass(a: AssignmentItem): { [key: string]: boolean } {
    return {
      'bg-red-50 border-red-200 text-red-800': a.isOverdue,
      'bg-green-50 border-green-200 text-green-800': a.hasSubmitted && a.grade != null,
      'bg-blue-50 border-blue-200 text-blue-800': a.hasSubmitted && a.grade == null,
      'bg-gray-50 border-gray-200 text-gray-800': !a.hasSubmitted
    };
  }

  getStatusText(a: AssignmentItem): string {
    if (a.hasSubmitted && a.grade != null) return `Graded (${a.grade}/100)`;
    if (a.hasSubmitted) return 'Submitted';
    return 'Pending';
  }

  abs(v: number | undefined): number {
    return Math.abs(v || 0); // SAFE: Handle undefined
  }

  retryLoad(): void {
    this.error = null;
    this.loadAssignments(true);
  }
  // Add this helper for badge class
getBadgeClass(a: AssignmentItem): string {
  if (a.isOverdue) return 'bg-red-100 text-red-800 border border-red-300';
  if (a.hasSubmitted && a.grade != null) return 'bg-green-100 text-green-800 border border-green-300';
  if (a.hasSubmitted) return 'bg-blue-100 text-blue-800 border border-blue-300';
  return 'bg-gray-100 text-gray-800 border border-gray-300';
}
}