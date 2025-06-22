import { Component, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators, FormArray } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CommonModule } from '@angular/common';
import { FeeService } from '../fee.service';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { ToastrService } from 'ngx-toastr';
import { ClassSubjectService } from '../../class-subject-management/class-subject.service';
import { AcademicYearService } from '../../academic-year/academic-year.service';

export interface AcademicYear {
  _id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive?: boolean;
}

export interface FeeStructure {
  _id?: string;
  schoolId: string;
  academicYearId: { _id: string; name: string };
  classId: { _id: string; name: string };
  fees: { name: string; amount: number; type: string; frequency: string; preferenceKey?: string }[];
  lateFeeRules: { dailyRate: number; maxLateFee: number };
  discounts: { name: string; amount: number; type: string }[];
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}

interface FeeEntry {
  key: string;
  value: number;
  type: string;
  frequency: string;
  preferenceKey?: string;
}

@Component({
  selector: 'app-fee-structure',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './fee-structure.component.html',
  styleUrls: ['./fee-structure.component.scss']
})
export class FeeStructureComponent {
  schoolId: string | null = null;
  createdBy: string | null = null;
  feeStructures: FeeStructure[] = [];
  classList: { _id: string; name: string }[] = [];
  academicYears: AcademicYear[] = [];
  feeForm: FormGroup;
  currentStep: number = 1;
  frequencies = ['Monthly', 'Quarterly', 'Yearly', 'Specific Months'];
  feeTypes = ['Base', 'Optional'];
  discountTypes = ['Percentage', 'Fixed'];
  feeEntries: { name: string; isDefault: boolean; type: string; preferenceKey?: string }[] = [
    { name: 'tuitionFee', isDefault: true, type: 'Base' },
    { name: 'examFee', isDefault: true, type: 'Base' },
    { name: 'transportFee', isDefault: true, type: 'Optional', preferenceKey: 'usesTransport' },
    { name: 'hostelFee', isDefault: true, type: 'Optional', preferenceKey: 'usesHostel' },
    { name: 'miscFee', isDefault: true, type: 'Base' },
    { name: 'labFee', isDefault: true, type: 'Base' }
  ];
  formFeeEntries: FeeEntry[] = [];

  @ViewChild('feeStructureModal') feeStructureModal: any;

  constructor(
    private fb: FormBuilder,
    private feeService: FeeService,
    private authService: AuthService,
    private classSubjectService: ClassSubjectService,
    private academicYearService: AcademicYearService,
    private toastr: ToastrService,
    private modalService: NgbModal
  ) {
    this.feeForm = this.fb.group({
      academicYearId: ['', Validators.required],
      classId: ['', Validators.required],
      frequency: ['Monthly', Validators.required],
      baseFee: [0, [Validators.required, Validators.min(0)]],
      fees: this.fb.group({
        tuitionFee: [0, [Validators.required, Validators.min(0)]],
        examFee: [0, Validators.min(0)],
        transportFee: [0, Validators.min(0)],
        hostelFee: [0, Validators.min(0)],
        miscFee: [0, Validators.min(0)],
        labFee: [0, Validators.min(0)]
      }),
      lateFeeRules: this.fb.group({
        dailyRate: [50, [Validators.required, Validators.min(0)]],
        maxLateFee: [1000, [Validators.required, Validators.min(0)]]
      }),
      discounts: this.fb.array([])
    });
  }

  ngOnInit(): void {
    this.schoolId = this.authService.getSchoolId();
    this.createdBy = this.authService.getUserId();
    console.log('School ID:', this.schoolId, 'Created By:', this.createdBy); // Debug
    if (!this.schoolId || !this.createdBy) {
      this.toastr.error('School ID or User ID not found. Please log in again.');
      return;
    }
    this.loadAcademicYears();
    this.loadClasses();
    this.loadFeeStructures();
  }

  get discounts(): FormArray {
    return this.feeForm.get('discounts') as FormArray;
  }

  loadAcademicYears(): void {
    this.academicYearService.getAllAcademicYears(this.schoolId!).subscribe({
      next: (academicYears: AcademicYear[]) => {
        this.academicYears = academicYears || [];
        console.log('Academic Years:', this.academicYears); // Debug
        if (this.academicYears.length === 0) {
          this.toastr.warning('No academic years found. Please create one first.');
        }
      },
      error: (err) => {
        console.error('Error loading academic years:', err); // Debug
        this.toastr.error('Failed to load academic years.');
      }
    });
  }

  loadClasses(): void {
    this.classSubjectService.getClassesBySchool(this.schoolId!).subscribe({
      next: (classes: any[]) => {
        this.classList = classes.map(c => ({ _id: c._id, name: c.name }));
        console.log('Classes:', this.classList); // Debug
        if (this.classList.length === 0) {
          this.toastr.warning('No classes found for this school.');
        }
      },
      error: (err) => {
        console.error('Error loading classes:', err); // Debug
        this.toastr.error('Failed to load classes.');
      }
    });
  }

  loadFeeStructures(): void {
    console.log('Fetching fee structures for schoolId:', this.schoolId); // Debug
    this.feeService.getFeeStructures(this.schoolId!).subscribe({
      next: (res) => {
        console.log('Fee Structures Response:', res); // Debug
        this.feeStructures = res.data || [];
        if (this.feeStructures.length === 0) {
          this.toastr.info('No fee structures found. Create one to start.');
        }
      },
      error: (err) => {
        console.error('Error fetching fee structures:', err); // Debug
        this.toastr.error('Failed to load fee structures: ' + (err.error?.message || 'Unknown error'));
      }
    });
  }

  openCreateModal() {
    this.currentStep = 1;
    this.feeEntries = [
      { name: 'tuitionFee', isDefault: true, type: 'Base' },
      { name: 'examFee', isDefault: true, type: 'Base' },
      { name: 'transportFee', isDefault: true, type: 'Optional', preferenceKey: 'usesTransport' },
      { name: 'hostelFee', isDefault: true, type: 'Optional', preferenceKey: 'usesHostel' },
      { name: 'miscFee', isDefault: true, type: 'Base' },
      { name: 'labFee', isDefault: true, type: 'Base' }
    ];
    const feesGroup = this.fb.group({});
    this.feeEntries.forEach(fee => {
      feesGroup.addControl(fee.name, this.fb.control(0, fee.isDefault && fee.type === 'Base' ? [Validators.required, Validators.min(0)] : Validators.min(0)));
    });
    this.feeForm = this.fb.group({
      academicYearId: ['', Validators.required],
      classId: ['', Validators.required],
      frequency: ['Monthly', Validators.required],
      baseFee: [0, [Validators.required, Validators.min(0)]],
      fees: feesGroup,
      lateFeeRules: this.fb.group({
        dailyRate: [50, [Validators.required, Validators.min(0)]],
        maxLateFee: [1000, [Validators.required, Validators.min(0)]]
      }),
      discounts: this.fb.array([])
    });

    const activeYear = this.academicYears.find(year => year.isActive);
    if (activeYear) {
      this.feeForm.get('academicYearId')?.setValue(activeYear._id);
    }

    this.modalService.open(this.feeStructureModal, { size: 'lg', backdrop: 'static' });
  }

  addFee() {
    const newFeeName = `customFee${this.feeEntries.length + 1}`;
    this.feeEntries.push({ name: newFeeName, isDefault: false, type: 'Base' });
    const feesGroup = this.feeForm.get('fees') as FormGroup;
    feesGroup.addControl(newFeeName, this.fb.control(0, Validators.min(0)));
  }

  updateFeeName(index: number, event: Event) {
    const newName = (event.target as HTMLInputElement).value.toLowerCase();
    if (!newName || this.feeEntries.some((fee, i) => i !== index && fee.name === newName)) {
      this.toastr.error('Fee name must be unique and non-empty.');
      return;
    }
    const oldName = this.feeEntries[index].name;
    this.feeEntries[index].name = newName;
    const feesGroup = this.feeForm.get('fees') as FormGroup;
    const control = feesGroup.get(oldName);
    if (control) {
      feesGroup.removeControl(oldName);
      feesGroup.addControl(newName, control);
    }
  }

  removeFee(index: number) {
    const feeName = this.feeEntries[index].name;
    this.feeEntries.splice(index, 1);
    const feesGroup = this.feeForm.get('fees') as FormGroup;
    feesGroup.removeControl(feeName);
  }

  addDiscount() {
    const discountForm = this.fb.group({
      name: ['', Validators.required],
      type: ['', Validators.required],
      amount: [0, [Validators.required, Validators.min(0)]]
    });
    this.discounts.push(discountForm);
  }

  removeDiscount(index: number) {
    this.discounts.removeAt(index);
  }

  nextStep(): void {
    if (this.currentStep === 1 && !this.feeForm.get('academicYearId')?.value) {
      this.toastr.error('Please select an academic year.');
      return;
    }
    if (this.currentStep === 1 && !this.feeForm.get('classId')?.value) {
      this.toastr.error('Please select a class.');
      return;
    }
    if (this.currentStep === 2 && !this.feeForm.get('frequency')?.value) {
      this.toastr.error('Please select a frequency.');
      return;
    }
    if (this.currentStep === 3) {
      const baseFee = this.feeForm.get('baseFee')?.value;
      const fees = this.feeForm.get('fees')?.value as { [key: string]: number };
      const breakdownTotal = Object.values(fees).reduce((sum: number, val: number) => sum + val, 0);
      if (baseFee !== breakdownTotal) {
        this.toastr.error('Base fee must equal the sum of the fee breakdown.');
        return;
      }
      this.formFeeEntries = Object.entries(fees).map(([key, value]) => {
        const feeEntry = this.feeEntries.find(f => f.name === key);
        return {
          key,
          value,
          type: feeEntry?.type || 'Base',
          frequency: this.feeForm.get('frequency')?.value,
          preferenceKey: feeEntry?.preferenceKey
        };
      }).filter(entry => entry.value > 0);
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

    if (!this.createdBy) {
      this.toastr.error('User ID not found. Please log in again.');
      return;
    }

    const feesArray = this.formFeeEntries.map(entry => ({
      name: entry.key,
      amount: entry.value,
      type: entry.type,
      frequency: entry.frequency,
      preferenceKey: entry.preferenceKey
    }));

    const feeData = {
      schoolId: this.schoolId!,
      classId: this.feeForm.get('classId')?.value,
      academicYearId: this.feeForm.get('academicYearId')?.value,
      fees: feesArray,
      lateFeeRules: this.feeForm.get('lateFeeRules')?.value,
      discounts: this.feeForm.get('discounts')?.value,
      createdBy: this.createdBy
    };

    console.log('Submitting fee structure:', feeData); // Debug
    this.feeService.createFeeStructure(feeData).subscribe({
      next: (res) => {
        console.log('Create Fee Structure Response:', res); // Debug
        this.toastr.success('Fee structure created successfully!');
        this.loadFeeStructures();
        this.closeModal();
      },
      error: (err) => {
        console.error('Error creating fee structure:', err); // Debug
        this.toastr.error(err.error?.message || 'Failed to create fee structure.');
      }
    });
  }

  closeModal() {
    this.modalService.dismissAll();
  }

  getAcademicYearName(academicYearId: string): string {
    const year = this.academicYears.find(y => y._id === academicYearId);
    return year ? year.name : 'N/A';
  }

  getClassName(classId: string): string {
    const classItem = this.classList.find(c => c._id === classId);
    return classItem ? classItem.name : 'N/A';
  }
}