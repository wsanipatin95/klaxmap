import { Component, signal } from '@angular/core';
import { DrawerModule } from 'primeng/drawer';
import { CommonModule } from '@angular/common';

interface Notification {
  id: number;
  type: 'soporte' | 'pagos' | 'crm' | 'cortes' | 'informativos' | 'admin';
  title: string;
  message: string;
  time: string;
  count: number;
  primeIcon: string;
  color: string;
  read: boolean;
}

@Component({
  selector: 'app-notification-sidebar',
  imports: [
    DrawerModule,
    CommonModule
  ],
  templateUrl: './notification-sidebar.html',
  styleUrl: './notification-sidebar.scss',
})
export class NotificationSidebar {
  visible = signal<boolean>(false);
  showAllMode = signal<boolean>(false);

  notifications: Notification[] = [
    {
      id: 1,
      type: 'soporte',
      title: 'Soporte',
      message: 'Nuevas solicitudes de soporte pendientes',
      time: 'Hace 5 min',
      count: 3,
      primeIcon: 'pi pi-wrench',
      color: 'bg-primary-900',
      read: false
    },
    {
      id: 2,
      type: 'pagos',
      title: 'Pagos',
      message: 'Pagos pendientes de verificación',
      time: 'Hace 15 min',
      count: 7,
      primeIcon: 'pi pi-dollar',
      color: 'bg-primary-900',
      read: false
    },
    {
      id: 3,
      type: 'crm',
      title: 'CRM',
      message: 'Nuevos clientes registrados',
      time: 'Hace 30 min',
      count: 5,
      primeIcon: 'pi pi-users',
      color: 'bg-primary-900',
      read: false
    },
    {
      id: 4,
      type: 'cortes',
      title: 'Cortes',
      message: 'Cortes de servicios programados',
      time: 'Hace 1 hora',
      count: 2,
      primeIcon: 'pi pi-check-square',
      color: 'bg-primary-900',
      read: true
    },
    {
      id: 5,
      type: 'informativos',
      title: 'Informativos',
      message: 'Actualización del sistema completada',
      time: 'Hace 2 horas',
      count: 1,
      primeIcon: 'pi pi-info-circle',
      color: 'bg-primary-900',
      read: true
    },
    {
      id: 6,
      type: 'admin',
      title: 'Admin.',
      message: 'Nuevas configuraciones disponibles',
      time: 'Hace 3 horas',
      count: 4,
      primeIcon: 'pi pi-ticket',
      color: 'bg-primary-900',
      read: true
    },
    {
      id: 7,
      type: 'soporte',
      title: 'Soporte',
      message: 'Recordatorio de reunión con el equipo de soporte',
      time: 'Hace 4 horas',
      count: 0,
      primeIcon: 'pi pi-calendar',
      color: 'bg-primary-900',
      read: false
    },
    {
      id: 8,
      type: 'pagos',
      title: 'Pagos',
      message: 'Informe mensual de pagos generado',
      time: 'Hace 5 horas',
      count: 0,
      primeIcon: 'pi pi-file',
      color: 'bg-primary-900',
      read: true
    }
  ];

  openDrawer() {
    this.visible.set(true);
  }

  closeDrawer() {
    this.visible.set(false);
  }

  toggleViewMode() {
    this.showAllMode.set(!this.showAllMode());
  }

  markAsRead(notification: Notification) {
    notification.read = true;
  }

  markAllAsRead() {
    this.notifications.forEach(n => n.read = true);
  }

  get unreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }
}
