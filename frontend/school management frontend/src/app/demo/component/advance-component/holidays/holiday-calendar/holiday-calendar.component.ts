import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CommonModule } from '@angular/common';
import { DatePipe } from '@angular/common';
import { Holiday, HolidayService } from '../holiday.service';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-holiday-calendar',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule,FormsModule],
  providers: [DatePipe],
  templateUrl: './holiday-calendar.component.html',
  styleUrls: ['./holiday-calendar.component.scss']
})
export class HolidayCalendarComponent implements OnInit {
  holidays: Holiday[] = [];
  filteredHolidays: Holiday[] = [];
  upcomingHolidays: Holiday[] = [];
  loading = false;
  error: string | null = null;

  // Pagination
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;

  // Filter
  searchTerm = '';
  startDate: string | null = null;
  endDate: string | null = null;

  // Form
  holidayForm: FormGroup;
  isEditing = false;
  selectedHolidayId: string | null = null;

  constructor(
    private holidayService: HolidayService,
    private authService: AuthService,
    private fb: FormBuilder,
    private modalService: NgbModal,
    private toastr: ToastrService,
    private datePipe: DatePipe
  ) {
    this.holidayForm = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(100)]],
      date: ['', Validators.required],
      description: ['', Validators.maxLength(500)]
    });
  }

  ngOnInit(): void {
    this.loadHolidays();
  }

  loadHolidays(): void {
    this.loading = true;
    this.error = null;

    const schoolId = this.authService.getSchoolId();
    if (!schoolId) {
      this.error = 'School ID not found';
      this.toastr.error(this.error);
      this.loading = false;
      return;
    }

    const params: any = {};
    if (this.startDate) params.startDate = this.startDate;
    if (this.endDate) params.endDate = this.endDate;

    this.holidayService.getHolidays(schoolId, params).subscribe({
      next: (holidays) => {
        this.holidays = holidays.map(h => ({
          ...h,
          date: this.formatDate(new Date(h.date)) // Ensure YYYY-MM-DD format
        }));
        this.filterHolidays();
        this.getUpcomingHolidays();
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load holidays. Please try again.';
        this.toastr.error(this.error);
        this.loading = false;
        console.error(err);
      }
    });
  }

  filterHolidays(): void {
    let result = [...this.holidays];

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(h =>
        h.title.toLowerCase().includes(term) ||
        (h.description && h.description.toLowerCase().includes(term))
      );
    }

    if (this.startDate) {
      result = result.filter(h => h.date >= this.startDate);
    }

    if (this.endDate) {
      result = result.filter(h => h.date <= this.endDate);
    }

    this.filteredHolidays = result;
    result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    this.totalItems = result.length;
    this.currentPage = 1;
  }

  getUpcomingHolidays(): void {
    const today = this.formatDate(new Date());
    this.upcomingHolidays = this.holidays
      .filter(h => h.date >= today)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5);
  }

  daysUntil(date: string): number {
    const today = new Date();
    const holidayDate = new Date(date);
    const diffTime = holidayDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  formatDate(date: Date): string {
    return this.datePipe.transform(date, 'yyyy-MM-dd') || date.toISOString().split('T')[0];
  }

  openModal(content: any, holiday?: Holiday): void {
    if (holiday) {
      this.isEditing = true;
      this.selectedHolidayId = holiday._id;
      this.holidayForm.patchValue({
        title: holiday.title,
        date: holiday.date,
        description: holiday.description
      });
    } else {
      this.isEditing = false;
      this.selectedHolidayId = null;
      this.holidayForm.reset();
    }

    this.modalService.open(content, { ariaLabelledBy: 'modal-basic-title' });
  }

  saveHoliday(): void {
    if (this.holidayForm.invalid) {
      this.holidayForm.markAllAsTouched();
      return;
    }

    const schoolId = this.authService.getSchoolId();
    if (!schoolId) {
      this.toastr.error('School ID not found');
      return;
    }

    const holidayData: Holiday = {
      ...this.holidayForm.value,
      schoolId
    };

    this.loading = true;

    const operation = this.isEditing && this.selectedHolidayId
      ? this.holidayService.updateHoliday(this.selectedHolidayId, holidayData)
      : this.holidayService.addHoliday(holidayData);

    operation.subscribe({
      next: () => {
        this.toastr.success(this.isEditing ? 'Holiday updated successfully' : 'Holiday added successfully');
        this.loadHolidays();
        this.modalService.dismissAll();
        this.loading = false;
      },
      error: (err) => {
        this.error = this.isEditing ? 'Failed to update holiday' : 'Failed to add holiday';
        this.toastr.error(this.error);
        this.loading = false;
        console.error(err);
      }
    });
  }

  deleteHoliday(id: string): void {
    if (confirm('Are you sure you want to delete this holiday?')) {
      this.loading = true;
      this.holidayService.deleteHoliday(id).subscribe({
        next: () => {
          this.toastr.success('Holiday deleted successfully');
          this.loadHolidays();
          this.loading = false;
        },
        error: (err) => {
          this.error = 'Failed to delete holiday';
          this.toastr.error(this.error);
          this.loading = false;
          console.error(err);
        }
      });
    }
  }

  // Pagination methods
  get paginatedHolidays(): Holiday[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredHolidays.slice(startIndex, startIndex + this.itemsPerPage);
  }

  get totalPages(): number {
    return Math.ceil(this.totalItems / this.itemsPerPage);
  }

  getPageNumbers(): number[] {
    const pages = [];
    for (let i = 1; i <= this.totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }
}