// fee-structure.component.ts
import { CommonModule } from '@angular/common';
import { Component, ViewChild } from '@angular/core';
import { FeeStructureService } from '../fee-structure.service';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'; 
import { EditOutline } from '@ant-design/icons-angular/icons';

@Component({
  selector: 'app-fee-structure',
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  standalone: true,
  templateUrl: './fee-structure.component.html',
  styleUrl: './fee-structure.component.scss'
})
export class FeeStructureComponent {
  schoolId: string | null = null;
  feeStructures: any[] = [];
  classList: string[] = ['Pre Nursery', 'Nursery', 'LKG', 'UKG', 'Class 1','Class 2','class 3','class 4'];
  feeForm: FormGroup;
  isEditMode = false;
  selectedStructure: any = null;
  examMonths: string[] = [];
  newExamMonth = '';

  @ViewChild('feeStructureModal') feeStructureModal: any;

  // Toast properties
  showToast = false;
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';

  constructor(
    private fb: FormBuilder,
    private feeService: FeeStructureService,
    private authService: AuthService,
    private modalService: NgbModal
  ) {
    this.feeForm = this.fb.group({
      session: ['2024-2025', Validators.required],
      className: ['', Validators.required],
      baseFee: [0, [Validators.required, Validators.min(0)]],
      feeBreakdown: this.fb.group({
        tuitionFee: [0, [Validators.required, Validators.min(0)]],
        examFee: [0, [Validators.required, Validators.min(0)]],
        labFee: [0],
        transportFee: [0],
        hostelFee: [0],
        miscFee: [0],
        examMonths: [[]]
      })
    });
  }

  ngOnInit(): void {
    this.schoolId = this.authService.getSchoolId();
    if (this.schoolId) {
      this.loadFeeStructures();
    }
  }
  // Add this method
  addExamMonth() {
    if (this.newExamMonth && !this.examMonths.includes(this.newExamMonth)) {
      this.examMonths.push(this.newExamMonth);
      this.newExamMonth = '';
    }
  }

  // Add this method
  removeExamMonth(month: string) {
    this.examMonths = this.examMonths.filter(m => m !== month);
  }

  loadFeeStructures(): void {
    const session = '2024-2025';
    this.feeService.getFeeStructures(this.schoolId!, session)
      .subscribe({
        next: (res) => {
          this.feeStructures = res;
        },
        error: (err) => this.showToastMessage(`Error loading structures: ${err.message}`, 'error')
      });
  }

  openCreateModal() {
    this.isEditMode = false;
    this.examMonths = [];
    this.newExamMonth = '';
    this.feeForm.reset({
      session: '2024-2025',
      className: '',
      baseFee: 0,
      feeBreakdown: {
        tuitionFee: 0,
        examFee: 0,
        labFee: 0,
        transportFee: 0,
        hostelFee: 0,
        miscFee: 0
      }
    });
    this.modalService.open(this.feeStructureModal, { size: 'lg' });
  }

  openEditModal(structure: any): void {
    this.isEditMode = true;
    this.selectedStructure = structure;
    this.examMonths = structure.examMonths || [];
    this.feeForm.patchValue({
      session: structure.session,
      className: structure.className,
      baseFee: structure.baseFee,
      feeBreakdown: {
        tuitionFee: structure.feeBreakdown.tuitionFee || 0,
        examFee: structure.feeBreakdown.examFee || 0,
        labFee: structure.feeBreakdown.labFee || 0,
        transportFee: structure.feeBreakdown.transportFee || 0,
        hostelFee: structure.feeBreakdown.hostelFee || 0,
        miscFee: structure.feeBreakdown.miscFee || 0
      }
    });
    this.modalService.open(this.feeStructureModal, { size: 'lg' });
  }

  submitFeeStructure(): void {
    if (this.feeForm.invalid) return;

    const feeData = {
      ...this.feeForm.value,
      schoolId: this.schoolId,
      examMonths: this.examMonths
    };

    const operation = this.isEditMode 
      ? this.feeService.updateFeeStructure(this.selectedStructure._id, feeData)
      : this.feeService.createFeeStructure(feeData);

    operation.subscribe({
      next: (res) => {
        this.showToastMessage(`Fee structure ${this.isEditMode ? 'updated' : 'created'} successfully`);
        this.loadFeeStructures();
        this.closeModal();
      },
      error: (err) => this.showToastMessage(`Operation failed: ${err.message}`, 'error')
    });
  }

  deleteStructure(structureId: string): void {
    if (confirm('Are you sure you want to delete this fee structure?')) {
      this.feeService.deleteFeeStructure(structureId)
        .subscribe({
          next: () => {
            this.showToastMessage('Fee structure deleted successfully');
            this.loadFeeStructures();
          },
          error: (err) => this.showToastMessage(`Delete failed: ${err.message}`, 'error')
        });
    }
  }

  closeModal() {
    this.modalService.dismissAll();
  }

  private showToastMessage(message: string, type: 'success' | 'error' = 'success', duration: number = 3000): void {
    this.toastMessage = message;
    this.toastType = type;
    this.showToast = true;
    
    setTimeout(() => {
      this.showToast = false;
    }, duration);
  }
}