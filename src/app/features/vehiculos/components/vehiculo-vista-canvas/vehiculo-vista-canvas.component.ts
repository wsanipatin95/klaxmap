import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { VehOrdenTrabajoHallazgoMarca, VehTipoVehiculoVista } from '../../data-access/vehiculos.models';

@Component({
  selector: 'app-vehiculo-vista-canvas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './vehiculo-vista-canvas.component.html',
  styleUrl: './vehiculo-vista-canvas.component.scss',
})
export class VehiculoVistaCanvasComponent {
  @Input() vista: VehTipoVehiculoVista | null = null;
  @Input() marcas: VehOrdenTrabajoHallazgoMarca[] = [];
  @Input() interactive = false;
  @Output() pointMarked = new EventEmitter<{ x: number; y: number }>();

  onSurfaceClick(event: MouseEvent) {
    if (!this.interactive) return;
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = Number(((event.clientX - rect.left) / rect.width).toFixed(4));
    const y = Number(((event.clientY - rect.top) / rect.height).toFixed(4));
    this.pointMarked.emit({ x, y });
  }

  resolveImageSrc(binary?: string | null) {
    if (!binary) return null;
    const value = String(binary).trim();
    if (!value) return null;
    if (value.startsWith('data:') || value.startsWith('http://') || value.startsWith('https://') || value.startsWith('blob:')) {
      return value;
    }
    return `data:${this.guessMimeType(value)};base64,${value}`;
  }

  marcasVista() {
    const vistaId = this.vista?.idVehTipoVehiculoVista;
    if (!vistaId) return [];
    return this.marcas.filter((marca) => marca.idVehTipoVehiculoVistaFk === vistaId);
  }

  renderShapes() {
    return this.marcasVista().map((marca) => this.buildShape(marca)).filter(Boolean) as Array<Record<string, unknown>>;
  }

  private buildShape(marca: VehOrdenTrabajoHallazgoMarca) {
    const tipo = String(marca.tipoMarca || 'PUNTO').toUpperCase();
    const geometria = (marca.geometria ?? {}) as Record<string, unknown>;
    const color = marca.color || '#cd327f';
    const title = marca.observaciones || marca.tipoMarca || 'Marca';
    const puntos = Array.isArray(geometria['puntos']) ? (geometria['puntos'] as Array<Record<string, unknown>>) : [];

    if (tipo === 'LINEA' && puntos.length >= 2) {
      return {
        kind: 'line',
        x1: this.scaleCoord(puntos[0]?.['x']),
        y1: this.scaleCoord(puntos[0]?.['y']),
        x2: this.scaleCoord(puntos[1]?.['x']),
        y2: this.scaleCoord(puntos[1]?.['y']),
        color,
        title,
      };
    }

    if (tipo === 'RECTANGULO') {
      if (puntos.length >= 2) {
        const x1 = this.scaleCoord(puntos[0]?.['x']);
        const y1 = this.scaleCoord(puntos[0]?.['y']);
        const x2 = this.scaleCoord(puntos[1]?.['x']);
        const y2 = this.scaleCoord(puntos[1]?.['y']);
        return {
          kind: 'rect',
          x: Math.min(x1, x2),
          y: Math.min(y1, y2),
          width: Math.abs(x2 - x1),
          height: Math.abs(y2 - y1),
          color,
          title,
        };
      }
      return {
        kind: 'rect',
        x: this.scaleCoord(geometria['x']),
        y: this.scaleCoord(geometria['y']),
        width: this.scaleSize(geometria['width'] ?? geometria['w']),
        height: this.scaleSize(geometria['height'] ?? geometria['h']),
        color,
        title,
      };
    }

    if (tipo === 'CIRCULO') {
      const center = (geometria['centro'] ?? {}) as Record<string, unknown>;
      return {
        kind: 'circle',
        cx: this.scaleCoord(center['x'] ?? geometria['x']),
        cy: this.scaleCoord(center['y'] ?? geometria['y']),
        r: this.scaleSize(geometria['radio'] ?? geometria['r'] ?? 0.025),
        color,
        title,
      };
    }

    if (tipo === 'POLIGONO' && puntos.length >= 3) {
      return {
        kind: 'polygon',
        points: puntos.map((p) => `${this.scaleCoord(p['x'])},${this.scaleCoord(p['y'])}`).join(' '),
        color,
        title,
      };
    }

    const point = puntos[0] ?? geometria;
    return {
      kind: 'point',
      cx: this.scaleCoord(point['x']),
      cy: this.scaleCoord(point['y']),
      r: 12,
      color,
      title,
    };
  }

  private scaleCoord(value: unknown) {
    const number = Number(value ?? 0.5);
    if (Number.isNaN(number)) return 500;
    if (number <= 1) return number * 1000;
    if (number <= 100) return number * 10;
    return number;
  }

  private scaleSize(value: unknown) {
    const number = Number(value ?? 0.03);
    if (Number.isNaN(number)) return 30;
    if (number <= 1) return number * 1000;
    if (number <= 100) return number * 10;
    return number;
  }

  private guessMimeType(base64: string) {
    if (base64.startsWith('/9j/')) return 'image/jpeg';
    if (base64.startsWith('iVBOR')) return 'image/png';
    if (base64.startsWith('R0lGOD')) return 'image/gif';
    if (base64.startsWith('UklGR')) return 'image/webp';
    if (base64.startsWith('PHN2Zy') || base64.startsWith('PD94bWw')) return 'image/svg+xml';
    return 'image/png';
  }
}
