import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { LoadingService } from 'src/app/theme/shared/service/loading.service';

@Component({
  selector: 'app-bouncing-loader',
  templateUrl: './bouncing-loader.component.html',
  imports:[CommonModule],
  styleUrls: ['./bouncing-loader.component.scss']
})
export class BouncingLoaderComponent implements OnInit {
  isLoading$: Observable<boolean>;

  constructor(public loadingService: LoadingService) {
    this.isLoading$ = this.loadingService.loading$;
  }

  ngOnInit() {}
}