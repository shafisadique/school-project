import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AssignmentService } from '../assignment.service';
import { ToastrService } from 'ngx-toastr';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-assignment-details',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './assignment-details.component.html'
})
export class AssignmentDetailsComponent implements OnInit, OnDestroy {
  assignments: any[] = [];
  selectedAssignment: any = null;
  students: any[] = [];
  isLoading = false;
  private subscriptions: Subscription = new Subscription();
  teacherId: string | null = localStorage.getItem('teacherId');

  constructor(
    private assignmentService: AssignmentService,
    private toastr: ToastrService,
    private modalService: NgbModal
  ) {}

  ngOnInit(): void {
    if (!this.teacherId) {
      this.toastr.error('Teacher ID not found');
      return;
    }
    this.loadAssignments();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadAssignments(): void {
    this.isLoading = true;
    this.subscriptions.add(
      this.assignmentService.getTeacherAssignments(this.teacherId!).subscribe({
        next: (data) => {
          this.assignments = data.data;
          this.isLoading = false;
        },
        error: (err) => {
          this.toastr.error('Failed to load assignments.');
          this.isLoading = false;
        }
      })
    );
  }

  openAssignmentDetails(assignmentId: string, content: any): void {
    this.isLoading = true;
    this.subscriptions.add(
      this.assignmentService.getAssignmentDetails(assignmentId).subscribe({
        next: (data) => {
          this.selectedAssignment = data.data.assignment;
          this.students = data.data.students.map(student => ({
            ...student,
            submitted: student.submitted || false,
            questionsSolved: student.questionsSolved || 0,
            grade: student.grade || '',
            comments: student.comments || ''
          }));
          this.isLoading = false;
          this.modalService.open(content, { size: 'xl', scrollable: true });
        },
        error: (err) => {
          this.toastr.error('Failed to load assignment details');
          this.isLoading = false;
        }
      })
    );
  }

  // Apply same values to all students
  applyToAll(field: string, value: any): void {
    this.students.forEach(student => {
      student[field] = value;
    });
    this.toastr.info(`Applied ${field} to all students`);
  }

  // Save all grades at once
  saveAllGrades(): void {
    this.isLoading = true;
    
    const gradesData = this.students.map(student => ({
      studentId: student._id,
      grade: student.grade ? Number(student.grade) : null,
      comments: student.comments || '',
      questionsSolved: student.questionsSolved || 0,
      submitted: student.submitted
    }));

    this.subscriptions.add(
      this.assignmentService.bulkGradeAssignment(this.selectedAssignment._id, gradesData).subscribe({
        next: () => {
          this.toastr.success('All grades saved successfully!');
          this.isLoading = false;
        },
        error: (err) => {
          this.toastr.error('Failed to save grades');
          this.isLoading = false;
        }
      })
    );
  }

  closeModal(): void {
    this.modalService.dismissAll();
    this.selectedAssignment = null;
  }
}