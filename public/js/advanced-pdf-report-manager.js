// advanced-pdf-report-manager.js
// Sistema Avanzado de Generación de PDFs para EcoVoluntarios

class AdvancedPDFReportManager {
  static colors = {
    primary: "#FF6B35",
    secondary: "#4A90E2",
    success: "#28A745",
    warning: "#FFC107",
    danger: "#DC3545",
    dark: "#2C3E50",
    light: "#F8F9FA",
    text: "#333333",
    textMuted: "#6C757D",
  };

  static margins = {
    top: 20,
    left: 20,
    right: 20,
    bottom: 20,
  };

  static fonts = {
    title: 18,
    subtitle: 14,
    normal: 10,
    small: 8,
    large: 12,
  };

  // =================== MÉTODO PRINCIPAL ===================
  static async generateReport(reportData) {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF("p", "mm", "a4");

      // Configurar documento
      this.setupDocument(doc);

      // Generar contenido según tipo
      switch (reportData.type) {
        case "general":
          await this.generateGeneralReport(doc, reportData);
          break;
        case "events": // ✅ AGREGAR ESTA LÍNEA
        case "eventos":
          await this.generateEventsReport(doc, reportData);
          break;
        case "donations": // ✅ AGREGAR ESTA LÍNEA
        case "donaciones":
          await this.generateDonationsReport(doc, reportData);
          break;
        case "volunteers": // ✅ AGREGAR ESTA LÍNEA
        case "voluntarios":
          await this.generateVolunteersReport(doc, reportData);
          break;
        default:
          throw new Error(`Tipo de reporte no válido: ${reportData.type}`);
      }

      // Descargar PDF
      const fileName = this.generateFileName(reportData);
      doc.save(fileName);

      // Mostrar notificación de éxito
      if (typeof window.showNotification === "function") {
        window.showNotification("Reporte PDF generado exitosamente", "success");
      }

      return true;
    } catch (error) {
      console.error("Error al generar PDF:", error);
      if (typeof window.showNotification === "function") {
        window.showNotification(
          "Error al generar PDF: " + error.message,
          "error"
        );
      }
      throw error;
    }
  }

  // =================== CONFIGURACIÓN DEL DOCUMENTO ===================
  static setupDocument(doc) {
    // Configurar metadatos
    doc.setProperties({
      title: "Reporte EcoVoluntarios",
      subject: "Sistema de Gestión de Voluntariado Ambiental",
      author: "EcoVoluntarios Sistema",
      creator: "EcoVoluntarios PDF Manager",
      keywords: "voluntariado, medio ambiente, reporte, donaciones, eventos",
    });
  }

  // =================== REPORTE GENERAL ===================
  static async generateGeneralReport(doc, reportData) {
    const data = reportData.data;
    let yPos = this.margins.top;

    // Header
    yPos = this.addHeader(doc, "REPORTE GENERAL DEL SISTEMA", yPos);
    yPos = this.addSubHeader(
      doc,
      "Resumen Completo de Actividades EcoVoluntarios",
      yPos
    );

    // Información del reporte
    yPos = this.addReportInfo(doc, reportData, yPos);
    yPos += 10;

    // Resumen ejecutivo
    yPos = this.addSectionTitle(doc, "RESUMEN EJECUTIVO", yPos);
    yPos = this.addExecutiveSummary(doc, data.summary, yPos);
    yPos += 5;

    // Estadísticas por módulos
    yPos = this.addSectionTitle(doc, "ESTADÍSTICAS POR MÓDULOS", yPos);
    yPos = this.addModuleStats(doc, data, yPos);

    // Nueva página para detalles
    if (yPos > 220) {
      doc.addPage();
      yPos = this.margins.top;
    }

    // Eventos destacados
    yPos = this.addSectionTitle(doc, "EVENTOS DESTACADOS", yPos);
    yPos = this.addFeaturedEvents(doc, data.events, yPos);

    // Top donaciones
    if (yPos > 200) {
      doc.addPage();
      yPos = this.margins.top;
    }
    yPos = this.addSectionTitle(doc, "DONACIONES DESTACADAS", yPos);
    yPos = this.addTopDonations(doc, data.donations, yPos);

    // Voluntarios más activos
    if (yPos > 200) {
      doc.addPage();
      yPos = this.margins.top;
    }
    yPos = this.addSectionTitle(doc, "VOLUNTARIOS MÁS ACTIVOS", yPos);
    yPos = this.addTopVolunteers(doc, data.users, data.events, yPos);

    // Recomendaciones
    if (reportData.config.includeRecommendations) {
      if (yPos > 200) {
        doc.addPage();
        yPos = this.margins.top;
      }
      yPos = this.addSectionTitle(doc, "RECOMENDACIONES", yPos);
      yPos = this.addRecommendations(doc, data, yPos);
    }

    // Footer en todas las páginas
    this.addPageNumbers(doc);
  }

  // =================== REPORTE DE EVENTOS ===================
  static async generateEventsReport(doc, reportData) {
    const data = reportData.data;
    let yPos = this.margins.top;

    // Header
    yPos = this.addHeader(doc, "REPORTE DE EVENTOS", yPos);
    yPos = this.addSubHeader(
      doc,
      "Análisis Detallado de Actividades y Participación",
      yPos
    );

    // Información del reporte
    yPos = this.addReportInfo(doc, reportData, yPos);
    yPos += 10;

    // Estadísticas generales
    yPos = this.addSectionTitle(doc, "ESTADÍSTICAS GENERALES", yPos);
    yPos = this.addEventStats(doc, data.statistics, yPos);
    yPos += 5;

    // Gráfico de eventos por tipo (si hay espacio)
    if (yPos < 180) {
      yPos = this.addEventsChart(doc, data.statistics, yPos);
    }

    // Nueva página para lista de eventos
    doc.addPage();
    yPos = this.margins.top;

    // Lista detallada de eventos
    yPos = this.addSectionTitle(doc, "EVENTOS DETALLADOS", yPos);
    yPos = this.addEventsTable(doc, data.events, yPos);

    // Análisis de participación
    if (yPos > 200) {
      doc.addPage();
      yPos = this.margins.top;
    }
    yPos = this.addSectionTitle(doc, "ANÁLISIS DE PARTICIPACIÓN", yPos);
    yPos = this.addParticipationAnalysis(doc, data.events, yPos);

    this.addPageNumbers(doc);
  }

  // =================== REPORTE DE DONACIONES ===================
  static async generateDonationsReport(doc, reportData) {
    const data = reportData.data;
    let yPos = this.margins.top;

    // Header
    yPos = this.addHeader(doc, "REPORTE DE DONACIONES", yPos);
    yPos = this.addSubHeader(
      doc,
      "Análisis Financiero y Gestión de Donaciones",
      yPos
    );

    // Información del reporte
    yPos = this.addReportInfo(doc, reportData, yPos);
    yPos += 10;

    // Resumen financiero
    yPos = this.addSectionTitle(doc, "RESUMEN FINANCIERO", yPos);
    yPos = this.addFinancialSummary(doc, data.statistics, yPos);
    yPos += 5;

    // Distribución por tipo de donante
    yPos = this.addSectionTitle(doc, "DISTRIBUCIÓN POR TIPO DE DONANTE", yPos);
    yPos = this.addDonorTypeDistribution(doc, data.statistics, yPos);

    // Nueva página para detalles
    if (yPos > 180) {
      doc.addPage();
      yPos = this.margins.top;
    }

    // Rendimiento de recolectores
    yPos = this.addSectionTitle(doc, "RENDIMIENTO DE RECOLECTORES", yPos);
    yPos = this.addCollectorPerformance(doc, data.statistics, yPos);

    // Lista de donaciones
    if (yPos > 150) {
      doc.addPage();
      yPos = this.margins.top;
    }
    yPos = this.addSectionTitle(doc, "REGISTRO DE DONACIONES", yPos);
    yPos = this.addDonationsTable(doc, data.donations, yPos);

    this.addPageNumbers(doc);
  }

  // =================== REPORTE DE VOLUNTARIOS ===================
  static async generateVolunteersReport(doc, reportData) {
    const data = reportData.data;
    let yPos = this.margins.top;

    // Header
    yPos = this.addHeader(doc, "REPORTE DE VOLUNTARIOS", yPos);
    yPos = this.addSubHeader(
      doc,
      "Análisis de Participación y Demografía",
      yPos
    );

    // Información del reporte
    yPos = this.addReportInfo(doc, reportData, yPos);
    yPos += 10;

    // Estadísticas generales
    yPos = this.addSectionTitle(doc, "ESTADÍSTICAS GENERALES", yPos);
    yPos = this.addVolunteerStats(doc, data.statistics, yPos);
    yPos += 5;

    // Distribución académica
    yPos = this.addSectionTitle(doc, "DISTRIBUCIÓN ACADÉMICA", yPos);
    yPos = this.addAcademicDistribution(doc, data.statistics, yPos);

    // Nueva página para más detalles
    if (yPos > 180) {
      doc.addPage();
      yPos = this.margins.top;
    }

    // Voluntarios destacados
    yPos = this.addSectionTitle(doc, "VOLUNTARIOS DESTACADOS", yPos);
    yPos = this.addTopVolunteersTable(
      doc,
      data.statistics.mostActiveUsers,
      yPos
    );

    // Lista completa de voluntarios
    if (yPos > 150) {
      doc.addPage();
      yPos = this.margins.top;
    }
    yPos = this.addSectionTitle(doc, "REGISTRO DE VOLUNTARIOS", yPos);
    yPos = this.addVolunteersTable(doc, data.volunteers, yPos);

    this.addPageNumbers(doc);
  }

  // =================== COMPONENTES COMUNES ===================
  static addHeader(doc, title, yPos) {
    // Logo y título principal
    const primaryRgb = this.hexToRgb(this.colors.primary);
    doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.rect(this.margins.left, yPos, 170, 25, "F");

    // Título
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(this.fonts.title);
    doc.setFont("helvetica", "bold");
    doc.text(title, this.margins.left + 5, yPos + 10);

    // Subtítulo EcoVoluntarios
    doc.setFontSize(this.fonts.normal);
    doc.setFont("helvetica", "normal");
    doc.text(
      "Sistema de Gestión de Voluntariado Ambiental",
      this.margins.left + 5,
      yPos + 20
    );

    return yPos + 30;
  }

  static addSubHeader(doc, subtitle, yPos) {
    const textRgb = this.hexToRgb(this.colors.text);
    doc.setTextColor(textRgb[0], textRgb[1], textRgb[2]);
    doc.setFontSize(this.fonts.subtitle);
    doc.setFont("helvetica", "bold");
    doc.text(subtitle, this.margins.left, yPos);
    return yPos + 10;
  }

  static addReportInfo(doc, reportData, yPos) {
    const info = [
      `Periodo: ${this.formatDateRange(reportData.data.dateRange)}`,
      `Fecha de generación: ${new Date().toLocaleDateString("es-PE")}`,
      `Generado por: ${reportData.generatedBy}`,
      `Tipo de reporte: ${this.getReportTypeName(reportData.type)}`,
    ];

    doc.setFontSize(this.fonts.small);
    doc.setFont("helvetica", "normal");
    const mutedRgb = this.hexToRgb(this.colors.textMuted);
    doc.setTextColor(mutedRgb[0], mutedRgb[1], mutedRgb[2]);

    info.forEach((line, index) => {
      doc.text(line, this.margins.left, yPos + index * 4);
    });

    return yPos + info.length * 4 + 5;
  }

  static addSectionTitle(doc, title, yPos) {
    const lightRgb = this.hexToRgb(this.colors.light);
    doc.setFillColor(lightRgb[0], lightRgb[1], lightRgb[2]);
    doc.rect(this.margins.left, yPos - 2, 170, 8, "F");

    const primaryRgb = this.hexToRgb(this.colors.primary);
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.setFontSize(this.fonts.large);
    doc.setFont("helvetica", "bold");
    doc.text(title, this.margins.left + 2, yPos + 4);

    return yPos + 12;
  }

  // =================== COMPONENTES ESPECÍFICOS ===================
  // =================== REEMPLAZAR COMPLETAMENTE EL MÉTODO addTable ===================
  // Busca el método addTable en la línea ~710 y reemplázalo COMPLETAMENTE con esto:

  static addTable(doc, data, yPos, colors = {}) {
    try {
      // Verificar si autoTable está disponible
      if (typeof doc.autoTable !== "function") {
        return this.addBasicTable(doc, data, yPos, colors);
      }

      // ✅ COLORES SEGUROS PARA AUTOTABLE - Solo usar arrays RGB numéricos
      let headFillColor = [255, 107, 53]; // Equivalente a #FF6B35 (primary)
      let headTextColor = [255, 255, 255]; // Blanco
      let bodyFillColor = [255, 255, 255]; // Blanco
      let alternateRowColor = [248, 249, 250]; // Equivalente a #F8F9FA (light)

      // Procesar colores de entrada de forma segura
      if (colors.head) {
        if (Array.isArray(colors.head) && colors.head.length === 2) {
          // Formato [fillColor, textColor]
          headFillColor = this.ensureRgbArray(colors.head[0]);
          headTextColor = this.ensureRgbArray(colors.head[1]);
        } else if (typeof colors.head === "string") {
          // Es un color hex string
          headFillColor = this.hexToRgb(colors.head);
        } else if (Array.isArray(colors.head) && colors.head.length === 3) {
          // Es un array RGB directo
          headFillColor = this.ensureRgbArray(colors.head);
        }
      }

      if (colors.body) {
        bodyFillColor = this.ensureRgbArray(colors.body);
      }

      if (colors.alternateRow) {
        alternateRowColor = this.ensureRgbArray(colors.alternateRow);
      }

      // Configuración de autoTable con colores seguros
      const tableConfig = {
        head: [data[0]],
        body: data.slice(1),
        startY: yPos,
        margin: {
          left: this.margins.left,
          right: this.margins.right,
        },
        styles: {
          fontSize: this.fonts.small,
          cellPadding: 2,
          lineColor: [200, 200, 200], // ✅ RGB directo
          lineWidth: 0.5,
          textColor: [50, 50, 50], // ✅ RGB directo
        },
        headStyles: {
          fillColor: headFillColor, // ✅ Array RGB validado
          textColor: headTextColor, // ✅ Array RGB validado
          fontStyle: "bold",
          halign: "center",
        },
        bodyStyles: {
          fillColor: bodyFillColor, // ✅ Array RGB validado
          textColor: [50, 50, 50], // ✅ RGB directo
        },
        alternateRowStyles: {
          fillColor: alternateRowColor, // ✅ Array RGB validado
        },
        columnStyles: {
          0: { cellWidth: "auto" },
        },
      };

      // Ejecutar autoTable
      doc.autoTable(tableConfig);

      return doc.lastAutoTable.finalY + 10;
    } catch (error) {
      // Fallback a tabla básica
      return this.addBasicTable(doc, data, yPos, colors);
    }
  }

  // =================== AGREGAR ESTE NUEVO MÉTODO DE AYUDA ===================
  // Agregar después del método addTable:

  static ensureRgbArray(color) {
    // Si ya es un array RGB válido, devolverlo
    if (Array.isArray(color) && color.length === 3) {
      const rgb = color.map((c) => {
        const num = parseInt(c);
        return isNaN(num) ? 0 : Math.max(0, Math.min(255, num));
      });
      return rgb;
    }

    // Si es un string hex, convertirlo
    if (typeof color === "string") {
      return this.hexToRgb(color);
    }

    // Si es un número, tratarlo como gris
    if (typeof color === "number") {
      const val = Math.max(0, Math.min(255, Math.floor(color)));
      return [val, val, val];
    }

    // Fallback a negro
    return [0, 0, 0];
  }

  // =================== TAMBIÉN CORREGIR LOS MÉTODOS QUE LLAMAN A addTable ===================

  // 1. Corregir addExecutiveSummary (línea ~414)
  static addExecutiveSummary(doc, summary, yPos) {
    const summaryData = [
      ["Métrica", "Valor", "Descripción"],
      [
        "Total de Eventos",
        summary.totalEvents?.toString() || "0",
        "Eventos programados en el periodo",
      ],
      [
        "Eventos Completados",
        summary.completedEvents?.toString() || "0",
        "Eventos finalizados exitosamente",
      ],
      [
        "Total de Voluntarios",
        summary.totalVolunteers?.toString() || "0",
        "Voluntarios registrados",
      ],
      [
        "Voluntarios Activos",
        summary.activeVolunteers?.toString() || "0",
        "Voluntarios con participación reciente",
      ],
      [
        "Total de Donaciones",
        summary.totalDonations?.toString() || "0",
        "Donaciones recibidas",
      ],
      [
        "Monto Total",
        `S/ ${(summary.totalAmount || 0).toFixed(2)}`,
        "Suma total de donaciones",
      ],
      [
        "Promedio por Donación",
        `S/ ${(summary.averageDonation || 0).toFixed(2)}`,
        "Monto promedio por donación",
      ],
    ];

    // ✅ USAR COLORES RGB DIRECTOS
    return this.addTable(doc, summaryData, yPos, {
      head: [
        [255, 107, 53],
        [255, 255, 255],
      ], // [fillColor, textColor]
      body: [255, 255, 255],
      alternateRow: [248, 249, 250],
    });
  }

  static addFinancialSummary(doc, stats, yPos) {
    const financialData = [
      ["Métrica Financiera", "Cantidad", "Monto (S/)", "Porcentaje"],
      [
        "Donaciones Totales",
        stats.total?.toString() || "0",
        (stats.totalAmount || 0).toFixed(2),
        "100%",
      ],
      [
        "Donaciones Validadas",
        stats.validatedCount?.toString() || "0",
        (stats.validatedAmount || 0).toFixed(2),
        `${((stats.validatedCount / stats.total) * 100 || 0).toFixed(1)}%`,
      ],
      [
        "Donaciones Pendientes",
        stats.pendingCount?.toString() || "0",
        (stats.pendingAmount || 0).toFixed(2),
        `${((stats.pendingCount / stats.total) * 100 || 0).toFixed(1)}%`,
      ],
      [
        "Promedio por Donación",
        "-",
        (stats.averageAmount || 0).toFixed(2),
        "-",
      ],
    ];

    return this.addTable(doc, financialData, yPos, {
      head: [this.colors.success, 255, 255, 255],
      body: [255, 255, 255],
      alternateRow: [this.hexToRgb(this.colors.light)],
    });
  }

  static addEventsTable(doc, events, yPos) {
    if (!events || events.length === 0) {
      doc.setFontSize(this.fonts.normal);
      const mutedRgb = this.hexToRgb(this.colors.textMuted);
      doc.setTextColor(mutedRgb[0], mutedRgb[1], mutedRgb[2]);
      doc.text(
        "No hay eventos para mostrar en el periodo seleccionado.",
        this.margins.left,
        yPos
      );
      return yPos + 10;
    }

    const eventsData = [
      [
        "Título",
        "Tipo",
        "Estado",
        "Fecha Inicio",
        "Participantes",
        "Capacidad",
      ],
    ];

    events.slice(0, 15).forEach((event) => {
      eventsData.push([
        this.truncateText(event.titulo || "Sin título", 25),
        this.truncateText(event.tipo || "Sin tipo", 15),
        this.getEventStatusText(event.estado),
        this.formatDate(event.fechaInicio),
        `${event.enrolledCount || 0}`,
        `${event.cantidadVoluntariosMax || 0}`,
      ]);
    });

    return this.addTable(doc, eventsData, yPos, {
      head: [this.hexToRgb(this.colors.secondary), [255, 255, 255]],
      body: [255, 255, 255],
      alternateRow: this.hexToRgb(this.colors.light),
    });
  }

  static addDonationsTable(doc, donations, yPos) {
    if (!donations || donations.length === 0) {
      doc.setFontSize(this.fonts.normal);
      const mutedRgb = this.hexToRgb(this.colors.textMuted);
      doc.setTextColor(mutedRgb[0], mutedRgb[1], mutedRgb[2]);
      doc.text(
        "No hay donaciones para mostrar en el periodo seleccionado.",
        this.margins.left,
        yPos
      );
      return yPos + 10;
    }

    const donationsData = [
      ["Donante", "Tipo", "Monto (S/)", "Fecha", "Estado", "Recolector"],
    ];

    donations.slice(0, 20).forEach((donation) => {
      const donorName =
        donation.donorName ||
        (donation.NombreUsuarioDonador
          ? `${donation.NombreUsuarioDonador} ${donation.ApellidoUsuarioDonador}`
          : donation.RazonSocialUsuarioDonador || "Sin nombre");

      const recolectorName = donation.recolectorInfo
        ? `${donation.recolectorInfo.nombreUsuario} ${donation.recolectorInfo.apellidoUsuario}`
        : "Sin asignar";

      donationsData.push([
        this.truncateText(donorName, 20),
        donation.Tipo_Usuario === "PERSONA NATURAL" ? "Natural" : "Empresa",
        (parseFloat(donation.monto) || 0).toFixed(2),
        this.formatDate(donation.fechaDonacion),
        donation.estadoValidacion ? "Validada" : "Pendiente",
        this.truncateText(recolectorName, 15),
      ]);
    });

    return this.addTable(doc, donationsData, yPos, {
      head: [this.hexToRgb(this.colors.warning), [0, 0, 0]],
      body: [255, 255, 255],
      alternateRow: this.hexToRgb(this.colors.light),
    });
  }

  static addVolunteersTable(doc, volunteers, yPos) {
    if (!volunteers || volunteers.length === 0) {
      doc.setFontSize(this.fonts.normal);
      this.safeSetColor(doc, "setTextColor", this.colors.textMuted);
      doc.text("No hay voluntarios para mostrar.", this.margins.left, yPos);
      return yPos + 10;
    }

    const volunteersData = [
      ["Nombre", "Escuela", "Ciclo", "Estado", "Eventos", "Rol"],
    ];

    volunteers.slice(0, 25).forEach((volunteer) => {
      const fullName = `${volunteer.nombreUsuario || ""} ${
        volunteer.apellidoUsuario || ""
      }`.trim();
      const escuelaNombre = this.getEscuelaName(volunteer.escuelaID);
      const rolText =
        volunteer.idRol === "rol_004" ? "Recolector" : "Voluntario";

      volunteersData.push([
        this.truncateText(fullName || "Sin nombre", 25),
        this.truncateText(escuelaNombre, 20),
        volunteer.ciclo?.toString() || "-",
        volunteer.estadoActivo ? "Activo" : "Inactivo",
        (volunteer.participatedEvents || 0).toString(),
        rolText,
      ]);
    });

    return this.addTable(doc, volunteersData, yPos, {
      head: [this.colors.primary, 255, 255, 255],
      body: [255, 255, 255],
      alternateRow: [this.hexToRgb(this.colors.light)],
    });
  }

  // =================== COMPONENTES DE ANÁLISIS ===================
  static addModuleStats(doc, data, yPos) {
    const moduleData = [
      ["Módulo", "Total", "Activos/Completados", "Promedio", "Estado"],
      [
        "Eventos",
        (data.events?.length || 0).toString(),
        (data.summary?.completedEvents || 0).toString(),
        data.statistics?.averageParticipation
          ? data.statistics.averageParticipation.toFixed(1)
          : "0",
        "Normal",
      ],
      [
        "Donaciones",
        (data.donations?.length || 0).toString(),
        (data.summary?.validatedDonations || 0).toString(),
        `S/ ${(data.summary?.averageDonation || 0).toFixed(2)}`,
        "Normal",
      ],
      [
        "Voluntarios",
        (data.users?.length || 0).toString(),
        (data.summary?.activeVolunteers || 0).toString(),
        "-",
        "Normal",
      ],
    ];

    // ✅ USAR COLORES RGB DIRECTOS
    return this.addTable(doc, moduleData, yPos, {
      head: [
        [44, 62, 80],
        [255, 255, 255],
      ], // dark color
      body: [255, 255, 255],
      alternateRow: [248, 249, 250],
    });
  }

  // 3. Corregir addTopDonations (línea ~1275)
  static addTopDonations(doc, donations, yPos) {
    if (!donations || donations.length === 0) {
      doc.setFontSize(this.fonts.normal);
      doc.setTextColor(108, 117, 125); // textMuted RGB
      doc.text(
        "No hay donaciones destacadas para mostrar.",
        this.margins.left,
        yPos
      );
      return yPos + 10;
    }

    // Obtener las donaciones más grandes
    const sortedDonations = donations
      .filter((donation) => parseFloat(donation.monto) > 0)
      .sort((a, b) => parseFloat(b.monto || 0) - parseFloat(a.monto || 0))
      .slice(0, 5);

    if (sortedDonations.length === 0) {
      doc.setFontSize(this.fonts.normal);
      doc.setTextColor(108, 117, 125);
      doc.text(
        "No hay donaciones válidas para destacar.",
        this.margins.left,
        yPos
      );
      return yPos + 10;
    }

    const topDonationsData = [
      ["Donante", "Tipo", "Monto (S/)", "Fecha", "Estado"],
    ];

    sortedDonations.forEach((donation) => {
      const donorName =
        donation.donorName ||
        (donation.NombreUsuarioDonador
          ? `${donation.NombreUsuarioDonador} ${donation.ApellidoUsuarioDonador}`
          : donation.RazonSocialUsuarioDonador || "Sin nombre");

      topDonationsData.push([
        this.truncateText(donorName, 25),
        donation.Tipo_Usuario === "PERSONA NATURAL" ? "Natural" : "Empresa",
        (parseFloat(donation.monto) || 0).toFixed(2),
        this.formatDate(donation.fechaDonacion),
        donation.estadoValidacion ? "Validada" : "Pendiente",
      ]);
    });

    // ✅ USAR COLORES RGB DIRECTOS
    return this.addTable(doc, topDonationsData, yPos, {
      head: [
        [255, 193, 7],
        [0, 0, 0],
      ], // warning color con texto negro
      body: [255, 255, 255],
      alternateRow: [248, 249, 250],
    });
  }

  static addCollectorPerformance(doc, stats, yPos) {
    if (!stats.byRecolector || Object.keys(stats.byRecolector).length === 0) {
      doc.setFontSize(this.fonts.normal);
      this.safeSetColor(doc, "setTextColor", this.colors.textMuted);
      doc.text(
        "No hay datos de recolectores disponibles.",
        this.margins.left,
        yPos
      );
      return yPos + 10;
    }

    const performanceData = [
      ["Recolector", "Donaciones", "Monto Total (S/)", "Promedio (S/)"],
    ];

    Object.entries(stats.byRecolector)
      .slice(0, 10)
      .forEach(([name, data]) => {
        performanceData.push([
          this.truncateText(name, 30),
          data.count?.toString() || "0",
          (data.amount || 0).toFixed(2),
          data.count > 0 ? (data.amount / data.count).toFixed(2) : "0.00",
        ]);
      });

    return this.addTable(doc, performanceData, yPos, {
      head: [this.colors.success, 255, 255, 255],
      body: [255, 255, 255],
      alternateRow: [this.hexToRgb(this.colors.light)],
    });
  }

  // =================== FUNCIÓN DE TABLA UNIVERSAL ===================
  static addTable(doc, data, yPos, colors = {}) {
    try {
      // Verificar si autoTable está disponible
      if (typeof doc.autoTable !== "function") {
        return this.addBasicTable(doc, data, yPos, colors);
      }

      // ✅ COLORES SEGUROS PARA AUTOTABLE - Solo usar arrays RGB numéricos
      let headFillColor = [255, 107, 53]; // Equivalente a #FF6B35 (primary)
      let headTextColor = [255, 255, 255]; // Blanco
      let bodyFillColor = [255, 255, 255]; // Blanco
      let alternateRowColor = [248, 249, 250]; // Equivalente a #F8F9FA (light)

      // Procesar colores de entrada de forma segura
      if (colors.head) {
        if (Array.isArray(colors.head) && colors.head.length === 2) {
          // Formato [fillColor, textColor]
          headFillColor = this.ensureRgbArray(colors.head[0]);
          headTextColor = this.ensureRgbArray(colors.head[1]);
        } else if (typeof colors.head === "string") {
          // Es un color hex string
          headFillColor = this.hexToRgb(colors.head);
        } else if (Array.isArray(colors.head) && colors.head.length === 3) {
          // Es un array RGB directo
          headFillColor = this.ensureRgbArray(colors.head);
        }
      }

      if (colors.body) {
        bodyFillColor = this.ensureRgbArray(colors.body);
      }

      if (colors.alternateRow) {
        alternateRowColor = this.ensureRgbArray(colors.alternateRow);
      }

      // Configuración de autoTable con colores seguros
      const tableConfig = {
        head: [data[0]],
        body: data.slice(1),
        startY: yPos,
        margin: {
          left: this.margins.left,
          right: this.margins.right,
        },
        styles: {
          fontSize: this.fonts.small,
          cellPadding: 2,
          lineColor: [200, 200, 200], // ✅ RGB directo
          lineWidth: 0.5,
          textColor: [50, 50, 50], // ✅ RGB directo
        },
        headStyles: {
          fillColor: headFillColor, // ✅ Array RGB validado
          textColor: headTextColor, // ✅ Array RGB validado
          fontStyle: "bold",
          halign: "center",
        },
        bodyStyles: {
          fillColor: bodyFillColor, // ✅ Array RGB validado
          textColor: [50, 50, 50], // ✅ RGB directo
        },
        alternateRowStyles: {
          fillColor: alternateRowColor, // ✅ Array RGB validado
        },
        columnStyles: {
          0: { cellWidth: "auto" },
        },
      };

      // Ejecutar autoTable
      doc.autoTable(tableConfig);

      return doc.lastAutoTable.finalY + 10;
    } catch (error) {
      // Fallback a tabla básica
      return this.addBasicTable(doc, data, yPos, colors);
    }
  }
  static ensureRgbArray(color) {
    // Si ya es un array RGB válido, devolverlo
    if (Array.isArray(color) && color.length === 3) {
      const rgb = color.map((c) => {
        const num = parseInt(c);
        return isNaN(num) ? 0 : Math.max(0, Math.min(255, num));
      });
      return rgb;
    }

    // Si es un string hex, convertirlo
    if (typeof color === "string") {
      return this.hexToRgb(color);
    }

    // Si es un número, tratarlo como gris
    if (typeof color === "number") {
      const val = Math.max(0, Math.min(255, Math.floor(color)));
      return [val, val, val];
    }

    // Fallback a negro
    return [250, 250, 250];
  }
  static validateRgbArray(color) {
    if (Array.isArray(color) && color.length === 3) {
      return color.map((c) => {
        const num = Number(c);
        return isNaN(num) ? 0 : Math.max(0, Math.min(255, Math.floor(num)));
      });
    } else if (typeof color === "string") {
      return this.hexToRgb(color);
    } else {
      return [0, 0, 0];
    }
  }
  // Tabla básica como fallback
  static addBasicTable(doc, data, yPos, colors = {}) {
    try {
      const rowHeight = 6;
      const colWidth = 170 / data[0].length;
      let currentY = yPos;

      // Header
      const primaryRgb = this.hexToRgb(this.colors.primary);
      doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
      doc.rect(this.margins.left, currentY, 170, rowHeight, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(this.fonts.small);
      doc.setFont("helvetica", "bold");

      data[0].forEach((header, index) => {
        doc.text(
          this.truncateText(header, 15),
          this.margins.left + index * colWidth + 2,
          currentY + 4
        );
      });

      currentY += rowHeight;

      // Body rows
      doc.setTextColor(50, 50, 50);
      doc.setFont("helvetica", "normal");

      data.slice(1).forEach((row, rowIndex) => {
        // Alternar color de fila
        if (rowIndex % 2 === 1) {
          doc.setFillColor(245, 245, 245);
          doc.rect(this.margins.left, currentY, 170, rowHeight, "F");
        }

        row.forEach((cell, colIndex) => {
          doc.text(
            this.truncateText(String(cell || ""), 15),
            this.margins.left + colIndex * colWidth + 2,
            currentY + 4
          );
        });

        currentY += rowHeight;
      });

      // Borde de la tabla
      doc.setDrawColor(200, 200, 200);
      doc.rect(this.margins.left, yPos, 170, currentY - yPos);

      return currentY + 10;
    } catch (error) {
      doc.setFontSize(this.fonts.normal);
      doc.setTextColor(100, 100, 100);
      doc.text("Error al mostrar tabla", this.margins.left, yPos);
      return yPos + 10;
    }
  }

  // =================== UTILIDADES ===================
  // ✅ MÉTODO CORREGIDO
  static hexToRgb(hex) {
    if (!hex || typeof hex !== "string") {
      return [0, 0, 0];
    }

    hex = hex.replace(/^#/, "");

    if (hex.length !== 6 || !/^[0-9A-Fa-f]{6}$/.test(hex)) {
      return [0, 0, 0];
    }

    const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) {
      return [0, 0, 0];
    }

    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);

    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      return [0, 0, 0];
    }

    return [r, g, b];
  }

  static safeSetColor(doc, colorMethod, color) {
    try {
      if (typeof color === "string") {
        const rgb = this.hexToRgb(color);
        doc[colorMethod](rgb[0], rgb[1], rgb[2]);
      } else if (Array.isArray(color) && color.length === 3) {
        const [r, g, b] = color.map((c) =>
          Math.max(0, Math.min(255, Math.floor(Number(c) || 0)))
        );
        doc[colorMethod](r, g, b);
      } else {
        doc[colorMethod](0, 0, 0);
      }
    } catch (error) {
      doc[colorMethod](0, 0, 0);
    }
  }

  static formatDate(dateString) {
    if (!dateString) return "Sin fecha";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("es-PE");
    } catch (error) {
      return "Fecha inválida";
    }
  }

  static formatDateRange(dateRange) {
    if (!dateRange || !dateRange.start || !dateRange.end)
      return "Periodo no especificado";
    return `${this.formatDate(dateRange.start)} - ${this.formatDate(
      dateRange.end
    )}`;
  }

  static truncateText(text, maxLength) {
    if (!text) return "";
    return text.length > maxLength
      ? text.substring(0, maxLength - 3) + "..."
      : text;
  }

  static getReportTypeName(type) {
    const types = {
      general: "Reporte General",
      eventos: "Reporte de Eventos",
      donaciones: "Reporte de Donaciones",
      voluntarios: "Reporte de Voluntarios",
    };
    return types[type] || "Reporte Personalizado";
  }

  static getEventStatusText(status) {
    const statuses = {
      programado: "Programado",
      en_progreso: "En Progreso",
      completado: "Completado",
      cancelado: "Cancelado",
    };
    return statuses[status] || "Sin estado";
  }

  static getEscuelaName(escuelaID) {
    const escuelas = {
      E001: "Ing. Informática",
      E002: "Ing. Electrónica",
      E003: "Ing. Mecatrónica",
      E004: "Ing. Telecomunicaciones",
    };
    return escuelas[escuelaID] || "Escuela no especificada";
  }

  static generateFileName(reportData) {
    const date = new Date().toISOString().split("T")[0];
    const type = reportData.type;
    return `EcoVoluntarios_${this.getReportTypeName(type).replace(
      /\s+/g,
      "_"
    )}_${date}.pdf`;
  }

  static addPageNumbers(doc) {
    const pageCount = doc.internal.getNumberOfPages();

    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);

      // Footer con número de página
      doc.setFontSize(this.fonts.small);
      const mutedRgb = this.hexToRgb(this.colors.textMuted);
      doc.setTextColor(mutedRgb[0], mutedRgb[1], mutedRgb[2]);
      doc.text(
        `Página ${i} de ${pageCount}`,
        doc.internal.pageSize.width - this.margins.right - 20,
        doc.internal.pageSize.height - this.margins.bottom + 5
      );

      // Línea de pie de página
      doc.setDrawColor(mutedRgb[0], mutedRgb[1], mutedRgb[2]);
      doc.line(
        this.margins.left,
        doc.internal.pageSize.height - this.margins.bottom,
        doc.internal.pageSize.width - this.margins.right,
        doc.internal.pageSize.height - this.margins.bottom
      );

      // Texto del pie
      doc.text(
        "EcoVoluntarios - Sistema de Gestión de Voluntariado Ambiental",
        this.margins.left,
        doc.internal.pageSize.height - this.margins.bottom + 5
      );
    }
  }

  // =================== FUNCIONES ADICIONALES DE ANÁLISIS ===================
  static addEventStats(doc, stats, yPos) {
    const eventStatsData = [
      ["Métrica", "Valor", "Descripción"],
      [
        "Total de Eventos",
        (stats.total || 0).toString(),
        "Eventos en el periodo",
      ],
      [
        "Eventos Completados",
        (stats.completedEvents || 0).toString(),
        "Eventos finalizados exitosamente",
      ],
      [
        "Eventos Próximos",
        (stats.upcomingEvents || 0).toString(),
        "Eventos programados",
      ],
      [
        "Total Participantes",
        (stats.totalParticipants || 0).toString(),
        "Participantes inscritos",
      ],
      [
        "Promedio Participación",
        (stats.averageParticipation || 0).toFixed(1),
        "Participantes por evento",
      ],
    ];

    return this.addTable(doc, eventStatsData, yPos, {
      head: [this.colors.secondary, 255, 255, 255],
      body: [255, 255, 255],
      alternateRow: [this.hexToRgb(this.colors.light)],
    });
  }

  static addVolunteerStats(doc, stats, yPos) {
    const volunteerStatsData = [
      ["Métrica", "Valor", "Descripción"],
      [
        "Total Voluntarios",
        (stats.total || 0).toString(),
        "Voluntarios registrados",
      ],
      [
        "Voluntarios Activos",
        (stats.active || 0).toString(),
        "Con participación reciente",
      ],
      [
        "Voluntarios Inactivos",
        (stats.inactive || 0).toString(),
        "Sin participación reciente",
      ],
      [
        "Recolectores",
        (stats.recolectores || 0).toString(),
        "Voluntarios recolectores",
      ],
      [
        "Promedio Participación",
        (stats.averageParticipation || 0).toFixed(1),
        "Eventos por voluntario",
      ],
    ];

    return this.addTable(doc, volunteerStatsData, yPos, {
      head: [this.colors.primary, 255, 255, 255],
      body: [255, 255, 255],
      alternateRow: [this.hexToRgb(this.colors.light)],
    });
  }

  static addAcademicDistribution(doc, stats, yPos) {
    // Distribución por facultad
    yPos = this.addSubSectionTitle(doc, "Por Facultad", yPos);

    const facultadData = [["Facultad", "Cantidad", "Porcentaje"]];
    let totalFacultad = 0;

    if (stats.byFacultad) {
      Object.entries(stats.byFacultad).forEach(([facultad, count]) => {
        totalFacultad += count;
      });

      Object.entries(stats.byFacultad).forEach(([facultad, count]) => {
        const percentage =
          totalFacultad > 0 ? ((count / totalFacultad) * 100).toFixed(1) : "0";
        facultadData.push([
          this.truncateText(facultad, 35),
          count.toString(),
          `${percentage}%`,
        ]);
      });
    }

    yPos = this.addTable(doc, facultadData, yPos, {
      head: [this.colors.secondary, 255, 255, 255],
      body: [255, 255, 255],
      alternateRow: [this.hexToRgb(this.colors.light)],
    });

    // Distribución por escuela
    yPos += 5;
    yPos = this.addSubSectionTitle(doc, "Por Escuela", yPos);

    const escuelaData = [["Escuela", "Cantidad", "Porcentaje"]];
    let totalEscuela = 0;

    if (stats.byEscuela) {
      Object.entries(stats.byEscuela).forEach(([escuela, count]) => {
        totalEscuela += count;
      });

      Object.entries(stats.byEscuela).forEach(([escuela, count]) => {
        const percentage =
          totalEscuela > 0 ? ((count / totalEscuela) * 100).toFixed(1) : "0";
        escuelaData.push([
          this.truncateText(escuela, 25),
          count.toString(),
          `${percentage}%`,
        ]);
      });
    }

    return this.addTable(doc, escuelaData, yPos, {
      head: [this.colors.warning, 0, 0, 0],
      body: [255, 255, 255],
      alternateRow: [this.hexToRgb(this.colors.light)],
    });
  }

  static addDonorTypeDistribution(doc, stats, yPos) {
    if (!stats.byUserType || Object.keys(stats.byUserType).length === 0) {
      doc.setFontSize(this.fonts.normal);
      this.safeSetColor(doc, "setTextColor", this.colors.textMuted);
      doc.text(
        "No hay datos de tipos de donante disponibles.",
        this.margins.left,
        yPos
      );
      return yPos + 10;
    }

    const donorTypeData = [
      [
        "Tipo de Donante",
        "Cantidad",
        "Monto Total (S/)",
        "Monto Promedio (S/)",
        "Porcentaje",
      ],
    ];

    let totalAmount = 0;
    let totalCount = 0;

    Object.values(stats.byUserType).forEach((data) => {
      totalAmount += data.amount || 0;
      totalCount += data.count || 0;
    });

    Object.entries(stats.byUserType).forEach(([type, data]) => {
      const percentage =
        totalCount > 0 ? ((data.count / totalCount) * 100).toFixed(1) : "0";
      const average =
        data.count > 0 ? (data.amount / data.count).toFixed(2) : "0.00";

      donorTypeData.push([
        type === "PERSONA NATURAL" ? "Persona Natural" : "Empresa",
        (data.count || 0).toString(),
        (data.amount || 0).toFixed(2),
        average,
        `${percentage}%`,
      ]);
    });

    return this.addTable(doc, donorTypeData, yPos, {
      head: [this.colors.warning, 0, 0, 0],
      body: [255, 255, 255],
      alternateRow: [this.hexToRgb(this.colors.light)],
    });
  }

  static addTopVolunteersTable(doc, topVolunteers, yPos) {
    if (!topVolunteers || topVolunteers.length === 0) {
      doc.setFontSize(this.fonts.normal);
      this.safeSetColor(doc, "setTextColor", this.colors.textMuted);
      doc.text(
        "No hay datos de voluntarios destacados.",
        this.margins.left,
        yPos
      );
      return yPos + 10;
    }

    const topVolunteersData = [
      ["Posición", "Nombre", "Escuela", "Eventos Participados", "Estado"],
    ];

    topVolunteers.slice(0, 10).forEach((volunteer, index) => {
      const fullName = `${volunteer.nombreUsuario || ""} ${
        volunteer.apellidoUsuario || ""
      }`.trim();
      const escuelaNombre = this.getEscuelaName(volunteer.escuelaID);

      topVolunteersData.push([
        `#${index + 1}`,
        this.truncateText(fullName || "Sin nombre", 25),
        this.truncateText(escuelaNombre, 20),
        (volunteer.participatedEvents || 0).toString(),
        volunteer.estadoActivo ? "Activo" : "Inactivo",
      ]);
    });

    return this.addTable(doc, topVolunteersData, yPos, {
      head: [this.colors.success, 255, 255, 255],
      body: [255, 255, 255],
      alternateRow: [this.hexToRgb(this.colors.light)],
    });
  }

  static addFeaturedEvents(doc, events, yPos) {
    if (!events || events.length === 0) {
      doc.setFontSize(this.fonts.normal);
      this.safeSetColor(doc, "setTextColor", this.colors.textMuted);
      doc.text(
        "No hay eventos destacados para mostrar.",
        this.margins.left,
        yPos
      );
      return yPos + 10;
    }

    // Obtener eventos con mayor participación
    const sortedEvents = events
      .filter((event) => event.enrolledCount > 0)
      .sort((a, b) => (b.enrolledCount || 0) - (a.enrolledCount || 0))
      .slice(0, 5);

    if (sortedEvents.length === 0) {
      doc.setFontSize(this.fonts.normal);
      this.safeSetColor(doc, "setTextColor", this.colors.textMuted);
      doc.text(
        "No hay eventos con participación para destacar.",
        this.margins.left,
        yPos
      );
      return yPos + 10;
    }

    const featuredEventsData = [
      ["Evento", "Tipo", "Participantes", "Capacidad", "Utilización (%)"],
    ];

    sortedEvents.forEach((event) => {
      const utilizacion =
        event.cantidadVoluntariosMax > 0
          ? (
              (event.enrolledCount / event.cantidadVoluntariosMax) *
              100
            ).toFixed(1)
          : "0";

      featuredEventsData.push([
        this.truncateText(event.titulo || "Sin título", 25),
        this.truncateText(event.tipo || "Sin tipo", 15),
        (event.enrolledCount || 0).toString(),
        (event.cantidadVoluntariosMax || 0).toString(),
        `${utilizacion}%`,
      ]);
    });

    return this.addTable(doc, featuredEventsData, yPos, {
      head: [this.colors.secondary, 255, 255, 255],
      body: [255, 255, 255],
      alternateRow: [this.hexToRgb(this.colors.light)],
    });
  }

  static addTopDonations(doc, donations, yPos) {
    if (!donations || donations.length === 0) {
      doc.setFontSize(this.fonts.normal);
      this.safeSetColor(doc, "setTextColor", this.colors.textMuted);
      doc.text(
        "No hay donaciones destacadas para mostrar.",
        this.margins.left,
        yPos
      );
      return yPos + 10;
    }

    // Obtener las donaciones más grandes
    const sortedDonations = donations
      .filter((donation) => parseFloat(donation.monto) > 0)
      .sort((a, b) => parseFloat(b.monto || 0) - parseFloat(a.monto || 0))
      .slice(0, 5);

    if (sortedDonations.length === 0) {
      doc.setFontSize(this.fonts.normal);
      this.safeSetColor(doc, "setTextColor", this.colors.textMuted);
      doc.text(
        "No hay donaciones válidas para destacar.",
        this.margins.left,
        yPos
      );
      return yPos + 10;
    }

    const topDonationsData = [
      ["Donante", "Tipo", "Monto (S/)", "Fecha", "Estado"],
    ];

    sortedDonations.forEach((donation) => {
      const donorName =
        donation.donorName ||
        (donation.NombreUsuarioDonador
          ? `${donation.NombreUsuarioDonador} ${donation.ApellidoUsuarioDonador}`
          : donation.RazonSocialUsuarioDonador || "Sin nombre");

      topDonationsData.push([
        this.truncateText(donorName, 25),
        donation.Tipo_Usuario === "PERSONA NATURAL" ? "Natural" : "Empresa",
        (parseFloat(donation.monto) || 0).toFixed(2),
        this.formatDate(donation.fechaDonacion),
        donation.estadoValidacion ? "Validada" : "Pendiente",
      ]);
    });

    return this.addTable(doc, topDonationsData, yPos, {
      head: [this.colors.warning, 0, 0, 0],
      body: [255, 255, 255],
      alternateRow: [this.hexToRgb(this.colors.light)],
    });
  }

  static addTopVolunteers(doc, users, events, yPos) {
    if (!users || users.length === 0) {
      doc.setFontSize(this.fonts.normal);
      this.safeSetColor(doc, "setTextColor", this.colors.textMuted);
      doc.text("No hay voluntarios para mostrar.", this.margins.left, yPos);
      return yPos + 10;
    }

    // Calcular participación en eventos para cada usuario
    const usersWithParticipation = users.map((user) => {
      const participatedEvents = events
        ? events.filter(
            (event) =>
              event.voluntariosInscritos &&
              event.voluntariosInscritos.includes(user.idUsuario)
          ).length
        : 0;

      return {
        ...user,
        participatedEvents,
      };
    });

    // Ordenar por participación
    const topVolunteers = usersWithParticipation
      .filter((user) => user.participatedEvents > 0)
      .sort((a, b) => b.participatedEvents - a.participatedEvents)
      .slice(0, 5);

    if (topVolunteers.length === 0) {
      doc.setFontSize(this.fonts.normal);
      this.safeSetColor(doc, "setTextColor", this.colors.textMuted);
      doc.text(
        "No hay voluntarios con participación para destacar.",
        this.margins.left,
        yPos
      );
      return yPos + 10;
    }

    const topVolunteersData = [
      ["Voluntario", "Escuela", "Eventos", "Rol", "Estado"],
    ];

    topVolunteers.forEach((volunteer) => {
      const fullName = `${volunteer.nombreUsuario || ""} ${
        volunteer.apellidoUsuario || ""
      }`.trim();
      const escuelaNombre = this.getEscuelaName(volunteer.escuelaID);
      const rolText =
        volunteer.idRol === "rol_004" ? "Recolector" : "Voluntario";

      topVolunteersData.push([
        this.truncateText(fullName || "Sin nombre", 25),
        this.truncateText(escuelaNombre, 20),
        volunteer.participatedEvents.toString(),
        rolText,
        volunteer.estadoActivo ? "Activo" : "Inactivo",
      ]);
    });

    return this.addTable(doc, topVolunteersData, yPos, {
      head: [this.colors.primary, 255, 255, 255],
      body: [255, 255, 255],
      alternateRow: [this.hexToRgb(this.colors.light)],
    });
  }

  static addParticipationAnalysis(doc, events, yPos) {
    if (!events || events.length === 0) {
      doc.setFontSize(this.fonts.normal);
      this.safeSetColor(doc, "setTextColor", this.colors.textMuted);
      doc.text(
        "No hay datos de eventos para análisis de participación.",
        this.margins.left,
        yPos
      );
      return yPos + 10;
    }

    // Análisis de utilización de capacidad
    const utilizationData = [
      ["Rango de Utilización", "Cantidad de Eventos", "Porcentaje"],
    ];

    const ranges = {
      "0-25%": 0,
      "26-50%": 0,
      "51-75%": 0,
      "76-100%": 0,
      Sobrecapacidad: 0,
    };

    events.forEach((event) => {
      const enrolled = event.enrolledCount || 0;
      const capacity = event.cantidadVoluntariosMax || 1;
      const utilization = (enrolled / capacity) * 100;

      if (utilization === 0) ranges["0-25%"]++;
      else if (utilization <= 25) ranges["0-25%"]++;
      else if (utilization <= 50) ranges["26-50%"]++;
      else if (utilization <= 75) ranges["51-75%"]++;
      else if (utilization <= 100) ranges["76-100%"]++;
      else ranges["Sobrecapacidad"]++;
    });

    const totalEvents = events.length;
    Object.entries(ranges).forEach(([range, count]) => {
      const percentage =
        totalEvents > 0 ? ((count / totalEvents) * 100).toFixed(1) : "0";
      utilizationData.push([range, count.toString(), `${percentage}%`]);
    });

    return this.addTable(doc, utilizationData, yPos, {
      head: [this.colors.secondary, 255, 255, 255],
      body: [255, 255, 255],
      alternateRow: [this.hexToRgb(this.colors.light)],
    });
  }

  static addRecommendations(doc, data, yPos) {
    const recommendations = this.generateRecommendations(data);

    doc.setFontSize(this.fonts.normal);
    const textRgb = this.hexToRgb(this.colors.text);
    doc.setTextColor(textRgb[0], textRgb[1], textRgb[2]);

    recommendations.forEach((recommendation, index) => {
      // Verificar si necesitamos nueva página
      if (yPos > 250) {
        doc.addPage();
        yPos = this.margins.top;
        yPos = this.addSectionTitle(
          doc,
          "RECOMENDACIONES (Continuación)",
          yPos
        );
      }

      // Título de la recomendación
      doc.setFont("helvetica", "bold");
      doc.text(
        `${index + 1}. ${recommendation.title}`,
        this.margins.left,
        yPos
      );
      yPos += 7;

      // Descripción
      doc.setFont("helvetica", "normal");
      const descriptionLines = doc.splitTextToSize(
        recommendation.description,
        170
      );
      doc.text(descriptionLines, this.margins.left + 5, yPos);
      yPos += descriptionLines.length * 5 + 5;
    });

    return yPos;
  }

  static generateRecommendations(data) {
    const recommendations = [];

    // Recomendaciones basadas en eventos
    if (data.events && data.summary) {
      const completionRate =
        data.summary.totalEvents > 0
          ? (data.summary.completedEvents / data.summary.totalEvents) * 100
          : 0;

      if (completionRate < 80) {
        recommendations.push({
          title: "Mejorar Tasa de Finalización de Eventos",
          description: `La tasa de finalización de eventos es del ${completionRate.toFixed(
            1
          )}%. Se recomienda implementar mejor seguimiento y recordatorios para voluntarios, así como mejorar la planificación de eventos.`,
        });
      }
    }

    // Recomendaciones basadas en donaciones
    if (data.donations && data.summary) {
      const validationRate =
        data.summary.totalDonations > 0
          ? (data.summary.validatedDonations / data.summary.totalDonations) *
            100
          : 0;

      if (validationRate < 90) {
        recommendations.push({
          title: "Agilizar Proceso de Validación de Donaciones",
          description: `Solo el ${validationRate.toFixed(
            1
          )}% de las donaciones están validadas. Se sugiere capacitar más recolectores y establecer procesos de validación más eficientes.`,
        });
      }
    }

    // Recomendaciones basadas en voluntarios
    if (data.users && data.summary) {
      const activeRate =
        data.summary.totalVolunteers > 0
          ? (data.summary.activeVolunteers / data.summary.totalVolunteers) * 100
          : 0;

      if (activeRate < 70) {
        recommendations.push({
          title: "Incrementar Participación de Voluntarios",
          description: `Solo el ${activeRate.toFixed(
            1
          )}% de los voluntarios están activos. Se recomienda implementar programas de reconocimiento, comunicación más frecuente y eventos más atractivos.`,
        });
      }
    }

    // Recomendación general si no hay datos suficientes
    if (recommendations.length === 0) {
      recommendations.push({
        title: "Continuar Monitoreando el Sistema",
        description:
          "Los indicadores actuales muestran un rendimiento estable. Se recomienda mantener el monitoreo regular y buscar oportunidades de mejora continua en todos los módulos del sistema.",
      });
    }

    return recommendations;
  }

  static addSubSectionTitle(doc, title, yPos) {
    const secondaryRgb = this.hexToRgb(this.colors.secondary);
    doc.setTextColor(secondaryRgb[0], secondaryRgb[1], secondaryRgb[2]);
    doc.setFontSize(this.fonts.normal);
    doc.setFont("helvetica", "bold");
    doc.text(title, this.margins.left, yPos);
    return yPos + 8;
  }

  static addEventsChart(doc, statistics, yPos) {
    // Crear un gráfico simple de texto para eventos por tipo
    if (!statistics.byType || Object.keys(statistics.byType).length === 0) {
      return yPos;
    }

    yPos = this.addSubSectionTitle(
      doc,
      "Distribución por Tipo de Evento",
      yPos
    );

    const chartData = [["Tipo de Evento", "Cantidad", "Porcentaje"]];
    const total = statistics.total || 1;

    Object.entries(statistics.byType).forEach(([type, count]) => {
      const percentage = ((count / total) * 100).toFixed(1);
      chartData.push([
        this.truncateText(type, 25),
        count.toString(),
        `${percentage}%`,
      ]);
    });

    return this.addTable(doc, chartData, yPos, {
      head: [this.colors.secondary, 255, 255, 255],
      body: [255, 255, 255],
      alternateRow: [this.hexToRgb(this.colors.light)],
    });
  }
}

// Hacer la clase disponible globalmente
window.AdvancedPDFReportManager = AdvancedPDFReportManager;

// Verificar dependencias al cargar
document.addEventListener("DOMContentLoaded", function () {
  // Verificar dependencias
  if (typeof window.jspdf === "undefined") {
  }

  // Verificar autoTable de manera más robusta
  setTimeout(() => {
    if (typeof window.jspdf !== "undefined") {
      const { jsPDF } = window.jspdf;
      const testDoc = new jsPDF();

      if (typeof testDoc.autoTable === "function") {
      } else {
      }
    }
  }, 100);
});

// Export para módulos ES6 si es necesario
if (typeof module !== "undefined" && module.exports) {
  module.exports = AdvancedPDFReportManager;
}
