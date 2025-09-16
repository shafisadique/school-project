export interface NavigationItem {
  id: string;
  title: string;
  type: 'item' | 'collapse' | 'group';
  translate?: string;
  icon?: string;
  hidden?: boolean;
  url?: string;
  classes?: string;
  groupClasses?: string;
  exactMatch?: boolean;
  external?: boolean;
  target?: boolean;
  breadcrumbs?: boolean;
  children?: NavigationItem[];
  link?: string;
  description?: string;
  path?: string;
}

export const NavigationItems: NavigationItem[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    type: 'group',
    icon: 'dashboard',
    children: [
      {
        id: 'default-dash',
        title: 'Dashboard',
        type: 'item',
        url: '/dashboard/default',
        icon: 'dashboard'
      }
    ]
  },
  
  {
    id: 'student',
    title: 'Student',
    type: 'group', // Changed to collapse
    icon: 'team',
    children: [
      {
        id: 'student-details',
        title: 'Student Details',
        type: 'item',
        url: '/student/student-details',
        icon: 'user'
      },
      
      {
        id: 'student-promotion',
        title: 'Student Promotion',
        type: 'item',
        url: '/student/student-promotion',
        icon: 'user'
      },
      {
        id: 'assign-rollno-to-student',
        title: 'Student Roll No',
        type: 'item',
        url: '/class-&-subject-management/assign-roll-numbers',
        icon: 'user'
      },
    ]
  },
  {
    id: 'teacher',
    title: 'Teacher',
    type: 'group', // Changed to collapse
    icon: 'team',
    children: [
      {
        id: 'teacher-details',
        title: 'Teacher Details',
        type: 'item',
        url: '/teacher/teacher-details',
        icon: 'user'
      },
      
      {
        id: 'teacher-create',
        title: 'Approve/Reject Leaves',
        type: 'item',
        url: '/teacher/approve-leaves',
        icon: 'user'
      },
            {
        id: 'Pending Teacher Absence Request',
        title: 'Pending Teacher Absence/Reject',
        type: 'item',
        url: '/teacher/admin/teacher-absences',
        icon: 'user'
      },
    ]
  },

  {
    id: 'class-&-subject-management',
    title: 'Class & Subject Management',
    type: 'group', // Changed to collapse
    icon: 'team',
    children: [
      {
        id: 'class-&-subject-management',
        title: 'Class & Subject',
        type: 'item',
        url: '/class-&-subject-management',
        icon: 'user'
      },
      {
        id: 'class-&-subject-combined',
        title: 'Class & Subject combined',
        type: 'item',
        url: '/class-&-subject-management/combined-class-and-subject',
        icon: 'user'
      },
     
    ]
  },
  {
    id: 'time-table',
    title: 'Time Table Management',
    type: 'group', // Changed to collapse
    icon: 'team',
    children: [
      {
        id: 'time-table',
        title: 'Time Table',
        type: 'item',
        url: '/time-table/time-table-details',
        icon: 'user'
      },
    ]
  },
  {
    id: 'Exam',
    title: 'Exam',
    type: 'group', // Changed to collapse
    icon: 'team',
    children: [
      {
        id: 'exam',
        title: 'Exam History',
        type: 'item',
        url: '/exams-&-progress/exam-list',
        icon: 'user'
      },
      {
        id: 'exam',
        title: 'Exam-Create',
        type: 'item',
        url: '/exams-&-progress/create-exam',
        icon: 'user'
      },
      
  ]
},
    {
    id: 'result',
    title: 'Result ',
    type: 'group', // Changed to collapse
    icon: 'team',
    children: [
      {
        id: 'result-list',
        title: 'Result List',
        type: 'item',
        url: '/result/admin-results',
        icon: 'user'
      },
    ]},
  {
    id: 'fee',
    title: 'Fee',
    type: 'group', // Changed to collapse
    icon: 'team',
    children: [
      {
        id: 'fee-structure',
        title: 'Fee Structure',
        type: 'item',
        url: '/fee/fee-structure',
        icon: 'user'
      },
      {
        id: 'generate-invoice',
        title: 'Monthly Invoice create',
        type: 'item',
        url: '/fee/bulk-generate-invoice',
        icon: 'user'
      },
      {
        id: 'invoice-list',
        title: 'Invoice List',
        type: 'item',
        url: '/fee/bulk-invoice-list',
        icon: 'user'
      },
      
      // {
      //   id: 'generate-invoice',
      //   title: 'Generate Monthly Invoice',
      //   type: 'item',
      //   url: '/fee/generate-invoice',
      //   icon: 'user'
      // },

      // {
      //   id: 'generate-invoice',
      //   title: 'Pay Fee',
      //   type: 'item',
      //   url: '/fee/pay-student-fee',
      //   icon: 'user'
      // },

      {
        id: 'fee-collection-reports',
        title: 'Fee collection Reports',
        type: 'item',
        url: '/fee/fee-collection-reports',
        icon: 'user'
      },
    ]
  },
  {
    id: 'fee',
    title: 'Transporatation',
    type: 'group', // Changed to collapse
    icon: 'team',
    children: [
      {
        id: 'transporatation',
        title: 'Transporatation Details',
        type: 'item',
        url: '/route/route-transportation',
        icon: 'user'
      },
    ]
  }
  
];
