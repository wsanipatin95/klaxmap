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
  private router = inject(Router);

  readonly tabs = [
    { label: 'Proveedores', route: '/app/importacion/proveedores', icon: 'pi pi-building' },
    { label: 'Artículos', route: '/app/importacion/articulos', icon: 'pi pi-box' },
    { label: 'Ofertas', route: '/app/importacion/ofertas', icon: 'pi pi-file-edit' },
    { label: 'Solicitudes', route: '/app/importacion/solicitudes', icon: 'pi pi-sitemap' },
  ];

  readonly activeIndex = computed(() => {
    const current = this.router.url;
    const idx = this.tabs.findIndex((x) => current.startsWith(x.route));
    return idx >= 0 ? idx : 0;
  });

  go(index: number) {
    const tab = this.tabs[index];
    if (!tab) return;
    this.router.navigateByUrl(tab.route);
  }
}
