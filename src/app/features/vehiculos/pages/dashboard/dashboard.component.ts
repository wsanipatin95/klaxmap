import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { VehiculosPageHeaderComponent } from '../../components/page-header/page-header.component';
import { VehiculosEmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { VehiculosRepository } from '../../data-access/vehiculos.repository';
import { DashboardMetric } from '../../data-access/vehiculos.models';
import { NotifyService } from 'src/app/core/services/notify.service';

@Component({
  selector: 'app-vehiculos-dashboard',
  standalone: true,
  imports: [CommonModule, ButtonModule, TagModule, VehiculosPageHeaderComponent, VehiculosEmptyStateComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class VehiculosDashboardComponent {
  private repo = inject(VehiculosRepository);
  private notify = inject(NotifyService);
  private destroyRef = inject(DestroyRef);

  loading = signal(false);
  metrics = signal<DashboardMetric[]>([]);
  recientes = signal<Array<{ label: string; value: string; chip?: string }>>([]);

  constructor() {
    this.cargar();
  }

  cargar() {
    this.loading.set(true);
    forkJoin({
      tipos: this.repo.listarTipos('', 0, 100, true),
      clientes: this.repo.listarClientes('', 0, 100, true),
      vehiculos: this.repo.listarClientesVehiculo(),
      ordenes: this.repo.listarOrdenes('', 0, 100, true),
      facturas: this.repo.listarFacturas('', 0, 100, true),
      cobros: this.repo.listarCobros('', 0, 100, true),
      articulos: this.repo.listarArticulos('', 0, 100, true),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (bundle) => {
          const ordenes = bundle.ordenes.items ?? [];
          const facturas = bundle.facturas.items ?? [];
          const cobros = bundle.cobros.items ?? [];

          this.metrics.set([
            { label: 'Tipos de vehículo', value: bundle.tipos.items?.length ?? 0, hint: 'Catálogo maestro' },
            { label: 'Clientes', value: bundle.clientes.items?.length ?? 0, hint: 'Clientes registrados' },
            { label: 'Vehículos', value: bundle.vehiculos.items?.length ?? 0, hint: 'Unidades registradas' },
            { label: 'Órdenes', value: ordenes.length, hint: 'Órdenes de trabajo' },
            { label: 'Facturas', value: facturas.length, hint: 'Documentos emitidos' },
            { label: 'Cobros', value: cobros.length, hint: 'Recibos y consumos' },
            { label: 'Artículos', value: bundle.articulos.items?.length ?? 0, hint: 'Catálogo inventario' },
            {
              label: 'Pendientes',
              value: ordenes.filter((x) => !String(x.estadoOrden || '').toUpperCase().includes('ENTREG')).length,
              hint: 'No entregadas',
            },
          ]);

          this.recientes.set([
            {
              label: 'Última orden',
              value: ordenes[0] ? `OT #${ordenes[0].idVehOrdenTrabajo}` : 'Sin órdenes',
              chip: ordenes[0]?.estadoOrden || 'SIN DATOS',
            },
            {
              label: 'Última factura',
              value: facturas[0] ? `FAC #${facturas[0].idFacVenta}` : 'Sin facturas',
              chip: facturas[0]?.sriEstado || 'SIN DATOS',
            },
            {
              label: 'Último cobro',
              value: cobros[0] ? `COB #${cobros[0].idFacVentaCobro}` : 'Sin cobros',
              chip: cobros[0] ? '$' + Number(cobros[0].valor || 0).toFixed(2) : '$0.00',
            },
          ]);
        },
        error: (err) => this.notify.error('No se pudo cargar el dashboard de vehículos', err?.message),
      });
  }
}
