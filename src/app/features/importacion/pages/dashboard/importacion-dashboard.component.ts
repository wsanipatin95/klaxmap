import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ImportacionPageHeaderComponent } from '../../components/page-header/page-header.component';

@Component({
  selector: 'app-importacion-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, CardModule, ButtonModule, TagModule, ImportacionPageHeaderComponent],
  templateUrl: './importacion-dashboard.component.html',
  styleUrl: './importacion-dashboard.component.scss',
})
export class ImportacionDashboardComponent {
  cards = [
    {
      title: 'Proveedores prospecto',
      subtitle: 'Alta, edición, contactos y documentos del proveedor en etapa de exploración.',
      route: '/app/importacion/proveedores',
      icon: 'pi pi-building',
      severity: 'info',
    },
    {
      title: 'Artículos prospecto',
      subtitle: 'Levantamiento técnico, imágenes, atributos, clasificación y homologación.',
      route: '/app/importacion/articulos',
      icon: 'pi pi-box',
      severity: 'success',
    },
    {
      title: 'Ofertas proveedor',
      subtitle: 'Cotizaciones y proformas con versionado físico, detalle, empaque y documentos.',
      route: '/app/importacion/ofertas',
      icon: 'pi pi-file-edit',
      severity: 'warn',
    },
    {
      title: 'Solicitudes generales',
      subtitle: 'Consolidación, comparación, selección por detalle y workflow de cierre.',
      route: '/app/importacion/solicitudes',
      icon: 'pi pi-sitemap',
      severity: 'danger',
    },
    {
      title: 'Reglas arancelarias',
      subtitle: 'Parámetros y requisitos regulatorios por código arancelario y contexto.',
      route: '/app/importacion/arancel',
      icon: 'pi pi-book',
      severity: 'secondary',
    },
    {
      title: 'Fichas finales',
      subtitle: 'Consulta de fichas agrupadas por proveedor luego del cierre de la solicitud.',
      route: '/app/importacion/fichas',
      icon: 'pi pi-check-square',
      severity: 'contrast',
    },
  ];
}
