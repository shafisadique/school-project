import { Component, viewChild, AfterViewInit } from '@angular/core';
import { ApexOptions, ChartComponent, NgApexchartsModule } from 'ng-apexcharts';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-chart-test',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule],
  template: `
    <div style="width: 300px; height: 300px;">
      <apx-chart
        #testChart
        [series]="chartOptions.series"
        [chart]="chartOptions.chart"
        [labels]="chartOptions.labels"
        [colors]="chartOptions.colors"
      ></apx-chart>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      padding: 20px;
    }
    apx-chart {
      width: 100% !important;
      height: 100% !important;
    }
  `]
})
export class ChartTestComponent implements AfterViewInit {
  chartOptions: Partial<ApexOptions> = {
    chart: { type: 'pie', height: 300, toolbar: { show: false } },
    labels: ['Present', 'Absent', 'Late'],
    series: [10, 1, 0], // Dummy data
    colors: ['#198754', '#dc3545', '#6c757d']
  };
  testChart = viewChild<ChartComponent>('testChart');

  ngAfterViewInit() {
    if (this.testChart()) {
      console.log('Chart initialized, updating with:', this.chartOptions.series);
      this.testChart()?.updateOptions(this.chartOptions, true, true);
    } else {
      console.log('Chart not initialized');
    }
  }
}