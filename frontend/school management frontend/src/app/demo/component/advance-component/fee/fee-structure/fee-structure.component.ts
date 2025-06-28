import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { FeeService } from '../fee.service';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { ClassSubjectService } from '../../class-subject-management/class-subject.service';
import { AcademicYearService } from '../../academic-year/academic-year.service';
import { RouteService } from '../../../route/route.service';
import { CommonModule } from '@angular/common';
interface FeeStructure {
  _id?: string;
  schoolId: string;
  academicYearId: { _id: string; name: string };
  classId: { _id: string; name: string };
  fees: FeeItem[];
  lateFeeConfig: LateFeeConfig;
  discounts: Discount[];
  createdBy: string;
  status?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface FeeItem {
  name: string;
  amount: number;
  type: 'Base' | 'Optional';
  frequency: 'Monthly' | 'Quarterly' | 'Yearly' | 'Specific Months';
  preferenceKey?: string;
  routeOptions?: RouteOption[];
  specificMonths?: number[];
}

interface RouteOption {
  routeId: string;
  amount: number;
}

interface LateFeeConfig {
  isEnabled: boolean;
  calculationType: 'daily' | 'fixed' | 'percentage';
  dailyRate: number;
  fixedAmount: number;
  percentageRate: number;
  maxLateFee: number;
  gracePeriodDays: number;
}

interface Discount {
  name: string;
  amount: number;
  type: 'Percentage' | 'Fixed';
}

interface Class {
  _id: string;
  name: string;
}

interface AcademicYear {
  _id: string;
  name: string;
  isActive?: boolean;
}

interface Route {
  _id: string;
  name: string;
  feeAmount: number;
}

@Component({
  selector: 'app-fee-structure',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './fee-structure.component.html',
  styleUrls: ['./fee-structure.component.scss']
})
export class FeeStructureComponent implements OnInit {
  @ViewChild('feeStructureModal') feeStructureModal: any;
  @ViewChild('confirmDeleteModal') confirmDeleteModal: TemplateRef<any>;
  schoolId: string;
  feeStructures: FeeStructure[] = [];
  classList: Class[] = [];
  academicYears: AcademicYear[] = [];
  routes: Route[] = [];
  isEditMode = false;
  selectedStructureId: string | null = null;
  feeForm: FormGroup;
  currentStep = 1;
  loading = false;
  frequencies = ['Monthly', 'Quarterly', 'Yearly', 'Specific Months'];
  feeTypes = ['Base', 'Optional'];
  discountTypes = ['Percentage', 'Fixed'];
  months = Array.from({ length: 12 }, (_, i) => i + 1);
  monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
initialFeeCount: number = 0; // Track the initial number of fees
  constructor(
    private fb: FormBuilder,
    private feeService: FeeService,
    private authService: AuthService,
    private toastr: ToastrService,
    private classService: ClassSubjectService,
    private academicYearService: AcademicYearService,
    private routeService: RouteService,
    private modalService: NgbModal
  ) {
    this.schoolId = this.authService.getSchoolId() || '';
    this.initializeForm();
  }

  ngOnInit(): void {
    if (!this.schoolId) {
      this.toastr.error('School ID not found. Please log in again.');
      return;
    }
    this.loadInitialData();
  }

  initializeForm(): void {
    this.feeForm = this.fb.group({
      academicYearId: ['', Validators.required],
      classId: ['', Validators.required],
      frequency: ['Monthly', Validators.required],
      fees: this.fb.array([]),
      lateFeeConfig: this.fb.group({
        isEnabled: [false],
        calculationType: ['daily'],
        dailyRate: [0, [Validators.min(0)]],
        fixedAmount: [0, [Validators.min(0)]],
        percentageRate: [0, [Validators.min(0)]],
        maxLateFee: [0, [Validators.min(0)]],
        gracePeriodDays: [0, [Validators.min(0)]]
      }),
      discounts: this.fb.array([])
    });
  }

  get fees(): FormArray {
    return this.feeForm.get('fees') as FormArray;
  }

  get discounts(): FormArray {
    return this.feeForm.get('discounts') as FormArray;
  }

  get lateFeeConfig(): FormGroup {
    return this.feeForm.get('lateFeeConfig') as FormGroup;
  }

  loadInitialData(): void {
    this.loading = true;
    Promise.all([
      this.loadClasses(),
      this.loadAcademicYears(),
      this.loadRoutes(),
      this.loadFeeStructures()
    ]).finally(() => this.loading = false);
  }

  loadClasses(): Promise<void> {
    return new Promise((resolve) => {
      this.classService.getClassesBySchool(this.schoolId).subscribe({
        next: (classes) => {
          this.classList = classes;
          if (!classes.length) this.toastr.warning('No classes found. Please create a class first.');
          resolve();
        },
        error: (err) => {
          this.toastr.error('Failed to load classes');
          console.error('Error loading classes:', err);
          resolve();
        }
      });
    });
  }

  loadAcademicYears(): Promise<void> {
    return new Promise((resolve) => {
      this.academicYearService.getAllAcademicYears(this.schoolId).subscribe({
        next: (years) => {
          this.academicYears = years;
          if (!years.length) this.toastr.warning('No academic years found. Please create an academic year first.');
          resolve();
        },
        error: (err) => {
          this.toastr.error('Failed to load academic years');
          console.error('Error loading academic years:', err);
          resolve();
        }
      });
    });
  }

  loadRoutes(): Promise<void> {
    return new Promise((resolve) => {
      this.routeService.getRoutes().subscribe({
        next: (response: any) => {
          this.routes = response.data || [];
          if (!this.routes.length) this.toastr.warning('No transportation routes found. Transport fee will be disabled.');
          resolve();
        },
        error: (err) => {
          this.toastr.error('Failed to load transportation routes');
          console.error('Error loading routes:', err);
          resolve();
        }
      });
    });
  }

  loadFeeStructures(): Promise<void> {
    return new Promise((resolve) => {
      this.feeService.getFeeStructures(this.schoolId).subscribe({
        next: (response) => {
          this.feeStructures = response.data || [];
          if (!this.feeStructures.length) this.toastr.info('No fee structures found. Create one to start.');
          resolve();
        },
        error: (err) => {
          this.toastr.error('Failed to load fee structures');
          console.error('Error loading fee structures:', err);
          resolve();
        }
      });
    });
  }

  openCreateModal(): void {
    if (!this.classList.length || !this.academicYears.length) {
      this.toastr.warning('Please wait while data is loading or ensure classes and academic years are set up.');
      return;
    }
    this.isEditMode = false;
    this.currentStep = 1;
    this.feeForm.reset({
      academicYearId: '',
      classId: '',
      frequency: 'Monthly',
      lateFeeConfig: {
        isEnabled: false,
        calculationType: 'daily',
        dailyRate: 0,
        fixedAmount: 0,
        percentageRate: 0,
        maxLateFee: 0,
        gracePeriodDays: 0
      }
    });
    this.fees.clear();
    this.discounts.clear();

    this.addFee('tuitionFee', 'Base');
    this.addFee('examFee', 'Base');
    if (this.routes.length) this.addTransportFee();
    this.addFee('hostelFee', 'Optional', 'usesHostel');
    this.addFee('miscFee', 'Base');
    this.addFee('labFee', 'Base');

    const activeYear = this.academicYears.find(year => year.isActive);
    if (activeYear) this.feeForm.get('academicYearId')?.setValue(activeYear._id);

    this.modalService.open(this.feeStructureModal, { size: 'lg', backdrop: 'static' });
  }

  openEditModal(structureId: string): void {
    this.isEditMode = true;
    this.selectedStructureId = structureId;
    this.currentStep = 1;
    this.feeForm.reset();
    this.fees.clear();
    this.discounts.clear();

    const structure = this.feeStructures.find(s => s._id === structureId);
    if (structure) {
      this.feeForm.patchValue({
        academicYearId: structure.academicYearId._id,
        classId: structure.classId._id,
        frequency: structure.fees[0]?.frequency || 'Monthly',
        lateFeeConfig: structure.lateFeeConfig
      });
      structure.fees.forEach(fee => {
        if (fee.name === 'transportFee' && !this.routes.length) return; // Skip if no routes
        const feeGroup = this.fb.group({
          name: [fee.name, Validators.required],
          amount: [fee.amount, [Validators.required, Validators.min(0)]],
          type: [fee.type, Validators.required],
          frequency: [fee.frequency, Validators.required],
          preferenceKey: [fee.preferenceKey || null],
          routeOptions: this.fb.array(fee.routeOptions?.map(opt => this.createRouteOption(opt.routeId, opt.amount)) || []),
          specificMonths: [fee.specificMonths || []]
        });
        this.fees.push(feeGroup);
      });
      structure.discounts.forEach(discount => {
        this.discounts.push(this.fb.group({
          name: [discount.name, Validators.required],
          type: [discount.type, Validators.required],
          amount: [discount.amount, [Validators.required, Validators.min(0)]]
        }));
      });

      const activeYear = this.academicYears.find(year => year._id === structure.academicYearId._id);
      if (activeYear) this.feeForm.get('academicYearId')?.setValue(activeYear._id);
      this.modalService.open(this.feeStructureModal, { size: 'lg', backdrop: 'static' });
    } else {
      this.toastr.error('Fee structure not found');
    }
  }

  addFee(name: string, type: 'Base' | 'Optional', preferenceKey?: string): void {
    const feeGroup = this.fb.group({
      name: [name, Validators.required],
      amount: [0, [Validators.required, Validators.min(0)]],
      type: [type, Validators.required],
      frequency: [this.feeForm.get('frequency')?.value || 'Monthly', Validators.required],
      preferenceKey: [preferenceKey || null],
      routeOptions: this.fb.array([]),
      specificMonths: [[]]
    });
    this.fees.push(feeGroup);
  }

  addTransportFee(): void {
    if (!this.routes.length) return;
    const routeOptionsArray = this.fb.array<FormGroup>([]);
    this.routes.forEach(route => {
      routeOptionsArray.push(this.createRouteOption(route._id, route.feeAmount));
    });
    const transportFee = this.fb.group({
      name: ['transportFee', Validators.required],
      amount: [0, [Validators.required, Validators.min(0)]],
      type: ['Optional', Validators.required],
      frequency: [this.feeForm.get('frequency')?.value || 'Monthly', Validators.required],
      preferenceKey: ['usesTransport'],
      routeOptions: routeOptionsArray,
      specificMonths: [[]]
    });
    this.fees.push(transportFee);
  }

  createRouteOption(routeId: string = '', amount: number = 0): FormGroup {
    return this.fb.group({
      routeId: [routeId, routeId ? [Validators.required] : []],
      amount: [amount, [Validators.required, Validators.min(0)]]
    });
  }

  getRouteOptions(feeIndex: number): FormArray {
    return this.fees.at(feeIndex).get('routeOptions') as FormArray;
  }

  addRouteOption(feeIndex: number): void {
    const routeOptions = this.getRouteOptions(feeIndex);
    routeOptions.push(this.createRouteOption());
  }

  removeRouteOption(feeIndex: number, optionIndex: number): void {
    const routeOptions = this.getRouteOptions(feeIndex);
    if (routeOptions.length > 1) {
      routeOptions.removeAt(optionIndex);
    } else {
      this.toastr.warning('At least one route option is required for transport fee.');
    }
  }

  addDiscount(): void {
    this.discounts.push(this.fb.group({
      name: ['', Validators.required],
      type: ['Percentage', Validators.required],
      amount: [0, [Validators.required, Validators.min(0)]]
    }));
  }

  removeDiscount(index: number): void {
    this.discounts.removeAt(index);
  }

  confirmDelete(structureId: string): void {
    this.selectedStructureId = structureId;
    this.modalService.open(this.confirmDeleteModal, { centered: true });
  }

  deleteFeeStructure(structureId: string): void {
    this.feeService.deleteFeeStructure(structureId).subscribe({
      next: () => {
        this.toastr.success('Fee structure deleted successfully');
        this.loadFeeStructures();
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'Failed to delete fee structure (e.g., invoices may exist)');
        console.error('Error deleting fee structure:', err);
      }
    });
  }

  toggleSpecificMonths(feeIndex: number, month: number): void {
    const fee = this.fees.at(feeIndex);
    const specificMonths: number[] = fee.get('specificMonths')?.value || [];
    const index = specificMonths.indexOf(month);
    if (index === -1) {
      specificMonths.push(month);
    } else {
      specificMonths.splice(index, 1);
    }
    fee.get('specificMonths')?.setValue(specificMonths);
  }

  isMonthSelected(feeIndex: number, month: number): boolean {
    const specificMonths = this.fees.at(feeIndex).get('specificMonths')?.value || [];
    return specificMonths.includes(month);
  }

  updateRouteAmount(feeIndex: number, optionIndex: number, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const routeId = select.value;
    const route = this.routes.find(r => r._id === routeId);
    const routeOptions = this.getRouteOptions(feeIndex);
    const fee = this.fees.at(feeIndex);
    if (route) {
      routeOptions.at(optionIndex).patchValue({ routeId, amount: route.feeAmount });
      const totalAmount = routeOptions.controls.reduce((sum, control) => sum + (control.value.amount || 0), 0);
      fee.patchValue({ amount: totalAmount });
    } else {
      routeOptions.at(optionIndex).patchValue({ routeId: '', amount: 0 });
      fee.patchValue({ amount: 0 });
    }
  }

  nextStep(): void {
    if (this.currentStep === 1) {
      if (!this.feeForm.get('academicYearId')?.value) {
        this.toastr.error('Please select an academic year');
        return;
      }
      if (!this.feeForm.get('classId')?.value) {
        this.toastr.error('Please select a class');
        return;
      }
    } else if (this.currentStep === 2) {
      if (!this.feeForm.get('frequency')?.value) {
        this.toastr.error('Please select a frequency');
        return;
      }
      this.fees.controls.forEach(fee => {
        if (!this.isEditMode || fee.value.frequency !== this.feeForm.get('frequency')?.value) {
          fee.patchValue({ frequency: this.feeForm.get('frequency')?.value });
        }
      });
    } else if (this.currentStep === 3) {
      for (let i = 0; i < this.fees.length; i++) {
        const fee = this.fees.at(i);
        if (fee.invalid) {
          this.toastr.error(`Please fill all required fields for ${fee.value.name}`);
          return;
        }
        if (fee.value.name === 'transportFee' && fee.value.amount > 0 && this.routes.length) {
          const routeOptions = this.getRouteOptions(i);
          if (routeOptions.length === 0) {
            this.toastr.error('Please add at least one route option for transport fee');
            return;
          }
          for (let j = 0; j < routeOptions.length; j++) {
            const option = routeOptions.at(j);
            if (option.get('routeId')?.value === '') {
              this.toastr.error('Please select a route for all route options');
              return;
            }
            if (option.invalid) {
              this.toastr.error('Please fill all required fields for route options');
              return;
            }
          }
        }
        if (fee.value.frequency === 'Specific Months' && !fee.value.specificMonths?.length) {
          this.toastr.error(`Please select at least one month for ${fee.value.name}`);
          return;
        }
      }
      if (this.lateFeeConfig.value.isEnabled) {
        const calcType = this.lateFeeConfig.value.calculationType;
        if (calcType === 'daily' && this.lateFeeConfig.value.dailyRate <= 0) {
          this.toastr.error('Daily rate must be greater than 0');
          return;
        }
        if (calcType === 'fixed' && this.lateFeeConfig.value.fixedAmount <= 0) {
          this.toastr.error('Fixed amount must be greater than 0');
          return;
        }
        if (calcType === 'percentage' && this.lateFeeConfig.value.percentageRate <= 0) {
          this.toastr.error('Percentage rate must be greater than 0');
          return;
        }
        if (this.lateFeeConfig.value.maxLateFee <= 0) {
          this.toastr.error('Maximum late fee must be greater than 0');
          return;
        }
      }
    }
    this.currentStep++;
  }

  prevStep(): void {
    if (this.currentStep > 1) this.currentStep--;
  }

  submitFeeStructure(): void {
    if (this.feeForm.invalid) {
      this.toastr.error('Please fill all required fields');
      this.feeForm.markAllAsTouched();
      return;
    }
    const createdBy = this.authService.getUserId();
    if (!createdBy) {
      this.toastr.error('User ID not found. Please log in again.');
      return;
    }
    const formData: FeeStructure = {
      ...this.feeForm.value,
      schoolId: this.schoolId,
      createdBy,
      _id: this.isEditMode ? this.selectedStructureId : undefined,
      fees: this.feeForm.value.fees.map((fee: FeeItem) => ({
        ...fee,
        routeOptions: fee.name === 'transportFee' && fee.amount > 0 && this.routes.length ? fee.routeOptions.filter((opt: RouteOption) => opt.routeId) : [],
        specificMonths: fee.frequency === 'Specific Months' ? fee.specificMonths : []
      })),
      academicYearId: { _id: this.feeForm.value.academicYearId, name: this.getAcademicYearName(this.feeForm.value.academicYearId) },
      classId: { _id: this.feeForm.value.classId, name: this.getClassName(this.feeForm.value.classId) }
    };
    const serviceCall = this.isEditMode
      ? this.feeService.updateFeeStructure(this.selectedStructureId!, formData)
      : this.feeService.createFeeStructure(formData);

    serviceCall.subscribe({
      next: () => {
        this.toastr.success(`${this.isEditMode ? 'Updated' : 'Created'} fee structure successfully`);
        this.loadFeeStructures();
        this.closeModal();
      },
      error: (err) => {
        this.toastr.error(err.error?.message || `Failed to ${this.isEditMode ? 'update' : 'create'} fee structure`);
        console.error(`Error ${this.isEditMode ? 'updating' : 'creating'} fee structure:`, err);
      }
    });
  }

  closeModal(): void {
    this.modalService.dismissAll();
    this.currentStep = 1;
    this.isEditMode = false;
    this.selectedStructureId = null;
    this.feeForm.reset();
    this.fees.clear();
    this.discounts.clear();
  }

  getClassName(classId: string): string {
    const classItem = this.classList.find(c => c._id === classId);
    return classItem ? classItem.name : 'N/A';
  }

  getAcademicYearName(yearId: string): string {
    const year = this.academicYears.find(y => y._id === yearId);
    return year ? year.name : 'N/A';
  }

  getRouteName(routeId: string): string {
    const route = this.routes.find(r => r._id === routeId);
    return route ? `${route.name} (₹${route.feeAmount})` : 'N/A';
  }

 addCustomFee(): void {
    this.addFee('', 'Base'); // Add a new fee with empty name and default type, editable by user
  }
}