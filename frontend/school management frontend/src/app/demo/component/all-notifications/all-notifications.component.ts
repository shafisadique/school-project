import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-all-notifications',
  imports: [CommonModule],
  templateUrl: './all-notifications.component.html',
  styleUrl: './all-notifications.component.scss'
})
export class AllNotificationsComponent {
notifications: any[] = [];
  private http = inject(HttpClient);
  private toastr = inject(ToastrService);

  ngOnInit() {
    this.loadNotifications();
  }

  loadNotifications() {
    this.http.get<any>(`${environment.apiUrl}/api/notifications/me`).subscribe({
      next: (res) => {
        this.notifications = res.notifications || [];
      }
    });
  }
  markAsRead(id: string) {
    this.http.patch(`${environment.apiUrl}/api/notifications/${id}/read`, {}).subscribe({
      next: () => {
        const n = this.notifications.find(x => x._id === id);
        if (n) n.status = 'read';
      }
    });
  }
}
