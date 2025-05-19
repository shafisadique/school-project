import { Component, ViewChild } from '@angular/core';
import { FeeStructureService } from '../fee-structure.service';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CommonModule } from '@angular/common';

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
  classList: string[] = ['Pre Nursery', 'Nursery', 'LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4'];
  feeForm: FormGroup;
  isEditMode = false;
  selectedStructure: any = null;

  @ViewChild('feeStructureModal') feeStructureModal: any;


  constructor(
    private fb: FormBuilder,
    private feeService: FeeStructureService,
    private authService: AuthService,
    private modalService: NgbModal
  ) {
    this.feeForm = this.fb.group({
      className: ['', Validators.required],
      baseFee: [0, [Validators.required, Validators.min(0)]],
      feeBreakdown: this.fb.group({
        tuitionFee: [0, [Validators.required, Validators.min(0)]],
        examFee: [0, [Validators.required, Validators.min(0)]],
        labFee: [0, Validators.min(0)],
        transportFee: [0, Validators.min(0)],
        hostelFee: [0, Validators.min(0)],
        miscFee: [0, Validators.min(0)]
      })
    });
  }

  ngOnInit(): void {
    this.schoolId = this.authService.getSchoolId();
    if (this.schoolId) this.loadFeeStructures();
  }

  loadFeeStructures(): void {
    if (!this.schoolId) return;
    this.feeService.getFeeStructures(this.schoolId).subscribe({
      next: (res) => this.feeStructures = res,
      error: (err) => console.error('Error loading structures:', err)
    });
  }

  openCreateModal() {
    this.isEditMode = false;
    this.feeForm.reset({
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
    this.feeForm.patchValue({
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
      schoolId: this.schoolId
    };
    const operation = this.isEditMode
      ? this.feeService.updateFeeStructure(this.selectedStructure._id, feeData)
      : this.feeService.createFeeStructure(feeData);
    operation.subscribe({
      next: () => {
        this.loadFeeStructures();
        this.closeModal();
      },
      error: (err) => console.error('Operation failed:', err)
    });
  }

  deleteStructure(structureId: string): void {
    if (confirm('Are you sure?')) {
      this.feeService.deleteFeeStructure(structureId).subscribe({
        next: () => this.loadFeeStructures(),
        error: (err) => console.error('Delete failed:', err)
      });
    }
  }

  closeModal() {
    this.modalService.dismissAll();
  }
}