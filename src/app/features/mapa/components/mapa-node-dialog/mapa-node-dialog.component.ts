import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import type { MapaNodo, MapaNodoSaveRequest, MapaPatchRequest } from '../../data-access/mapa.models';

type NodeDialogMode = 'create' | 'edit';

@Component({
    selector: 'app-mapa-node-dialog',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, DialogModule],
    templateUrl: './mapa-node-dialog.component.html',
    styleUrl: './mapa-node-dialog.component.scss',
})
export class MapaNodeDialogComponent {
    @Output() createSubmitted = new EventEmitter<MapaNodoSaveRequest>();
    @Output() editSubmitted = new EventEmitter<MapaPatchRequest>();

    visible = signal(false);
    mode = signal<NodeDialogMode>('create');
    error = signal<string | null>(null);
    title = signal('Crear nodo');

    parentNode = signal<MapaNodo | null>(null);
    editingNode = signal<MapaNodo | null>(null);

    form: MapaNodoSaveRequest = this.defaultForm();

    openCreate(parent: MapaNodo | null, tipo: MapaNodo['tipoNodo'] = 'carpeta') {
        this.mode.set('create');
        this.title.set(parent ? `Crear dentro de ${parent.nodo}` : 'Crear nodo raíz');
        this.parentNode.set(parent);
        this.editingNode.set(null);
        this.error.set(null);

        this.form = {
            idRedNodoPadreFk: parent?.idRedNodo ?? null,
            codigo: null,
            nodo: '',
            descripcion: '',
            tipoNodo: tipo,
            orden: 0,
            visible: true,
            atributos: {},
        };

        this.visible.set(true);
    }

    openEdit(node: MapaNodo) {
        this.mode.set('edit');
        this.title.set(`Editar ${node.nodo}`);
        this.parentNode.set(null);
        this.editingNode.set(node);
        this.error.set(null);

        this.form = {
            idRedNodoPadreFk: node.idRedNodoPadreFk ?? null,
            codigo: node.codigo ?? null,
            nodo: node.nodo,
            descripcion: node.descripcion ?? '',
            tipoNodo: node.tipoNodo,
            orden: node.orden ?? 0,
            visible: node.visible,
            atributos: node.atributos ?? {},
        };

        this.visible.set(true);
    }

    close() {
        this.visible.set(false);
        this.error.set(null);
    }

    submit() {
        if (!this.form.nodo || !this.form.nodo.trim()) {
            this.error.set('El nombre del nodo es obligatorio.');
            return;
        }

        if (!this.form.tipoNodo) {
            this.error.set('Debes seleccionar el tipo de nodo.');
            return;
        }

        if (this.mode() === 'create') {
            this.createSubmitted.emit({
                idRedNodoPadreFk: this.form.idRedNodoPadreFk ?? null,
                codigo: this.nullable(this.form.codigo),
                nodo: this.form.nodo.trim(),
                descripcion: this.nullable(this.form.descripcion),
                tipoNodo: this.form.tipoNodo,
                orden: this.form.orden ?? 0,
                visible: this.form.visible ?? true,
                atributos: this.form.atributos ?? {},
            });
            this.close();
            return;
        }

        const editing = this.editingNode();
        if (!editing) {
            this.error.set('No se encontró el nodo a editar.');
            return;
        }

        this.editSubmitted.emit({
            id: editing.idRedNodo,
            cambios: {
                codigo: this.nullable(this.form.codigo),
                nodo: this.form.nodo.trim(),
                descripcion: this.nullable(this.form.descripcion),
                tipoNodo: this.form.tipoNodo,
                orden: this.form.orden ?? 0,
                visible: this.form.visible ?? true,
                atributos: this.form.atributos ?? {},
            },
        });

        this.close();
    }

    private nullable(value: string | null | undefined): string | null {
        const trimmed = (value ?? '').trim();
        return trimmed ? trimmed : null;
    }

    private defaultForm(): MapaNodoSaveRequest {
        return {
            idRedNodoPadreFk: null,
            codigo: null,
            nodo: '',
            descripcion: '',
            tipoNodo: 'carpeta',
            orden: 0,
            visible: true,
            atributos: {},
        };
    }
}