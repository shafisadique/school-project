export interface Timetable {
    _id?: string;
    schoolId: string;
    className: string;
    subject: { _id: string; name: string };
    teacher: { _id: string; name: string };
    day: string;
    startTime: string;
    endTime: string;
    room: string;
  }
  