// Angular import
import { Component, OnInit, inject, output } from '@angular/core';
import { CommonModule, Location, LocationStrategy } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FileDoneOutline } from '@ant-design/icons-angular/icons';
// project import
import { NavigationItem, NavigationItems } from '../navigation';
import { environment } from 'src/environments/environment';
import { TrophyOutline } from '@ant-design/icons-angular/icons';
import { NavGroupComponent } from './nav-group/nav-group.component';

// icon
import { IconService } from '@ant-design/icons-angular';
import {
  DashboardOutline,
  CreditCardOutline,
  LoginOutline,
  QuestionOutline,
  ChromeOutline,
  FontSizeOutline,
  ProfileOutline,
  BgColorsOutline,
  AntDesignOutline
} from '@ant-design/icons-angular/icons';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { NavCollapseComponent } from "./nav-collapse/nav-collapse.component";
import { AuthService } from 'src/app/theme/shared/service/auth.service';

@Component({
  selector: 'app-nav-content',
  imports: [CommonModule, RouterModule, NavGroupComponent, NgScrollbarModule, NavCollapseComponent],
  templateUrl: './nav-content.component.html',
  styleUrls: ['./nav-content.component.scss']
})
export class NavContentComponent implements OnInit {
  private location = inject(Location);
  private locationStrategy = inject(LocationStrategy);
  private iconService = inject(IconService);

  // public props
  NavCollapsedMob = output();

  navigations: NavigationItem[];

  // version
  title = 'Demo application for version numbering';
  currentApplicationVersion = environment.appVersion;

  navigation = NavigationItems;
  windowWidth = window.innerWidth;

  // Constructor
  constructor(private authService:AuthService) {
    this.iconService.addIcon(
      ...[
        DashboardOutline,
        CreditCardOutline,
        FontSizeOutline,
        LoginOutline,
        TrophyOutline,
        ProfileOutline,
        BgColorsOutline,
        AntDesignOutline,
        ChromeOutline,
        QuestionOutline,
        FileDoneOutline
      ]
    );
    this.navigations = NavigationItems;
    this.updateNavigations();
  }

  // Life cycle events
  ngOnInit() {
    if (this.windowWidth < 1025) {
      (document.querySelector('.coded-navbar') as HTMLDivElement).classList.add('menupos-static');
    }
  }

  fireOutClick() {
    let current_url = this.location.path();
    const baseHref = this.locationStrategy.getBaseHref();
    if (baseHref) {
      current_url = baseHref + this.location.path();
    }
    const link = "a.nav-link[ href='" + current_url + "' ]";
    const ele = document.querySelector(link);
    if (ele !== null && ele !== undefined) {
      const parent = ele.parentElement;
      const up_parent = parent?.parentElement?.parentElement;
      const last_parent = up_parent?.parentElement;
      if (parent?.classList.contains('coded-hasmenu')) {
        parent.classList.add('coded-trigger');
        parent.classList.add('active');
      } else if (up_parent?.classList.contains('coded-hasmenu')) {
        up_parent.classList.add('coded-trigger');
        up_parent.classList.add('active');
      } else if (last_parent?.classList.contains('coded-hasmenu')) {
        last_parent.classList.add('coded-trigger');
        last_parent.classList.add('active');
      }
    }
  }

  navMob() {
    if (this.windowWidth < 1025 && document.querySelector('app-navigation.coded-navbar').classList.contains('mob-open')) {
      this.NavCollapsedMob.emit();
    }
  }


   private updateNavigations() {
  const role = this.authService.getUserRole();
  
  switch (role) {
    // case 'superadmin':
    //   this.navigations = [
    //     {
    //       id: 'dashboard',
    //       title: 'Dashboard',
    //       type: 'group',
    //       icon: 'dashboard',
    //       children: [
    //         { id: 'default-dash', title: 'Default', type: 'item', url: '/dashboard/default', icon: 'dashboard' }
    //       ]
    //     },
    //     {
    //       id: 'subscription',
    //       title: 'Subscription Management',
    //       type: 'group',
    //       icon: 'credit-card',
    //       children: [
    //         { id: 'manage-subscription', title: 'Manage Subscriptions', type: 'item', url: '/subscription-management', icon: 'credit-card' }
    //       ]
    //     },
    //     {
    //       id: 'approve',
    //       title: 'Approve',
    //       type: 'group',
    //       icon: 'check',
    //       children: [
    //         { id: 'approve-requests', title: 'Approve Requests', type: 'item', url: '/approve', icon: 'check' }
    //       ]
    //     }
    //   ];
    //   break;

    case 'admin':
      this.navigations = NavigationItems; // or define specific admin navigation
      break;

    case 'teacher':
      this.navigations = [
        {
          id: 'dashboard',
          title: 'Teacher Dashboard',
          type: 'group',
          icon: 'dashboard',
          children: [
            {
              id: 'default-dash',
              title: 'Default',
              type: 'item',
              url: '/teacher-dashboard',
              icon: 'dashboard'
            }
          ]
        },
        {
          id: 'attendance',
          title: 'Attendance',
          type: 'group',
          icon: 'team',
          children: [
            {
              id: 'teacher-attendance',
              title: 'Teacher Attendance',
              type: 'item',
              url: '/teacher/attendance',
              icon: 'user'
            },
            {
              id: 'student-attendance',
              title: 'Student Attendance',
              type: 'item',
              url: '/attendance',
              icon: 'user'
            },
            {
              id: 'student-weekly-report',
              title: 'Student Weekly Report',
              type: 'item',
              url: '/student/student-progress-reports-weekly',
              icon: 'user'
            },
          ]
        },
        {
          id: 'assignment',
          title: 'Assignment',
          type: 'group',
          icon: 'team',
          children: [
            { id: 'create-assignment', title: 'Create Assignment', type: 'item', url: '/assignment-details', icon: 'user' },
          ]
        },
        {
          id: 'result',
          title: 'Result',
          type: 'group',
          icon: 'team',
          children: [
            { id: 'result-list', title: 'Result List', type: 'item', url: '/result/result-list', icon: 'user' },
            { id: 'result-create', title: 'Result Create', type: 'item', url: '/result/create-result', icon: 'user' }
          ]
        },
        {
          id: 'teacher-leave',
          title: 'Teacher',
          type: 'group',
          icon: 'team',
          children: [
            { id: 'apply-leave', title: 'Apply for Leave', type: 'item', url: '/teacher/apply-leave', icon: 'user' },
          ]
        }
      ];
      break;

    case 'parent':
      this.navigations = [
        {
          id: 'dashboard',
          title: 'Parent Dashboard',
          type: 'group',
          icon: 'dashboard',
          children: [
            { id: 'parent-dash', title: 'Dashboard', type: 'item', url: '/parent/dashboard', icon: 'dashboard' }
          ]
        },
        {
          id: 'children',
          title: 'My Children',
          type: 'group',
          icon: 'team',
          children: [
            { id: 'children-list', title: 'Children List', type: 'item', url: '/parent/children', icon: 'user' },
            { id: 'attendance', title: 'Attendance', type: 'item', url: '/parent/attendance', icon: 'calendar' },
            { id: 'progress', title: 'Progress Reports', type: 'item', url: '/parent/progress', icon: 'bar-chart' }
          ]
        },
        {
          id: 'payments',
          title: 'Payments',
          type: 'group',
          icon: 'credit-card',
          children: [
            { id: 'fee-payment', title: 'Fee Payment', type: 'item', url: '/parent/payments', icon: 'dollar' }
          ]
        }
      ];
      break;

    case 'student':
      this.navigations = [
        {
          id: 'dashboard',
          title: 'Student Dashboard',
          type: 'group',
          icon: 'dashboard',
          children: [
            { id: 'student-dash', title: 'Dashboard', type: 'item', url: '/student-dashboard', icon: 'dashboard' }
          ]
        },
        {
          id: 'academics',
          title: 'Academics',
          type: 'group',
          icon: 'tasks',
          children: [
            { id: 'timetable', title: 'Timetable', type: 'item', url: '/time-table/my-timetable', icon: 'calendar' },
            { id: 'assignments', title: 'Assignments', type: 'item', url: '/student-assignments-list', icon: 'file-done' },
            { id: 'results', title: 'Results', type: 'item', url: '/student-result', icon: 'trophy' }
          ]
        },
        {
          id: 'attendance',
          title: 'Attendance',
          type: 'group',
          icon: 'calendar',
          children: [
            { id: 'my-attendance', title: 'My Attendance', type: 'item', url: '/student-attenance', icon: 'user' }
          ]
        }
      ];
      break;

    default:
      // Fallback for unknown roles or guests
      this.navigations = [];
      break;
  }
}
}
