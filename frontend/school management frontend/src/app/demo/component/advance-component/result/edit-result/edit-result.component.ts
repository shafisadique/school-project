import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ResultService } from '../result.service';
import { AuthService } from 'src/app/theme/shared/service/auth.service';

@Component({
  selector: 'app-edit-result',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './edit-result.component.html',
  styleUrls: ['./edit-result.component.scss']
})
export class EditResultComponent implements OnInit {
  resultId: string = '';
  result: any = null;
  marksForm: FormGroup;
  isLoading: boolean = false;
  maxMarks: number = 100; // Default, updated after fetching result
  schoolId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private resultService: ResultService,
    private authService: AuthService,
    private toastr: ToastrService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.marksForm = this.fb.group({
      marksObtained: [0, [Validators.required, Validators.min(0)]]
    });
  }

  ngOnInit(): void {
    this.schoolId = this.authService.getSchoolId();
    if (!this.schoolId) {
      this.toastr.error('School ID is missing. Please log in again.', 'Error');
      this.router.navigate(['/auth/login']);
      return;
    }

    this.resultId = this.route.snapshot.paramMap.get('resultId') || '';
    if (!this.resultId) {
      this.toastr.error('Invalid result ID', 'Error');
      this.router.navigate(['/result/result-list']);
      return;
    }

    this.loadResult();
  }

  loadResult(): void {
    this.isLoading = true;
    this.resultService.getResultById(this.resultId).subscribe({
      next: (result) => {
        if (!result.subjectId) {
          this.toastr.error('This is not a partial result', 'Error');
          this.router.navigate(['/result/result-list']);
          return;
        }
        this.result = result;
        this.maxMarks = result.maxMarks || 100; // Fallback
        this.marksForm.get('marksObtained')?.setValidators([Validators.required, Validators.min(0), Validators.max(this.maxMarks)]);
        this.marksForm.get('marksObtained')?.setValue(result.marksObtained);
        this.marksForm.get('marksObtained')?.updateValueAndValidity();
        this.cdr.detectChanges();
      },
      error: (err) => this.handleError('load result', err),
      complete: () => this.isLoading = false
    });
  }

  submitMarks(): void {
    if (this.marksForm.invalid) {
      this.toastr.warning('Please enter valid marks (0 to ' + this.maxMarks + ').', 'Validation Error');
      this.marksForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    const updateData = {
      marksObtained: this.marksForm.value.marksObtained
    };

    this.resultService.updatePartialResult(this.resultId, updateData).subscribe({
      next: () => {
        this.toastr.success('Marks updated successfully!', 'Success');
        this.router.navigate(['/result/result-list']);
      },
      error: (err) => this.handleError('update marks', err),
      complete: () => this.isLoading = false
    });
  }

  getPercentage(): number {
    const marks = this.marksForm.get('marksObtained')?.value || 0;
    return (marks / this.maxMarks) * 100;
  }

  private handleError(type: string, err: any): void {
    console.error(`Error ${type}:`, err);
    let errorMessage = `Failed to ${type}. Please try again.`;
    if (err?.error?.error) {
      errorMessage = err.error.error;
    } else if (err?.message) {
      errorMessage = err.message;
    } else if (err?.error) {
      errorMessage = typeof err.error === 'string' ? err.error : JSON.stringify(err.error);
    }
    this.toastr.error(errorMessage, `${type.charAt(0).toUpperCase() + type.slice(1)} Error`);
    this.isLoading = false;
  }

  cancel(): void {
    this.router.navigate(['/result/result-list']);
  }
}