import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';

interface Company {
  id: number;
  name: string;
  code: string;
  contact: string;
  email: string;
  status: 'active' | 'inactive' | 'pending';
  users: number;
}

interface Notification {
  id: number;
  title: string;
  message: string;
  time: string;
  type: 'info' | 'warning' | 'success' | 'error';
}

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, ButtonModule, TableModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  companies: Company[] = [
    {
      id: 1,
      name: 'Tech Solutions S.A.',
      code: 'TECH-001',
      contact: 'Juan Pérez',
      email: 'juan.perez@techsolutions.com',
      status: 'active',
      users: 45
    },
    {
      id: 2,
      name: 'Innovatech Corp',
      code: 'INNO-002',
      contact: 'María García',
      email: 'maria.garcia@innovatech.com',
      status: 'active',
      users: 32
    },
    {
      id: 3,
      name: 'Digital Services Ltd',
      code: 'DIGI-003',
      contact: 'Carlos Rodríguez',
      email: 'carlos.rodriguez@digitalservices.com',
      status: 'pending',
      users: 18
    },
    {
      id: 4,
      name: 'Global Systems Inc',
      code: 'GLOB-004',
      contact: 'Ana Martínez',
      email: 'ana.martinez@globalsystems.com',
      status: 'active',
      users: 67
    },
    {
      id: 5,
      name: 'Smart Business Group',
      code: 'SMART-005',
      contact: 'Luis Fernández',
      email: 'luis.fernandez@smartbusiness.com',
      status: 'inactive',
      users: 12
    },
    {
      id: 6,
      name: 'Cloud Solutions Pro',
      code: 'CLOUD-006',
      contact: 'Patricia López',
      email: 'patricia.lopez@cloudsolutions.com',
      status: 'active',
      users: 54
    },
    {
      id: 7,
      name: 'Data Analytics Co',
      code: 'DATA-007',
      contact: 'Roberto Sánchez',
      email: 'roberto.sanchez@dataanalytics.com',
      status: 'active',
      users: 28
    }
  ];

  notifications: Notification[] = [
    {
      id: 1,
      title: 'Nuevo Usuario',
      message: 'Juan Pérez se registró en Tech Solutions',
      time: 'Hace 5 min',
      type: 'success'
    },
    {
      id: 2,
      title: 'Alerta de Sistema',
      message: 'El servidor requiere actualización',
      time: 'Hace 15 min',
      type: 'warning'
    },
    {
      id: 3,
      title: 'Empresa Pendiente',
      message: 'Digital Services Ltd requiere aprobación',
      time: 'Hace 30 min',
      type: 'info'
    },
    // {
    //   id: 4,
    //   title: 'Pago Recibido',
    //   message: 'Global Systems Inc - $2,500',
    //   time: 'Hace 1 hora',
    //   type: 'success'
    // },
    // {
    //   id: 5,
    //   title: 'Error de Conexión',
    //   message: 'Fallo al sincronizar con API externa',
    //   time: 'Hace 2 horas',
    //   type: 'error'
    // },
    // {
    //   id: 6,
    //   title: 'Nuevo Ticket',
    //   message: 'Soporte técnico - Ticket #1234',
    //   time: 'Hace 3 horas',
    //   type: 'info'
    // },
    // {
    //   id: 7,
    //   title: 'Actualización Exitosa',
    //   message: 'Base de datos actualizada correctamente',
    //   time: 'Hace 4 horas',
    //   type: 'success'
    // },
    // {
    //   id: 8,
    //   title: 'Licencia por Vencer',
    //   message: 'La licencia de Smart Business Group vence en 7 días',
    //   time: 'Hace 5 horas',
    //   type: 'warning'
    // }
  ];
}
