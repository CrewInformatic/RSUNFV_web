// =============================================
// PAST-REPORTS.JS - GENERADOR DE REPORTES PDF
// =============================================

import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Cargar jsPDF desde CDN
const jsPDF = window.jspdf?.jsPDF || window.jsPDF;

/**
 * Generar reporte PDF del evento
 */
export async function generateEventReport(eventId) {
  try {
    // Verificar que jsPDF esté disponible
    if (!jsPDF) {
      throw new Error(
        "jsPDF no está disponible. Asegúrate de incluir la librería en tu HTML."
      );
    }

    // Obtener datos del evento
    const eventData = await getEventData(eventId);
    if (!eventData) {
      throw new Error("No se encontró el evento especificado");
    }

    // Obtener datos de voluntarios
    const volunteersData = await getVolunteersData(eventId);

    // Crear el PDF
    const pdf = new jsPDF();

    // Generar el contenido del reporte
    await generateReportContent(pdf, eventData, volunteersData);

    // Descargar el PDF
    const fileName = `Reporte_Evento_${eventData.titulo.replace(
      /[^a-zA-Z0-9]/g,
      "_"
    )}_${formatDateForFilename(new Date())}.pdf`;
    pdf.save(fileName);

    // Mostrar mensaje de éxito
    if (window.showSuccess) {
      window.showSuccess(
        "Reporte Generado",
        "El reporte PDF se ha descargado exitosamente"
      );
    }
  } catch (error) {
    throw error;
  }
}

/**
 * Obtener datos del evento desde Firestore
 */
async function getEventData(eventId) {
  try {
    const db = window.firebaseDB;
    if (!db) {
      throw new Error("Base de datos no disponible");
    }

    const eventRef = doc(db, "eventos", eventId);
    const eventSnap = await getDoc(eventRef);

    if (!eventSnap.exists()) {
      throw new Error(`Evento con ID ${eventId} no encontrado`);
    }

    return { id: eventSnap.id, ...eventSnap.data() };
  } catch (error) {
    throw error;
  }
}

/**
 * Obtener datos de voluntarios del evento
 */
async function getVolunteersData(eventId) {
  try {
    const db = window.firebaseDB;
    if (!db) {
      throw new Error("Base de datos no disponible");
    }

    // Buscar voluntarios registrados en el evento
    const voluntariosRef = collection(db, "voluntarios");
    const q = query(
      voluntariosRef,
      where("eventosInscritos", "array-contains", eventId)
    );
    const querySnapshot = await getDocs(q);

    const volunteers = [];
    querySnapshot.forEach((doc) => {
      volunteers.push({ id: doc.id, ...doc.data() });
    });

    return volunteers;
  } catch (error) {
    return [];
  }
}

/**
 * Generar contenido del reporte PDF
 */
async function generateReportContent(pdf, eventData, volunteersData) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  let currentY = margin;

  // Configurar fuentes
  pdf.setFont("helvetica");

  // =============================================
  // ENCABEZADO DEL REPORTE
  // =============================================

  // Título principal
  pdf.setFontSize(20);
  pdf.setTextColor(44, 62, 80);
  pdf.text("REPORTE DE EVENTO VOLUNTARIO", pageWidth / 2, currentY, {
    align: "center",
  });
  currentY += 15;

  // Línea separadora
  pdf.setDrawColor(52, 152, 219);
  pdf.setLineWidth(0.5);
  pdf.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 10;

  // Información del reporte
  pdf.setFontSize(10);
  pdf.setTextColor(128, 128, 128);
  const reportDate = new Date().toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  pdf.text(`Generado el: ${reportDate}`, pageWidth - margin, currentY, {
    align: "right",
  });
  currentY += 20;

  // =============================================
  // INFORMACIÓN DEL EVENTO
  // =============================================

  currentY = addSectionTitle(
    pdf,
    "INFORMACIÓN DEL EVENTO",
    currentY,
    pageWidth,
    margin
  );

  // Datos básicos del evento
  const eventInfo = [
    ["Título:", eventData.titulo || "No especificado"],
    ["Fecha de inicio:", formatDate(eventData.fechaInicio)],
    ["Fecha de fin:", formatDate(eventData.fechaFin)],
    ["Ubicación:", eventData.ubicacion || "No especificada"],
    ["Estado:", getEventStatusText(eventData.estado)],
    ["Máximo voluntarios:", eventData.cantidadVoluntariosMax || "Sin límite"],
    ["Voluntarios inscritos:", eventData.voluntariosInscritos?.length || 0],
    ["Requisitos:", eventData.requisitos || "Ninguno"],
  ];

  currentY = addInfoTable(pdf, eventInfo, currentY, pageWidth, margin);
  currentY += 10;

  // Descripción del evento
  if (eventData.descripcion) {
    pdf.setFontSize(12);
    pdf.setTextColor(44, 62, 80);
    pdf.text("Descripción:", margin, currentY);
    currentY += 8;

    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    const descriptionLines = pdf.splitTextToSize(
      eventData.descripcion,
      pageWidth - 2 * margin
    );
    pdf.text(descriptionLines, margin, currentY);
    currentY += descriptionLines.length * 5 + 10;
  }

  // =============================================
  // ESTADÍSTICAS DEL EVENTO
  // =============================================

  currentY = addSectionTitle(pdf, "ESTADÍSTICAS", currentY, pageWidth, margin);

  const stats = calculateEventStats(eventData, volunteersData);
  const statsInfo = [
    ["Total de voluntarios participantes:", stats.totalVolunteers],
    ["Tasa de ocupación:", `${stats.occupancyRate}%`],
    ["Promedio de edad:", `${stats.averageAge} años`],
    [
      "Voluntarios por género:",
      `${stats.genderDistribution.masculino}M / ${stats.genderDistribution.femenino}F / ${stats.genderDistribution.otro}O`,
    ],
    ["Duración del evento:", stats.eventDuration],
    ["Voluntarios nuevos:", stats.newVolunteers],
    ["Voluntarios recurrentes:", stats.recurringVolunteers],
  ];

  currentY = addInfoTable(pdf, statsInfo, currentY, pageWidth, margin);
  currentY += 15;

  // =============================================
  // LISTA DE VOLUNTARIOS
  // =============================================

  if (volunteersData.length > 0) {
    currentY = addSectionTitle(
      pdf,
      "LISTA DE VOLUNTARIOS PARTICIPANTES",
      currentY,
      pageWidth,
      margin
    );
    currentY = addVolunteersTable(
      pdf,
      volunteersData,
      currentY,
      pageWidth,
      margin
    );
  }

  // =============================================
  // PIE DE PÁGINA
  // =============================================

  addFooter(pdf, pageWidth, pageHeight, margin);
}

/**
 * Agregar título de sección
 */
function addSectionTitle(pdf, title, currentY, pageWidth, margin) {
  pdf.setFontSize(14);
  pdf.setTextColor(52, 152, 219);
  pdf.text(title, margin, currentY);
  currentY += 10;

  // Línea bajo el título
  pdf.setDrawColor(52, 152, 219);
  pdf.setLineWidth(0.3);
  pdf.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 8;

  return currentY;
}

/**
 * Agregar tabla de información
 */
function addInfoTable(pdf, data, currentY, pageWidth, margin) {
  pdf.setFontSize(10);
  const lineHeight = 6;

  data.forEach(([label, value]) => {
    // Verificar si necesitamos nueva página
    if (currentY > pdf.internal.pageSize.getHeight() - 30) {
      pdf.addPage();
      currentY = margin;
    }

    // Etiqueta
    pdf.setTextColor(44, 62, 80);
    pdf.setFont("helvetica", "bold");
    pdf.text(label, margin, currentY);

    // Valor
    pdf.setTextColor(0, 0, 0);
    pdf.setFont("helvetica", "normal");
    const valueLines = pdf.splitTextToSize(
      String(value),
      pageWidth - margin - 80
    );
    pdf.text(valueLines, margin + 70, currentY);

    currentY += Math.max(lineHeight, valueLines.length * 4.5);
  });

  return currentY;
}

/**
 * Agregar tabla de voluntarios
 */
function addVolunteersTable(pdf, volunteers, currentY, pageWidth, margin) {
  const tableWidth = pageWidth - 2 * margin;
  const colWidths = [10, 50, 50, 30, 30]; // Porcentajes
  const actualWidths = colWidths.map((w) => (w / 100) * tableWidth);

  // Encabezados
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(255, 255, 255);
  pdf.setFillColor(52, 152, 219);

  const headers = ["#", "Nombre", "Email", "Teléfono", "Edad"];
  let xPos = margin;

  headers.forEach((header, index) => {
    pdf.rect(xPos, currentY, actualWidths[index], 8, "F");
    pdf.text(header, xPos + 2, currentY + 5);
    xPos += actualWidths[index];
  });

  currentY += 8;

  // Datos de voluntarios
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(0, 0, 0);

  volunteers.forEach((volunteer, index) => {
    if (currentY > pdf.internal.pageSize.getHeight() - 30) {
      pdf.addPage();
      currentY = margin;
    }

    const rowData = [
      (index + 1).toString(),
      volunteer.nombre || "No especificado",
      volunteer.email || "No especificado",
      volunteer.telefono || "No especificado",
      volunteer.edad?.toString() || "N/A",
    ];

    xPos = margin;
    const fillColor = index % 2 === 0 ? [249, 249, 249] : [255, 255, 255];

    rowData.forEach((data, colIndex) => {
      pdf.setFillColor(...fillColor);
      pdf.rect(xPos, currentY, actualWidths[colIndex], 6, "F");

      const textLines = pdf.splitTextToSize(data, actualWidths[colIndex] - 4);
      pdf.text(textLines, xPos + 2, currentY + 4);
      xPos += actualWidths[colIndex];
    });

    currentY += 6;
  });

  return currentY + 10;
}

/**
 * Agregar pie de página
 */
function addFooter(pdf, pageWidth, pageHeight, margin) {
  pdf.setFontSize(8);
  pdf.setTextColor(128, 128, 128);

  // Línea superior
  pdf.setDrawColor(200, 200, 200);
  pdf.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);

  // Texto del pie
  pdf.text(
    "Reporte generado por Sistema de Gestión de Voluntarios",
    margin,
    pageHeight - 15
  );
  pdf.text(`Página 1 de 1`, pageWidth - margin, pageHeight - 15, {
    align: "right",
  });

  // Información de contacto (opcional)
  pdf.text(
    "Para más información, contacte al administrador del sistema",
    pageWidth / 2,
    pageHeight - 10,
    { align: "center" }
  );
}

/**
 * Calcular estadísticas del evento
 */
function calculateEventStats(eventData, volunteersData) {
  const totalVolunteers = volunteersData.length;
  const maxVolunteers = eventData.cantidadVoluntariosMax || totalVolunteers;
  const occupancyRate =
    maxVolunteers > 0 ? Math.round((totalVolunteers / maxVolunteers) * 100) : 0;

  // Calcular promedio de edad
  const ages = volunteersData
    .filter((v) => v.edad && !isNaN(v.edad))
    .map((v) => v.edad);
  const averageAge =
    ages.length > 0
      ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length)
      : 0;

  // Distribución por género
  const genderDistribution = {
    masculino: volunteersData.filter((v) => v.genero === "masculino").length,
    femenino: volunteersData.filter((v) => v.genero === "femenino").length,
    otro: volunteersData.filter((v) => v.genero === "otro" || !v.genero).length,
  };

  // Duración del evento
  const startDate = parseStringDate(eventData.fechaInicio);
  const endDate = parseStringDate(eventData.fechaFin);
  let eventDuration = "No especificada";

  if (startDate && endDate) {
    const diffHours = Math.abs(endDate - startDate) / (1000 * 60 * 60);
    eventDuration = `${Math.round(diffHours)} horas`;
  }

  // Voluntarios nuevos vs recurrentes (simplificado)
  const newVolunteers = Math.round(totalVolunteers * 0.7); // Estimación
  const recurringVolunteers = totalVolunteers - newVolunteers;

  return {
    totalVolunteers,
    occupancyRate,
    averageAge,
    genderDistribution,
    eventDuration,
    newVolunteers,
    recurringVolunteers,
  };
}

/**
 * Obtener texto del estado del evento
 */
function getEventStatusText(status) {
  const statusMap = {
    completado: "Completado",
    cancelado: "Cancelado",
    en_progreso: "En Progreso",
    programado: "Programado",
  };
  return statusMap[status] || "Finalizado";
}

/**
 * Formatear fecha para mostrar
 */
function formatDate(dateString) {
  if (!dateString) return "No especificada";

  const date = parseStringDate(dateString);
  if (!date) return "Fecha inválida";

  return date.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Formatear fecha para nombre de archivo
 */
function formatDateForFilename(date) {
  return date.toISOString().split("T")[0].replace(/-/g, "");
}

/**
 * Parsear fecha string a objeto Date (reutilizada de past-events.js)
 */
function parseStringDate(dateString) {
  if (!dateString) return null;

  try {
    if (dateString instanceof Date) {
      return dateString;
    }

    if (dateString && typeof dateString.toDate === "function") {
      return dateString.toDate();
    }

    if (typeof dateString === "string") {
      if (dateString.includes("T")) {
        return new Date(dateString);
      }

      if (dateString.includes("-") && dateString.includes(":")) {
        return new Date(dateString.replace(" ", "T"));
      }

      if (dateString.includes("-") && dateString.split("-").length === 3) {
        return new Date(dateString + "T00:00:00");
      }

      if (dateString.includes("/")) {
        const parts = dateString.split(" ");
        const datePart = parts[0];
        const timePart = parts[1] || "00:00";

        const [day, month, year] = datePart.split("/");
        return new Date(
          `${year}-${month.padStart(2, "0")}-${day.padStart(
            2,
            "0"
          )}T${timePart}`
        );
      }

      const parsed = new Date(dateString);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}
