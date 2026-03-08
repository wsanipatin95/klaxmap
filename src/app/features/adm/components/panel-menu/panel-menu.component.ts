import { Component, OnInit } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { PanelMenu } from 'primeng/panelmenu';
import { BadgeModule } from 'primeng/badge';
import { Ripple } from 'primeng/ripple';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-panel-menu',
  imports: [PanelMenu, BadgeModule, Ripple, CommonModule],
  templateUrl: './panel-menu.component.html',
  styleUrl: './panel-menu.component.scss',
})
export class PanelMenuComponent implements OnInit {
  items!: MenuItem[];

  ngOnInit() {
    this.items = [
      {
        label: 'Facturación',
        icon: 'pi pi-file',
        badge: '5',
        items: [
          {
            label: 'Compose',
            icon: 'pi pi-file-edit',
            shortcut: '⌘+N'
          },
          {
            label: 'Inbox',
            icon: 'pi pi-inbox',
            badge: '5'
          },
          {
            label: 'Sent',
            icon: 'pi pi-send',
            shortcut: '⌘+S'
          },
          {
            label: 'Trash',
            icon: 'pi pi-trash',
            shortcut: '⌘+T'
          }
        ]
      },
      {
        label: 'Configuración básica',
        icon: 'pi pi-cog',
        shortcut: '⌘+R',
        items: [
          {
            label: 'Sales',
            icon: 'pi pi-chart-line',
            badge: '3'
          },
          {
            label: 'Products',
            icon: 'pi pi-list',
            badge: '6'
          }
        ]
      },
      {
        label: 'Inventario',
        icon: 'pi pi-box',
        shortcut: '⌘+W',
        items: [
          {
            label: 'Settings',
            icon: 'pi pi-cog',
            shortcut: '⌘+O'
          },
          {
            label: 'Privacy',
            icon: 'pi pi-shield',
            shortcut: '⌘+P'
          }
        ]
      }
    ];
  }

  toggleAll() {
    const expanded = !this.areAllItemsExpanded();
    this.items = this.toggleAllRecursive(this.items, expanded);
  }

  private toggleAllRecursive(items: MenuItem[], expanded: boolean): MenuItem[] {
    return items.map((menuItem) => {
      menuItem.expanded = expanded;
      if (menuItem.items) {
        menuItem.items = this.toggleAllRecursive(menuItem.items, expanded);
      }
      return menuItem;
    });
  }

  private areAllItemsExpanded(): boolean {
    return this.items.every((menuItem) => menuItem.expanded);
  }
}
