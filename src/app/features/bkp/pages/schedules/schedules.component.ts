import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { BkpPageHeaderComponent, BkpEmptyStateComponent } from '../../components/bkp-ui.component';
import { BkpRepository } from '../../data-access/bkp.repository';
import { BkpCatalogs, BkpSchedule } from '../../data-access/bkp.models';
import { BkpConfirmService } from '../../services/bkp-confirm.service';
import { PendingChangesAware } from '../../guards/pending-changes.guard';
import { NotifyService } from 'src/app/core/services/notify.service';

type ScheduleReloadState = {
  id?: number | null;
  name?: string | null;
};

type WeekdayOption = {
  value: string;
  label: string;
  short: string;
};

@Component({
  selector: 'app-bkp-schedules',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    ConfirmDialogModule,
    BkpPageHeaderComponent,
    BkpEmptyStateComponent,
  ],
  templateUrl: './schedules.component.html',
  styleUrl: './schedules.component.scss',
})
export class BkpSchedulesComponent implements OnInit, PendingChangesAware {
  private repo = inject(BkpRepository);
  private confirm = inject(BkpConfirmService);
  private notify = inject(NotifyService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  q = signal('');
  loading = signal(false);
  saving = signal(false);
  dirty = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);
  items = signal<BkpSchedule[]>([]);
  catalogs = signal<Partial<BkpCatalogs>>({});
  selected = signal<BkpSchedule | null>(null);

  tipo = signal('DAILY');
  typeHint = computed(() => this.scheduleTypeHint(this.tipo()));

  weekDays: WeekdayOption[] = [
    { value: 'MON', label: 'Lunes', short: 'Lun' },
    { value: 'TUE', label: 'Martes', short: 'Mar' },
    { value: 'WED', label: 'Miércoles', short: 'Mié' },
    { value: 'THU', label: 'Jueves', short: 'Jue' },
    { value: 'FRI', label: 'Viernes', short: 'Vie' },
    { value: 'SAT', label: 'Sábado', short: 'Sáb' },
    { value: 'SUN', label: 'Domingo', short: 'Dom' },
  ];

  form = this.fb.group({
    nombre: ['', Validators.required],
    tipoSchedule: ['DAILY', Validators.required],
    cronExpression: [''],
    intervalMinutes: [null as number | null],
    hora: [2, [Validators.min(0), Validators.max(23)]],
    minuto: [0, [Validators.min(0), Validators.max(59)]],
    diasSemana: ['MON,TUE,WED,THU,FRI'],
    diaMes: [1, [Validators.min(1), Validators.max(31)]],
    timezone: ['America/Guayaquil', Validators.required],
    activo: [true],
  });

  ngOnInit() {
    this.form.valueChanges.subscribe(() => {
      this.dirty.set(true);
      this.success.set(null);
    });

    this.form.get('tipoSchedule')?.valueChanges.subscribe(value => {
      const type = this.normalizeScheduleType(value);
      this.tipo.set(type);
      this.applyDefaultsForType(type);
    });

    this.cargar();
    this.nuevo();
  }

  canDeactivate() {
    return !this.dirty() || this.confirm.confirmDiscard();
  }

  volverDashboard() {
    this.router.navigateByUrl('/app/backups/dashboard');
  }

  cargar(state: ScheduleReloadState = {}) {
    const snapshot: ScheduleReloadState = {
      id: state.id ?? this.selected()?.idBkpSchedule ?? null,
      name: state.name ?? this.selected()?.nombre ?? null,
    };

    this.loading.set(true);

    forkJoin({
      schedules: this.repo.listarSchedules(this.q(), 0, 200, null),
      catalogs: this.repo.catalogos(),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: r => {
          this.items.set(r.schedules.items ?? []);
          this.catalogs.set(r.catalogs ?? {});
          const selected = this.findSchedule(snapshot.id, snapshot.name);
          if (selected) this.seleccionarSinConfirmar(selected);
        },
        error: e => this.setError('No se pudo cargar horarios', e?.message),
      });
  }

  nuevo() {
    this.selected.set(null);
    this.tipo.set('DAILY');

    this.form.reset({
      nombre: 'Diario 02:00',
      tipoSchedule: 'DAILY',
      cronExpression: '',
      intervalMinutes: null,
      hora: 2,
      minuto: 0,
      diasSemana: 'MON,TUE,WED,THU,FRI',
      diaMes: 1,
      timezone: 'America/Guayaquil',
      activo: true,
    });

    this.clean();
  }

  async seleccionar(i: BkpSchedule) {
    if (this.dirty() && !(await this.confirm.confirmDiscard())) return;
    this.seleccionarSinConfirmar(i);
  }

  private seleccionarSinConfirmar(i: BkpSchedule) {
    const type = this.normalizeScheduleType(i.tipoSchedule);

    this.selected.set(i);
    this.tipo.set(type);

    this.form.reset({
      nombre: i.nombre ?? '',
      tipoSchedule: type,
      cronExpression: i.cronExpression ?? '',
      intervalMinutes: i.intervalMinutes ?? null,
      hora: i.hora ?? 2,
      minuto: i.minuto ?? 0,
      diasSemana: i.diasSemana ?? 'MON,TUE,WED,THU,FRI',
      diaMes: i.diaMes ?? 1,
      timezone: i.timezone ?? 'America/Guayaquil',
      activo: i.activo !== false,
    });

    this.clean();
  }

  guardar() {
    this.form.markAllAsTouched();
    this.error.set(null);
    this.success.set(null);

    if (this.form.invalid) {
      this.setError('Completa nombre, tipo y zona horaria.');
      return;
    }

    try {
      const payload = this.payload();
      const id = this.selected()?.idBkpSchedule ?? 0;
      const state: ScheduleReloadState = {
        id: id || null,
        name: payload.nombre,
      };

      const req = id
        ? this.repo.editarSchedule(id, payload as Record<string, unknown>)
        : this.repo.crearSchedule(payload);

      this.save(req, 'Horario guardado', false, state);
    } catch (e) {
      this.setError(this.msg(e));
    }
  }

  async eliminar(i = this.selected()) {
    if (!i) return;
    if (!(await this.confirm.confirmDelete(i.nombre))) return;

    this.save(this.repo.eliminarSchedule(i.idBkpSchedule), 'Horario desactivado', true);
  }

  private payload(): Partial<BkpSchedule> {
    const v = this.form.getRawValue();
    const type = this.normalizeScheduleType(v.tipoSchedule);
    const nombre = String(v.nombre ?? '').trim();
    const timezone = String(v.timezone ?? '').trim();

    if (!nombre) throw new Error('Nombre es obligatorio.');
    if (!timezone) throw new Error('Timezone es obligatorio.');

    const hora = Number(v.hora ?? 0);
    const minuto = Number(v.minuto ?? 0);

    if (!Number.isFinite(minuto) || minuto < 0 || minuto > 59) {
      throw new Error('Minuto debe estar entre 0 y 59.');
    }

    if (this.usesHour(type) && (!Number.isFinite(hora) || hora < 0 || hora > 23)) {
      throw new Error('Hora debe estar entre 0 y 23.');
    }

    const p: Partial<BkpSchedule> = {
      nombre,
      tipoSchedule: type,
      timezone,
      activo: v.activo ?? true,
      cronExpression: null,
      intervalMinutes: null,
      hora: null,
      minuto: null,
      diasSemana: null,
      diaMes: null,
    };

    if (type === 'HOURLY') {
      p.minuto = minuto;
      return p;
    }

    if (type === 'DAILY') {
      p.hora = hora;
      p.minuto = minuto;
      return p;
    }

    if (type === 'WEEKLY') {
      const diasSemana = String(v.diasSemana || '').trim();
      if (!diasSemana) throw new Error('Selecciona al menos un día de la semana.');

      p.hora = hora;
      p.minuto = minuto;
      p.diasSemana = diasSemana;
      return p;
    }

    if (type === 'MONTHLY') {
      const diaMes = Number(v.diaMes ?? 1);
      if (!Number.isFinite(diaMes) || diaMes < 1 || diaMes > 31) {
        throw new Error('Día del mes debe estar entre 1 y 31.');
      }

      p.hora = hora;
      p.minuto = minuto;
      p.diaMes = diaMes;
      return p;
    }

    if (type === 'INTERVAL') {
      const intervalMinutes = Number(v.intervalMinutes ?? 0);
      if (!Number.isFinite(intervalMinutes) || intervalMinutes < 1) {
        throw new Error('Intervalo minutos debe ser mayor a 0.');
      }

      p.intervalMinutes = intervalMinutes;
      return p;
    }

    if (type === 'CRON') {
      const cron = String(v.cronExpression || '').trim();
      if (!cron) throw new Error('Cron es obligatorio.');

      p.cronExpression = cron;
      return p;
    }

    return p;
  }

  private save(obs: any, label: string, reset = false, state: ScheduleReloadState = {}) {
    this.saving.set(true);

    obs.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (r: any) => {
        this.success.set(r?.mensaje || label);
        this.notify.success(label, r?.mensaje);
        this.dirty.set(false);

        if (reset) {
          this.nuevo();
          this.cargar();
          return;
        }

        this.cargar(state);
      },
      error: (e: any) => this.setError('No se pudo guardar', e?.message),
    });
  }

  clean() {
    this.dirty.set(false);
    this.error.set(null);
    this.success.set(null);
  }

  setError(summary: string, detail?: string) {
    this.error.set(detail || summary);
    this.notify.error(summary, detail);
  }

  scheduleTypes() {
    const fromCatalog = this.catalogs().scheduleTypes ?? [];
    const allowed = ['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'INTERVAL', 'CRON'];
    const normalized = Array.from(new Set(
      fromCatalog
        .map(x => this.normalizeScheduleType(x))
        .filter(x => allowed.includes(x))
    ));

    return normalized.length ? normalized : allowed;
  }

  scheduleLabel(type?: string | null) {
    const t = this.normalizeScheduleType(type);

    const labels: Record<string, string> = {
      HOURLY: 'Cada hora',
      DAILY: 'Diario',
      WEEKLY: 'Semanal',
      MONTHLY: 'Mensual',
      INTERVAL: 'Cada intervalo',
      CRON: 'Cron avanzado',
    };

    return labels[t] ?? t;
  }

  scheduleTypeHint(type?: string | null) {
    const t = this.normalizeScheduleType(type);

    if (t === 'HOURLY') return 'Ejecuta cada hora en el minuto indicado.';
    if (t === 'DAILY') return 'Ejecuta todos los días a una hora fija.';
    if (t === 'WEEKLY') return 'Ejecuta en días seleccionados a una hora fija.';
    if (t === 'MONTHLY') return 'Ejecuta cada mes en el día y hora seleccionados.';
    if (t === 'INTERVAL') return 'Ejecuta cada N minutos. Úsalo para pruebas o alta frecuencia.';
    if (t === 'CRON') return 'Usa una expresión cron cuando necesitas una regla avanzada.';

    return 'Configura frecuencia y zona horaria.';
  }

  scheduleSummary(i: BkpSchedule) {
    const type = this.normalizeScheduleType(i.tipoSchedule);
    const tz = i.timezone || 'sin timezone';

    if (type === 'HOURLY') return `minuto ${this.pad(i.minuto ?? 0)} · ${tz}`;
    if (type === 'DAILY') return `${this.pad(i.hora ?? 0)}:${this.pad(i.minuto ?? 0)} · ${tz}`;
    if (type === 'WEEKLY') return `${this.weekDaysLabel(i.diasSemana)} · ${this.pad(i.hora ?? 0)}:${this.pad(i.minuto ?? 0)} · ${tz}`;
    if (type === 'MONTHLY') return `día ${i.diaMes ?? 1} · ${this.pad(i.hora ?? 0)}:${this.pad(i.minuto ?? 0)} · ${tz}`;
    if (type === 'INTERVAL') return `cada ${i.intervalMinutes ?? 0} min · ${tz}`;
    if (type === 'CRON') return `${i.cronExpression || 'sin cron'} · ${tz}`;

    return tz;
  }

  isHourly() {
    return this.tipo() === 'HOURLY';
  }

  isDaily() {
    return this.tipo() === 'DAILY';
  }

  isWeekly() {
    return this.tipo() === 'WEEKLY';
  }

  isMonthly() {
    return this.tipo() === 'MONTHLY';
  }

  isInterval() {
    return this.tipo() === 'INTERVAL';
  }

  isCron() {
    return this.tipo() === 'CRON';
  }

  usesHour(type = this.tipo()) {
    return ['DAILY', 'WEEKLY', 'MONTHLY'].includes(type);
  }

  toggleDay(day: string) {
    const values = this.selectedDays();
    const next = values.includes(day)
      ? values.filter(x => x !== day)
      : [...values, day];

    this.form.patchValue({ diasSemana: next.join(',') });
  }

  daySelected(day: string) {
    return this.selectedDays().includes(day);
  }

  selectedDays() {
    return String(this.form.value.diasSemana || '')
      .split(',')
      .map(x => x.trim().toUpperCase())
      .filter(Boolean);
  }

  weekDaysLabel(value?: string | null) {
    const selected = String(value || '')
      .split(',')
      .map(x => x.trim().toUpperCase())
      .filter(Boolean);

    if (!selected.length) return 'sin días';

    return this.weekDays
      .filter(d => selected.includes(d.value))
      .map(d => d.short)
      .join(', ');
  }

  invalid(name: string) {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  private applyDefaultsForType(type: string) {
    const t = this.normalizeScheduleType(type);

    const cron = this.form.get('cronExpression');
    const interval = this.form.get('intervalMinutes');
    const dias = this.form.get('diasSemana');
    const diaMes = this.form.get('diaMes');
    cron?.setValidators(t === 'CRON' ? [Validators.required] : []);
    interval?.setValidators(t === 'INTERVAL' ? [Validators.required, Validators.min(1)] : []);
    dias?.setValidators(t === 'WEEKLY' ? [Validators.required] : []);
    diaMes?.setValidators(t === 'MONTHLY' ? [Validators.required, Validators.min(1), Validators.max(31)] : []);
    cron?.updateValueAndValidity({ emitEvent: false });
    interval?.updateValueAndValidity({ emitEvent: false });
    dias?.updateValueAndValidity({ emitEvent: false });
    diaMes?.updateValueAndValidity({ emitEvent: false });

    if (t === 'HOURLY') {
      this.form.patchValue({
        nombre: this.form.value.nombre || 'Cada hora',
        minuto: this.form.value.minuto ?? 0,
      }, { emitEvent: false });
    }

    if (t === 'DAILY') {
      this.form.patchValue({
        hora: this.form.value.hora ?? 2,
        minuto: this.form.value.minuto ?? 0,
      }, { emitEvent: false });
    }

    if (t === 'WEEKLY') {
      this.form.patchValue({
        hora: this.form.value.hora ?? 2,
        minuto: this.form.value.minuto ?? 0,
        diasSemana: this.form.value.diasSemana || 'MON,TUE,WED,THU,FRI',
      }, { emitEvent: false });
    }

    if (t === 'MONTHLY') {
      this.form.patchValue({
        hora: this.form.value.hora ?? 2,
        minuto: this.form.value.minuto ?? 0,
        diaMes: this.form.value.diaMes ?? 1,
      }, { emitEvent: false });
    }

    if (t === 'INTERVAL') {
      this.form.patchValue({
        intervalMinutes: this.form.value.intervalMinutes ?? 60,
      }, { emitEvent: false });
    }
  }

  private normalizeScheduleType(value?: string | null) {
    const raw = String(value || 'DAILY').trim().toUpperCase();
    const allowed = ['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'INTERVAL', 'CRON'];

    return allowed.includes(raw) ? raw : 'DAILY';
  }

  private findSchedule(id?: number | null, name?: string | null) {
    if (id) {
      const byId = this.items().find((x: BkpSchedule) => x.idBkpSchedule === id);
      if (byId) return byId;
    }

    const normalized = String(name || '').trim().toUpperCase();
    if (!normalized) return null;

    return this.items().find((x: BkpSchedule) => String(x.nombre || '').trim().toUpperCase() === normalized) ?? null;
  }

  private pad(value: number) {
    return String(value).padStart(2, '0');
  }

  private msg(e: unknown) {
    return e instanceof Error ? e.message : String((e as any)?.message || e || 'Error');
  }
}
