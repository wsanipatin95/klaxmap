import { CommonModule } from '@angular/common';
import { Component, Input, inject, signal, computed, OnDestroy } from '@angular/core';
import { finalize } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';

import { NotifyService } from 'src/app/core/services/notify.service';
import { ArchivoRepository } from 'src/app/core/archivo/archivo.repository';
import type { ArchivoListItemDto } from 'src/app/core/archivo/archivo.models';

@Component({
    selector: 'app-archivo-unico',
    standalone: true,
    imports: [CommonModule, ButtonModule, ConfirmDialogModule],
    providers: [ConfirmationService],
    templateUrl: './archivo-unico.component.html',
    styleUrl: './archivo-unico.component.scss',
})
export class ArchivoUnicoComponent implements OnDestroy {
    private repo = inject(ArchivoRepository);
    private notify = inject(NotifyService);
    private confirmSvc = inject(ConfirmationService);

    @Input({ required: true }) modulo!: string;
    @Input({ required: true }) tabla!: string;
    @Input({ required: true }) campoTabla!: string; // se mandará como campo_tabla
    @Input({ required: true }) idTabla!: number;

    @Input() title = 'Archivo';
    @Input() accept = 'image/*';
    @Input() readonly = false;

    loading = signal(false);
    uploading = signal(false);

    item = signal<ArchivoListItemDto | null>(null);
    previewUrl = signal<string | null>(null);

    hasFile = computed(() => !!this.item()?.idArchivo);

    ngOnDestroy(): void {
        this.revokePreview();
    }

    refresh() {
        if (!this.idTabla) return;

        this.loading.set(true);
        this.repo.list({ tabla: this.tabla, campo_tabla: this.campoTabla, id_tabla: this.idTabla })
            .pipe(finalize(() => this.loading.set(false)))
            .subscribe({
                next: (list) => {
                    const first = (list ?? [])[0] ?? null;
                    this.item.set(first);
                    this.loadPreview(first);
                },
                error: (err) => {
                    this.item.set(null);
                    this.revokePreview();
                    this.notify.error('No se pudo cargar archivo', err?.message || 'Error');
                },
            });
    }

    onPick(file: File | null) {
        if (!file || this.readonly) return;
        if (!this.idTabla) {
            this.notify.warn('Primero guarda el registro para subir archivo');
            return;
        }

        this.uploading.set(true);
        this.repo.uploadUnico({
            modulo: this.modulo,
            tabla: this.tabla,
            campo_tabla: this.campoTabla,
            id_tabla: this.idTabla,
            file,
        })
            .pipe(finalize(() => this.uploading.set(false)))
            .subscribe({
                next: (r) => {
                    this.notify.success(r?.mensaje || 'Archivo subido');
                    this.refresh();
                },
                error: (err) => this.notify.error('No se pudo subir', err?.message || 'Error'),
            });
    }

    download() {
        const id = Number(this.item()?.idArchivo ?? 0);
        if (!id) return;

        this.repo.downloadById(id).subscribe({
            next: (blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = this.item()?.nombreRegistro || `archivo_${id}`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
            },
            error: (err) => this.notify.error('No se pudo descargar', err?.message || 'Error'),
        });
    }

    remove() {
        const id = Number(this.item()?.idArchivo ?? 0);
        if (!id || this.readonly) return;

        this.confirmSvc.confirm({
            header: 'Eliminar archivo',
            message: '¿Deseas eliminar este archivo?',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Eliminar',
            rejectLabel: 'Cancelar',
            accept: () => {
                this.loading.set(true);
                this.repo.deleteById(id, false)
                    .pipe(finalize(() => this.loading.set(false)))
                    .subscribe({
                        next: (r) => {
                            this.notify.success(r?.mensaje || 'Eliminado');
                            this.item.set(null);
                            this.revokePreview();
                        },
                        error: (err) => this.notify.error('No se pudo eliminar', err?.message || 'Error'),
                    });
            },
        });
    }

    private loadPreview(it: ArchivoListItemDto | null) {
        this.revokePreview();
        const id = Number(it?.idArchivo ?? 0);
        if (!id) return;

        // solo previsualizamos imágenes (si no, dejamos icono)
        const mime = String(it?.mimeType ?? '').toLowerCase();
        const isImage = mime.startsWith('image/');
        if (!isImage) return;

        this.repo.downloadById(id).subscribe({
            next: (blob) => this.previewUrl.set(URL.createObjectURL(blob)),
            error: () => this.previewUrl.set(null),
        });
    }

    private revokePreview() {
        const url = this.previewUrl();
        if (url) URL.revokeObjectURL(url);
        this.previewUrl.set(null);
    }
}
