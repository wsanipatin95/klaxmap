import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { VehiculosPageHeaderComponent } from '../../components/page-header/page-header.component';
import { VehiculosRepository } from '../../data-access/vehiculos.repository';
import {
  CliVehiculo,
  VehCheckList,
  VehCheckListVehiculo,
  VehCliente,
  VehCobro,
  VehFactura,
  VehOrdenTrabajo,
  VehTipoVehiculo,
} from '../../data-access/vehiculos.models';
import { emptyPaged, Paged } from '../../data-access/vehiculos.shared';
import { NotifyService } from 'src/app/core/services/notify.service';
import { PendingChangesAware } from '../../guards/pending-changes.guard';

type AccessCard = {
  label: string;
  hint: string;
  icon: string;
  route: string;
  value: number | string;
};

type ResumeCard = {
  label: string;
  value: number | string;
  hint: string;
  tone?: 'accent' | 'success' | 'warn' | 'neutral';
};

@Component({
  selector: 'app-vehiculos-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    VehiculosPageHeaderComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class VehiculosDashboardComponent implements PendingChangesAware {
  private repo = inject(VehiculosRepository);
  private notify = inject(NotifyService);
  private router = inject(Router);

  readonly loading = signal(false);
  readonly failures = signal<string[]>([]);

  readonly tipos = signal<VehTipoVehiculo[]>([]);
  readonly checklists = signal<VehCheckList[]>([]);
  readonly relaciones = signal<VehCheckListVehiculo[]>([]);
  readonly clientes = signal<VehCliente[]>([]);
  readonly vehiculos = signal<CliVehiculo[]>([]);
  readonly ordenes = signal<VehOrdenTrabajo[]>([]);
  readonly facturas = signal<VehFactura[]>([]);
  readonly cobros = signal<VehCobro[]>([]);

  readonly tiposSinChecklist = computed(() => {
    const relacionados = new Set(this.relaciones().map((x) => x.idVehTipoVehiculoFk));
    return this.tipos().filter((x) => !relacionados.has(x.idVehTipoVehiculo)).length;
  });

  readonly checklistSinTipo = computed(() => {
    const relacionados = new Set(this.relaciones().map((x) => x.idVehVehiculoCheckListFk));
    return this.checklists().filter((x) => !relacionados.has(x.idVehVehiculoCheckList)).length;
  });

  readonly ordenesAbiertas = computed(() =>
    this.ordenes().filter((x) => !this.isEstado(x.estadoOrden, ['ANUL', 'ENTREG', 'CERR', 'FACTURADO_FINAL'])).length
  );

  readonly ordenesEnProceso = computed(() =>
    this.ordenes().filter((x) =>
      this.isEstado(x.estadoOrden, ['PEND', 'PROCES', 'DIAG', 'RECEP', 'VALID', 'ESPERA', 'FACTURADO_PARCIAL'])
    ).length
  );

  readonly ordenesAnuladas = computed(() =>
    this.ordenes().filter((x) => this.isEstado(x.estadoOrden, ['ANUL'])).length
  );

  readonly facturasConSaldo = computed(() =>
    this.facturas().filter((x) => Number(x.cxcDeuda || 0) > 0).length
  );

  readonly saldoCartera = computed(() =>
    this.facturas().reduce((acc, item) => acc + Number(item.cxcDeuda || 0), 0)
  );

  readonly totalCobrado = computed(() =>
    this.cobros().reduce((acc, item) => acc + Number(item.valor || 0), 0)
  );

  readonly accessCards = computed<AccessCard[]>(() => [
    {
      label: 'Checklist',
      hint: 'catálogo e igualdad por tipo',
      icon: 'pi pi-check-square',
      route: '/app/vehiculos/checklists',
      value: this.checklists().length,
    },
    {
      label: 'Tipos',
      hint: 'configuración base',
      icon: 'pi pi-car',
      route: '/app/vehiculos/tipos',
      value: this.tipos().length,
    },
    {
      label: 'Clientes',
      hint: 'clientes y vehículos',
      icon: 'pi pi-users',
      route: '/app/vehiculos/clientes',
      value: this.clientes().length,
    },
    {
      label: 'Órdenes',
      hint: 'recepción, ejecución y comercial',
      icon: 'pi pi-wrench',
      route: '/app/vehiculos/ordenes',
      value: this.ordenesAbiertas(),
    },
    {
      label: 'Facturación',
      hint: 'facturas, cobros y caja',
      icon: 'pi pi-money-bill',
      route: '/app/vehiculos/facturacion',
      value: this.facturas().length,
    },
  ]);

  readonly resumeCards = computed<ResumeCard[]>(() => [
    {
      label: 'Activas',
      value: this.ordenesAbiertas(),
      hint: 'órdenes vigentes',
      tone: 'accent',
    },
    {
      label: 'Proceso',
      value: this.ordenesEnProceso(),
      hint: 'operación en curso',
      tone: 'success',
    },
    {
      label: 'Clientes',
      value: this.clientes().length,
      hint: 'base activa',
      tone: 'neutral',
    },
    {
      label: 'Vehículos',
      value: this.vehiculos().length,
      hint: 'registrados',
      tone: 'neutral',
    },
    {
      label: 'Saldo',
      value: this.formatMoney(this.saldoCartera()),
      hint: 'cartera pendiente',
      tone: 'warn',
    },
    {
      label: 'Cobrado',
      value: this.formatMoney(this.totalCobrado()),
      hint: 'ingreso acumulado',
      tone: 'success',
    },
  ]);

  constructor() {
    this.cargar();
  }

  canDeactivate(): boolean | Promise<boolean> {
    return true;
  }

  cargar(): void {
    this.loading.set(true);
    this.failures.set([]);

    forkJoin({
      tipos: this.safeList(this.repo.listarTipos('', 0, 100, false), 'tipos'),
      checklists: this.safeList(this.repo.listarChecklists(), 'checklists'),
      relaciones: this.safeList(this.repo.listarChecklistsVehiculo(), 'relaciones'),
      clientes: this.safeList(this.repo.listarClientes('', 0, 100, false), 'clientes'),
      vehiculos: this.safeList(this.repo.listarClientesVehiculo(), 'vehiculos'),
      ordenes: this.safeList(this.repo.listarOrdenes('', 0, 100, false), 'ordenes'),
      facturas: this.safeList(this.repo.listarFacturas('', 0, 100, false), 'facturas'),
      cobros: this.safeList(this.repo.listarCobros('', 0, 100, false), 'cobros'),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (bundle) => {
          this.tipos.set(bundle.tipos.items ?? []);
          this.checklists.set(bundle.checklists.items ?? []);
          this.relaciones.set(bundle.relaciones.items ?? []);
          this.clientes.set(bundle.clientes.items ?? []);
          this.vehiculos.set(bundle.vehiculos.items ?? []);
          this.ordenes.set(bundle.ordenes.items ?? []);
          this.facturas.set(bundle.facturas.items ?? []);
          this.cobros.set(bundle.cobros.items ?? []);

          if (this.failures().length) {
            this.notify.warn(
              'Dashboard parcial',
              `Se cargó con datos incompletos: ${this.failures().join(', ')}.`
            );
          }
        },
        error: (err) => {
          console.error(err);
          this.notify.error('No se pudo cargar el dashboard de vehículos', err?.message);
        },
      });
  }

  go(route: string): void {
    this.router.navigate([route]);
  }

  irATipos(): void {
    this.go('/app/vehiculos/tipos');
  }

  irAChecklists(): void {
    this.go('/app/vehiculos/checklists');
  }

  irAClientes(): void {
    this.go('/app/vehiculos/clientes');
  }

  irAOrdenes(): void {
    this.go('/app/vehiculos/ordenes');
  }

  irAFacturacion(): void {
    this.go('/app/vehiculos/facturacion');
  }

  ordenesRecientes(): VehOrdenTrabajo[] {
    return [...this.ordenes()]
      .sort((a, b) => this.compareReciente(a, b, 'idVehOrdenTrabajo'))
      .slice(0, 6);
  }

  facturasRecientes(): VehFactura[] {
    return [...this.facturas()]
      .sort((a, b) => this.compareReciente(a, b, 'idFacVenta'))
      .slice(0, 6);
  }

  clientesRecientes(): VehCliente[] {
    return [...this.clientes()]
      .sort((a, b) => this.compareReciente(a, b, 'dni'))
      .slice(0, 5);
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

  ordenVehiculo(item: VehOrdenTrabajo): string {
    return [item.marca, item.modelo, item.placa].filter(Boolean).join(' · ') || `Vehículo #${item.idCliVehiculoFk}`;
  }

  facturaNumero(item: VehFactura): string {
    if (item.numeroFactura?.trim()) return item.numeroFactura;
    const estab = String(item.estab ?? 0).padStart(3, '0');
    const ptoemi = String(item.ptoemi ?? 0).padStart(3, '0');
    const sec = String(item.secuencial ?? item.idFacVenta ?? 0).padStart(9, '0');
    return `${estab}-${ptoemi}-${sec}`;
  }

  facturaCliente(item: VehFactura): string {
    return item.nombre || item.ruc || (item.dni ? `DNI ${item.dni}` : 'Cliente');
  }

  esObligatorio(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') return ['1', 'true', 'si', 'sí'].includes(value.toLowerCase());
    return false;
  }

  formatMoney(value: unknown): string {
    const amount = Number(value ?? 0);
    return new Intl.NumberFormat('es-EC', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(amount) ? amount : 0);
  }

  private safeList<T>(source$: Observable<Paged<T>>, key: string): Observable<Paged<T>> {
    return source$.pipe(
      catchError((err) => {
        console.error(`[dashboard:${key}]`, err);
        this.failures.update((current) => current.includes(key) ? current : [...current, key]);
        return of(emptyPaged<T>());
      })
    );
  }

  private isEstado(value: string | null | undefined, tokens: string[]): boolean {
    const raw = String(value || '').toUpperCase();
    return tokens.some((token) => raw.includes(token));
  }

  private compareReciente<T>(a: T, b: T, idField: keyof T): number {
    const ax = a as T & { fecGen?: string | null; fecEmi?: string | null; fecha?: string | null };
    const bx = b as T & { fecGen?: string | null; fecEmi?: string | null; fecha?: string | null };

    const fa = ax.fecEmi || ax.fecGen || ax.fecha || null;
    const fb = bx.fecEmi || bx.fecGen || bx.fecha || null;

    const ta = fa ? new Date(fa).getTime() : 0;
    const tb = fb ? new Date(fb).getTime() : 0;

    if (tb !== ta) return tb - ta;

    const ia = Number(a[idField] ?? 0);
    const ib = Number(b[idField] ?? 0);
    return ib - ia;
  }
}