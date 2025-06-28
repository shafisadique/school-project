import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouteService } from '../route.service';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { ToastrService } from 'ngx-toastr';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-route-transportation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './route-transportation.component.html',
  styleUrls: ['./route-transportation.component.scss']
})
export class RouteTransportationComponent implements OnInit {
  routes:any[] = [];
  newRoute = {
    name: '',
    pickupPoints: ['Default Point'], // Start with a default point
    distance: null,
    feeAmount: null,
    frequency: 'Monthly'
  };
  selectedRoute: any = null;
  editMode = false;
  students: any[] = []; // Placeholder; replace with StudentService data
  selectedStudentId: string | null = null;
  schoolId: string | null = null;
  currentRoute: any = this.newRoute;

  constructor(
    private routeService: RouteService,
    private authService: AuthService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.schoolId = this.authService.getUserSchoolId();
    if (!this.schoolId) {
      this.toastr.error('School ID not found. Please log in again.', 'Error');
      return;
    }
    this.loadRoutes();
  }

  loadRoutes(): void {
    this.routeService.getRoutes().subscribe({
      next: (data:any) => {
        this.routes = data.data;
        console.log(this.routes)
      },
      error: (err) => this.toastr.error('Failed to load routes', 'Error')
    });
  }

  addPickupPoint(): void {
    this.currentRoute.pickupPoints.push(''); // User can edit this
  }

  removePickupPoint(index: number): void {
    if (this.currentRoute.pickupPoints.length > 1) {
      this.currentRoute.pickupPoints.splice(index, 1);
    } else {
      this.toastr.warning('At least one pickup point is required', 'Warning');
    }
  }


createRoute(): void {
  if (!this.currentRoute.name || !this.currentRoute.pickupPoints.length || this.currentRoute.distance === null || this.currentRoute.feeAmount === null) {
    this.toastr.warning('All fields are required', 'Warning');
    return;
  }
  const userId = this.authService.getUserId();
  if (!userId) {
    this.toastr.error('User ID not found. Please log in again.', 'Error');
    return;
  }
  const payload = {
    ...this.currentRoute,
    pickupPoints: this.currentRoute.pickupPoints.filter(point => point.trim().length > 0),
    schoolId: this.schoolId
    // Do not include createdBy here; it will be set by the backend
  };
  if (payload.pickupPoints.length === 0) {
    this.toastr.warning('At least one valid pickup point is required', 'Warning');
    return;
  }
  console.log('Sending payload:', payload);
  this.routeService.createRoute(payload).subscribe({
    next: () => {
      this.toastr.success('Route created successfully', 'Success');
      this.resetForm();
      this.loadRoutes();
    },
    error: (err) => this.toastr.error(`Failed to create route: ${err.message}`, 'Error')
  });
}


  editRoute(route: any): void {
    this.selectedRoute = { ...route };
    this.currentRoute = this.selectedRoute;
    this.editMode = true;
  }

  updateRoute(): void {
    if (!this.currentRoute._id || !this.currentRoute.name || !this.currentRoute.pickupPoints.length || this.currentRoute.distance === null || this.currentRoute.feeAmount === null) {
      this.toastr.warning('All fields are required', 'Warning');
      return;
    }
    const payload = {
      ...this.currentRoute,
      pickupPoints: this.currentRoute.pickupPoints.filter(point => point.trim().length > 0)
    };
    if (payload.pickupPoints.length === 0) {
      this.toastr.warning('At least one valid pickup point is required', 'Warning');
      return;
    }
    this.routeService.updateRoute(this.currentRoute._id, payload).subscribe({
      next: () => {
        this.toastr.success('Route updated successfully', 'Success');
        this.editMode = false;
        this.selectedRoute = null;
        this.currentRoute = this.newRoute;
        this.loadRoutes();
      },
      error: (err) => this.toastr.error(`Failed to update route: ${err.message}`, 'Error')
    });
  }

  deleteRoute(id: string): void {
    if (confirm('Are you sure you want to delete this route?')) {
      this.routeService.deleteRoute(id).subscribe({
        next: () => {
          this.toastr.success('Route deleted successfully', 'Success');
          this.loadRoutes();
        },
        error: (err) => this.toastr.error('Failed to delete route (possibly due to assigned students)', 'Error')
      });
    }
  }

  assignRoute(): void {
    if (!this.selectedStudentId) {
      this.toastr.warning('Please select a student', 'Warning');
      return;
    }
    const routeId = this.selectedRoute ? this.selectedRoute._id : null;
    this.routeService.assignRoute(this.selectedStudentId, routeId).subscribe({
      next: () => {
        this.toastr.success('Route assigned to student successfully', 'Success');
        this.selectedStudentId = null;
        this.selectedRoute = null;
      },
      error: (err) => this.toastr.error('Failed to assign route', 'Error')
    });
  }

  resetForm(): void {
    this.newRoute = {
      name: '',
      pickupPoints: ['Default Point'],
      distance: null,
      feeAmount: null,
      frequency: 'Monthly'
    };
    this.currentRoute = this.newRoute;
    this.editMode = false;
    this.selectedRoute = null;
  }

  // Method to evaluate the disabled state
  isFormInvalid(): boolean {
    return !this.currentRoute.name || this.currentRoute.pickupPoints.some(p => !p.trim()) || this.currentRoute.distance === null || this.currentRoute.feeAmount === null;
  }
}