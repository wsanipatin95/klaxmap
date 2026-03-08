import { Component, inject } from '@angular/core';
import { RouterModule } from "@angular/router";
import { NavbarComponent } from "../navbar/navbar.component";
import { SidebarComponent } from "../sidebar/sidebar.component";
import { SidebarService } from '../../core/services/sidebar.service';

@Component({
  selector: 'app-layout',
  imports: [
    RouterModule,
    NavbarComponent,
    SidebarComponent
  ],
  templateUrl: './app-layout.component.html',
  styleUrl: './app-layout.component.scss',
})
export class AppLayoutComponent {
  sidebarService = inject(SidebarService);
  isCollapsed = this.sidebarService.isCollapsed;
  isMobileVisible = this.sidebarService.isMobileVisible;

  closeMobileSidebar() {
    this.sidebarService.closeMobileSidebar();
  }
}
