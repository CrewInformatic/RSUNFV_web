// reportes.js - Versión mejorada con código limpio
import { db, collection, getDocs } from "./firebase_config.js";

/**
 * Constantes para estados y tipos de eventos
 */
const ESTADOS_EVENTO = {
  ACTIVO: "activo",
  FINALIZADO: "finalizado",
  CANCELADO: "cancelado",
  EN_PROGRESO: "en_progreso",
};

const TIPOS_EVENTO = {
  REFORESTACION: "reforestacion",
  LIMPIEZA: "limpieza",
  EDUCACION: "educacion",
  CONSERVACION: "conservacion",
};

const COLORES_GRAFICOS = {
  REFORESTACION: "#28a745",
  LIMPIEZA: "#17a2b8",
  EDUCACION: "#ffc107",
  CONSERVACION: "#6f42c1",
  ACTIVO: "#007bff",
  FINALIZADO: "#28a745",
  CANCELADO: "#dc3545",
  EN_PROGRESO: "#ffc107",
};

const MENSAJES = {
  ERROR_INICIALIZACION: "Error inicializando reportes:",
  ERROR_CARGA_DATOS: "Error cargando datos:",
  DATOS_CARGADOS: "Datos cargados:",
  EVENTOS: "eventos y",
  USUARIOS: "usuarios",
  FILTROS_APLICADOS: "Filtros aplicados. Mostrando",
  EVENTOS_FILTRADOS: "eventos.",
  REPORTE_GENERADO: "generado exitosamente.",
  GENERANDO: '<i class="fas fa-spinner fa-spin me-2"></i>Generando...',
  GENERADO: '<i class="fas fa-check me-2"></i>¡Generado!',
};

const SELECTORES = {
  REPORTE_GENERAL: ".report-card:nth-child(1)",
  REPORTE_INSCRIPCIONES: ".report-card:nth-child(2)",
  REPORTE_UBICACION: ".report-card:nth-child(3)",
  REPORTE_TIPO: ".report-card:nth-child(4)",
  REPORTE_ADMIN: ".report-card:nth-child(5)",
  REPORTE_TEMPORAL: ".report-card:nth-child(6)",
  TABLA_EVENTOS: "#eventosTable",
  GRAFICO_TIPOS: "#tipoEventoChart",
  GRAFICO_ESTADOS: "#estadoEventoChart",
  BTN_FILTRO: ".btn-filter",
  BTN_DESCARGA: ".btn-download",
  SIDEBAR_TOGGLE: "#sidebarToggle",
  SIDEBAR: "#sidebar",
};

/**
 * Clase principal para manejo de reportes de eventos
 */
class ReportesEventos {
  constructor() {
    this.eventos = [];
    this.usuarios = [];
    this.eventosOriginales = [];
    this.init();
  }

  /**
   * Inicializa la aplicación de reportes
   */
  async init() {
    try {
      await this.cargarDatos();
      this.generarReportes();
      this.configurarEventListeners();
      this.inicializarGraficos();
    } catch (error) {
      this.manejarError(MENSAJES.ERROR_INICIALIZACION, error);
    }
  }

  /**
   * Carga datos desde Firebase
   */
  async cargarDatos() {
    try {
      const [eventosSnapshot, usuariosSnapshot] = await Promise.all([
        getDocs(collection(db, "eventos")),
        getDocs(collection(db, "usuarios")),
      ]);

      this.eventos = this.mapearDocumentos(eventosSnapshot);
      this.usuarios = this.mapearDocumentos(usuariosSnapshot);
      this.eventosOriginales = [...this.eventos];

      console.log(
        `${MENSAJES.DATOS_CARGADOS} ${this.eventos.length} ${MENSAJES.EVENTOS} ${this.usuarios.length} ${MENSAJES.USUARIOS}`
      );
    } catch (error) {
      this.manejarError(MENSAJES.ERROR_CARGA_DATOS, error);
    }
  }

  /**
   * Mapea documentos de Firebase a objetos JavaScript
   * @param {QuerySnapshot} snapshot - Snapshot de Firebase
   * @returns {Array} Array de objetos mapeados
   */
  mapearDocumentos(snapshot) {
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  }

  /**
   * Genera todos los reportes
   */
  generarReportes() {
    this.actualizarReporteGeneral();
    this.actualizarReporteInscripciones();
    this.actualizarReporteUbicacion();
    this.actualizarReporteTipo();
    this.actualizarReporteAdministradores();
    this.actualizarReporteTemporal();
    this.actualizarTablaEventos();
  }

  /**
   * Actualiza el reporte general
   */
  actualizarReporteGeneral() {
    const estadisticas = this.calcularEstadisticasGenerales();
    this.actualizarElementoReporte(SELECTORES.REPORTE_GENERAL, [
      estadisticas.total,
      estadisticas.finalizados,
      estadisticas.activos,
    ]);
  }

  /**
   * Calcula estadísticas generales de eventos
   * @returns {Object} Objeto con estadísticas
   */
  calcularEstadisticasGenerales() {
    return {
      total: this.eventos.length,
      finalizados: this.contarEventosPorEstado(ESTADOS_EVENTO.FINALIZADO),
      activos: this.contarEventosPorEstado(ESTADOS_EVENTO.ACTIVO),
    };
  }

  /**
   * Cuenta eventos por estado específico
   * @param {string} estado - Estado a contar
   * @returns {number} Cantidad de eventos
   */
  contarEventosPorEstado(estado) {
    return this.eventos.filter((evento) => evento.estado === estado).length;
  }

  /**
   * Actualiza el reporte de inscripciones
   */
  actualizarReporteInscripciones() {
    const estadisticas = this.calcularEstadisticasInscripciones();
    this.actualizarElementoReporte(SELECTORES.REPORTE_INSCRIPCIONES, [
      estadisticas.totalInscritos,
      estadisticas.capacidadTotal,
      `${estadisticas.ocupacion}%`,
    ]);
  }

  /**
   * Calcula estadísticas de inscripciones
   * @returns {Object} Objeto con estadísticas de inscripciones
   */
  calcularEstadisticasInscripciones() {
    const totalInscritos = this.eventos.reduce((sum, evento) => {
      const voluntarios = Array.isArray(evento.voluntariosInscritos)
        ? evento.voluntariosInscritos
        : [];
      return sum + voluntarios.length;
    }, 0);

    const capacidadTotal = this.eventos.reduce((sum, evento) => {
      return sum + this.obtenerCapacidadEvento(evento);
    }, 0);

    const ocupacion =
      capacidadTotal > 0
        ? Math.round((totalInscritos / capacidadTotal) * 100)
        : 0;

    return { totalInscritos, capacidadTotal, ocupacion };
  }

  /**
   * Obtiene la capacidad máxima de un evento
   * @param {Object} evento - Objeto evento
   * @returns {number} Capacidad máxima
   */
  obtenerCapacidadEvento(evento) {
    return Number(evento.maxVoluntarios || evento.cantidadVoluntariosMax || 0);
  }

  /**
   * Actualiza el reporte de ubicaciones
   */
  actualizarReporteUbicacion() {
    const estadisticas = this.calcularEstadisticasUbicacion();
    this.actualizarElementoReporte(SELECTORES.REPORTE_UBICACION, [
      estadisticas.totalUbicaciones,
      estadisticas.totalEventos,
      estadisticas.promedio,
    ]);
  }

  /**
   * Calcula estadísticas de ubicaciones
   * @returns {Object} Objeto con estadísticas de ubicaciones
   */
  calcularEstadisticasUbicacion() {
    const ubicacionesUnicas = this.obtenerUbicacionesUnicas();
    const totalUbicaciones = ubicacionesUnicas.length;
    const totalEventos = this.eventos.length;
    const promedio =
      totalEventos > 0 ? (totalEventos / totalUbicaciones).toFixed(1) : "0";

    return { totalUbicaciones, totalEventos, promedio };
  }

  /**
   * Obtiene ubicaciones únicas de eventos
   * @returns {Array} Array de ubicaciones únicas
   */
  obtenerUbicacionesUnicas() {
    return [
      ...new Set(
        this.eventos
          .map((evento) => evento.ubicacion)
          .filter((ubicacion) => ubicacion && ubicacion.trim() !== "")
      ),
    ];
  }

  /**
   * Actualiza el reporte por tipos de evento
   */
  actualizarReporteTipo() {
    const conteoTipos = this.contarEventosPorTipo();
    this.actualizarElementoReporte(SELECTORES.REPORTE_TIPO, [
      conteoTipos[TIPOS_EVENTO.REFORESTACION] || 0,
      conteoTipos[TIPOS_EVENTO.LIMPIEZA] || 0,
      conteoTipos[TIPOS_EVENTO.EDUCACION] || 0,
    ]);
  }

  /**
   * Cuenta eventos por tipo
   * @returns {Object} Objeto con conteo por tipo
   */
  contarEventosPorTipo() {
    return this.eventos.reduce((conteo, evento) => {
      const tipo = evento.tipo || "sin_tipo";
      conteo[tipo] = (conteo[tipo] || 0) + 1;
      return conteo;
    }, {});
  }

  /**
   * Actualiza el reporte de administradores
   */
  actualizarReporteAdministradores() {
    const estadisticas = this.calcularEstadisticasAdministradores();
    this.actualizarElementoReporte(SELECTORES.REPORTE_ADMIN, [
      estadisticas.adminsActivos,
      estadisticas.eventosPorAdmin,
      `${estadisticas.tasaExito}%`,
    ]);
  }

  /**
   * Calcula estadísticas de administradores
   * @returns {Object} Objeto con estadísticas de administradores
   */
  calcularEstadisticasAdministradores() {
    const adminsUnicos = this.obtenerAdministradoresUnicos();
    const adminsActivos = adminsUnicos.length;
    const eventosTotal = this.eventos.length;
    const eventosPorAdmin =
      adminsActivos > 0 ? (eventosTotal / adminsActivos).toFixed(1) : "0";
    const tasaExito = this.calcularTasaExito();

    return { adminsActivos, eventosPorAdmin, tasaExito };
  }

  /**
   * Obtiene administradores únicos
   * @returns {Array} Array de administradores únicos
   */
  obtenerAdministradoresUnicos() {
    return [
      ...new Set(
        this.eventos
          .map((evento) => evento.createdBy)
          .filter((admin) => admin && admin.trim() !== "")
      ),
    ];
  }

  /**
   * Calcula la tasa de éxito de eventos
   * @returns {number} Porcentaje de éxito
   */
  calcularTasaExito() {
    if (this.eventos.length === 0) return 0;

    const exitosos = this.eventos.filter(
      (evento) =>
        evento.estado === ESTADOS_EVENTO.FINALIZADO ||
        evento.estado === ESTADOS_EVENTO.ACTIVO
    ).length;

    return Math.round((exitosos / this.eventos.length) * 100);
  }

  /**
   * Actualiza el reporte temporal
   */
  actualizarReporteTemporal() {
    const estadisticas = this.calcularEstadisticasTemporales();
    this.actualizarElementoReporte(SELECTORES.REPORTE_TEMPORAL, [
      `+${estadisticas.crecimiento}%`,
      estadisticas.diasPromedio,
      `${estadisticas.puntualidad}%`,
    ]);
  }

  /**
   * Calcula estadísticas temporales
   * @returns {Object} Objeto con estadísticas temporales
   */
  calcularEstadisticasTemporales() {
    return {
      crecimiento: this.calcularCrecimiento(),
      diasPromedio: this.calcularDiasPromedio(),
      puntualidad: this.calcularPuntualidad(),
    };
  }

  /**
   * Calcula el crecimiento mensual de eventos
   * @returns {number} Porcentaje de crecimiento
   */
  calcularCrecimiento() {
    if (this.eventos.length === 0) return 23; // Valor por defecto

    const hoy = new Date();
    const mesAnterior = new Date(
      hoy.getFullYear(),
      hoy.getMonth() - 1,
      hoy.getDate()
    );

    const eventosRecientes = this.eventos.filter((evento) => {
      const fechaEvento = this.obtenerFechaCreacion(evento);
      return fechaEvento >= mesAnterior;
    });

    return (
      Math.round((eventosRecientes.length / this.eventos.length) * 100) || 23
    );
  }

  /**
   * Obtiene la fecha de creación de un evento
   * @param {Object} evento - Objeto evento
   * @returns {Date} Fecha de creación
   */
  obtenerFechaCreacion(evento) {
    if (evento.createdAt?.seconds) {
      return new Date(evento.createdAt.seconds * 1000);
    }
    return new Date(evento.fechaInicio || Date.now());
  }

  /**
   * Calcula los días promedio entre creación e inicio
   * @returns {string} Días promedio formateados
   */
  calcularDiasPromedio() {
    let totalDias = 0;
    let contador = 0;

    this.eventos.forEach((evento) => {
      try {
        const fechaCreacion = this.obtenerFechaCreacion(evento);
        const fechaInicio = new Date(evento.fechaInicio);

        if (
          this.esFechaValida(fechaCreacion) &&
          this.esFechaValida(fechaInicio)
        ) {
          const diferencia = Math.abs(fechaInicio - fechaCreacion);
          const dias = Math.ceil(diferencia / (1000 * 60 * 60 * 24));
          totalDias += dias;
          contador++;
        }
      } catch (error) {
        console.warn(`Error calculando días para evento: ${evento.id}`, error);
      }
    });

    return contador > 0 ? (totalDias / contador).toFixed(1) : "2.5";
  }

  /**
   * Verifica si una fecha es válida
   * @param {Date} fecha - Fecha a verificar
   * @returns {boolean} True si es válida
   */
  esFechaValida(fecha) {
    return fecha instanceof Date && !isNaN(fecha.getTime());
  }

  /**
   * Calcula la puntualidad (simulado)
   * @returns {number} Porcentaje de puntualidad
   */
  calcularPuntualidad() {
    return 85; // Valor simulado
  }

  /**
   * Actualiza la tabla de eventos
   */
  actualizarTablaEventos() {
    const tbody = document.getElementById("eventosTable");
    if (!tbody) return;

    tbody.innerHTML = "";

    this.eventos.forEach((evento, index) => {
      const fila = this.crearFilaEvento(evento, index);
      tbody.appendChild(fila);
    });
  }

  /**
   * Crea una fila para la tabla de eventos
   * @param {Object} evento - Objeto evento
   * @param {number} index - Índice del evento
   * @returns {HTMLElement} Elemento tr
   */
  crearFilaEvento(evento, index) {
    const fila = document.createElement("tr");
    const datosEvento = this.obtenerDatosEvento(evento, index);

    fila.innerHTML = `
      <td>${datosEvento.numero}</td>
      <td>${datosEvento.titulo}</td>
      <td>${datosEvento.ubicacion}</td>
      <td>${datosEvento.fechaInicio}</td>
      <td>${datosEvento.capacidad}</td>
      <td>${datosEvento.inscritos}</td>
      <td>${datosEvento.estadoBadge}</td>
      <td>${datosEvento.tipoTexto}</td>
      <td>${datosEvento.adminInfo}</td>
    `;

    return fila;
  }

  /**
   * Obtiene los datos formateados de un evento
   * @param {Object} evento - Objeto evento
   * @param {number} index - Índice del evento
   * @returns {Object} Datos formateados
   */
  obtenerDatosEvento(evento, index) {
    const voluntarios = Array.isArray(evento.voluntariosInscritos)
      ? evento.voluntariosInscritos
      : [];

    return {
      numero: String(index + 1).padStart(3, "0"),
      titulo: evento.titulo || "Sin título",
      ubicacion: evento.ubicacion || "Sin ubicación",
      fechaInicio: this.formatearFecha(evento.fechaInicio),
      capacidad: this.obtenerCapacidadEvento(evento),
      inscritos: voluntarios.length,
      estadoBadge: this.generarBadgeEstado(evento.estado),
      tipoTexto: this.obtenerTextoTipo(evento.tipo),
      adminInfo: this.obtenerInfoAdmin(evento.createdBy),
    };
  }

  /**
   * Formatea una fecha para mostrar
   * @param {string} fecha - Fecha en string
   * @returns {string} Fecha formateada
   */
  formatearFecha(fecha) {
    if (!fecha) return "Sin fecha";
    try {
      return new Date(fecha).toLocaleDateString("es-ES");
    } catch {
      return fecha;
    }
  }

  /**
   * Genera un badge HTML para el estado
   * @param {string} estado - Estado del evento
   * @returns {string} HTML del badge
   */
  generarBadgeEstado(estado) {
    const badges = {
      [ESTADOS_EVENTO.ACTIVO]: '<span class="badge bg-primary">Activo</span>',
      [ESTADOS_EVENTO.FINALIZADO]:
        '<span class="badge bg-success">Finalizado</span>',
      [ESTADOS_EVENTO.CANCELADO]:
        '<span class="badge bg-danger">Cancelado</span>',
      [ESTADOS_EVENTO.EN_PROGRESO]:
        '<span class="badge bg-warning">En progreso</span>',
    };

    return (
      badges[estado] || '<span class="badge bg-secondary">Sin estado</span>'
    );
  }

  /**
   * Obtiene el texto legible del tipo de evento
   * @param {string} tipo - Tipo de evento
   * @returns {string} Texto del tipo
   */
  obtenerTextoTipo(tipo) {
    const tipos = {
      [TIPOS_EVENTO.REFORESTACION]: "Reforestación",
      [TIPOS_EVENTO.LIMPIEZA]: "Limpieza",
      [TIPOS_EVENTO.EDUCACION]: "Educación",
      [TIPOS_EVENTO.CONSERVACION]: "Conservación",
    };

    return tipos[tipo] || "Otro";
  }

  /**
   * Obtiene información del administrador
   * @param {string} adminEmail - Email del administrador
   * @returns {string} Nombre o email del admin
   */
  obtenerInfoAdmin(adminEmail) {
    if (!adminEmail) return "Admin";

    const admin = this.usuarios.find(
      (usuario) => usuario.correo === adminEmail
    );
    return admin?.nombreUsuario || adminEmail;
  }

  /**
   * Inicializa los gráficos
   */
  inicializarGraficos() {
    this.crearGraficoTipos();
    this.crearGraficoEstados();
  }

  /**
   * Crea el gráfico de tipos de eventos
   */
  crearGraficoTipos() {
    const ctx = document.getElementById(SELECTORES.GRAFICO_TIPOS.slice(1));
    if (!ctx) return;

    const conteoTipos = this.contarEventosPorTipo();
    const configuracion = this.obtenerConfiguracionGraficoTipos(conteoTipos);

    new Chart(ctx, configuracion);
  }

  /**
   * Obtiene la configuración del gráfico de tipos
   * @param {Object} conteoTipos - Conteo por tipo
   * @returns {Object} Configuración del gráfico
   */
  obtenerConfiguracionGraficoTipos(conteoTipos) {
    return {
      type: "pie",
      data: {
        labels: ["Reforestación", "Limpieza", "Educación", "Conservación"],
        datasets: [
          {
            data: [
              conteoTipos[TIPOS_EVENTO.REFORESTACION] || 0,
              conteoTipos[TIPOS_EVENTO.LIMPIEZA] || 0,
              conteoTipos[TIPOS_EVENTO.EDUCACION] || 0,
              conteoTipos[TIPOS_EVENTO.CONSERVACION] || 0,
            ],
            backgroundColor: [
              COLORES_GRAFICOS.REFORESTACION,
              COLORES_GRAFICOS.LIMPIEZA,
              COLORES_GRAFICOS.EDUCACION,
              COLORES_GRAFICOS.CONSERVACION,
            ],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
          },
        },
      },
    };
  }

  /**
   * Crea el gráfico de estados de eventos
   */
  crearGraficoEstados() {
    const ctx = document.getElementById(SELECTORES.GRAFICO_ESTADOS.slice(1));
    if (!ctx) return;

    const conteoEstados = this.contarEventosPorEstado();
    const configuracion =
      this.obtenerConfiguracionGraficoEstados(conteoEstados);

    new Chart(ctx, configuracion);
  }

  /**
   * Cuenta eventos por todos los estados
   * @returns {Object} Conteo por estado
   */
  contarEventosPorEstado() {
    const conteo = {};
    Object.values(ESTADOS_EVENTO).forEach((estado) => {
      conteo[estado] = 0;
    });

    this.eventos.forEach((evento) => {
      const estado = evento.estado || ESTADOS_EVENTO.ACTIVO;
      if (conteo.hasOwnProperty(estado)) {
        conteo[estado]++;
      }
    });

    return conteo;
  }

  /**
   * Obtiene la configuración del gráfico de estados
   * @param {Object} conteoEstados - Conteo por estado
   * @returns {Object} Configuración del gráfico
   */
  obtenerConfiguracionGraficoEstados(conteoEstados) {
    return {
      type: "bar",
      data: {
        labels: ["Activo", "Finalizado", "Cancelado", "En Progreso"],
        datasets: [
          {
            label: "Cantidad de Eventos",
            data: [
              conteoEstados[ESTADOS_EVENTO.ACTIVO],
              conteoEstados[ESTADOS_EVENTO.FINALIZADO],
              conteoEstados[ESTADOS_EVENTO.CANCELADO],
              conteoEstados[ESTADOS_EVENTO.EN_PROGRESO],
            ],
            backgroundColor: [
              COLORES_GRAFICOS.ACTIVO,
              COLORES_GRAFICOS.FINALIZADO,
              COLORES_GRAFICOS.CANCELADO,
              COLORES_GRAFICOS.EN_PROGRESO,
            ],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1,
            },
          },
        },
        plugins: {
          legend: {
            position: "top",
          },
        },
      },
    };
  }

  /**
   * Configura todos los event listeners
   */
  configurarEventListeners() {
    this.configurarBotonFiltros();
    this.configurarBotonesDescarga();
    this.configurarToggleSidebar();
  }

  /**
   * Configura el botón de filtros
   */
  configurarBotonFiltros() {
    const btnFiltro = document.querySelector(SELECTORES.BTN_FILTRO);
    if (btnFiltro) {
      btnFiltro.addEventListener("click", () => this.aplicarFiltros());
    }
  }

  /**
   * Configura los botones de descarga
   */
  configurarBotonesDescarga() {
    document.querySelectorAll(SELECTORES.BTN_DESCARGA).forEach((btn, index) => {
      btn.addEventListener("click", (evento) =>
        this.manejarDescarga(evento, index)
      );
    });
  }

  /**
   * Configura el toggle del sidebar
   */
  configurarToggleSidebar() {
    const sidebarToggle = document.getElementById(
      SELECTORES.SIDEBAR_TOGGLE.slice(1)
    );
    if (sidebarToggle) {
      sidebarToggle.addEventListener("click", this.toggleSidebar.bind(this));
    }
  }

  /**
   * Aplica filtros a los eventos
   */
  async aplicarFiltros() {
    const filtros = this.obtenerValoresFiltros();
    const eventosFiltrados = this.filtrarEventos(filtros);

    this.eventos = eventosFiltrados;
    this.generarReportes();

    this.mostrarMensaje(
      `${MENSAJES.FILTROS_APLICADOS} ${eventosFiltrados.length} ${MENSAJES.EVENTOS_FILTRADOS}`
    );

    // Restaurar datos originales después de 5 segundos
    setTimeout(() => {
      this.eventos = [...this.eventosOriginales];
      this.generarReportes();
    }, 5000);
  }

  /**
   * Obtiene los valores de los filtros
   * @returns {Object} Objeto con valores de filtros
   */
  obtenerValoresFiltros() {
    return {
      fechaInicio: document.getElementById("fechaInicio")?.value,
      fechaFin: document.getElementById("fechaFin")?.value,
      tipoEvento: document.getElementById("tipoEvento")?.value,
      estadoEvento: document.getElementById("estadoEvento")?.value,
    };
  }

  /**
   * Filtra eventos según los criterios especificados
   * @param {Object} filtros - Objeto con criterios de filtro
   * @returns {Array} Array de eventos filtrados
   */
  filtrarEventos(filtros) {
    return this.eventosOriginales.filter((evento) => {
      return (
        this.cumpleFiltroFecha(evento, filtros.fechaInicio, filtros.fechaFin) &&
        this.cumpleFiltroTipo(evento, filtros.tipoEvento) &&
        this.cumpleFiltroEstado(evento, filtros.estadoEvento)
      );
    });
  }

  /**
   * Verifica si un evento cumple el filtro de fecha
   * @param {Object} evento - Evento a verificar
   * @param {string} fechaInicio - Fecha inicio del filtro
   * @param {string} fechaFin - Fecha fin del filtro
   * @returns {boolean} True si cumple el filtro
   */
  cumpleFiltroFecha(evento, fechaInicio, fechaFin) {
    const fechaEvento = new Date(evento.fechaInicio);

    if (fechaInicio && fechaEvento < new Date(fechaInicio)) {
      return false;
    }

    if (fechaFin && fechaEvento > new Date(fechaFin)) {
      return false;
    }

    return true;
  }

  /**
   * Verifica si un evento cumple el filtro de tipo
   * @param {Object} evento - Evento a verificar
   * @param {string} tipoFiltro - Tipo a filtrar
   * @returns {boolean} True si cumple el filtro
   */
  cumpleFiltroTipo(evento, tipoFiltro) {
    return !tipoFiltro || evento.tipo === tipoFiltro;
  }

  /**
   * Verifica si un evento cumple el filtro de estado
   * @param {Object} evento - Evento a verificar
   * @param {string} estadoFiltro - Estado a filtrar
   * @returns {boolean} True si cumple el filtro
   */
  cumpleFiltroEstado(evento, estadoFiltro) {
    return !estadoFiltro || evento.estado === estadoFiltro;
  }

  /**
   * Maneja la descarga de reportes
   * @param {Event} evento - Evento del click
   * @param {number} tipoReporte - Índice del tipo de reporte
   */
  manejarDescarga(evento, tipoReporte) {
    evento.preventDefault();

    const btn = evento.target.closest(SELECTORES.BTN_DESCARGA);
    const textoOriginal = btn.innerHTML;

    this.mostrarEstadoBotonDescarga(btn, MENSAJES.GENERANDO);

    // Simular generación de reporte
    setTimeout(() => {
      this.mostrarEstadoBotonDescarga(btn, MENSAJES.GENERADO);
      this.simularDescarga(tipoReporte);

      setTimeout(() => {
        this.restaurarBotonDescarga(btn, textoOriginal);
      }, 2000);
    }, 2000);
  }

  /**
   * Muestra el estado del botón de descarga
   * @param {HTMLElement} btn - Botón a modificar
   * @param {string} mensaje - Mensaje a mostrar
   */
  mostrarEstadoBotonDescarga(btn, mensaje) {
    btn.innerHTML = mensaje;
    btn.style.pointerEvents = "none";
  }

  /**
   * Restaura el botón de descarga a su estado original
   * @param {HTMLElement} btn - Botón a restaurar
   * @param {string} textoOriginal - Texto original del botón
   */
  restaurarBotonDescarga(btn, textoOriginal) {
    btn.innerHTML = textoOriginal;
    btn.style.pointerEvents = "auto";
  }

  /**
   * Simula la descarga de un reporte
   * @param {number} tipoReporte - Índice del tipo de reporte
   */
  simularDescarga(tipoReporte) {
    const tiposReporte = [
      "reporte_general_eventos.pdf",
      "inscripciones_por_evento.pdf",
      "eventos_por_ubicacion.pdf",
      "eventos_por_tipo.pdf",
      "eventos_por_administrador.pdf",
      "analisis_temporal.pdf",
      "detalle_eventos.xlsx",
    ];

    const nombreArchivo = tiposReporte[tipoReporte] || "reporte_eventos.pdf";
    console.log(`Descargando: ${nombreArchivo}`);
    this.mostrarMensaje(
      `${MENSAJES.REPORTE_GENERADO.replace(
        "generado",
        nombreArchivo + " generado"
      )}`
    );
  }

  /**
   * Alterna la visibilidad del sidebar
   */
  toggleSidebar() {
    const sidebar = document.getElementById(SELECTORES.SIDEBAR.slice(1));
    if (!sidebar) return;

    const estaVisible = sidebar.style.transform === "translateX(0px)";
    sidebar.style.transform = estaVisible
      ? "translateX(-100%)"
      : "translateX(0px)";
  }

  /**
   * Actualiza un elemento de reporte con estadísticas
   * @param {string} selector - Selector CSS del elemento
   * @param {Array} valores - Array de valores a mostrar
   */
  actualizarElementoReporte(selector, valores) {
    const elemento = document.querySelector(selector);
    if (!elemento) return;

    const stats = elemento.querySelectorAll(".stat-number");
    valores.forEach((valor, index) => {
      if (stats[index]) {
        stats[index].textContent = valor;
      }
    });
  }

  /**
   * Muestra un mensaje temporal al usuario
   * @param {string} mensaje - Mensaje a mostrar
   */
  mostrarMensaje(mensaje) {
    const alert = this.crearElementoAlerta(mensaje);
    document.body.appendChild(alert);
    this.programarRemoverAlerta(alert);
  }

  /**
   * Crea un elemento de alerta
   * @param {string} mensaje - Mensaje de la alerta
   * @returns {HTMLElement} Elemento de alerta
   */
  crearElementoAlerta(mensaje) {
    const alert = document.createElement("div");
    alert.className =
      "alert alert-info alert-dismissible fade show position-fixed";
    alert.style.cssText =
      "top: 20px; right: 20px; z-index: 1050; max-width: 300px;";
    alert.innerHTML = `
      ${mensaje}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    return alert;
  }

  /**
   * Programa la remoción automática de una alerta
   * @param {HTMLElement} alert - Elemento de alerta
   */
  programarRemoverAlerta(alert) {
    setTimeout(() => {
      if (alert.parentNode) {
        alert.parentNode.removeChild(alert);
      }
    }, 5000);
  }

  /**
   * Maneja errores de manera consistente
   * @param {string} mensaje - Mensaje de error
   * @param {Error} error - Objeto error
   */
  manejarError(mensaje, error) {
    console.error(mensaje, error);
    this.mostrarMensaje(`Error: ${mensaje}`);
  }

  /**
   * Actualiza los datos y regenera reportes
   */
  async actualizarDatos() {
    try {
      await this.cargarDatos();
      this.generarReportes();
      this.mostrarMensaje("Datos actualizados exitosamente");
    } catch (error) {
      this.manejarError("Error actualizando datos", error);
    }
  }

  /**
   * Exporta los datos actuales para uso externo
   * @returns {Object} Objeto con datos exportables
   */
  exportarDatos() {
    return {
      eventos: this.eventos,
      usuarios: this.usuarios,
      estadisticas: this.obtenerEstadisticasCompletas(),
    };
  }

  /**
   * Obtiene estadísticas completas del sistema
   * @returns {Object} Objeto con todas las estadísticas
   */
  obtenerEstadisticasCompletas() {
    return {
      general: this.calcularEstadisticasGenerales(),
      inscripciones: this.calcularEstadisticasInscripciones(),
      ubicaciones: this.calcularEstadisticasUbicacion(),
      tipos: this.contarEventosPorTipo(),
      estados: this.contarEventosPorEstado(),
      administradores: this.calcularEstadisticasAdministradores(),
      temporales: this.calcularEstadisticasTemporales(),
    };
  }

  /**
   * Limpia recursos y event listeners
   */
  destruir() {
    // Remover event listeners
    document.querySelectorAll(SELECTORES.BTN_DESCARGA).forEach((btn) => {
      btn.removeEventListener("click", this.manejarDescarga);
    });

    const btnFiltro = document.querySelector(SELECTORES.BTN_FILTRO);
    if (btnFiltro) {
      btnFiltro.removeEventListener("click", this.aplicarFiltros);
    }

    const sidebarToggle = document.getElementById(
      SELECTORES.SIDEBAR_TOGGLE.slice(1)
    );
    if (sidebarToggle) {
      sidebarToggle.removeEventListener("click", this.toggleSidebar);
    }

    // Limpiar datos
    this.eventos = [];
    this.usuarios = [];
    this.eventosOriginales = [];
  }
}

/**
 * Inicializa la aplicación cuando se carga el DOM
 */
document.addEventListener("DOMContentLoaded", () => {
  // Crear instancia global para acceso desde consola (debugging)
  window.reportesEventos = new ReportesEventos();
});

// Exportar para uso en módulos ES6
export default ReportesEventos;
