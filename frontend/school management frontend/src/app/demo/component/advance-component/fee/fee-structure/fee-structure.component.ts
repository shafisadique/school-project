import { Component, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CommonModule } from '@angular/common';
import { FeeService } from '../fee.service';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { ToastrService } from 'ngx-toastr';
import { ClassSubjectService } from '../../class-subject-management/class-subject.service';

@Component({
  selector: 'app-fee-structure',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './fee-structure.component.html',
  styleUrls: ['./fee-structure.component.scss']
})
export class FeeStructureComponent {
  schoolId: string | null = null;
  feeStructures: any[] = [];
  classList: string[] = [];
  feeForm: FormGroup;
  currentStep: number = 1;
  frequencies = ['Monthly', 'Quarterly', 'Yearly'];

  @ViewChild('feeStructureModal') feeStructureModal: any;

  constructor(
    private fb: FormBuilder,
    private feeService: FeeService,
    private authService: AuthService,
    private classSubjectService: ClassSubjectService,
    private toastr: ToastrService,
    private modalService: NgbModal
  ) {
    this.feeForm = this.fb.group({
      className: ['', Validators.required],
      frequency: ['Monthly', Validators.required],
      baseFee: [0, [Validators.required, Validators.min(0)]],
      feeBreakdown: this.fb.group({
        tuitionFee: [0, [Validators.required, Validators.min(0)]],
        examFee: [0, [Validators.required, Validators.min(0)]],
        transportFee: [0, Validators.min(0)],
        hostelFee: [0, Validators.min(0)]
      })
    });
  }

  ngOnInit(): void {
    this.schoolId = this.authService.getSchoolId();
    if (this.schoolId) {
      this.loadClasses();
      this.loadFeeStructures();
    } else {
      this.toastr.error('School ID not found. Please log in again.');
    }
  }

  loadClasses(): void {
    this.classSubjectService.getClassesBySchool(this.schoolId!).subscribe({
      next: (classes: any[]) => {
        this.classList = classes.map(c => c.name);
        if (this.classList.length === 0) {
          this.toastr.warning('No classes found for this school.');
        }
      },
      error: () => this.toastr.error('Failed to load classes.')
    });
  }

  loadFeeStructures(): void {
    this.feeService.getFeeStructures(this.schoolId!).subscribe({
      next: (res) => {
        this.feeStructures = res.data || [];
        if (this.feeStructures.length === 0) {
          this.toastr.info('No fee structures found. Create one to start.');
        }
      },
      error: () => this.toastr.error('Failed to load fee structures.')
    });
  }

  openCreateModal() {
    this.currentStep = 1;
    this.feeForm.reset({
      className: '',
      frequency: 'Monthly',
      baseFee: 0,
      feeBreakdown: {
        tuitionFee: 0,
        examFee: 0,
        transportFee: 0,
        hostelFee: 0
      }
    });
    this.modalService.open(this.feeStructureModal, { size: 'lg', backdrop: 'static' });
  }

  nextStep(): void {
    if (this.currentStep === 1 && !this.feeForm.get('className')?.value) {
      this.toastr.error('Please select a class.');
      return;
    }
    if (this.currentStep === 2 && !this.feeForm.get('frequency')?.value) {
      this.toastr.error('Please select a frequency.');
      return;
    }
    if (this.currentStep === 3) {
      const baseFee = this.feeForm.get('baseFee')?.value;
      const breakdown = this.feeForm.get('feeBreakdown')?.value;
      const breakdownTotal = breakdown.tuitionFee + breakdown.examFee + breakdown.transportFee + breakdown.hostelFee;
      if (baseFee !== breakdownTotal) {
        this.toastr.error('Base fee must equal the sum of the fee breakdown.');
        return;
      }
    }
    this.currentStep++;
  }

  prevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  submitFeeStructure(): void {
    if (this.feeForm.invalid) {
      this.toastr.error('Please fill all required fields.');
      return;
    }
    const feeData = {
      ...this.feeForm.value,
      schoolId: this.schoolId,
      lateFeeRules: { dailyRate: 0, maxLateFee: 0 }, // Default values
      discounts: [] // Default empty array
    };
    this.feeService.createFeeStructure(feeData).subscribe({
      next: () => {
        this.toastr.success('Fee structure created successfully!');
        this.loadFeeStructures();
        this.closeModal();
      },
      error: () => this.toastr.error('Failed to create fee structure.')
    });
  }

  closeModal() {
    this.modalService.dismissAll();
  }
}