import { Component, Input, Output, EventEmitter, ContentChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface Tab {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  customClass?: string;
}

export interface TabsConfig {
  containerClass?: string;
  tabListClass?: string;
  tabClass?: string;
  activeTabClass?: string;
  inactiveTabClass?: string;
  contentClass?: string;
  iconClass?: string;
  labelClass?: string;
  scrollable?: boolean;
}

@Component({
  selector: 'app-custom-tabs',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './custom-tabs.component.html',
  styleUrl: './custom-tabs.component.scss',
})
export class CustomTabsComponent {
  @Input() tabs: Tab[] = [];
  @Input() activeTabId: string = '';
  @Input() config: TabsConfig = {};
  @Output() tabChange = new EventEmitter<string>();
  @ContentChild('tabContent', { static: false }) tabContentTemplate?: TemplateRef<any>;

  ngOnInit() {
    // Set first tab as active if no active tab is set
    if (!this.activeTabId && this.tabs.length > 0) {
      this.activeTabId = this.tabs[0].id;
    }
  }

  selectTab(tabId: string) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (tab && !tab.disabled) {
      this.activeTabId = tabId;
      this.tabChange.emit(tabId);
    }
  }

  isActive(tabId: string): boolean {
    return this.activeTabId === tabId;
  }

  getDefaultConfig(): TabsConfig {
    return {
      containerClass: this.config.containerClass || 'w-full',
      tabListClass: this.config.tabListClass || 'flex border-b border-gray-200 overflow-x-auto',
      tabClass: this.config.tabClass || 'px-4 py-3 font-medium transition-all duration-200 cursor-pointer whitespace-nowrap',
      activeTabClass: this.config.activeTabClass || 'text-primary-600 border-b-2 border-primary-600 bg-primary-50',
      inactiveTabClass: this.config.inactiveTabClass || 'text-gray-600 hover:text-gray-900 hover:bg-gray-50',
      contentClass: this.config.contentClass || 'p-4',
      iconClass: this.config.iconClass || 'mr-2',
      labelClass: this.config.labelClass || '',
      scrollable: this.config.scrollable !== undefined ? this.config.scrollable : true
    };
  }

  getTabClasses(tab: Tab): string {
    const defaultConfig = this.getDefaultConfig();
    const baseClass = defaultConfig.tabClass;
    const statusClass = this.isActive(tab.id) ? defaultConfig.activeTabClass : defaultConfig.inactiveTabClass;
    const disabledClass = tab.disabled ? 'opacity-50 cursor-not-allowed' : '';
    const customClass = tab.customClass || '';

    return `${baseClass} ${statusClass} ${disabledClass} ${customClass}`;
  }
}
