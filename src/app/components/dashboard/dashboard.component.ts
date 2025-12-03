import { Component, OnInit, OnDestroy } from '@angular/core';
import { interval, Subscription } from 'rxjs';
import { ChartConfiguration, ChartData } from 'chart.js';
import {BancoPopularService, TasaCambio} from '../../banco-popular.service';
import {DatosClima, WeatherService} from '../../weather.service';
import {CurrencyPipe, DatePipe, NgClass, NgIf} from '@angular/common';
import {BaseChartDirective} from 'ng2-charts';

interface KPI {
  titulo: string;
  valor: string;
  cambio: string;
  tendencia: 'up' | 'down' | 'neutral';
  icono: string;
}

interface DatosInternos {
  ventas: Array<{ mes: string; ventas: number; gastos: number; utilidad: number }>;
  kpis: {
    ventasMes: number;
    crecimiento: number;
    clientesActivos: number;
    ticketPromedio: number;
  };
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  imports: [
    DatePipe,
    CurrencyPipe,
    NgClass,
    BaseChartDirective,
    NgIf
  ],
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  // Estado de carga
  cargando = true;
  ultimaActualizacion = new Date();

  // Datos de APIs
  tasasCambio: TasaCambio[] = [];
  tasaActual?: TasaCambio;
  climaDatos?: DatosClima;
  impactoClima?: any;

  // Datos internos
  datosInternos: DatosInternos = {
    ventas: [],
    kpis: {
      ventasMes: 0,
      crecimiento: 0,
      clientesActivos: 0,
      ticketPromedio: 0
    }
  };

  // KPIs para mostrar
  kpis: KPI[] = [];

  // Configuración de gráficos
  chartVentasData?: ChartData<'bar'>;
  chartTasasData?: ChartData<'line'>;
  chartVentasOptions: ChartConfiguration['options'];
  chartTasasOptions: ChartConfiguration['options'];

  // Suscripciones
  private subscriptions: Subscription[] = [];

  // Ciudades para monitorear clima
  ciudadesMonitoreo = ['Santo Domingo', 'Santiago', 'La Romana'];
  climaCiudades: DatosClima[] = [];

  constructor(
    public bancoService: BancoPopularService,
    public weatherService: WeatherService
  ) {
    this.inicializarOpcionesGraficos();
  }

  ngOnInit(): void {
    this.cargarDatosIniciales();
    this.configurarActualizacionAutomatica();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Carga todos los datos del dashboard
   */
  async cargarDatosIniciales(): Promise<void> {
    this.cargando = true;

    try {
      // Generar datos internos simulados
      this.generarDatosInternos();

      // Cargar tasas de cambio
      await this.cargarTasasCambio();

      // Cargar datos del clima
      await this.cargarDatosClima();

      // Actualizar KPIs
      this.actualizarKPIs();

      // Generar gráficos
      this.generarGraficos();

      this.ultimaActualizacion = new Date();
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      this.cargando = false;
    }
  }

  /**
   * Carga las tasas de cambio del Banco Popular
   */
  async cargarTasasCambio(): Promise<void> {
    try {
      // Intentar con API real
      this.tasasCambio = await this.bancoService.getTasasCambio().toPromise() || [];

      // Si no hay datos, usar simulados
      if (this.tasasCambio.length === 0) {
        this.tasasCambio = await this.bancoService.getTasasSimuladas().toPromise() || [];
      }

      this.tasaActual = this.tasasCambio[0];
    } catch (error) {
      console.error('Error cargando tasas:', error);
      // Usar datos simulados en caso de error
      this.tasasCambio = await this.bancoService.getTasasSimuladas().toPromise() || [];
      this.tasaActual = this.tasasCambio[0];
    }
  }

  /**
   * Carga los datos del clima
   */
  async cargarDatosClima(): Promise<void> {
    try {
      // Cargar clima de Santo Domingo (ciudad principal)
      this.climaDatos = await this.weatherService.getClimaPorCiudad('Santo Domingo').toPromise();

      if (this.climaDatos) {
        this.impactoClima = this.weatherService.getImpactoOperacional(this.climaDatos);
      }

      // Cargar clima de múltiples ciudades
      this.climaCiudades = await this.weatherService.getClimaMultiplesCiudades(this.ciudadesMonitoreo).toPromise() || [];

    } catch (error) {
      console.error('Error cargando clima:', error);
      // Usar datos simulados
      this.climaDatos = await this.weatherService.getClimaSimulado().toPromise();
      if (this.climaDatos) {
        this.impactoClima = this.weatherService.getImpactoOperacional(this.climaDatos);
      }
    }
  }

  /**
   * Genera datos internos simulados (ventas, clientes, etc.)
   */
  generarDatosInternos(): void {
    this.datosInternos = {
      ventas: [
        { mes: 'Ene', ventas: 45000, gastos: 32000, utilidad: 13000 },
        { mes: 'Feb', ventas: 52000, gastos: 35000, utilidad: 17000 },
        { mes: 'Mar', ventas: 48000, gastos: 33000, utilidad: 15000 },
        { mes: 'Abr', ventas: 61000, gastos: 38000, utilidad: 23000 },
        { mes: 'May', ventas: 55000, gastos: 36000, utilidad: 19000 },
        { mes: 'Jun', ventas: 67000, gastos: 40000, utilidad: 27000 }
      ],
      kpis: {
        ventasMes: 67000,
        crecimiento: 21.8,
        clientesActivos: 1247,
        ticketPromedio: 537
      }
    };
  }

  /**
   * Actualiza los KPIs principales
   */
  actualizarKPIs(): void {
    this.kpis = [
      {
        titulo: 'Ventas del Mes',
        valor: `$${(this.datosInternos.kpis.ventasMes / 1000).toFixed(0)}K`,
        cambio: `+${this.datosInternos.kpis.crecimiento}%`,
        tendencia: 'up',
        icono: 'trending_up'
      },
      {
        titulo: 'Tasa USD (Compra)',
        valor: `$${this.tasaActual?.compra.toFixed(2) || '0.00'}`,
        cambio: this.calcularVariacionTasa(),
        tendencia: this.getTendenciaTasa(),
        icono: 'attach_money'
      },
      {
        titulo: 'Temperatura',
        valor: `${this.climaDatos?.temperatura || 0}°C`,
        cambio: this.climaDatos?.descripcion || '',
        tendencia: 'neutral',
        icono: 'wb_sunny'
      },
      {
        titulo: 'Clientes Activos',
        valor: this.datosInternos.kpis.clientesActivos.toLocaleString(),
        cambio: `Ticket: $${this.datosInternos.kpis.ticketPromedio}`,
        tendencia: 'up',
        icono: 'people'
      }
    ];
  }

  /**
   * Genera los gráficos del dashboard
   */
  generarGraficos(): void {
    // Gráfico de ventas
    this.chartVentasData = {
      labels: this.datosInternos.ventas.map(v => v.mes),
      datasets: [
        {
          label: 'Ventas',
          data: this.datosInternos.ventas.map(v => v.ventas),
          backgroundColor: '#3b82f6'
        },
        {
          label: 'Gastos',
          data: this.datosInternos.ventas.map(v => v.gastos),
          backgroundColor: '#ef4444'
        },
        {
          label: 'Utilidad',
          data: this.datosInternos.ventas.map(v => v.utilidad),
          backgroundColor: '#10b981'
        }
      ]
    };

    // Gráfico de tasas de cambio
    if (this.tasasCambio.length > 0) {
      this.chartTasasData = {
        labels: this.tasasCambio.map(t => new Date(t.fecha).toLocaleDateString()),
        datasets: [
          {
            label: 'Tasa Compra',
            data: this.tasasCambio.map(t => t.compra),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.4
          },
          {
            label: 'Tasa Venta',
            data: this.tasasCambio.map(t => t.venta),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            tension: 0.4
          }
        ]
      };
    }
  }

  /**
   * Configura las opciones de los gráficos
   */
  inicializarOpcionesGraficos(): void {
    this.chartVentasOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top' },
        title: { display: true, text: 'Rendimiento Financiero Mensual' }
      },
      scales: {
        y: { beginAtZero: true }
      }
    };

    this.chartTasasOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top' },
        title: { display: true, text: 'Evolución Tasas de Cambio USD/DOP' }
      },
      scales: {
        y: { beginAtZero: false }
      }
    };
  }

  /**
   * Configura actualización automática cada 5 minutos
   */
  configurarActualizacionAutomatica(): void {
    const sub = interval(300000).subscribe(() => {
      this.actualizarDatos();
    });
    this.subscriptions.push(sub);
  }

  /**
   * Actualiza los datos manualmente
   */
  actualizarDatos(): void {
    this.cargarDatosIniciales();
  }

  /**
   * Calcula la variación de la tasa
   */
  calcularVariacionTasa(): string {
    if (this.tasasCambio.length < 2) return '+0.00%';

    const actual = this.tasasCambio[0].compra;
    const anterior = this.tasasCambio[1].compra;
    const variacion = this.bancoService.calcularVariacion(actual, anterior);

    return `${variacion >= 0 ? '+' : ''}${variacion.toFixed(2)}%`;
  }

  /**
   * Determina la tendencia de la tasa
   */
  getTendenciaTasa(): 'up' | 'down' | 'neutral' {
    if (this.tasasCambio.length < 2) return 'neutral';

    const actual = this.tasasCambio[0].compra;
    const anterior = this.tasasCambio[1].compra;

    if (actual > anterior) return 'up';
    if (actual < anterior) return 'down';
    return 'neutral';
  }

  /**
   * Obtiene la URL del icono del clima
   */
  getIconoClima(icono: string): string {
    return this.weatherService.getIconoUrl(icono);
  }

  /**
   * Formatea números a moneda
   */
  formatearMoneda(valor: number): string {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP'
    }).format(valor);
  }
}
