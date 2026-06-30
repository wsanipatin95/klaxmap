import { Directive, ElementRef, Input, OnChanges, inject } from '@angular/core';

/** Hace scroll hasta el elemento cuando pasa a estar seleccionado (para no perder el foco en listas largas). */
@Directive({
  selector: '[rbScrollSelected]',
  standalone: true,
})
export class RbScrollSelectedDirective implements OnChanges {
  private readonly el = inject(ElementRef<HTMLElement>);
  @Input('rbScrollSelected') selected = false;

  ngOnChanges(): void {
    if (this.selected) {
      setTimeout(() => this.el.nativeElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 0);
    }
  }
}
