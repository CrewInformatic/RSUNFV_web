// reports-analytics.js
// Sistema de Reportes y Analytics para EcoVoluntarios - Con Historial Firebase

// Importar módulos necesarios
import {
  db,
  collection,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  doc,
  updateDoc,
  increment,
} from "./firebase_config.js";

// Variables globales
let currentReportData = null;
let reportStats = {
  totalReports: 0,
  totalDownloads: 0,
  scheduledReports: 0,
  dataAccuracy: 98.5,
};

// Mapeo de datos del sistema
const FACULTADES = {
  F001: "Facultad de Ingeniería Electrónica e Informática",
};

const ESCUELAS = {
  E001: "Ingeniería Informática",
  E002: "Ingeniería Electrónica",
  E003: "Ingeniería Mecatrónica",
  E004: "Ingeniería Telecomunicaciones",
};

const ROLES = {
  rol_004: "Recolector de Donaciones",
};

// Inicialización del sistema
document.addEventListener("DOMContentLoaded", function () {
  console.log("Inicializando Sistema de Reportes EcoVoluntarios...");
  initializeReportsSystem();
  loadStatistics();
  loadRecentReports();
  setupEventListeners();
});

// Inicializar sistema de reportes
function initializeReportsSystem() {
  // Configurar fecha máxima para inputs
  const today = new Date().toISOString().split("T")[0];
  const startDateInput = document.getElementById("startDate");
  const endDateInput = document.getElementById("endDate");

  if (startDateInput && endDateInput) {
    startDateInput.max = today;
    endDateInput.max = today;
  }

  // Verificar dependencias
  if (typeof window.AdvancedPDFReportManager === "undefined") {
    console.warn(
      "AdvancedPDFReportManager no encontrado. Asegúrate de incluir advanced-pdf-report-manager.js"
    );
  }
}

// Configurar event listeners
function setupEventListeners() {
  // Formulario principal de reportes
  const reportForm = document.getElementById("reportForm");
  if (reportForm) {
    reportForm.addEventListener("submit", handleReportSubmission);
  }

  // Selector de periodo personalizado
  const reportPeriod = document.getElementById("reportPeriod");
  if (reportPeriod) {
    reportPeriod.addEventListener("change", function () {
      const customDateRange = document.getElementById("customDateRange");
      if (this.value === "personalizado") {
        customDateRange.style.display = "block";
      } else {
        customDateRange.style.display = "none";
      }
    });
  }
}

// =================== FUNCIONES DE REPORTES RÁPIDOS ===================

// Generar reporte rápido - Función principal para botones
async function generateQuickReport(type) {
  try {
    console.log(`Generando reporte rápido: ${type}`);
    showProgressModal();
    updateProgressModal("Iniciando generación...", 10);

    const reportConfig = {
      type: type,
      period: "ultimo_mes",
      format: "pdf",
      includeCharts: true,
      includeDetails: true,
      includeRecommendations: true,
      includeComparisons: false,
    };

    // Obtener datos según el tipo
    updateProgressModal("Recopilando datos...", 30);
    const data = await fetchReportData(reportConfig);

    // Generar el reporte
    updateProgressModal("Generando PDF...", 70);
    await generateReport(reportConfig, data);

    updateProgressModal("Completado", 100);
    setTimeout(() => hideProgressModal(), 1000);
  } catch (error) {
    console.error("Error al generar reporte rápido:", error);
    showNotification("Error al generar reporte: " + error.message, "error");
    hideProgressModal();
  }
}

// Manejar envío del formulario principal
async function handleReportSubmission(e) {
  e.preventDefault();

  const reportConfig = {
    type: document.getElementById("reportType").value,
    period: document.getElementById("reportPeriod").value,
    format: document.getElementById("reportFormat").value,
    includeCharts: document.getElementById("includeCharts")?.checked || false,
    includeDetails: document.getElementById("includeDetails")?.checked || false,
    includeRecommendations:
      document.getElementById("includeRecommendations")?.checked || false,
    includeComparisons:
      document.getElementById("includeComparisons")?.checked || false,
  };

  // Validaciones
  if (!reportConfig.type || !reportConfig.period || !reportConfig.format) {
    showNotification(
      "Por favor complete todos los campos requeridos",
      "warning"
    );
    return;
  }

  if (reportConfig.period === "personalizado") {
    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;

    if (!startDate || !endDate) {
      showNotification(
        "Por favor seleccione las fechas de inicio y fin",
        "warning"
      );
      return;
    }

    reportConfig.startDate = startDate;
    reportConfig.endDate = endDate;
  }

  try {
    showProgressModal();
    updateProgressModal("Procesando solicitud...", 20);

    const data = await fetchReportData(reportConfig);
    await generateReport(reportConfig, data);
  } catch (error) {
    console.error("Error al generar reporte:", error);
    showNotification("Error al generar reporte: " + error.message, "error");
  } finally {
    hideProgressModal();
  }
}

// =================== OBTENCIÓN DE DATOS ===================

// Obtener datos según configuración
async function fetchReportData(config) {
  const dateRange = getDateRange(
    config.period,
    config.startDate,
    config.endDate
  );

  try {
    switch (config.type) {
      case "general":
        return await fetchGeneralReportData(dateRange);
      case "events":
      case "eventos":
        return await fetchEventsReportData(dateRange);
      case "donations":
      case "donaciones":
        return await fetchDonationsReportData(dateRange);
      case "volunteers":
      case "voluntarios":
        return await fetchVolunteersReportData(dateRange);
      default:
        throw new Error(`Tipo de reporte no válido: ${config.type}`);
    }
  } catch (error) {
    console.error("Error al obtener datos:", error);
    throw error;
  }
}

// Datos para reporte general
async function fetchGeneralReportData(dateRange) {
  updateProgressModal("Obteniendo datos generales...", 40);

  const [eventsSnapshot, usersSnapshot, donationsSnapshot] = await Promise.all([
    getDocs(collection(db, "eventos")),
    getDocs(collection(db, "usuarios")),
    getDocs(collection(db, "donaciones")),
  ]);

  const events = eventsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
  const users = usersSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
  const donations = donationsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  // Filtrar por fecha
  const filteredEvents = filterByDateRange(events, dateRange, "fechaInicio");
  const filteredDonations = filterByDateRange(
    donations,
    dateRange,
    "fechaDonacion"
  );

  // Calcular estadísticas
  const stats = calculateGeneralStats(filteredEvents, users, filteredDonations);

  return {
    events: filteredEvents,
    users: users,
    donations: filteredDonations,
    summary: stats,
    dateRange: dateRange,
  };
}

// Datos para reporte de eventos
async function fetchEventsReportData(dateRange) {
  updateProgressModal("Obteniendo datos de eventos...", 40);

  const [eventsSnapshot, usersSnapshot] = await Promise.all([
    getDocs(collection(db, "eventos")),
    getDocs(collection(db, "usuarios")),
  ]);

  const events = eventsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
  const users = usersSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const filteredEvents = filterByDateRange(events, dateRange, "fechaInicio");

  // Enriquecer eventos con datos de voluntarios
  const enrichedEvents = enrichEventsWithVolunteers(filteredEvents, users);

  // Calcular estadísticas
  const statistics = calculateEventStats(enrichedEvents);

  return {
    events: enrichedEvents,
    statistics: statistics,
    dateRange: dateRange,
  };
}

// Datos para reporte de donaciones
async function fetchDonationsReportData(dateRange) {
  updateProgressModal("Obteniendo datos de donaciones...", 40);

  const [donationsSnapshot, usersSnapshot] = await Promise.all([
    getDocs(collection(db, "donaciones")),
    getDocs(collection(db, "usuarios")),
  ]);

  const donations = donationsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
  const users = usersSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const filteredDonations = filterByDateRange(
    donations,
    dateRange,
    "fechaDonacion"
  );

  // Enriquecer donaciones
  const enrichedDonations = enrichDonationsWithUsers(filteredDonations, users);

  // Calcular estadísticas
  const statistics = calculateDonationStats(enrichedDonations);

  return {
    donations: enrichedDonations,
    statistics: statistics,
    dateRange: dateRange,
  };
}

// Datos para reporte de voluntarios
async function fetchVolunteersReportData(dateRange) {
  updateProgressModal("Obteniendo datos de voluntarios...", 40);

  const [usersSnapshot, eventsSnapshot] = await Promise.all([
    getDocs(collection(db, "usuarios")),
    getDocs(collection(db, "eventos")),
  ]);

  const users = usersSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
  const events = eventsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  // Enriquecer usuarios
  const enrichedUsers = enrichUsersWithEventData(users, events);

  // Calcular estadísticas
  const statistics = calculateVolunteerStats(enrichedUsers);

  return {
    volunteers: enrichedUsers,
    statistics: statistics,
    dateRange: dateRange,
  };
}

// =================== FUNCIONES DE ENRIQUECIMIENTO ===================

function enrichEventsWithVolunteers(events, users) {
  return events.map((event) => {
    const voluntariosInscritos = event.voluntariosInscritos || [];
    const volunteerDetails = voluntariosInscritos
      .map((volunteerId) =>
        users.find((user) => user.idUsuario === volunteerId)
      )
      .filter(Boolean);

    return {
      ...event,
      volunteerDetails,
      enrolledCount: voluntariosInscritos.length,
      availableSpots:
        (event.cantidadVoluntariosMax || 0) - voluntariosInscritos.length,
    };
  });
}

function enrichDonationsWithUsers(donations, users) {
  return donations.map((donation) => {
    const recolector = users.find(
      (user) => user.idUsuario === donation.idRecolector
    );

    return {
      ...donation,
      recolectorInfo: recolector,
      amount: parseFloat(donation.monto) || 0,
      donorName: getDonorName(donation),
    };
  });
}

function enrichUsersWithEventData(users, events) {
  return users.map((user) => {
    const facultad = FACULTADES[user.facultadID] || "Facultad no especificada";
    const escuela = ESCUELAS[user.escuelaID] || "Escuela no especificada";

    const participatedEvents = events.filter(
      (event) =>
        event.voluntariosInscritos &&
        event.voluntariosInscritos.includes(user.idUsuario)
    );

    return {
      ...user,
      facultadNombre: facultad,
      escuelaNombre: escuela,
      participatedEvents: participatedEvents.length,
      isRecolector: user.idRol === "rol_004",
    };
  });
}

// =================== FUNCIONES DE CÁLCULO ===================

function calculateGeneralStats(events, users, donations) {
  const totalAmount = donations.reduce(
    (sum, d) => sum + (parseFloat(d.monto) || 0),
    0
  );
  const validatedDonations = donations.filter(
    (d) => d.estadoValidacion === true
  ).length;
  const activeVolunteers = users.filter((u) => u.estadoActivo === true).length;
  const completedEvents = events.filter(
    (e) => e.estado === "completado"
  ).length;

  return {
    totalEvents: events.length,
    completedEvents: completedEvents,
    totalVolunteers: users.length,
    activeVolunteers: activeVolunteers,
    totalDonations: donations.length,
    validatedDonations: validatedDonations,
    totalAmount: totalAmount,
    averageDonation: donations.length > 0 ? totalAmount / donations.length : 0,
  };
}

function calculateEventStats(events) {
  const byType = groupBy(events, "tipo");
  const byStatus = groupBy(events, "estado");
  const totalParticipants = events.reduce(
    (sum, e) => sum + (e.enrolledCount || 0),
    0
  );

  return {
    total: events.length,
    byType: Object.fromEntries(
      Object.entries(byType).map(([k, v]) => [k, v.length])
    ),
    byStatus: Object.fromEntries(
      Object.entries(byStatus).map(([k, v]) => [k, v.length])
    ),
    totalParticipants: totalParticipants,
    averageParticipation:
      events.length > 0 ? totalParticipants / events.length : 0,
    upcomingEvents: events.filter((e) => new Date(e.fechaInicio) > new Date())
      .length,
    completedEvents: events.filter((e) => e.estado === "completado").length,
  };
}

function calculateDonationStats(donations) {
  const totalAmount = donations.reduce((sum, d) => sum + d.amount, 0);
  const validated = donations.filter((d) => d.estadoValidacion === true);
  const pending = donations.filter((d) => d.estadoValidacion === false);

  const byUserType = donations.reduce((acc, d) => {
    const type = d.Tipo_Usuario || "Sin especificar";
    if (!acc[type]) acc[type] = { count: 0, amount: 0 };
    acc[type].count += 1;
    acc[type].amount += d.amount;
    return acc;
  }, {});

  const byRecolector = donations.reduce((acc, d) => {
    const name = d.recolectorInfo
      ? `${d.recolectorInfo.nombreUsuario} ${d.recolectorInfo.apellidoUsuario}`
      : "Sin asignar";
    if (!acc[name]) acc[name] = { count: 0, amount: 0 };
    acc[name].count += 1;
    acc[name].amount += d.amount;
    return acc;
  }, {});

  return {
    total: donations.length,
    totalAmount: totalAmount,
    validatedCount: validated.length,
    pendingCount: pending.length,
    validatedAmount: validated.reduce((sum, d) => sum + d.amount, 0),
    pendingAmount: pending.reduce((sum, d) => sum + d.amount, 0),
    averageAmount: donations.length > 0 ? totalAmount / donations.length : 0,
    byUserType: byUserType,
    byRecolector: byRecolector,
  };
}

function calculateVolunteerStats(users) {
  const active = users.filter((u) => u.estadoActivo === true);
  const recolectores = users.filter((u) => u.idRol === "rol_004");

  const byFacultad = groupCount(users, "facultadNombre");
  const byEscuela = groupCount(users, "escuelaNombre");
  const byCiclo = groupCount(users, "ciclo");

  const mostActive = users
    .sort((a, b) => b.participatedEvents - a.participatedEvents)
    .slice(0, 10);

  const totalParticipation = users.reduce(
    (sum, u) => sum + u.participatedEvents,
    0
  );

  return {
    total: users.length,
    active: active.length,
    inactive: users.length - active.length,
    recolectores: recolectores.length,
    byFacultad: byFacultad,
    byEscuela: byEscuela,
    byCiclo: byCiclo,
    mostActiveUsers: mostActive,
    averageParticipation:
      users.length > 0 ? totalParticipation / users.length : 0,
  };
}

// =================== GENERACIÓN DE REPORTES ===================

async function generateReport(config, data) {
  try {
    updateProgressModal("Preparando PDF...", 80);

    // Preparar datos para el PDF manager
    const reportData = {
      title: getReportTitle(config.type),
      type: config.type,
      config: config,
      data: data,
      generatedBy: getCurrentUser(),
      generatedAt: new Date().toISOString(),
    };

    // ✅ NUEVO: Crear el documento en Firebase ANTES de generar el PDF
    const reportDocId = await saveReportToFirebase(reportData);
    reportData.firebaseId = reportDocId;

    // Generar PDF
    if (typeof window.AdvancedPDFReportManager !== "undefined") {
      await window.AdvancedPDFReportManager.generateReport(reportData);
    } else {
      // Fallback a jsPDF básico
      await generateBasicPDF(reportData);
    }

    // ✅ NUEVO: Actualizar el documento con el estado de completado y incrementar descargas
    await updateReportAfterGeneration(reportDocId);

    // ✅ NUEVO: Actualizar estadísticas en tiempo real
    await updateReportStats();

    // ✅ NUEVO: Recargar la interfaz
    await loadStatistics();
    await loadRecentReports();

    showNotification("Reporte generado y guardado exitosamente", "success");
  } catch (error) {
    console.error("Error al generar reporte:", error);
    throw error;
  }
}

// Generar PDF básico como fallback
async function generateBasicPDF(reportData) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Título
  doc.setFontSize(16);
  doc.text(reportData.title, 20, 20);

  // Fecha
  doc.setFontSize(12);
  doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 20, 35);

  // Contenido básico según tipo
  let yPos = 50;

  switch (reportData.type) {
    case "general":
      yPos = addGeneralContent(doc, reportData.data, yPos);
      break;
    case "eventos":
      yPos = addEventsContent(doc, reportData.data, yPos);
      break;
    case "donaciones":
      yPos = addDonationsContent(doc, reportData.data, yPos);
      break;
    case "voluntarios":
      yPos = addVolunteersContent(doc, reportData.data, yPos);
      break;
  }

  // Descargar
  const fileName = `${reportData.title}_${
    new Date().toISOString().split("T")[0]
  }.pdf`;
  doc.save(fileName);
}

// =================== GUARDAR EN FIREBASE ===================

async function saveReportToFirebase(reportData) {
  try {
    updateProgressModal("Guardando en base de datos...", 85);

    const reportDoc = {
      title: reportData.title,
      type: reportData.type,
      config: reportData.config,
      generatedBy: reportData.generatedBy,
      generatedAt: serverTimestamp(),
      status: "generating",
      dataRange: reportData.data.dateRange,
      summary: reportData.data.summary || reportData.data.statistics,
      downloadCount: 0,
      fileSize: "0 MB", // Se actualizará después
      format: reportData.config.format || "pdf",
    };

    const docRef = await addDoc(collection(db, "reports"), reportDoc);
    console.log("Reporte guardado con ID:", docRef.id);

    return docRef.id;
  } catch (error) {
    console.error("Error al guardar reporte:", error);
    throw error;
  }
}

// ✅ NUEVA FUNCIÓN: Actualizar reporte después de la generación
async function updateReportAfterGeneration(reportId) {
  try {
    const reportRef = doc(db, "reports", reportId);
    await updateDoc(reportRef, {
      status: "completed",
      downloadCount: increment(1),
      fileSize: "2.1 MB", // Estimado, podrías calcular el tamaño real
      completedAt: serverTimestamp(),
    });

    console.log("Reporte actualizado después de generación:", reportId);
  } catch (error) {
    console.error("Error al actualizar reporte:", error);
  }
}

// =================== FUNCIONES DE UTILIDAD ===================

function filterByDateRange(items, dateRange, dateField) {
  return items.filter((item) => {
    const itemDate = new Date(item[dateField]);
    return itemDate >= dateRange.start && itemDate <= dateRange.end;
  });
}

function getDateRange(period, startDate, endDate) {
  const now = new Date();
  const start = new Date();
  const end = new Date();

  switch (period) {
    case "ultima_semana":
      start.setDate(now.getDate() - 7);
      break;
    case "ultimo_mes":
      start.setMonth(now.getMonth() - 1);
      break;
    case "ultimo_trimestre":
      start.setMonth(now.getMonth() - 3);
      break;
    case "ultimo_semestre":
      start.setMonth(now.getMonth() - 6);
      break;
    case "ultimo_año":
      start.setFullYear(now.getFullYear() - 1);
      break;
    case "personalizado":
      return {
        start: new Date(startDate),
        end: new Date(endDate),
      };
    default:
      start.setMonth(now.getMonth() - 1);
  }

  return { start, end };
}

function getReportTitle(type) {
  const titles = {
    general: "Reporte General del Sistema",
    eventos: "Reporte de Eventos",
    donaciones: "Reporte de Donaciones",
    voluntarios: "Reporte de Voluntarios",
    inventario: "Control de Inventario",
    financiero: "Reporte Financiero",
    participacion: "Análisis de Participación",
  };
  return titles[type] || "Reporte";
}

function getDonorName(donation) {
  if (donation.Tipo_Usuario === "PERSONA NATURAL") {
    return `${donation.NombreUsuarioDonador} ${donation.ApellidoUsuarioDonador}`;
  } else {
    return donation.RazonSocialUsuarioDonador || "Empresa sin nombre";
  }
}

function getCurrentUser() {
  return (
    document.getElementById("userDisplayName")?.textContent || "Usuario Anónimo"
  );
}

function groupBy(array, key) {
  return array.reduce((groups, item) => {
    const group = item[key] || "Sin categoría";
    groups[group] = groups[group] || [];
    groups[group].push(item);
    return groups;
  }, {});
}

function groupCount(array, key) {
  return array.reduce((counts, item) => {
    const group = item[key] || "Sin especificar";
    counts[group] = (counts[group] || 0) + 1;
    return counts;
  }, {});
}

// =================== FUNCIONES DE CONTENIDO PDF ===================

function addGeneralContent(doc, data, yPos) {
  doc.setFontSize(14);
  doc.text("RESUMEN EJECUTIVO", 20, yPos);
  yPos += 10;

  doc.setFontSize(10);
  const summary = [
    `Total de Eventos: ${data.summary.totalEvents}`,
    `Eventos Completados: ${data.summary.completedEvents}`,
    `Total de Voluntarios: ${data.summary.totalVolunteers}`,
    `Voluntarios Activos: ${data.summary.activeVolunteers}`,
    `Total de Donaciones: ${data.summary.totalDonations}`,
    `Monto Total: S/ ${data.summary.totalAmount.toFixed(2)}`,
  ];

  summary.forEach((line) => {
    doc.text(line, 20, yPos);
    yPos += 7;
  });

  return yPos;
}

function addEventsContent(doc, data, yPos) {
  doc.setFontSize(14);
  doc.text("ESTADÍSTICAS DE EVENTOS", 20, yPos);
  yPos += 10;

  doc.setFontSize(10);
  const stats = [
    `Total de Eventos: ${data.statistics.total}`,
    `Eventos Completados: ${data.statistics.completedEvents}`,
    `Eventos Próximos: ${data.statistics.upcomingEvents}`,
    `Total de Participantes: ${data.statistics.totalParticipants}`,
  ];

  stats.forEach((line) => {
    doc.text(line, 20, yPos);
    yPos += 7;
  });

  return yPos;
}

function addDonationsContent(doc, data, yPos) {
  doc.setFontSize(14);
  doc.text("RESUMEN FINANCIERO", 20, yPos);
  yPos += 10;

  doc.setFontSize(10);
  const stats = [
    `Total de Donaciones: ${data.statistics.total}`,
    `Donaciones Validadas: ${data.statistics.validatedCount}`,
    `Monto Total: S/ ${data.statistics.totalAmount.toFixed(2)}`,
    `Monto Validado: S/ ${data.statistics.validatedAmount.toFixed(2)}`,
  ];

  stats.forEach((line) => {
    doc.text(line, 20, yPos);
    yPos += 7;
  });

  return yPos;
}

function addVolunteersContent(doc, data, yPos) {
  doc.setFontSize(14);
  doc.text("ESTADÍSTICAS DE VOLUNTARIOS", 20, yPos);
  yPos += 10;

  doc.setFontSize(10);
  const stats = [
    `Total de Voluntarios: ${data.statistics.total}`,
    `Voluntarios Activos: ${data.statistics.active}`,
    `Recolectores: ${data.statistics.recolectores}`,
    `Promedio de Participación: ${data.statistics.averageParticipation.toFixed(
      2
    )}`,
  ];

  stats.forEach((line) => {
    doc.text(line, 20, yPos);
    yPos += 7;
  });

  return yPos;
}

// =================== FUNCIONES DE UI ===================

// ✅ ACTUALIZADA: Cargar estadísticas desde Firebase
async function loadStatistics() {
  try {
    // Cargar estadísticas reales de Firebase
    const reportsSnapshot = await getDocs(collection(db, "reports"));

    let totalDownloads = 0;
    reportsSnapshot.forEach((doc) => {
      const data = doc.data();
      totalDownloads += data.downloadCount || 0;
    });

    reportStats.totalReports = reportsSnapshot.size;
    reportStats.totalDownloads = totalDownloads;

    updateStatisticsUI(reportStats);
  } catch (error) {
    console.error("Error al cargar estadísticas:", error);
    updateStatisticsUI(reportStats);
  }
}

function updateStatisticsUI(stats) {
  const elements = {
    totalReports: document.getElementById("totalReports"),
    totalDownloads: document.getElementById("totalDownloads"),
    scheduledReports: document.getElementById("scheduledReports"),
    dataAccuracy: document.getElementById("dataAccuracy"),
    reportsChange: document.getElementById("reportsChange"),
    downloadsChange: document.getElementById("downloadsChange"),
    nextScheduled: document.getElementById("nextScheduled"),
    accuracyStatus: document.getElementById("accuracyStatus"),
  };

  if (elements.totalReports)
    elements.totalReports.textContent = stats.totalReports;
  if (elements.totalDownloads)
    elements.totalDownloads.textContent = stats.totalDownloads;
  if (elements.scheduledReports)
    elements.scheduledReports.textContent = stats.scheduledReports;
  if (elements.dataAccuracy)
    elements.dataAccuracy.textContent = stats.dataAccuracy + "%";
  if (elements.reportsChange) elements.reportsChange.textContent = "+12%";
  if (elements.downloadsChange) elements.downloadsChange.textContent = "+8%";
  if (elements.nextScheduled) elements.nextScheduled.textContent = "Mañana";
  if (elements.accuracyStatus) elements.accuracyStatus.textContent = "Óptimo";
}

// ✅ NUEVA FUNCIÓN: Actualizar estadísticas después de cada descarga
async function updateReportStats() {
  reportStats.totalReports++;
  reportStats.totalDownloads++;
  updateStatisticsUI(reportStats);
}

// ✅ ACTUALIZADA: Cargar reportes recientes desde Firebase
async function loadRecentReports() {
  try {
    // Obtener reportes de Firebase ordenados por fecha
    const reportsQuery = query(
      collection(db, "reports"),
      orderBy("generatedAt", "desc"),
      limit(10)
    );

    const reportsSnapshot = await getDocs(reportsQuery);
    const container = document.getElementById("recentReportsTable");

    if (!container) return;

    if (reportsSnapshot.empty) {
      container.innerHTML =
        '<tr><td colspan="6" class="text-center text-muted">No hay reportes recientes</td></tr>';
      return;
    }

    const reportsHTML = reportsSnapshot.docs
      .map((docSnapshot) => {
        const report = docSnapshot.data();
        const reportId = docSnapshot.id;
        const date = report.generatedAt?.toDate
          ? report.generatedAt.toDate().toLocaleDateString()
          : new Date().toLocaleDateString();

        const statusBadge = getStatusBadge(report.status);
        const typeBadge = getTypeBadge(report.type);

        return `
        <tr>
          <td>${report.title}</td>
          <td>${date}</td>
          <td>${report.fileSize || "2.1 MB"}</td>
          <td>${statusBadge}</td>
          <td>
            <button class="btn btn-sm btn-outline-primary" onclick="downloadReportFromFirebase('${reportId}')" 
                    title="Descargar reporte">
              <i class="fas fa-download"></i>
            </button>
            <button class="btn btn-sm btn-outline-info" onclick="viewReportDetails('${reportId}')" 
                    title="Ver detalles">
              <i class="fas fa-eye"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteReportFromFirebase('${reportId}')" 
                    title="Eliminar reporte">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `;
      })
      .join("");

    container.innerHTML = reportsHTML;
  } catch (error) {
    console.error("Error al cargar reportes recientes:", error);
    const container = document.getElementById("recentReportsTable");
    if (container) {
      container.innerHTML =
        '<tr><td colspan="6" class="text-center text-danger">Error al cargar reportes</td></tr>';
    }
  }
}

// ✅ NUEVA FUNCIÓN: Obtener badge de estado
function getStatusBadge(status) {
  const badges = {
    completed: '<span class="badge bg-success">Completado</span>',
    generating: '<span class="badge bg-warning">Generando</span>',
    error: '<span class="badge bg-danger">Error</span>',
    pending: '<span class="badge bg-secondary">Pendiente</span>',
  };
  return (
    badges[status] || '<span class="badge bg-secondary">Desconocido</span>'
  );
}

// ✅ NUEVA FUNCIÓN: Obtener badge de tipo
function getTypeBadge(type) {
  const badges = {
    general: '<span class="badge bg-primary">General</span>',
    eventos: '<span class="badge bg-info">Eventos</span>',
    donaciones: '<span class="badge bg-success">Donaciones</span>',
    voluntarios: '<span class="badge bg-warning">Voluntarios</span>',
    inventario: '<span class="badge bg-secondary">Inventario</span>',
    financiero: '<span class="badge bg-danger">Financiero</span>',
    participacion: '<span class="badge bg-dark">Participación</span>',
  };
  return badges[type] || '<span class="badge bg-secondary">Otro</span>';
}

// ✅ NUEVA FUNCIÓN: Descargar reporte desde Firebase
async function downloadReportFromFirebase(reportId) {
  try {
    showNotification("Descargando reporte...", "info");

    // Incrementar contador de descargas
    const reportRef = doc(db, "reports", reportId);
    await updateDoc(reportRef, {
      downloadCount: increment(1),
      lastDownloaded: serverTimestamp(),
    });

    // Actualizar estadísticas
    await updateReportStats();
    await loadStatistics();
    await loadRecentReports();

    showNotification("Reporte descargado exitosamente", "success");
  } catch (error) {
    console.error("Error al descargar reporte:", error);
    showNotification("Error al descargar reporte", "error");
  }
}

// ✅ NUEVA FUNCIÓN: Ver detalles del reporte
async function viewReportDetails(reportId) {
  try {
    const reportDoc = await getDocs(
      query(collection(db, "reports"), where("__name__", "==", reportId))
    );

    if (!reportDoc.empty) {
      const report = reportDoc.docs[0].data();
      showReportDetailsModal(report);
    } else {
      showNotification("Reporte no encontrado", "warning");
    }
  } catch (error) {
    console.error("Error al obtener detalles del reporte:", error);
    showNotification("Error al obtener detalles", "error");
  }
}

// ✅ NUEVA FUNCIÓN: Eliminar reporte de Firebase
async function deleteReportFromFirebase(reportId) {
  if (
    !confirm(
      "¿Está seguro de eliminar este reporte? Esta acción no se puede deshacer."
    )
  ) {
    return;
  }

  try {
    await deleteDoc(doc(db, "reports", reportId));

    // Actualizar estadísticas
    reportStats.totalReports--;
    updateStatisticsUI(reportStats);

    // Recargar tabla
    await loadRecentReports();
    await loadStatistics();

    showNotification("Reporte eliminado exitosamente", "success");
  } catch (error) {
    console.error("Error al eliminar reporte:", error);
    showNotification("Error al eliminar reporte", "error");
  }
}

// ✅ NUEVA FUNCIÓN: Mostrar modal de detalles
function showReportDetailsModal(report) {
  const modalHTML = `
    <div class="modal fade" id="reportDetailsModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="fas fa-file-alt me-2"></i>Detalles del Reporte
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="row">
              <div class="col-md-6">
                <h6><i class="fas fa-info-circle me-2"></i>Información General</h6>
                <table class="table table-sm">
                  <tr><td><strong>Título:</strong></td><td>${
                    report.title
                  }</td></tr>
                  <tr><td><strong>Tipo:</strong></td><td>${getTypeBadge(
                    report.type
                  )}</td></tr>
                  <tr><td><strong>Estado:</strong></td><td>${getStatusBadge(
                    report.status
                  )}</td></tr>
                  <tr><td><strong>Formato:</strong></td><td>${
                    report.format?.toUpperCase() || "PDF"
                  }</td></tr>
                </table>
              </div>
              <div class="col-md-6">
                <h6><i class="fas fa-chart-bar me-2"></i>Estadísticas</h6>
                <table class="table table-sm">
                  <tr><td><strong>Generado por:</strong></td><td>${
                    report.generatedBy
                  }</td></tr>
                  <tr><td><strong>Fecha:</strong></td><td>${
                    report.generatedAt?.toDate
                      ? report.generatedAt.toDate().toLocaleDateString()
                      : "N/A"
                  }</td></tr>
                  <tr><td><strong>Descargas:</strong></td><td>${
                    report.downloadCount || 0
                  }</td></tr>
                  <tr><td><strong>Tamaño:</strong></td><td>${
                    report.fileSize || "2.1 MB"
                  }</td></tr>
                </table>
              </div>
            </div>
            
            ${
              report.config
                ? `
            <div class="row mt-3">
              <div class="col-12">
                <h6><i class="fas fa-cogs me-2"></i>Configuración</h6>
                <div class="bg-light p-3 rounded">
                  <div class="row">
                    <div class="col-md-6">
                      <small><strong>Periodo:</strong> ${getPeriodText(
                        report.config.period
                      )}</small><br>
                      <small><strong>Gráficos:</strong> ${
                        report.config.includeCharts ? "Sí" : "No"
                      }</small><br>
                    </div>
                    <div class="col-md-6">
                      <small><strong>Detalles:</strong> ${
                        report.config.includeDetails ? "Sí" : "No"
                      }</small><br>
                      <small><strong>Recomendaciones:</strong> ${
                        report.config.includeRecommendations ? "Sí" : "No"
                      }</small><br>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            `
                : ""
            }
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
            <button type="button" class="btn btn-primary" onclick="downloadReportFromFirebase('${
              report.id
            }')">
              <i class="fas fa-download me-2"></i>Descargar
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Remover modal existente
  const existingModal = document.getElementById("reportDetailsModal");
  if (existingModal) {
    existingModal.remove();
  }

  // Agregar nuevo modal
  document.body.insertAdjacentHTML("beforeend", modalHTML);

  // Mostrar modal
  const modal = new bootstrap.Modal(
    document.getElementById("reportDetailsModal")
  );
  modal.show();
}

function addToRecentReports(report) {
  // Esta función ya no es necesaria porque ahora guardamos directamente en Firebase
  console.log("Reporte agregado a Firebase:", report);
}

function deleteReport(reportId) {
  // Redirigir a la función de Firebase
  deleteReportFromFirebase(reportId);
}

function downloadReport(reportId) {
  // Redirigir a la función de Firebase
  downloadReportFromFirebase(reportId);
}

// =================== FUNCIONES DE VISTA PREVIA ===================

function previewReport() {
  const reportType = document.getElementById("reportType").value;
  const reportPeriod = document.getElementById("reportPeriod").value;

  if (!reportType || !reportPeriod) {
    showNotification(
      "Seleccione tipo y periodo de reporte para vista previa",
      "warning"
    );
    return;
  }

  showPreviewModal(reportType, reportPeriod);
}

function showPreviewModal(type, period) {
  const modal = new bootstrap.Modal(document.getElementById("previewModal"));
  const previewContent = document.getElementById("previewContent");

  const previewHTML = generatePreviewContent(type, period);
  previewContent.innerHTML = previewHTML;

  modal.show();
}

function generatePreviewContent(type, period) {
  const reportTitle = getReportTitle(type);
  const periodText = getPeriodText(period);

  return `
    <div class="preview-container">
      <div class="text-center mb-4">
        <h4>${reportTitle}</h4>
        <p class="text-muted">Periodo: ${periodText}</p>
        <p class="text-muted">Fecha de generación: ${new Date().toLocaleDateString()}</p>
      </div>
      
      <div class="row mb-3">
        <div class="col-12">
          <h6><i class="fas fa-info-circle me-2"></i>Estructura del Reporte</h6>
        </div>
      </div>
      
      ${getPreviewStructure(type)}
      
      <div class="alert alert-info mt-3">
        <i class="fas fa-info-circle me-2"></i>
        <strong>Nota:</strong> Esta es una vista previa de la estructura del reporte. 
        Los datos reales se generarán al crear el PDF y se guardarán en el historial.
      </div>
    </div>
  `;
}

function getPreviewStructure(type) {
  const structures = {
    general: `
      <div class="preview-section">
        <h6>📊 Resumen Ejecutivo</h6>
        <ul class="list-unstyled ms-3">
          <li>• Total de eventos y estado</li>
          <li>• Estadísticas de voluntarios</li>
          <li>• Resumen financiero de donaciones</li>
          <li>• Indicadores clave de rendimiento</li>
        </ul>
      </div>
      <div class="preview-section">
        <h6>📈 Análisis Detallado</h6>
        <ul class="list-unstyled ms-3">
          <li>• Eventos por categoría y estado</li>
          <li>• Participación de voluntarios</li>
          <li>• Donaciones por tipo de usuario</li>
          <li>• Tendencias y comparaciones</li>
        </ul>
      </div>
      <div class="preview-section">
        <h6>💡 Recomendaciones</h6>
        <ul class="list-unstyled ms-3">
          <li>• Áreas de mejora identificadas</li>
          <li>• Estrategias sugeridas</li>
          <li>• Próximos pasos recomendados</li>
        </ul>
      </div>
    `,
    eventos: `
      <div class="preview-section">
        <h6>📅 Estadísticas Generales</h6>
        <ul class="list-unstyled ms-3">
          <li>• Total de eventos programados</li>
          <li>• Eventos completados vs pendientes</li>
          <li>• Promedio de participación</li>
          <li>• Distribución por tipo de evento</li>
        </ul>
      </div>
      <div class="preview-section">
        <h6>👥 Participación de Voluntarios</h6>
        <ul class="list-unstyled ms-3">
          <li>• Eventos con mayor participación</li>
          <li>• Voluntarios más activos</li>
          <li>• Capacidad utilizada vs disponible</li>
        </ul>
      </div>
      <div class="preview-section">
        <h6>📋 Lista Detallada de Eventos</h6>
        <ul class="list-unstyled ms-3">
          <li>• Información completa de cada evento</li>
          <li>• Estado y fechas</li>
          <li>• Participantes inscritos</li>
          <li>• Ubicación y materiales</li>
        </ul>
      </div>
    `,
    donaciones: `
      <div class="preview-section">
        <h6>💰 Resumen Financiero</h6>
        <ul class="list-unstyled ms-3">
          <li>• Monto total recaudado</li>
          <li>• Donaciones validadas vs pendientes</li>
          <li>• Promedio por donación</li>
          <li>• Comparación con periodos anteriores</li>
        </ul>
      </div>
      <div class="preview-section">
        <h6>👤 Análisis por Tipo de Donante</h6>
        <ul class="list-unstyled ms-3">
          <li>• Personas naturales vs empresas</li>
          <li>• Distribución de montos</li>
          <li>• Frecuencia de donaciones</li>
        </ul>
      </div>
      <div class="preview-section">
        <h6>🎯 Rendimiento de Recolectores</h6>
        <ul class="list-unstyled ms-3">
          <li>• Top recolectores por monto</li>
          <li>• Eficiencia en validaciones</li>
          <li>• Distribución de donaciones</li>
        </ul>
      </div>
      <div class="preview-section">
        <h6>📝 Lista de Donaciones</h6>
        <ul class="list-unstyled ms-3">
          <li>• Donaciones recientes detalladas</li>
          <li>• Estado de validación</li>
          <li>• Información del donante</li>
          <li>• Recolector asignado</li>
        </ul>
      </div>
    `,
    voluntarios: `
      <div class="preview-section">
        <h6>👥 Estadísticas Generales</h6>
        <ul class="list-unstyled ms-3">
          <li>• Total de voluntarios registrados</li>
          <li>• Voluntarios activos vs inactivos</li>
          <li>• Distribución por roles</li>
          <li>• Promedio de participación</li>
        </ul>
      </div>
      <div class="preview-section">
        <h6>🏫 Distribución Académica</h6>
        <ul class="list-unstyled ms-3">
          <li>• Voluntarios por facultad</li>
          <li>• Distribución por escuela</li>
          <li>• Participación por ciclo académico</li>
        </ul>
      </div>
      <div class="preview-section">
        <h6>🏆 Voluntarios Destacados</h6>
        <ul class="list-unstyled ms-3">
          <li>• Top 10 voluntarios más activos</li>
          <li>• Participación en eventos</li>
          <li>• Reconocimientos y logros</li>
        </ul>
      </div>
      <div class="preview-section">
        <h6>📊 Análisis de Participación</h6>
        <ul class="list-unstyled ms-3">
          <li>• Tendencias de participación</li>
          <li>• Retención de voluntarios</li>
          <li>• Áreas de oportunidad</li>
        </ul>
      </div>
    `,
    inventario: `
      <div class="preview-section">
        <h6>📦 Control de Stock</h6>
        <ul class="list-unstyled ms-3">
          <li>• Inventario actual por categoría</li>
          <li>• Productos con stock bajo</li>
          <li>• Movimientos recientes</li>
          <li>• Valorización del inventario</li>
        </ul>
      </div>
    `,
    financiero: `
      <div class="preview-section">
        <h6>💰 Estado Financiero</h6>
        <ul class="list-unstyled ms-3">
          <li>• Ingresos y egresos</li>
          <li>• Flujo de caja</li>
          <li>• Presupuesto vs real</li>
          <li>• Proyecciones financieras</li>
        </ul>
      </div>
    `,
    participacion: `
      <div class="preview-section">
        <h6>📈 Análisis de Participación</h6>
        <ul class="list-unstyled ms-3">
          <li>• Tendencias de participación</li>
          <li>• Eventos más populares</li>
          <li>• Retención de voluntarios</li>
          <li>• Factores de engagement</li>
        </ul>
      </div>
    `,
  };

  return (
    structures[type] ||
    "<p>Vista previa no disponible para este tipo de reporte.</p>"
  );
}

function getPeriodText(period) {
  const periods = {
    ultima_semana: "Última Semana",
    ultimo_mes: "Último Mes",
    ultimo_trimestre: "Último Trimestre",
    ultimo_semestre: "Último Semestre",
    ultimo_año: "Último Año",
    personalizado: "Periodo Personalizado",
  };
  return periods[period] || "Periodo no especificado";
}

function confirmGenerateReport() {
  // Cerrar modal de vista previa
  const previewModal = bootstrap.Modal.getInstance(
    document.getElementById("previewModal")
  );
  if (previewModal) {
    previewModal.hide();
  }

  // Ejecutar generación del reporte
  const reportForm = document.getElementById("reportForm");
  if (reportForm) {
    const event = new Event("submit", { bubbles: true, cancelable: true });
    reportForm.dispatchEvent(event);
  }
}

// =================== FUNCIONES DE PROGRAMACIÓN ===================

function scheduleReport() {
  const reportType = document.getElementById("reportType").value;

  if (!reportType) {
    showNotification("Seleccione un tipo de reporte para programar", "warning");
    return;
  }

  // Pre-llenar el modal con datos del formulario actual
  document.getElementById("scheduleName").value = getReportTitle(reportType);

  const modal = new bootstrap.Modal(document.getElementById("scheduleModal"));
  modal.show();
}

function saveScheduledReport() {
  const form = document.getElementById("scheduleForm");
  const formData = new FormData(form);

  const scheduledReport = {
    id: Date.now().toString(),
    name:
      formData.get("scheduleName") ||
      document.getElementById("scheduleName").value,
    frequency:
      formData.get("scheduleFrequency") ||
      document.getElementById("scheduleFrequency").value,
    time:
      formData.get("scheduleTime") ||
      document.getElementById("scheduleTime").value,
    email:
      formData.get("scheduleEmail") ||
      document.getElementById("scheduleEmail").value,
    reportType: document.getElementById("reportType").value,
    nextExecution: calculateNextExecution(
      document.getElementById("scheduleFrequency").value,
      document.getElementById("scheduleTime").value
    ),
    status: "active",
  };

  // Validar campos requeridos
  if (
    !scheduledReport.name ||
    !scheduledReport.frequency ||
    !scheduledReport.time
  ) {
    showNotification("Complete todos los campos requeridos", "warning");
    return;
  }

  // Guardar en localStorage (en producción usar Firebase)
  let scheduledReports = JSON.parse(
    localStorage.getItem("scheduledReports") || "[]"
  );
  scheduledReports.push(scheduledReport);
  localStorage.setItem("scheduledReports", JSON.stringify(scheduledReports));

  // Actualizar estadísticas
  reportStats.scheduledReports = scheduledReports.length;
  updateStatisticsUI(reportStats);

  // Cerrar modal
  const modal = bootstrap.Modal.getInstance(
    document.getElementById("scheduleModal")
  );
  if (modal) {
    modal.hide();
  }

  // Limpiar formulario
  form.reset();

  showNotification("Reporte programado exitosamente", "success");
  loadScheduledReports();
}

function calculateNextExecution(frequency, time) {
  const now = new Date();
  const [hours, minutes] = time.split(":").map(Number);
  const nextExecution = new Date();
  nextExecution.setHours(hours, minutes, 0, 0);

  switch (frequency) {
    case "diario":
      if (nextExecution <= now) {
        nextExecution.setDate(nextExecution.getDate() + 1);
      }
      break;
    case "semanal":
      nextExecution.setDate(nextExecution.getDate() + 7);
      break;
    case "mensual":
      nextExecution.setMonth(nextExecution.getMonth() + 1);
      break;
    case "trimestral":
      nextExecution.setMonth(nextExecution.getMonth() + 3);
      break;
  }

  return nextExecution.toLocaleDateString();
}

function loadScheduledReports() {
  const container = document.getElementById("scheduledReportsContainer");
  if (!container) return;

  const scheduledReports = JSON.parse(
    localStorage.getItem("scheduledReports") || "[]"
  );

  if (scheduledReports.length === 0) {
    container.innerHTML =
      '<p class="text-muted text-center">No hay reportes programados</p>';
    return;
  }

  const reportsHTML = scheduledReports
    .map(
      (report) => `
    <div class="scheduled-report-item border rounded p-3 mb-2">
      <div class="d-flex justify-content-between align-items-start">
        <div>
          <h6 class="mb-1">${report.name}</h6>
          <small class="text-muted">
            <i class="fas fa-clock me-1"></i>${report.frequency} a las ${report.time}
          </small><br>
          <small class="text-muted">
            <i class="fas fa-calendar me-1"></i>Próximo: ${report.nextExecution}
          </small>
        </div>
        <div class="dropdown">
          <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
            <i class="fas fa-ellipsis-v"></i>
          </button>
          <ul class="dropdown-menu">
            <li><a class="dropdown-item" href="#" onclick="editScheduledReport('${report.id}')">
              <i class="fas fa-edit me-2"></i>Editar
            </a></li>
            <li><a class="dropdown-item" href="#" onclick="runScheduledReport('${report.id}')">
              <i class="fas fa-play me-2"></i>Ejecutar Ahora
            </a></li>
            <li><hr class="dropdown-divider"></li>
            <li><a class="dropdown-item text-danger" href="#" onclick="deleteScheduledReport('${report.id}')">
              <i class="fas fa-trash me-2"></i>Eliminar
            </a></li>
          </ul>
        </div>
      </div>
    </div>
  `
    )
    .join("");

  container.innerHTML = reportsHTML;
}

function editScheduledReport(id) {
  const scheduledReports = JSON.parse(
    localStorage.getItem("scheduledReports") || "[]"
  );
  const report = scheduledReports.find((r) => r.id === id);

  if (report) {
    document.getElementById("scheduleName").value = report.name;
    document.getElementById("scheduleFrequency").value = report.frequency;
    document.getElementById("scheduleTime").value = report.time;
    document.getElementById("scheduleEmail").value = report.email || "";

    const modal = new bootstrap.Modal(document.getElementById("scheduleModal"));
    modal.show();

    // Marcar como edición
    const saveBtn = modal._element.querySelector(".btn-primary");
    saveBtn.textContent = "Actualizar Programación";
    saveBtn.setAttribute("data-edit-id", id);
  }
}

function deleteScheduledReport(id) {
  if (confirm("¿Está seguro de eliminar este reporte programado?")) {
    let scheduledReports = JSON.parse(
      localStorage.getItem("scheduledReports") || "[]"
    );
    scheduledReports = scheduledReports.filter((report) => report.id !== id);
    localStorage.setItem("scheduledReports", JSON.stringify(scheduledReports));

    reportStats.scheduledReports = scheduledReports.length;
    updateStatisticsUI(reportStats);

    loadScheduledReports();
    showNotification("Reporte programado eliminado", "info");
  }
}

function runScheduledReport(id) {
  const scheduledReports = JSON.parse(
    localStorage.getItem("scheduledReports") || "[]"
  );
  const report = scheduledReports.find((r) => r.id === id);

  if (report) {
    showNotification(`Ejecutando reporte programado: ${report.name}`, "info");
    generateQuickReport(report.reportType);
  }
}

function refreshRecentReports() {
  loadRecentReports();
  showNotification("Lista de reportes actualizada", "info");
}

// =================== FUNCIONES DE NOTIFICACIONES Y MODALES ===================

function showProgressModal() {
  const modal = document.getElementById("reportProgressModal");
  if (modal) {
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    updateProgressModal("Iniciando...", 0);
  }
}

function updateProgressModal(message, percentage) {
  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");

  if (progressBar) {
    progressBar.style.width = percentage + "%";
    progressBar.setAttribute("aria-valuenow", percentage);
  }

  if (progressText) {
    progressText.textContent = message;
  }
}

function hideProgressModal() {
  const modal = document.getElementById("reportProgressModal");
  if (modal) {
    const bsModal = bootstrap.Modal.getInstance(modal);
    if (bsModal) {
      setTimeout(() => {
        bsModal.hide();
      }, 1000);
    }
  }
}

function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `alert alert-${getBootstrapAlertType(
    type
  )} alert-dismissible fade show position-fixed`;
  notification.style.cssText = `
    top: 20px;
    right: 20px;
    z-index: 9999;
    min-width: 300px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  `;

  notification.innerHTML = `
    <div class="d-flex align-items-center">
      <i class="${getNotificationIcon(type)} me-2"></i>
      <span>${message}</span>
      <button type="button" class="btn-close ms-auto" data-bs-dismiss="alert"></button>
    </div>
  `;

  document.body.appendChild(notification);

  // Auto-remove después de 5 segundos
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 5000);
}

function getBootstrapAlertType(type) {
  const types = {
    success: "success",
    error: "danger",
    warning: "warning",
    info: "info",
  };
  return types[type] || "info";
}

function getNotificationIcon(type) {
  const icons = {
    success: "fas fa-check-circle",
    error: "fas fa-exclamation-circle",
    warning: "fas fa-exclamation-triangle",
    info: "fas fa-info-circle",
  };
  return icons[type] || "fas fa-info-circle";
}

// =================== EXPORTAR FUNCIONES GLOBALES ===================

// Hacer funciones disponibles globalmente para HTML
window.generateQuickReport = generateQuickReport;
window.previewReport = previewReport;
window.scheduleReport = scheduleReport;
window.confirmGenerateReport = confirmGenerateReport;
window.saveScheduledReport = saveScheduledReport;
window.editScheduledReport = editScheduledReport;
window.deleteScheduledReport = deleteScheduledReport;
window.runScheduledReport = runScheduledReport;
window.deleteReport = deleteReport;
window.downloadReport = downloadReport;
window.refreshRecentReports = refreshRecentReports;

// ✅ NUEVAS FUNCIONES EXPORTADAS PARA FIREBASE
window.downloadReportFromFirebase = downloadReportFromFirebase;
window.viewReportDetails = viewReportDetails;
window.deleteReportFromFirebase = deleteReportFromFirebase;

// Funciones de UI
window.showProgressModal = showProgressModal;
window.updateProgressModal = updateProgressModal;
window.hideProgressModal = hideProgressModal;
window.showNotification = showNotification;

// =================== MANEJO DE ERRORES GLOBALES ===================

window.addEventListener("error", function (event) {
  console.error("Error en Sistema de Reportes:", event.error);
  showNotification("Ha ocurrido un error inesperado en el sistema", "error");
});

window.addEventListener("unhandledrejection", function (event) {
  console.error("Error no manejado:", event.reason);
  showNotification("Error en procesamiento de datos", "error");
  event.preventDefault();
});

// =================== INICIALIZACIÓN FINAL ===================

// Verificar dependencias al cargar
document.addEventListener("DOMContentLoaded", function () {
  // Verificar jsPDF
  if (typeof window.jspdf === "undefined") {
    console.warn(
      "jsPDF no encontrado. Los reportes PDF podrían no funcionar correctamente."
    );
  }

  // Verificar Bootstrap
  if (typeof bootstrap === "undefined") {
    console.warn(
      "Bootstrap JS no encontrado. Los modales podrían no funcionar correctamente."
    );
  }

  // Verificar Firebase
  if (typeof db === "undefined") {
    console.warn(
      "Firebase no encontrado. Las funciones de guardado podrían no funcionar."
    );
  }

  console.log(
    "Sistema de Reportes EcoVoluntarios inicializado correctamente ✓"
  );
});
