import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

// Define interfaces for type safety
interface Class {
  _id: string;
  name: string;
  sections: string[];
  schoolId: string;
  attendanceTeacher?: { _id: string; name: string };
  substituteAttendanceTeachers?: { _id: string; name: string }[];
}

interface Subject {
  _id: string;
  name: string;
  schoolId: string;
}

interface Teacher {
  _id: string;
  name: string;
  email: string;
}

interface Assignment {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  attendanceTeacherName?: string;
  substituteAttendanceTeachers?: { _id: string; name: string }[];
}

@Injectable({
  providedIn: 'root'
})
export class ClassSubjectService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Get Classes by School
  getClassesBySchool(schoolId: string): Observable<Class[]> {
    return this.http.get<Class[]>(`${this.apiUrl}/api/class-subject-management/classes/${schoolId}`);
  }

  // Fetch students by class
  getStudentsByClass(className: string): Observable<any> {
    const params = new HttpParams().set('className', className);
    return this.http.get(`${this.apiUrl}/api/class-subject-management/list`, { params });
  }

  // Assign roll numbers to students in a class (by creation order)
  assignRollNumbers(className: string): Observable<any> {
    const params = new HttpParams().set('className', className);
    return this.http.post(`${this.apiUrl}/api/students/assign-roll-numbers`, {}, { params });
  }

  // Assign roll numbers alphabetically
  assignRollNumbersAlphabetically(className: string): Observable<any> {
    const params = new HttpParams().set('className', className);
    return this.http.post(`${this.apiUrl}/api/students/assign-roll-numbers-alphabetically`, {}, { params });
  }

  // Assign a roll number to a specific student
  assignRollNumberToStudent(studentId: string, rollNo: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/api/students/${studentId}/assign-roll-number`, { rollNo });
  }

  // Create a new class
  createClass(classData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/class-subject-management/classes`, classData);
  }

  // Create a new subject
  createSubject(subjectData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/class-subject-management/subject`, subjectData); // Fixed endpoint to plural form
  }

  // Get subjects by school
  getSubjects(schoolId: string): Observable<Subject[]> {
    return this.http.get<Subject[]>(`${this.apiUrl}/api/class-subject-management/subjects/${schoolId}`);
  }

  // Get teachers by school
  getTeachers(schoolId: string): Observable<Teacher[]> {
    return this.http.get<Teacher[]>(`${this.apiUrl}/api/class-subject-management/teachers/by-school/${schoolId}`);
  }

  // Get combined assignments
  getCombinedAssignments(schoolId: string, academicYearId: string): Observable<Assignment[]> {
    const params = new HttpParams().set('academicYearId', academicYearId);
    return this.http.get<Assignment[]>(`${this.apiUrl}/api/class-subject-management/assignments/${schoolId}`, { params });
  }

  // Assign a subject to a class
  assignSubjectToClass(classId: string, subjectId: string, teacherId: string, academicYearId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/class-subject-management/assign-subject`, { // Changed to POST
      classId,
      subjectId,
      teacherId,
      academicYearId
    });
  }

  // Get assignments by teacher
  getAssignmentsByTeacher(teacherId: string, academicYearId: string, date?: string): Observable<Assignment[]> {
    let params = new HttpParams().set('academicYearId', academicYearId);
    if (date) {
      params = params.set('date', date);
    }
    return this.http.get<Assignment[]>(`${this.apiUrl}/api/class-subject-management/assignments/teacher/${teacherId}`, { params });
  }

  // Update attendance teachers for a class
  updateAttendanceTeachers(classId: string, attendanceTeacher: string | null, substituteAttendanceTeachers: string[]): Observable<any> {
    return this.http.put(`${this.apiUrl}/api/class-subject-management/update-attendance-teachers`, {
      classId,
      attendanceTeacher,
      substituteAttendanceTeachers
    });
  }
}