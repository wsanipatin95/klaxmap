import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { TabsModule } from 'primeng/tabs';
import { NgxSonnerToaster } from 'ngx-sonner';

@Component({
  selector: 'app-importacion-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, TabsModule, NgxSonnerToaster],
  templateUrl: './importacion-shell.component.html',
  styleUrl: './importacion-shell.component.scss',
})
export class ImportacionShellComponent {
  private readonly router = inject(Router);

  readonly tabs = [
    { label: 'Proveedores', route: '/app/importacion/proveedores', icon: 'pi pi-building' },
    { label: 'Artículos', route: '/app/importacion/articulos', icon: 'pi pi-box' },
    { label: 'Ofertas', route: '/app/importacion/ofertas', icon: 'pi pi-file-edit' },
    { label: 'Solicitudes', route: '/app/importacion/solicitudes', icon: 'pi pi-sitemap' },
  ];

  // El computed devuelve el índice numérico basado en la URL actual
  readonly activeIndex = computed(() => {
    const current = this.router.url;
    const idx = this.tabs.findIndex((tab) => current.startsWith(tab.route));
    return idx >= 0 ? idx : 0;
  });

  /**
   * Navega a la ruta según el índice del tab seleccionado.
   * Usamos 'any' para el evento para evitar errores de tipado estricto en el HTML.
   */
  go(index: any) {
    const numericIndex = Number(index);
    const target = this.tabs[numericIndex];
    
    if (target && target.route) {
      this.router.navigateByUrl(target.route);
    }
  }
}
