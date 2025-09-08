import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

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

  getClassesBySchool(schoolId: string): Observable<Class[]> {
    return this.http.get<Class[]>(`${this.apiUrl}/api/class-subject-management/classes/${schoolId}`);
  }

  // getStudentsByClass(classId: string): Observable<any> {
  //   const url = `${this.apiUrl}/api/students/get-student-by-class/${classId}`;
  //   return this.http.get(url);
  // }

  getStudentsByClass(classId: string, academicYearId: string): Observable<any> {
    const url = `${this.apiUrl}/api/students/get-student-by-class/${classId}`;
    const params = new HttpParams().set('academicYearId', academicYearId); // Add academicYearId as query param
    return this.http.get(url, { params });
  }

  assignRollNumbers(classId: string): Observable<any> {
    const url = `${this.apiUrl}/api/students/assign-roll-numbers?classId=${classId}`; // Fixed: classId
    console.log('Calling assignRollNumbers with URL:', url);
    return this.http.post(url, {});
  }

  assignRollNumbersAlphabetically(classId: string): Observable<any> {
    const url = `${this.apiUrl}/api/students/assign-roll-numbers-alphabetically?classId=${classId}`; // Fixed: classId
    console.log('Calling assignRollNumbersAlphabetically with URL:', url);
    return this.http.post(url, {});
  }

  assignRollNumberToStudent(studentId: string, rollNo: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/api/students/${studentId}/assign-roll-number`, { rollNo });
  }

  createClass(classData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/class-subject-management/classes`, classData);
  }

  createSubject(subjectData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/class-subject-management/subject`, subjectData);
  }

  getSubjects(schoolId: string): Observable<Subject[]> {
    return this.http.get<Subject[]>(`${this.apiUrl}/api/class-subject-management/subjects/${schoolId}`);
  }

  getTeachers(schoolId: string): Observable<Teacher[]> {
    return this.http.get<Teacher[]>(`${this.apiUrl}/api/class-subject-management/teachers/by-school/${schoolId}`);
  }

  getCombinedAssignments(schoolId: string, academicYearId: string): Observable<Assignment[]> {
    const params = new HttpParams().set('academicYearId', academicYearId);
    return this.http.get<Assignment[]>(`${this.apiUrl}/api/class-subject-management/assignments/${schoolId}`, { params });
  }

  assignSubjectToClass(classId: string, subjectId: string, teacherId: string, academicYearId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/class-subject-management/assign-subject`, {
      classId,
      subjectId,
      teacherId,
      academicYearId
    });
  }
  updateAssignment(data: { classId: string, subjectId: string, teacherId: string, academicYearId: string }) {
    return this.http.put(`${this.apiUrl}/api/class-subject-management/assign-subject`, data);
  }

  getAssignmentsByTeacher(teacherId: string, academicYearId: string, date?: string): Observable<Assignment[]> {
    let params = new HttpParams().set('academicYearId', academicYearId);
    if (date) {
      params = params.set('date', date);
    }
    return this.http.get<Assignment[]>(`${this.apiUrl}/api/class-subject-management/assignments/teacher/${teacherId}`, { params });
  }

  updateAttendanceTeachers(classId: string, attendanceTeacher: string | null, substituteAttendanceTeachers: string[]): Observable<any> {
    return this.http.put(`${this.apiUrl}/api/class-subject-management/update-attendance-teachers`, {
      classId,
      attendanceTeacher,
      substituteAttendanceTeachers
    });
  }
}