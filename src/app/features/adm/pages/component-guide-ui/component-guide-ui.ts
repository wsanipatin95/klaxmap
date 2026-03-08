import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { FloatLabel } from 'primeng/floatlabel';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { DatePicker } from 'primeng/datepicker';
import { Select } from 'primeng/select';
import { TabsModule } from 'primeng/tabs';
import { Dialog } from 'primeng/dialog';
import { AutoComplete } from 'primeng/autocomplete';
import { AccordionModule } from 'primeng/accordion';
import { toast, NgxSonnerToaster } from 'ngx-sonner';
import { ComponentsService } from '../../data-access/components.service';

@Component({
  selector: 'app-component-guide-ui',
  imports: [
    CommonModule,
    FormsModule,
    InputTextModule,
    FloatLabel,
    InputGroupModule,
    InputGroupAddonModule,
    ButtonModule,
    TableModule,
    DatePicker,
    Select,
    NgxSonnerToaster,
    TabsModule,
    AutoComplete,
    AccordionModule,
    Dialog
  ],
  templateUrl: './component-guide-ui.html',
  styleUrl: './component-guide-ui.scss',
})
export class ComponentGuideUi {

  private componentService = inject(ComponentsService);

  protected readonly toast = toast;
  products = signal([
    { code: 'P001', name: 'Apple', category: 'Fruits', price: 1.2, quantity: 10 },
    { code: 'P002', name: 'Banana', category: 'Fruits', price: 0.5, quantity: 10 },
    { code: 'P003', name: 'Carrot', category: 'Vegetables', price: 0.8, quantity: 10 },
    { code: 'P004', name: 'Broccoli', category: 'Vegetables', price: 1.5, quantity: 10 },
    { code: 'P005', name: 'Orange', category: 'Fruits', price: 1.0, quantity: 15 },
    { code: 'P006', name: 'Tomato', category: 'Vegetables', price: 0.9, quantity: 20 },
    { code: 'P007', name: 'Grape', category: 'Fruits', price: 2.5, quantity: 8 },
    { code: 'P008', name: 'Lettuce', category: 'Vegetables', price: 1.1, quantity: 12 },
    { code: 'P009', name: 'Strawberry', category: 'Fruits', price: 3.0, quantity: 6 },
    { code: 'P010', name: 'Potato', category: 'Vegetables', price: 0.6, quantity: 25 },
  ]);

  cities = signal([
    { name: 'New York', code: 'NY' },
    { name: 'Rome', code: 'RM' },
    { name: 'London', code: 'LDN' },
    { name: 'Istanbul', code: 'IST' },
    { name: 'Paris', code: 'PRS' },
    { name: 'Tokyo', code: 'TKO' },
    { name: 'Madrid', code: 'MAD' },
    { name: 'Berlin', code: 'BER' },
    { name: 'Sydney', code: 'SYD' },
    { name: 'Toronto', code: 'TOR' }
  ]);

  countries = signal([
    { name: 'United States', code: 'US' },
    { name: 'Canada', code: 'CA' },
    { name: 'Mexico', code: 'MX' },
    { name: 'Brazil', code: 'BR' },
    { name: 'Argentina', code: 'AR' },
    { name: 'United Kingdom', code: 'GB' },
    { name: 'Germany', code: 'DE' },
    { name: 'France', code: 'FR' },
    { name: 'Italy', code: 'IT' },
    { name: 'Spain', code: 'ES' }
  ]);

  categories = signal([
    { name: 'Electronics', code: 'ELEC' },
    { name: 'Clothing', code: 'CLTH' },
    { name: 'Food & Beverages', code: 'FOOD' },
    { name: 'Home & Garden', code: 'HOME' },
    { name: 'Sports', code: 'SPRT' },
    { name: 'Books', code: 'BOOK' },
    { name: 'Toys', code: 'TOYS' },
    { name: 'Health & Beauty', code: 'HLTH' }
  ]);

  tabs = signal([
    { route: 'dashboard', label: 'Dashboard', icon: 'pi pi-home' },
    { route: 'transactions', label: 'Transactions', icon: 'pi pi-chart-line' },
    { route: 'products', label: 'Products', icon: 'pi pi-list' },
    { route: 'messages', label: 'Messages', icon: 'pi pi-inbox' }
  ]);

  selectedCity: any = null;
  selectedCountry: any = null;
  selectedCategory: any = null;

  // Autocomplete properties
  value1: any = null;
  items: any[] = [];
  isSearching: boolean = false;

  // Dialog properties
  displayBasicDialog: boolean = false;
  displayFormDialog: boolean = false;
  dialogFormData = {
    name: '',
    email: ''
  };

  showSuccessToast() {
    this.toast.success('Operación realizada con éxito');
  }

  showInfoToast() {
    this.toast.info('Información importante', {
      description: 'Este es un mensaje informativo'
    });
  }

  showWarningToast() {
    this.toast.warning('Advertencia', {
      description: 'Ten cuidado con esta acción'
    });
  }

  showErrorToast() {
    this.toast.error('Error', {
      description: 'Algo salió mal. Por favor intenta nuevamente'
    });
  }

  showLoadingToast() {
    this.toast.loading('Cargando...', {
      description: 'Procesando tu solicitud'
    });
  }

  showCustomToast() {
    this.toast('Mensaje personalizado', {
      description: 'Este es un toast con estilo personalizado',
      duration: 5000
    });
  }

  showBasicDialog() {
    this.displayBasicDialog = true;
  }

  showFormDialog() {
    this.displayFormDialog = true;
  }

  submitDialogForm() {
    if (this.dialogFormData.name && this.dialogFormData.email) {
      this.toast.success('Formulario enviado', {
        description: `Nombre: ${this.dialogFormData.name}, Email: ${this.dialogFormData.email}`
      });
      this.displayFormDialog = false;
      this.dialogFormData = { name: '', email: '' };
    } else {
      this.toast.error('Error', {
        description: 'Por favor completa todos los campos'
      });
    }
  }

  cancelDialogForm() {
    this.displayFormDialog = false;
    this.dialogFormData = { name: '', email: '' };
  }

  search(event?: any) {
    const query = event?.query || '';
    this.isSearching = true;

    this.componentService.searchCountries(query).subscribe({
      next: (results) => {
        this.items = results;
        this.isSearching = false;
      },
      error: () => {
        this.isSearching = false;
        this.toast.error('Error al buscar países');
      }
    });
  }
}
