import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild } from '@angular/core';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-line-chart',
  standalone: true,
  template: `<canvas #cv></canvas>`,
  styles: [`:host{display:block;position:relative;width:100%;height:100%}`],
})
export class LineChart implements AfterViewInit, OnChanges, OnDestroy {
  @Input() labels: string[] = [];
  @Input() datasets: any[] = [];
  @Input() mini = false;
  @Input() fmt: '' | 'gbps' = '';   // 'gbps': ejes/tooltip en Kbps/Mbps/Gbps (el dato viene en Gbps)

  /** Valor en Gbps → texto auto-escalado. */
  static gbps(v: number): string {
    const n = Math.abs(v);
    if (n >= 1) return v.toFixed(2) + ' Gbps';
    if (n >= 0.001) return (v * 1000).toFixed(1) + ' Mbps';
    return (v * 1e6).toFixed(0) + ' Kbps';
  }

  @ViewChild('cv') cv!: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;
  private ready = false;

  ngAfterViewInit(): void { this.ready = true; this.render(); }
  ngOnChanges(): void { if (this.ready) this.render(); }
  ngOnDestroy(): void { this.chart?.destroy(); }

  // Fondo gris claro del área de ploteo (look Zabbix), aplicado a todos los gráficos.
  private static zbxBg = {
    id: 'zbxBg',
    beforeDraw: (c: any) => {
      const { ctx, chartArea } = c;
      if (!chartArea) return;
      ctx.save();
      ctx.fillStyle = '#f7f8fa';
      ctx.fillRect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);
      ctx.restore();
    },
  };

  private render(): void {
    if (!this.cv) return;
    this.chart?.destroy();
    const ax: any = { grid: { color: '#e6e9ef' }, ticks: { color: '#9aa3b2', font: { size: 10 } } };
    this.chart = new Chart(this.cv.nativeElement, {
      type: 'line',
      data: { labels: this.labels, datasets: this.datasets },
      plugins: this.mini ? [] : [LineChart.zbxBg],
      options: {
        interaction: { mode: 'index', intersect: false },   // tooltip al pasar el puntero por la línea
        plugins: {
          legend: { display: !this.mini, position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            enabled: !this.mini, mode: 'index', intersect: false,
            callbacks: this.fmt === 'gbps'
              ? { label: (c: any) => `${c.dataset.label}: ${LineChart.gbps(c.parsed.y)}` }
              : {},
          },
        },
        scales: this.mini
          ? { x: { display: false }, y: { display: false, beginAtZero: true } }
          : { x: ax, y: { ...ax, beginAtZero: true,
                ticks: this.fmt === 'gbps'
                  ? { ...ax.ticks, callback: (v: any) => LineChart.gbps(Number(v)) }
                  : ax.ticks } },
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 500 },
      },
    });
  }
}
