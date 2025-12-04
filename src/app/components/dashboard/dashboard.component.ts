import { Component, OnInit, OnDestroy, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { interval, Subscription } from 'rxjs';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import {BancoPopularService, TasaCambio} from '../../services/banco-popular.service';
import {DatosClima, WeatherService} from '../../services/weather.service';


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
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  // Signals de Angular 20 para estado reactivo
  cargando = signal(true);
  ultimaActualizacion = signal(new Date());
  tasasCambio = signal<TasaCambio[]>([]);
  climaDatos = signal<DatosClima | undefined>(undefined);
  climaCiudades = signal<DatosClima[]>([]);
  kpis = signal<KPI[]>([]);

  // Computed signals
  tasaActual = computed(() => this.tasasCambio()[0]);
  impactoClima = computed(() => {
    const clima = this.climaDatos();
    return clima ? this.weatherService.getImpactoOperacional(clima) : null;
  });

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

  // Configuración de gráficos
  chartVentasData = signal<ChartData<'bar'> | undefined>(undefined);
  chartTasasData = signal<ChartData<'line'> | undefined>(undefined);

  chartVentasOptions: ChartConfiguration['options'] = {
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

  chartTasasOptions: ChartConfiguration['options'] = {
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

  // Suscripciones
  private subscriptions: Subscription[] = [];

  // Ciudades para monitorear clima
  ciudadesMonitoreo = ['Santo Domingo', 'Santiago', 'La Romana'];

  constructor(
    public bancoService: BancoPopularService,
    public weatherService: WeatherService
  ) {
    // Effect para logging (Angular 20)
    effect(() => {
      console.log('Datos actualizados:', {
        tasas: this.tasasCambio().length,
        clima: this.climaDatos()?.ciudad,
        timestamp: this.ultimaActualizacion()
      });
    });
  }

  ngOnInit(): void {
    this.cargarDatosIniciales();
    this.configurarActualizacionAutomatica();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  async cargarDatosIniciales(): Promise<void> {
    this.cargando.set(true);

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

      this.ultimaActualizacion.set(new Date());
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      this.cargando.set(false);
    }
  }

  async cargarTasasCambio(): Promise<void> {
    try {
      const tasas = await this.bancoService.getTasasCambio().toPromise() || [];

      if (tasas.length === 0) {
        const tasasSimuladas = await this.bancoService.getTasasSimuladas().toPromise() || [];
        this.tasasCambio.set(tasasSimuladas);
      } else {
        this.tasasCambio.set(tasas);
      }
    } catch (error) {
      console.error('Error cargando tasas:', error);
      const tasasSimuladas = await this.bancoService.getTasasSimuladas().toPromise() || [];
      this.tasasCambio.set(tasasSimuladas);
    }
  }

  async cargarDatosClima(): Promise<void> {
    try {
      const clima = await this.weatherService.getClimaPorCiudad('Santo Domingo').toPromise();
      this.climaDatos.set(clima);

      const climaCiudades = await this.weatherService.getClimaMultiplesCiudades(
        this.ciudadesMonitoreo
      ).toPromise() || [];
      this.climaCiudades.set(climaCiudades);

    } catch (error) {
      console.error('Error cargando clima:', error);
      const climaSimulado = await this.weatherService.getClimaSimulado().toPromise();
      this.climaDatos.set(climaSimulado);
    }
  }

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

  actualizarKPIs(): void {
    const tasaActual = this.tasaActual();
    const clima = this.climaDatos();

    this.kpis.set([
      {
        titulo: 'Ventas del Mes',
        valor: `$${(this.datosInternos.kpis.ventasMes / 1000).toFixed(0)}K`,
        cambio: `+${this.datosInternos.kpis.crecimiento}%`,
        tendencia: 'up',
        icono: 'trending_up'
      },
      {
        titulo: 'Tasa USD (Compra)',
        valor: `$${tasaActual?.compra.toFixed(2) || '0.00'}`,
        cambio: this.calcularVariacionTasa(),
        tendencia: this.getTendenciaTasa(),
        icono: 'attach_money'
      },
      {
        titulo: 'Temperatura',
        valor: `${clima?.temperatura || 0}°C`,
        cambio: clima?.descripcion || '',
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
    ]);
  }

  generarGraficos(): void {
    // Gráfico de ventas
    this.chartVentasData.set({
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
    });

    // Gráfico de tasas de cambio
    const tasas = this.tasasCambio();
    if (tasas.length > 0) {
      this.chartTasasData.set({
        labels: tasas.map(t => new Date(t.fecha).toLocaleDateString()),
        datasets: [
          {
            label: 'Tasa Compra',
            data: tasas.map(t => t.compra),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.4,
            fill: true
          },
          {
            label: 'Tasa Venta',
            data: tasas.map(t => t.venta),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            tension: 0.4,
            fill: true
          }
        ]
      });
    }
  }

  configurarActualizacionAutomatica(): void {
    const sub = interval(300000).subscribe(() => {
      this.actualizarDatos();
    });
    this.subscriptions.push(sub);
  }

  actualizarDatos(): void {
    this.cargarDatosIniciales();
  }

  calcularVariacionTasa(): string {
    const tasas = this.tasasCambio();
    if (tasas.length < 2) return '+0.00%';

    const actual = tasas[0].compra;
    const anterior = tasas[1].compra;
    const variacion = this.bancoService.calcularVariacion(actual, anterior);

    return `${variacion >= 0 ? '+' : ''}${variacion.toFixed(2)}%`;
  }

  getTendenciaTasa(): 'up' | 'down' | 'neutral' {
    const tasas = this.tasasCambio();
    if (tasas.length < 2) return 'neutral';

    const actual = tasas[0].compra;
    const anterior = tasas[1].compra;

    if (actual > anterior) return 'up';
    if (actual < anterior) return 'down';
    return 'neutral';
  }

  getIconoClima(icono: string): string {
    return this.weatherService.getIconoUrl(icono);
  }

  formatearMoneda(valor: number): string {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP'
    }).format(valor);
  }
}
