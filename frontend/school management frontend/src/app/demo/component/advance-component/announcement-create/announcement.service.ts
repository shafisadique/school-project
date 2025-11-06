import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

interface Announcement {
  title: string;
  body: string;
  targetUsers?: string[]; // Or targetRoles
}

@Injectable({
  providedIn: 'root'
})
export class AnnouncementService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  create(announcement: Announcement): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/auth/announcements`, announcement);
  }

  getList(page: number = 1, limit: number = 10): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/auth/announcements?page=${page}&limit=${limit}`);
  }
}