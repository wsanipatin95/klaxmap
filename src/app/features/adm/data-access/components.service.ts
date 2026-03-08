import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';

export interface CountryData {
  id: number;
  name: string;
  code: string;
  status: 'active' | 'inactive';
}

@Injectable({
  providedIn: 'root'
})
export class ComponentsService {

  private countryData: CountryData[] = [
    {
      id: 1,
      name: 'Ecuador',
      code: 'EC',
      status: 'active',
    },
    {
      id: 2,
      name: 'Canada',
      code: 'CA',
      status: 'active',
    },
    {
      id: 3,
      name: 'Germany',
      code: 'DE',
      status: 'inactive',
    },
    {
      id: 4,
      name: 'Brazil',
      code: 'BR',
      status: 'active',
    }
  ];

  constructor() { }

  searchCountries(query: string): Observable<CountryData[]> {
    // Simular búsqueda con delay de 500ms
    const filtered = this.countryData.filter(country =>
      country.name.toLowerCase().includes(query.toLowerCase()) ||
      country.code.toLowerCase().includes(query.toLowerCase())
    );

    return of(filtered).pipe(delay(500));
  }
}
