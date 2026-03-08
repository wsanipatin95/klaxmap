import { ChangeDetectorRef, Component, OnInit, signal, ViewChild } from '@angular/core';
import { TabsModule } from 'primeng/tabs';
import { MenuItem, TreeNode } from 'primeng/api';
import { TieredMenu } from 'primeng/tieredmenu';
import { BadgeModule } from 'primeng/badge';
import { CommonModule } from '@angular/common';
import { Ripple } from 'primeng/ripple';
import { ButtonModule } from 'primeng/button';
import { Tree } from 'primeng/tree';
import { CascadingMenuComponent, CascadingMenuItem, SelectionChangeEvent } from '@shared/cascading-menu/cascading-menu.component';
import { FullCalendarModule } from '@fullcalendar/angular';


@Component({
  selector: 'app-user-page',
  imports: [
    TabsModule,
    TieredMenu,
    BadgeModule,
    Ripple,
    CommonModule,
    ButtonModule,
    Tree,
    CascadingMenuComponent
  ],
  templateUrl: './user-page.component.html',
  styleUrl: './user-page.component.scss',
})
export class UserPageComponent implements OnInit {
  @ViewChild('menu') menu!: TieredMenu;

  activeTab: string = 'Usuarios';

  items: MenuItem[] | undefined;
  checkableItems: MenuItem[] | undefined;
  // selectedPermissions: Set<string> = new Set();

  files!: TreeNode[];

  selectedFiles!: TreeNode[];

  cascadingMenuItems: CascadingMenuItem[] = [];
  selectedPermissions: string[] = [];

  constructor(private cdr: ChangeDetectorRef) { }

  onTabChange(event: any) {
    this.activeTab = event.value;
    setTimeout(() => {
      this.cdr.detectChanges();
    }, 0);
  }

  // togglePermission(permission: string) {
  //   if (this.selectedPermissions.has(permission)) {
  //     this.selectedPermissions.delete(permission);
  //   } else {
  //     this.selectedPermissions.add(permission);
  //   }
  //   this.updateCheckableItems();
  // }

  // isPermissionSelected(permission: string): boolean {
  //   return this.selectedPermissions.has(permission);
  // }

  // updateCheckableItems() {
  //   this.checkableItems = [
  //     {
  //       label: 'Call Center',
  //       icon: 'pi pi-phone',
  //       items: [
  //         {
  //           label: 'Acceso a call Center',
  //           icon: this.isPermissionSelected('callcenter-access') ? 'pi pi-check-circle' : 'pi pi-circle',
  //           styleClass: this.isPermissionSelected('callcenter-access') ? 'selected-permission' : 'unselected-permission',
  //           command: () => this.togglePermission('callcenter-access')
  //         }
  //       ]
  //     },
  //     {
  //       label: 'Mis Tickets',
  //       icon: 'pi pi-ticket',
  //       items: [
  //         {
  //           label: 'Mis tickets',
  //           icon: this.isPermissionSelected('tickets-view') ? 'pi pi-check-circle' : 'pi pi-circle',
  //           styleClass: this.isPermissionSelected('tickets-view') ? 'selected-permission' : 'unselected-permission',
  //           command: () => this.togglePermission('tickets-view')
  //         },
  //         {
  //           label: 'Mis tickets asignados',
  //           icon: this.isPermissionSelected('tickets-assigned') ? 'pi pi-check-circle' : 'pi pi-circle',
  //           styleClass: this.isPermissionSelected('tickets-assigned') ? 'selected-permission' : 'unselected-permission',
  //           command: () => this.togglePermission('tickets-assigned')
  //         }
  //       ]
  //     },
  //     {
  //       label: 'Recaudaciones',
  //       icon: 'pi pi-dollar',
  //       items: [
  //         {
  //           label: 'Recaudaciones',
  //           icon: this.isPermissionSelected('recaudaciones-view') ? 'pi pi-check-circle' : 'pi pi-circle',
  //           styleClass: this.isPermissionSelected('recaudaciones-view') ? 'selected-permission' : 'unselected-permission',
  //           command: () => this.togglePermission('recaudaciones-view')
  //         },
  //         {
  //           label: 'Rubros',
  //           icon: this.isPermissionSelected('rubros-view') ? 'pi pi-check-circle' : 'pi pi-circle',
  //           styleClass: this.isPermissionSelected('rubros-view') ? 'selected-permission' : 'unselected-permission',
  //           command: () => this.togglePermission('rubros-view')
  //         },
  //         {
  //           label: 'Débitos',
  //           icon: this.isPermissionSelected('debitos-view') ? 'pi pi-check-circle' : 'pi pi-circle',
  //           styleClass: this.isPermissionSelected('debitos-view') ? 'selected-permission' : 'unselected-permission',
  //           command: () => this.togglePermission('debitos-view')
  //         }
  //       ]
  //     },
  //     {
  //       label: 'Atención al Cliente',
  //       icon: this.isPermissionSelected('atencion-cliente') ? 'pi pi-check-circle' : 'pi pi-circle',
  //       styleClass: this.isPermissionSelected('atencion-cliente') ? 'selected-permission' : 'unselected-permission',
  //       command: () => this.togglePermission('atencion-cliente')
  //     },
  //     {
  //       label: 'Internet',
  //       icon: this.isPermissionSelected('internet') ? 'pi pi-check-circle' : 'pi pi-circle',
  //       styleClass: this.isPermissionSelected('internet') ? 'selected-permission' : 'unselected-permission',
  //       command: () => this.togglePermission('internet')
  //     },
  //     {
  //       label: 'Contratos',
  //       icon: this.isPermissionSelected('contratos') ? 'pi pi-check-circle' : 'pi pi-circle',
  //       styleClass: this.isPermissionSelected('contratos') ? 'selected-permission' : 'unselected-permission',
  //       command: () => this.togglePermission('contratos')
  //     },
  //     {
  //       label: 'Mis contratos',
  //       icon: this.isPermissionSelected('mis-contratos') ? 'pi pi-check-circle' : 'pi pi-circle',
  //       styleClass: this.isPermissionSelected('mis-contratos') ? 'selected-permission' : 'unselected-permission',
  //       command: () => this.togglePermission('mis-contratos')
  //     },
  //     {
  //       label: 'Clientes',
  //       icon: this.isPermissionSelected('clientes') ? 'pi pi-check-circle' : 'pi pi-circle',
  //       styleClass: this.isPermissionSelected('clientes') ? 'selected-permission' : 'unselected-permission',
  //       command: () => this.togglePermission('clientes')
  //     },
  //     {
  //       label: 'Cobranza',
  //       icon: this.isPermissionSelected('cobranza') ? 'pi pi-check-circle' : 'pi pi-circle',
  //       styleClass: this.isPermissionSelected('cobranza') ? 'selected-permission' : 'unselected-permission',
  //       command: () => this.togglePermission('cobranza')
  //     }
  //   ];
  // }

  onCascadingSelectionChange(event: SelectionChangeEvent): void {
    this.selectedPermissions = event.selected;
    console.log('Permisos seleccionados:', this.selectedPermissions);
  }

  ngOnInit() {
    this.items = [
      {
        label: 'Call Center',
        icon: 'pi pi-phone',
        badge: '1 pag.',
        badgeStyleClass: 'p-badge-rounded p-badge-info',
        items: [
          {
            label: 'Accceso a call Center',
            icon: 'pi pi-sign-in',
          }
        ]
      },
      {
        label: 'Mis Tickets',
        icon: 'pi pi-ticket',
        badge: '3 pags.',
        badgeStyleClass: 'p-badge-rounded p-badge-warning',
        items: [
          {
            label: 'Mis tickets',
            icon: 'pi pi-list',
          },
          {
            label: 'Mis tickets asignados',
            icon: 'pi pi-user',
            badge: '3 pags.',
            badgeStyleClass: 'p-badge-rounded p-badge-danger',
            command: () => {
              confirm('¿Deseas asignar este privilegio?');
            }
          }
        ]
      },
      {
        label: 'Recaudaciones',
        icon: 'pi pi-dollar',
        badge: '3 pags.',
        badgeStyleClass: 'p-badge-rounded p-badge-success',
        items: [
          {
            label: 'Recaudaciones',
            icon: 'pi pi-money-bill',
          },
          {
            label: 'Rubros',
            icon: 'pi pi-tag',
          },
          {
            label: 'Débitos',
            icon: 'pi pi-credit-card',
          }
        ]
      },
      {
        label: 'Atención al Cliente',
        icon: 'pi pi-comments',
      },
      {
        label: 'Internet',
        icon: 'pi pi-wifi',
      },
      {
        label: 'Contratos',
        icon: 'pi pi-file-edit',
      },
      {
        label: 'Mis contratos',
        icon: 'pi pi-file',
      },
      {
        label: 'Clientes',
        icon: 'pi pi-users',
      },
      {
        label: 'Cobranza',
        icon: 'pi pi-wallet',
      }
    ];

    this.files = [
      {
        label: 'Contabilidad',
        children: [
          {
            label: 'Estados financieros',
          },
          {
            label: 'Conciliaciones',
          },
          {
            label: 'Cargas / descargas',
          }
        ]
      },
      {
        label: 'Operaciones',
        children: [
          {
            label: 'Mi nomina',
          },
          {
            label: 'Viajes y gastos',
          },
          {
            label: 'Horarios',
          }
        ]
      },
      {
        label: 'CRM',
        children: [
          {
            label: 'Leads',
          },
          {
            label: 'Oportunidades',
          },
          {
            label: 'Campañas',
          }
        ]
      },
      {
        label: 'Atención al Cliente',
        children: [
          {
            label: 'Tickets',
          },
          {
            label: 'Base de conocimientos',
          },
          {
            label: 'Chat en vivo',
          }
        ]
      },
      {
        label: 'Cobranza',
        children: [
          {
            label: 'Facturación',
          },
          {
            label: 'Pagos',
          },
          {
            label: 'Recordatorios',
          }
        ]
      },
      {
        label: 'Facturación',
        children: [
          {
            label: 'Crear factura',
          },
          {
            label: 'Historial de facturas',
          },
          {
            label: 'Ajustes de facturación',
          }
        ]
      },
      {
        label: 'Mi ruta',
        children: [
          {
            label: 'Ver mapa',
          },
          {
            label: 'Historial de rutas',
          },
          {
            label: 'Ajustes de ruta',
          }
        ]
      }
    ];

    // Inicializar el menu con checkboxes
    // this.updateCheckableItems();

    // Inicializar el cascading menu personalizado
    this.cascadingMenuItems = [
      {
        label: 'Call Center',
        icon: 'pi pi-phone',
        children: [
          {
            label: 'Acceso a call Center',
            icon: 'pi pi-sign-in',
            value: 'callcenter-access',
            selectable: true
          }
        ]
      },
      {
        label: 'Mis Tickets',
        icon: 'pi pi-ticket',
        children: [
          {
            label: 'Mis tickets',
            icon: 'pi pi-list',
            value: 'tickets-view',
            selectable: true
          },
          {
            label: 'Mis tickets asignados',
            icon: 'pi pi-user',
            value: 'tickets-assigned',
            selectable: true
          }
        ]
      },
      {
        label: 'Recaudaciones',
        icon: 'pi pi-dollar',
        children: [
          {
            label: 'Recaudaciones',
            icon: 'pi pi-money-bill',
            value: 'recaudaciones-view',
            selectable: true
          },
          {
            label: 'Rubros',
            icon: 'pi pi-tag',
            value: 'rubros-view',
            selectable: true
          },
          {
            label: 'Débitos',
            icon: 'pi pi-credit-card',
            value: 'debitos-view',
            selectable: true
          }
        ]
      },
      {
        label: 'Atención al Cliente',
        icon: 'pi pi-comments',
        value: 'atencion-cliente',
        selectable: true
      },
      {
        label: 'Internet',
        icon: 'pi pi-wifi',
        value: 'internet',
        selectable: true
      },
      {
        label: 'Contratos',
        icon: 'pi pi-file-edit',
        value: 'contratos',
        selectable: true
      },
      {
        label: 'Mis contratos',
        icon: 'pi pi-file',
        value: 'mis-contratos',
        selectable: true
      },
      {
        label: 'Clientes',
        icon: 'pi pi-users',
        value: 'clientes',
        selectable: true
      },
      {
        label: 'Cobranza',
        icon: 'pi pi-wallet',
        value: 'cobranza',
        selectable: true
      }
    ];
  }
}
