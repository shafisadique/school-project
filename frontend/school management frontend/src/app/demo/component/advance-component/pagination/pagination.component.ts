import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-pagination',
  imports: [CommonModule, NgbPaginationModule, FormsModule],
  templateUrl: './pagination.component.html',
  styleUrls: ['./pagination.component.scss'],
  standalone: true
})
export class PaginationComponent {
  @Input() currentPage: number = 1;
  @Input() pageSize: number = 25;
  @Input() totalItems: number = 0;
  @Input() pageSizeOptions: number[] = [10, 25, 50, 100];

  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();

  onPageChange(page: number) {
    this.currentPage = page; // Update local currentPage
    this.pageChange.emit(page); // Emit the new page to the parent
  }

  onPageSizeChange() {
    this.pageSizeChange.emit(this.pageSize);
  }

  getStartIndex(): number {
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  getEndIndex(): number {
    return Math.min(this.currentPage * this.pageSize, this.totalItems);
  }
}