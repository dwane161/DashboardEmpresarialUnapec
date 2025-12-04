import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

export interface Ubicacion {
  nombre: string;
  lat: number;
  lon: number;
  pais: string;
}

export interface DatosClima {
  temperatura: number;
  sensacionTermica: number;
  tempMin: number;
  tempMax: number;
  presion: number;
  humedad: number;
  descripcion: string;
  icono: string;
  viento: number;
  nubosidad: number;
  ciudad: string;
  pais: string;
}

@Injectable({
  providedIn: 'root'
})
export class WeatherService {
  // IMPORTANTE: Obtén tu API Key gratis en: https://openweathermap.org/api
  private apiKey = '8e54a6a43a554ad605a5906bad7db8f6'; // Reemplazar con tu key real
  private geocodingUrl = 'https://api.openweathermap.org/geo/1.0/direct';
  private weatherUrl = 'https://api.openweathermap.org/data/2.5/weather';

  constructor(private http: HttpClient) {}

  /**
   * Busca ubicaciones por nombre de ciudad
   * @param ciudad Nombre de la ciudad
   * @param limite Número máximo de resultados
   */
  buscarUbicacion(ciudad: string, limite: number = 5): Observable<Ubicacion[]> {
    const url = `${this.geocodingUrl}?q=${ciudad}&limit=${limite}&appid=${this.apiKey}`;

    return this.http.get<any[]>(url).pipe(
      map(data => data.map(item => ({
        nombre: item.name,
        lat: item.lat,
        lon: item.lon,
        pais: item.country
      }))),
      catchError(error => {
        console.error('Error en Geocoding API:', error);
        return of([]);
      })
    );
  }

  /**
   * Obtiene datos del clima para una ubicación específica
   * @param lat Latitud
   * @param lon Longitud
   */
  getClimaPorCoordenadas(lat: number, lon: number): Observable<DatosClima> {
    const url = `${this.weatherUrl}?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=metric&lang=es`;

    return this.http.get<any>(url).pipe(
      map(data => this.transformarDatosClima(data)),
      catchError(error => {
        console.error('Error en Weather API:', error);
        throw error;
      })
    );
  }

  /**
   * Obtiene el clima por nombre de ciudad
   * @param ciudad Nombre de la ciudad
   */
  getClimaPorCiudad(ciudad: string): Observable<DatosClima> {
    return this.buscarUbicacion(ciudad, 1).pipe(
      switchMap(ubicaciones => {
        if (ubicaciones.length === 0) {
          throw new Error('Ciudad no encontrada');
        }
        const ubicacion = ubicaciones[0];
        return this.getClimaPorCoordenadas(ubicacion.lat, ubicacion.lon);
      })
    );
  }

  /**
   * Obtiene el clima de múltiples ciudades
   * @param ciudades Array de nombres de ciudades
   */
  getClimaMultiplesCiudades(ciudades: string[]): Observable<DatosClima[]> {
    const requests = ciudades.map(ciudad =>
      this.getClimaPorCiudad(ciudad).pipe(
        catchError(() => of(null))
      )
    );

    return forkJoin(requests).pipe(
      map(results => results.filter(r => r !== null) as DatosClima[])
    );
  }

  /**
   * Transforma la respuesta de la API a formato interno
   */
  private transformarDatosClima(data: any): DatosClima {
    return {
      temperatura: Math.round(data.main.temp),
      sensacionTermica: Math.round(data.main.feels_like),
      tempMin: Math.round(data.main.temp_min),
      tempMax: Math.round(data.main.temp_max),
      presion: data.main.pressure,
      humedad: data.main.humidity,
      descripcion: data.weather[0].description,
      icono: data.weather[0].icon,
      viento: data.wind.speed,
      nubosidad: data.clouds.all,
      ciudad: data.name,
      pais: data.sys.country
    };
  }

  /**
   * Obtiene la URL del icono del clima
   */
  getIconoUrl(icono: string | undefined): string {
    return `https://openweathermap.org/img/wn/${icono}@2x.png`;
  }

  /**
   * Determina el impacto operacional basado en el clima
   */
  getImpactoOperacional(clima: DatosClima): {
    nivel: 'bajo' | 'medio' | 'alto';
    mensaje: string;
    color: string;
  } {
    let nivel: 'bajo' | 'medio' | 'alto' = 'bajo';
    let mensaje = 'Condiciones normales de operación';
    let color = 'text-green-600';

    // Temperatura extrema
    if (clima.temperatura > 35 || clima.temperatura < 10) {
      nivel = 'alto';
      mensaje = 'Temperatura extrema - Ajustar operaciones';
      color = 'text-red-600';
    }
    // Humedad alta
    else if (clima.humedad > 85) {
      nivel = 'medio';
      mensaje = 'Alta humedad - Precaución en almacenamiento';
      color = 'text-yellow-600';
    }
    // Viento fuerte
    else if (clima.viento > 50) {
      nivel = 'alto';
      mensaje = 'Vientos fuertes - Retrasos posibles';
      color = 'text-red-600';
    }
    // Condiciones óptimas
    else if (clima.temperatura >= 20 && clima.temperatura <= 28 && clima.humedad < 70) {
      mensaje = 'Condiciones óptimas para operaciones';
    }

    return { nivel, mensaje, color };
  }

  /**
   * Datos simulados para desarrollo
   */
  getClimaSimulado(): Observable<DatosClima> {
    const datosSimulados: DatosClima = {
      temperatura: 28,
      sensacionTermica: 30,
      tempMin: 25,
      tempMax: 31,
      presion: 1013,
      humedad: 75,
      descripcion: 'cielo despejado',
      icono: '01d',
      viento: 12,
      nubosidad: 10,
      ciudad: 'Santo Domingo',
      pais: 'DO'
    };

    return of(datosSimulados);
  }
}
