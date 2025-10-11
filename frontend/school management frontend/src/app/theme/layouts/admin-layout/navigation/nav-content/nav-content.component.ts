// Angular import
import { Component, OnInit, inject, output } from '@angular/core';
import { CommonModule, Location, LocationStrategy } from '@angular/common';
import { RouterModule } from '@angular/router';

// project import
import { NavigationItem, NavigationItems } from '../navigation';
import { environment } from 'src/environments/environment';

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
        ProfileOutline,
        BgColorsOutline,
        AntDesignOutline,
        ChromeOutline,
        QuestionOutline
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
    if (role === 'superadmin') {
    this.navigations = [
      {
        id: 'dashboard',
        title: 'Dashboard',
        type: 'group',
        icon: 'dashboard',
        children: [
          { id: 'default-dash', title: 'Default', type: 'item', url: '/dashboard/default', icon: 'dashboard' }
        ]
      },
      {
        id: 'subscription',
        title: 'Subscription Management',
        type: 'group',
        icon: 'credit-card',
        children: [
          { id: 'manage-subscription', title: 'Manage Subscriptions', type: 'item', url: '/subscription-management', icon: 'credit-card' }
        ]
      },
      {
        id: 'approve',
        title: 'Approve',
        type: 'group',
        icon: 'check',
        children: [
          { id: 'approve-requests', title: 'Approve Requests', type: 'item', url: '/approve', icon: 'check' }
        ]
      }
    ];
  } 
    if (role === 'teacher') {
      
      // For teachers, show only Dashboard and Attendance
      this.navigations = [
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
          id: 'attendance',
          title: 'Attendance',
          type: 'group',
          icon: 'team',
          children: [
            {
              id: 'attendance-details',
              title: 'Teacher Attendance',
              type: 'item',
              url: '/teacher/attendance', // Adjust to match your route
              icon: 'user'
            },
            {
              id: 'attendance-details',
              title: 'Student Attendance',
              type: 'item',
              url: '/attendance', // Adjust to match your route
              icon: 'user'
            },
             {
              id: 'attendance-details',
              title: 'Student Weekly Report',
              type: 'item',
              url: '/student/student-progress-reports-weekly', // Adjust to match your route
              icon: 'user'
            },
          ]
        },
        //  {
        //   id: 'Exam',
        //   title: 'Exam',
        //   type: 'group',
        //   icon: 'team',
        //   children: [
        //     { id: 'exam-history', title: 'Exam History', type: 'item', url: '/exams-&-progress/exam-list', icon: 'user' }
        //   ]
        // },
        {
          id: 'Assignment',
          title: 'Assignment',
          type: 'group',
          icon: 'team',
          children: [
            { id: 'assignment', title: 'Create Assignment', type: 'item', url: '/assignment', icon: 'user' },
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
          id: 'Teacher',
          title: 'Teacher ',
          type: 'group',
          icon: 'team',
          children: [
            { id: '', title: 'Apply for Leave', type: 'item', url: '/teacher/apply-leave', icon: 'user' },
          ]
        }
      ];
    } else {
      // For other roles (e.g., admin), show all items
      this.navigations = NavigationItems;
    }
  }
}
