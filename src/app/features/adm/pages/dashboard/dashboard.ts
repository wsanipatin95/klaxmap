import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

interface ModuleCard {
  title: string;
  description: string;
  icon: string;
  route: string;
  cta: string;
  metric: string;
  kicker: string;
}

interface BenefitCard {
  title: string;
  description: string;
  icon: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  readonly tags = [
    'Tiempo real',
    'Trazabilidad',
    'Control operativo',
    'Acceso centralizado',
  ];

  readonly modules: ModuleCard[] = [
    {
      title: 'Mapa',
      description:
        'Consulta ubicaciones, monitoreo y contexto operativo desde una vista visual e inmediata.',
      icon: 'pi pi-map',
      route: '/app/mapa/home',
      cta: 'Entrar al mapa',
      metric: 'En vivo',
      kicker: 'Visualización y monitoreo',
    },
    {
      title: 'Importación',
      description:
        'Carga información de forma ordenada para acelerar procesos y mantener consistencia.',
      icon: 'pi pi-upload',
      route: '/app/importacion/',
      cta: 'Importar información',
      metric: 'Ágil',
      kicker: 'Carga y organización de datos',
    },
    {
      title: 'Vehículos',
      description:
        'Gestiona flota, seguimiento y control operativo en un solo entorno.',
      icon: 'pi pi-car',
      route: '/app/vehiculos/',
      cta: 'Ver vehículos',
      metric: 'Control',
      kicker: 'Gestión vehicular',
    },
    {
      title: 'Administración',
      description:
        'Centraliza usuarios, estructura y operación interna con acceso directo.',
      icon: 'pi pi-building',
      route: '/app/adm',
      cta: 'Ir a administración',
      metric: 'Central',
      kicker: 'Gestión y configuración',
    },
  ];

  readonly benefits: BenefitCard[] = [
    {
      title: 'Monitoreo continuo',
      description: 'Sigue tu operación con mayor visibilidad y respuesta rápida.',
      icon: 'pi pi-chart-line',
    },
    {
      title: 'Gestión unificada',
      description: 'Todo el sistema conectado dentro de una misma experiencia.',
      icon: 'pi pi-sitemap',
    },
    {
      title: 'Operación más ágil',
      description: 'Menos pasos, acceso directo y mejor flujo de trabajo.',
      icon: 'pi pi-bolt',
    },
  ];
}