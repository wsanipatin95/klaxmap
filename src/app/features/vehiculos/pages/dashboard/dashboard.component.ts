import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { VehiculosPageHeaderComponent } from '../../components/page-header/page-header.component';
import { VehiculosEmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { VehiculosRepository } from '../../data-access/vehiculos.repository';
import {
  DashboardMetric,
  VehCheckList,
  VehCheckListVehiculo,
  VehCliente,
  VehOrdenTrabajo,
  VehTipoVehiculo,
} from '../../data-access/vehiculos.models';
import { NotifyService } from 'src/app/core/services/notify.service';
import { PendingChangesAware } from '../../guards/pending-changes.guard';

@Component({
  selector: 'app-vehiculos-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TagModule,
    VehiculosPageHeaderComponent,
    VehiculosEmptyStateComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class VehiculosDashboardComponent implements PendingChangesAware {
  private repo = inject(VehiculosRepository);
  private notify = inject(NotifyService);
  private router = inject(Router);

  readonly loading = signal(false);

  readonly metrics = signal<DashboardMetric[]>([]);
  readonly tipos = signal<VehTipoVehiculo[]>([]);
  readonly checklists = signal<VehCheckList[]>([]);
  readonly relaciones = signal<VehCheckListVehiculo[]>([]);
  readonly clientes = signal<VehCliente[]>([]);
  readonly ordenes = signal<VehOrdenTrabajo[]>([]);

  readonly recientes = signal<Array<{ label: string; value: string; chip?: string }>>([]);

  constructor() {
    this.cargar();
  }

  canDeactivate(): boolean | Promise<boolean> {
    return true;
  }

  cargar(): void {
    this.loading.set(true);

    forkJoin({
      tipos: this.repo.listarTipos('', 0, 300, true),
      checklists: this.repo.listarChecklists(),
      relaciones: this.repo.listarChecklistsVehiculo(),
      clientes: this.repo.listarClientes('', 0, 300, true),
      vehiculos: this.repo.listarClientesVehiculo(),
      ordenes: this.repo.listarOrdenes('', 0, 300, true),
      facturas: this.repo.listarFacturas('', 0, 300, true),
      cobros: this.repo.listarCobros('', 0, 300, true),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (bundle) => {
          const tipos = bundle.tipos.items ?? [];
          const checklists = bundle.checklists.items ?? [];
          const relaciones = bundle.relaciones.items ?? [];
          const clientes = bundle.clientes.items ?? [];
          const ordenes = bundle.ordenes.items ?? [];
          const vehiculos = bundle.vehiculos.items ?? [];
          const facturas = bundle.facturas.items ?? [];
          const cobros = bundle.cobros.items ?? [];

          this.tipos.set(tipos);
          this.checklists.set(checklists);
          this.relaciones.set(relaciones);
          this.clientes.set(clientes);
          this.ordenes.set(ordenes);

          const tiposRelacionados = new Set<number>(
            relaciones.map((x) => x.idVehTipoVehiculoFk)
          );
          const checklistsRelacionados = new Set<number>(
            relaciones.map((x) => x.idVehVehiculoCheckListFk)
          );

          this.metrics.set([
            { label: 'Tipos de vehículo', value: tipos.length, hint: 'Catálogo maestro' },
            { label: 'Checklist maestro', value: checklists.length, hint: 'Ítems registrados' },
            { label: 'Relaciones', value: relaciones.length, hint: 'Checklist por tipo' },
            {
              label: 'Tipos sin checklist',
              value: tipos.filter((x) => !tiposRelacionados.has(x.idVehTipoVehiculo)).length,
              hint: 'Pendientes de relacionar',
            },
            {
              label: 'Checklist sin tipo',
              value: checklists.filter((x) => !checklistsRelacionados.has(x.idVehVehiculoCheckList)).length,
              hint: 'Pendientes de asignar',
            },
            { label: 'Clientes', value: clientes.length, hint: 'Clientes activos' },
            { label: 'Vehículos', value: vehiculos.length, hint: 'Unidades registradas' },
            { label: 'Órdenes', value: ordenes.length, hint: 'Órdenes de trabajo' },
            { label: 'Facturas', value: facturas.length, hint: 'Documentos emitidos' },
            { label: 'Cobros', value: cobros.length, hint: 'Recibos registrados' },
          ]);

          const tiposRecientes = this.tiposRecientes();
          const checklistsRecientes = this.checklistsRecientes();
          const clientesRecientes = this.clientesRecientes();
          const ordenesRecientes = this.ordenesRecientes();

          this.recientes.set([
            {
              label: 'Último tipo',
              value: tiposRecientes[0]?.tipoVehiculo || 'Sin tipos',
              chip: tiposRecientes[0]
                ? `#${tiposRecientes[0].idVehTipoVehiculo}`
                : 'SIN DATOS',
            },
            {
              label: 'Último checklist',
              value: checklistsRecientes[0]?.nombreItem || 'Sin checklist',
              chip: checklistsRecientes[0]
                ? (this.esObligatorio(checklistsRecientes[0].obligatorio) ? 'Obligatorio' : 'Opcional')
                : 'SIN DATOS',
            },
            {
              label: 'Último cliente',
              value: clientesRecientes[0]?.nombre || 'Sin clientes',
              chip: clientesRecientes[0]
                ? `#${clientesRecientes[0].dni || clientesRecientes[0].idTaxDni || ''}`
                : 'SIN DATOS',
            },
            {
              label: 'Última orden',
              value: ordenesRecientes[0]
                ? `Orden #${ordenesRecientes[0].idVehOrdenTrabajo}`
                : 'Sin órdenes',
              chip: ordenesRecientes[0]?.estadoOrden || 'SIN DATOS',
            },
          ]);
        },
        error: (err) => {
          console.error(err);
          this.notify.error('No se pudo cargar el dashboard de vehículos', err?.message);
        },
      });
  }

  irAChecklists(): void {
    this.router.navigate(['/app/vehiculos/checklists']);
  }

  irATipos(): void {
    this.router.navigate(['/app/vehiculos/tipos']);
  }

  irAClientes(): void {
    this.router.navigate(['/app/vehiculos/clientes']);
  }

  irAOrdenes(): void {
    this.router.navigate(['/app/vehiculos/ordenes']);
  }

  irAFacturacion(): void {
    this.router.navigate(['/app/vehiculos/facturacion']);
  }

  tiposRecientes(): VehTipoVehiculo[] {
    return [...this.tipos()]
      .sort((a, b) => this.compareReciente(a, b, 'idVehTipoVehiculo'))
      .slice(0, 5);
  }

  checklistsRecientes(): VehCheckList[] {
    return [...this.checklists()]
      .sort((a, b) => this.compareReciente(a, b, 'idVehVehiculoCheckList'))
      .slice(0, 5);
  }

  clientesRecientes(): VehCliente[] {
    return [...this.clientes()]
      .sort((a, b) => this.compareReciente(a, b, 'dni'))
      .slice(0, 5);
  }

  ordenesRecientes(): VehOrdenTrabajo[] {
    return [...this.ordenes()]
      .sort((a, b) => this.compareReciente(a, b, 'idVehOrdenTrabajo'))
      .slice(0, 5);
  }

  nombreTipo(id?: number | null): string {
    return this.tipos().find((x) => x.idVehTipoVehiculo === id)?.tipoVehiculo || `Tipo #${id}`;
  }

  nombreChecklist(id?: number | null): string {
    return this.checklists().find((x) => x.idVehVehiculoCheckList === id)?.nombreItem || `Checklist #${id}`;
  }

  esObligatorio(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') return ['1', 'true', 'si', 'sí'].includes(value.toLowerCase());
    return false;
  }

  relacionesPendientesTexto(): string {
    const tiposRelacionados = new Set<number>(
      this.relaciones().map((x) => x.idVehTipoVehiculoFk)
    );
    const checklistsRelacionados = new Set<number>(
      this.relaciones().map((x) => x.idVehVehiculoCheckListFk)
    );

    const tiposPend = this.tipos().filter(
      (x) => !tiposRelacionados.has(x.idVehTipoVehiculo)
    ).length;

    const checkPend = this.checklists().filter(
      (x) => !checklistsRelacionados.has(x.idVehVehiculoCheckList)
    ).length;

    return `${tiposPend} tipos sin checklist · ${checkPend} checklist sin tipo`;
  }

  private compareReciente<T>(a: T, b: T, idField: keyof T): number {
    const aWithDate = a as T & { fecGen?: string | null };
    const bWithDate = b as T & { fecGen?: string | null };

    const fa = aWithDate.fecGen ? new Date(aWithDate.fecGen).getTime() : 0;
    const fb = bWithDate.fecGen ? new Date(bWithDate.fecGen).getTime() : 0;

    if (fb !== fa) {
      return fb - fa;
    }

    const ia = Number(a[idField] ?? 0);
    const ib = Number(b[idField] ?? 0);

    return ib - ia;
  }
}