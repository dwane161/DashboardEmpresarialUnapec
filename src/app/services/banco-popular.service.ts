import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface TasaCambio {
  fecha: string;
  compra: number;
  venta: number;
  moneda: string;
}

@Injectable({
  providedIn: 'root'
})
export class BancoPopularService {
  private apiUrl = 'https://api.us-east-a.apiconnect.ibmappdomain.cloud/apiportalpopular/bpdsandbox/consultatasa/consultaTasa';

  // IMPORTANTE: Necesitarás obtener tu API Key registrándote en:
  // https://www.apiportal.popularenlinea.com/
  private apiKey = 'AAIgMWMzZWZlYTBkNDU3YTdlNWE2YjI5ZTBiYzk0YzI1NTmCxo2ir5tqbzwjV6AM0qQlFFSsXRw_42YPrcYgKRJRPzfhJ8oZ6pKLpEHU33e434_odwM0fjxiYpv6yz8YNOUw1oZ2Zt843Y_g9FmxVGF8tqqeu_R7ZOekGAo0GNmWFkE'; // Reemplazar con tu key real

  constructor(private http: HttpClient) {}

  /**
   * Consulta las tasas de cambio del Banco Popular Dominicano
   * @returns Observable con las tasas de cambio
   */
  getTasasCambio(): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-ibm-client-id': '1c3efea0d457a7e5a6b29e0bc94c2559'
    });

    return this.http.get<any>(this.apiUrl, { headers }).pipe(
      map(response => {
        console.log('Respuesta API Banco Popular:', response);
        return this.transformarTasas(response);
      }),
      catchError(error => {
        console.error('Error en API Banco Popular:', error);
        // Retornar datos simulados si la API falla
        return throwError(() => error);
      })
    );
  }

  /**
   * Transforma la respuesta de la API a un formato uniforme
   */
  private transformarTasas(data: any): TasaCambio[] {
    const tasas: TasaCambio[] = [];

    if (data && data.tasas) {
      data.tasas.forEach((tasa: any) => {
        tasas.push({
          fecha: tasa.fecha || new Date().toISOString(),
          compra: parseFloat(tasa.tasaCompra || tasa.compra),
          venta: parseFloat(tasa.tasaVenta || tasa.venta),
          moneda: tasa.moneda || 'USD'
        });
      });
    }

    return tasas;
  }

  /**
   * Datos simulados para desarrollo/pruebas
   */
  getTasasSimuladas(): Observable<TasaCambio[]> {
    const tasasSimuladas: TasaCambio[] = [
      {
        fecha: new Date().toISOString(),
        compra: 58.50,
        venta: 59.20,
        moneda: 'USD'
      },
      {
        fecha: new Date(Date.now() - 86400000).toISOString(),
        compra: 58.45,
        venta: 59.15,
        moneda: 'USD'
      },
      {
        fecha: new Date(Date.now() - 172800000).toISOString(),
        compra: 58.40,
        venta: 59.10,
        moneda: 'USD'
      }
    ];

    return new Observable(observer => {
      observer.next(tasasSimuladas);
      observer.complete();
    });
  }

  /**
   * Calcula el diferencial de cambio
   */
  calcularDiferencial(compra: number, venta: number): number {
    return parseFloat((venta - compra).toFixed(2));
  }

  /**
   * Calcula la variación porcentual
   */
  calcularVariacion(actual: number, anterior: number): number {
    if (anterior === 0) return 0;
    return parseFloat((((actual - anterior) / anterior) * 100).toFixed(2));
  }
}
