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
        title: 'Default',
        type: 'item',
        url: '/dashboard/default',
        icon: 'dashboard'
      }
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
        title: 'Teacher Create',
        type: 'item',
        url: '/teacher/teacher-create',
        icon: 'user'
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
        id: 'teacher-create',
        title: 'Student Create',
        type: 'item',
        url: '/student/student-create',
        icon: 'user'
      }
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
        title: 'Bulk Monthly Fee Invoice',
        type: 'item',
        url: '/fee/bulk-generate-invoice',
        icon: 'user'
      },
      {
        id: 'generate-invoice',
        title: 'Generate Monthly Invoice',
        type: 'item',
        url: '/fee/generate-invoice',
        icon: 'user'
      },

      {
        id: 'generate-invoice',
        title: 'Pay Fee',
        type: 'item',
        url: '/fee/pay-student-fee',
        icon: 'user'
      },
      {
        id: 'generate-invoice',
        title: 'Recipt Fee',
        type: 'item',
        url: '/fee/fee-receipt',
        icon: 'user'
      },
    ]
  }
];
