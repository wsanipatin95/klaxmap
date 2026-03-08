import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface CascadingMenuItem {
  label: string;
  icon?: string;
  value?: string;
  children?: CascadingMenuItem[];
  selectable?: boolean;
}

export interface SelectionChangeEvent {
  selected: string[];
  item: CascadingMenuItem;
  action: 'select' | 'deselect';
}

@Component({
  selector: 'app-cascading-menu',
  imports: [CommonModule],
  templateUrl: './cascading-menu.component.html',
  styleUrl: './cascading-menu.component.scss',
})
export class CascadingMenuComponent {
  @Input() items: CascadingMenuItem[] = [];
  @Input() selectedValues: string[] = [];
  @Output() selectionChange = new EventEmitter<SelectionChangeEvent>();

  expandedItems: Set<string> = new Set();

  toggleExpand(item: CascadingMenuItem, event: Event): void {
    event.stopPropagation();
    const key = this.getItemKey(item);

    if (this.expandedItems.has(key)) {
      this.expandedItems.delete(key);
    } else {
      this.expandedItems.add(key);
    }
  }

  isExpanded(item: CascadingMenuItem): boolean {
    return this.expandedItems.has(this.getItemKey(item));
  }

  hasChildren(item: CascadingMenuItem): boolean {
    return !!item.children && item.children.length > 0;
  }

  isSelected(item: CascadingMenuItem): boolean {
    if (!item.value) return false;
    return this.selectedValues.includes(item.value);
  }

  isIndeterminate(item: CascadingMenuItem): boolean {
    if (!this.hasChildren(item)) return false;

    const selectableChildren = this.getSelectableChildren(item);
    if (selectableChildren.length === 0) return false;

    const selectedCount = selectableChildren.filter(child =>
      child.value && this.selectedValues.includes(child.value)
    ).length;

    return selectedCount > 0 && selectedCount < selectableChildren.length;
  }

  isParentFullySelected(item: CascadingMenuItem): boolean {
    if (!this.hasChildren(item)) return false;

    const selectableChildren = this.getSelectableChildren(item);
    if (selectableChildren.length === 0) return false;

    return selectableChildren.every(child =>
      child.value && this.selectedValues.includes(child.value)
    );
  }

  getSelectableChildren(item: CascadingMenuItem): CascadingMenuItem[] {
    if (!item.children) return [];

    const result: CascadingMenuItem[] = [];

    for (const child of item.children) {
      if (child.selectable !== false && child.value) {
        result.push(child);
      }
      if (child.children) {
        result.push(...this.getSelectableChildren(child));
      }
    }

    return result;
  }

  onCheckboxChange(item: CascadingMenuItem, event: Event): void {
    event.stopPropagation();

    if (!item.value) return;

    const isCurrentlySelected = this.isSelected(item);
    let newSelection = [...this.selectedValues];

    if (isCurrentlySelected) {
      // Deseleccionar item y sus hijos
      newSelection = newSelection.filter(v => v !== item.value);

      if (this.hasChildren(item)) {
        const childrenValues = this.getSelectableChildren(item)
          .map(c => c.value)
          .filter((v): v is string => !!v);
        newSelection = newSelection.filter(v => !childrenValues.includes(v));
      }

      this.selectionChange.emit({
        selected: newSelection,
        item,
        action: 'deselect'
      });
    } else {
      // Seleccionar item y sus hijos
      if (!newSelection.includes(item.value)) {
        newSelection.push(item.value);
      }

      if (this.hasChildren(item)) {
        const childrenValues = this.getSelectableChildren(item)
          .map(c => c.value)
          .filter((v): v is string => !!v);

        childrenValues.forEach(v => {
          if (!newSelection.includes(v)) {
            newSelection.push(v);
          }
        });
      }

      this.selectionChange.emit({
        selected: newSelection,
        item,
        action: 'select'
      });
    }
  }

  private getItemKey(item: CascadingMenuItem): string {
    return item.value || item.label;
  }
}
