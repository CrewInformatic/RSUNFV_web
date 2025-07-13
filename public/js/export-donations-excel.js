// donations_exceljs_exporter.js - VERSIÓN MEJORADA CON SOPORTE COMPLETO PARA EMPRESA Y PERSONA NATURAL
class DonationsExcelJSExporter {
  constructor() {
    this.ExcelJS = null;
    this.charts = {}; // Almacenar referencias a los gráficos del modal
    this.initializeLibrary();
  }

  async initializeLibrary() {
    try {
      // Cargar ExcelJS desde CDN
      await this.loadScript(
        "https://cdn.jsdelivr.net/npm/exceljs@4.3.0/dist/exceljs.min.js"
      );
      this.ExcelJS = window.ExcelJS;
      console.log("ExcelJS cargado correctamente");
    } catch (error) {
      console.error("Error cargando ExcelJS:", error);
      this.showError("Error al cargar la librería de exportación");
    }
  }

  loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // Método principal de exportación con gráficos
  async exportDonationsToExcel(
    donations,
    filename = "reporte_donaciones.xlsx"
  ) {
    if (!this.ExcelJS) {
      this.showError("La librería de exportación no está disponible");
      return;
    }

    try {
      // Crear workbook
      const workbook = new this.ExcelJS.Workbook();
      workbook.creator = "Sistema de Donaciones";
      workbook.created = new Date();

      // Agregar hojas
      this.addDashboardSheet(workbook, donations);
      this.addDonationsSheet(workbook, donations);
      this.addPersonasNaturalesSheet(workbook, donations);
      this.addEmpresasSheet(workbook, donations);
      this.addStatisticsSheet(workbook, donations);
      this.addChartsDataSheet(workbook, donations);

      // Generar y descargar el archivo
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);

      this.showSuccess(`Reporte exportado exitosamente: ${filename}`);
    } catch (error) {
      console.error("Error al exportar:", error);
      this.showError("Error al generar el reporte de Excel");
    }
  }

  // Dashboard principal mejorado
  addDashboardSheet(workbook, donations) {
    const worksheet = workbook.addWorksheet("Dashboard");
    const stats = this.calculateStatistics(donations);

    // Título principal
    worksheet.mergeCells("A1:H1");
    worksheet.getCell("A1").value = "DASHBOARD DE DONACIONES";
    worksheet.getCell("A1").font = {
      size: 16,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    worksheet.getCell("A1").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF366092" },
    };
    worksheet.getCell("A1").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    worksheet.getRow(1).height = 30;

    // Fecha de generación
    worksheet.getCell("A2").value = "Generado el:";
    worksheet.getCell("B2").value = new Date().toLocaleDateString("es-PE");

    // Resumen ejecutivo
    worksheet.getCell("A4").value = "RESUMEN EJECUTIVO";
    worksheet.getCell("A4").font = {
      size: 14,
      bold: true,
      color: { argb: "FF366092" },
    };

    // KPIs principales
    const kpis = [
      { label: "Total Donaciones:", value: stats.total, col: "A", row: 6 },
      {
        label: "Monto Total:",
        value: `S/ ${stats.totalAmount.toFixed(2)}`,
        col: "D",
        row: 6,
      },
      {
        label: "Donaciones Validadas:",
        value: stats.validated,
        col: "A",
        row: 7,
      },
      {
        label: "Monto Validado:",
        value: `S/ ${stats.validatedAmount.toFixed(2)}`,
        col: "D",
        row: 7,
      },
      {
        label: "Donaciones Pendientes:",
        value: stats.pending,
        col: "A",
        row: 8,
      },
      {
        label: "Monto Pendiente:",
        value: `S/ ${stats.pendingAmount.toFixed(2)}`,
        col: "D",
        row: 8,
      },
      {
        label: "Donaciones Rechazadas:",
        value: stats.rejected,
        col: "A",
        row: 9,
      },
      {
        label: "Monto Promedio:",
        value: `S/ ${stats.averageAmount.toFixed(2)}`,
        col: "D",
        row: 9,
      },
    ];

    kpis.forEach((kpi) => {
      worksheet.getCell(`${kpi.col}${kpi.row}`).value = kpi.label;
      worksheet.getCell(`${kpi.col}${kpi.row}`).font = { bold: true };
      const valueCol = String.fromCharCode(kpi.col.charCodeAt(0) + 1);
      worksheet.getCell(`${valueCol}${kpi.row}`).value = kpi.value;
    });

    // ANÁLISIS POR TIPO DE USUARIO
    const userTypeData = this.calculateUserTypeData(donations);

    worksheet.getCell("A12").value = "Análisis por Tipo de Usuario";
    worksheet.getCell("A12").font = { bold: true, size: 12 };

    worksheet.getCell("A13").value = "Tipo Usuario";
    worksheet.getCell("B13").value = "Cantidad";
    worksheet.getCell("C13").value = "Porcentaje";
    worksheet.getCell("D13").value = "Monto Total";
    worksheet.getCell("E13").value = "Monto Promedio";

    let row = 14;
    Object.entries(userTypeData).forEach(([type, data]) => {
      worksheet.getCell(`A${row}`).value = type;
      worksheet.getCell(`B${row}`).value = data.count;
      worksheet.getCell(`C${row}`).value = data.percentage / 100;
      worksheet.getCell(`C${row}`).numFmt = "0.0%";
      worksheet.getCell(`D${row}`).value = data.amount;
      worksheet.getCell(`D${row}`).numFmt = '"S/ "#,##0.00';
      worksheet.getCell(`E${row}`).value = data.average;
      worksheet.getCell(`E${row}`).numFmt = '"S/ "#,##0.00';
      row++;
    });

    // ANÁLISIS POR ESTADO
    const statusData = this.calculateStatusData(donations);

    worksheet.getCell("A18").value = "Análisis por Estado";
    worksheet.getCell("A18").font = { bold: true, size: 12 };

    worksheet.getCell("A19").value = "Estado";
    worksheet.getCell("B19").value = "Cantidad";
    worksheet.getCell("C19").value = "Porcentaje";
    worksheet.getCell("D19").value = "Monto";

    row = 20;
    Object.entries(statusData).forEach(([status, data]) => {
      worksheet.getCell(`A${row}`).value = status;
      worksheet.getCell(`B${row}`).value = data.count;
      worksheet.getCell(`C${row}`).value = data.percentage / 100;
      worksheet.getCell(`C${row}`).numFmt = "0.0%";
      worksheet.getCell(`D${row}`).value = data.amount;
      worksheet.getCell(`D${row}`).numFmt = '"S/ "#,##0.00';
      row++;
    });

    // EVOLUCIÓN MENSUAL
    const monthlyData = this.calculateMonthlyData(donations);

    worksheet.getCell("A25").value = "Evolución Mensual";
    worksheet.getCell("A25").font = { bold: true, size: 12 };

    worksheet.getCell("A26").value = "Mes";
    worksheet.getCell("B26").value = "Cantidad";
    worksheet.getCell("C26").value = "Monto";
    worksheet.getCell("D26").value = "Promedio";

    row = 27;
    const sortedMonths = Object.keys(monthlyData).sort().slice(-6); // Últimos 6 meses
    sortedMonths.forEach((month) => {
      const data = monthlyData[month];
      worksheet.getCell(`A${row}`).value = month;
      worksheet.getCell(`B${row}`).value = data.count;
      worksheet.getCell(`C${row}`).value = data.amount;
      worksheet.getCell(`C${row}`).numFmt = '"S/ "#,##0.00';
      worksheet.getCell(`D${row}`).value = data.average;
      worksheet.getCell(`D${row}`).numFmt = '"S/ "#,##0.00';
      row++;
    });

    // Configurar anchos de columna
    worksheet.columns = [
      { width: 25 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
    ];

    // Agregar bordes a las tablas
    this.addBordersToRange(worksheet, "A6:E9");
    this.addBordersToRange(worksheet, "A13:E16");
    this.addBordersToRange(worksheet, "A19:D22");
    this.addBordersToRange(worksheet, "A26:D32");
  }

  // Hoja de todas las donaciones con información completa
  addDonationsSheet(workbook, donations) {
    const worksheet = workbook.addWorksheet("Todas las Donaciones");

    // Headers
    const headers = [
      "ID Donación",
      "Tipo Usuario",
      "Nombre/Razón Social",
      "Documento",
      "Email",
      "Teléfono",
      "Cargo/Representante",
      "Monto (S/)",
      "Fecha",
      "Estado",
      "Recolector",
      "Email Recolector",
      "Facultad",
      "Método Pago",
      "Observaciones",
    ];

    // Agregar headers con estilo
    headers.forEach((header, index) => {
      const cell = worksheet.getCell(1, index + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF366092" },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });

    // Agregar datos
    donations.forEach((donation, rowIndex) => {
      const row = worksheet.getRow(rowIndex + 2);
      row.values = [
        donation.IDUsuarioDonador || donation.id || "N/A",
        donation.Tipo_Usuario || "N/A",
        this.getDonorName(donation),
        this.getDonorDocument(donation),
        donation.EmailUsuarioDonador || "N/A",
        donation.TelefonoUsuarioDonador || "N/A",
        this.getDonorPosition(donation),
        parseFloat(donation.monto || 0),
        this.formatDate(donation.fechaDonacion),
        this.getStatusText(donation.estadoValidacion),
        this.getCollectorName(donation),
        donation.emailRecolector || "N/A",
        donation.facultadRecolector || "N/A",
        donation.metodoPago || "N/A",
        donation.observaciones || donation.OpcionalUsuarioDonador || "N/A",
      ];

      // Formato para montos
      row.getCell(8).numFmt = '"S/ "#,##0.00';
    });

    // Configurar anchos de columna
    worksheet.columns = [
      { width: 25 }, // ID
      { width: 18 }, // Tipo
      { width: 35 }, // Nombre
      { width: 15 }, // Documento
      { width: 35 }, // Email
      { width: 15 }, // Teléfono
      { width: 25 }, // Cargo
      { width: 12 }, // Monto
      { width: 15 }, // Fecha
      { width: 15 }, // Estado
      { width: 25 }, // Recolector
      { width: 35 }, // Email Rec
      { width: 40 }, // Facultad
      { width: 15 }, // Método
      { width: 30 }, // Observaciones
    ];

    // Agregar autofiltro
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length },
    };
  }

  // Hoja específica para Personas Naturales
  addPersonasNaturalesSheet(workbook, donations) {
    const personasNaturales = donations.filter(
      (d) => d.Tipo_Usuario === "PERSONA NATURAL"
    );

    const worksheet = workbook.addWorksheet("Personas Naturales");

    // Headers específicos para personas naturales
    const headers = [
      "ID Donación",
      "Nombre Completo",
      "DNI",
      "Email",
      "Teléfono",
      "Monto (S/)",
      "Fecha Donación",
      "Estado Validación",
      "Recolector",
      "Email Recolector",
      "Facultad Recolector",
      "Método Pago",
      "Observaciones",
    ];

    // Agregar headers con estilo
    headers.forEach((header, index) => {
      const cell = worksheet.getCell(1, index + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF28a745" }, // Verde para personas naturales
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });

    // Agregar datos específicos de personas naturales
    personasNaturales.forEach((donation, rowIndex) => {
      const row = worksheet.getRow(rowIndex + 2);
      row.values = [
        donation.IDUsuarioDonador || "N/A",
        `${donation.NombreUsuarioDonador || ""} ${
          donation.ApellidoUsuarioDonador || ""
        }`.trim(),
        donation.DNIUsuarioDonador || "N/A",
        donation.EmailUsuarioDonador || "N/A",
        donation.TelefonoUsuarioDonador || "N/A",
        parseFloat(donation.monto || 0),
        this.formatDate(donation.fechaDonacion),
        this.getStatusText(donation.estadoValidacion),
        donation.nombreRecolector || this.getCollectorName(donation),
        donation.emailRecolector || "N/A",
        donation.facultadRecolector || "N/A",
        donation.metodoPago || "N/A",
        donation.OpcionalUsuarioDonador || "N/A",
      ];

      // Formato para montos
      row.getCell(6).numFmt = '"S/ "#,##0.00';
    });

    // Configurar anchos de columna
    worksheet.columns = [
      { width: 25 }, // ID
      { width: 35 }, // Nombre
      { width: 12 }, // DNI
      { width: 35 }, // Email
      { width: 15 }, // Teléfono
      { width: 12 }, // Monto
      { width: 15 }, // Fecha
      { width: 15 }, // Estado
      { width: 25 }, // Recolector
      { width: 35 }, // Email Rec
      { width: 40 }, // Facultad
      { width: 15 }, // Método
      { width: 30 }, // Observaciones
    ];

    // Agregar resumen al final
    const lastRow = personasNaturales.length + 3;
    worksheet.getCell(`A${lastRow}`).value = "RESUMEN PERSONAS NATURALES";
    worksheet.getCell(`A${lastRow}`).font = { bold: true, size: 12 };

    const totalAmount = personasNaturales.reduce(
      (sum, d) => sum + parseFloat(d.monto || 0),
      0
    );
    const avgAmount =
      personasNaturales.length > 0 ? totalAmount / personasNaturales.length : 0;

    worksheet.getCell(`A${lastRow + 1}`).value = "Total Donaciones:";
    worksheet.getCell(`B${lastRow + 1}`).value = personasNaturales.length;

    worksheet.getCell(`A${lastRow + 2}`).value = "Monto Total:";
    worksheet.getCell(`B${lastRow + 2}`).value = totalAmount;
    worksheet.getCell(`B${lastRow + 2}`).numFmt = '"S/ "#,##0.00';

    worksheet.getCell(`A${lastRow + 3}`).value = "Monto Promedio:";
    worksheet.getCell(`B${lastRow + 3}`).value = avgAmount;
    worksheet.getCell(`B${lastRow + 3}`).numFmt = '"S/ "#,##0.00';

    // Agregar autofiltro
    if (personasNaturales.length > 0) {
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: headers.length },
      };
    }
  }

  // Hoja específica para Empresas
  addEmpresasSheet(workbook, donations) {
    const empresas = donations.filter((d) => d.Tipo_Usuario === "EMPRESA");

    const worksheet = workbook.addWorksheet("Empresas");

    // Headers específicos para empresas
    const headers = [
      "ID Donación",
      "Razón Social",
      "RUC",
      "Representante Legal",
      "Cargo Representante",
      "Email",
      "Monto (S/)",
      "Fecha Donación",
      "Estado Validación",
      "Recolector",
      "Email Recolector",
      "Facultad Recolector",
      "Método Pago",
      "Observaciones",
    ];

    // Agregar headers con estilo
    headers.forEach((header, index) => {
      const cell = worksheet.getCell(1, index + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF17a2b8" }, // Azul para empresas
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });

    // Agregar datos específicos de empresas
    empresas.forEach((donation, rowIndex) => {
      const row = worksheet.getRow(rowIndex + 2);
      row.values = [
        donation.IDUsuarioDonador || "N/A",
        donation.RazonSocialUsuarioDonador || "N/A",
        donation["RUC-UsuarioDonador"] || "N/A",
        donation.RepresentanteLegalUsuarioDonador || "N/A",
        donation.CargoUsuarioDonador || "N/A",
        donation.EmailUsuarioDonador || "N/A",
        parseFloat(donation.monto || 0),
        this.formatDate(donation.fechaDonacion),
        this.getStatusText(donation.estadoValidacion),
        donation.nombreRecolector || this.getCollectorName(donation),
        donation.emailRecolector || "N/A",
        donation.facultadRecolector || "N/A",
        donation.metodoPago || "N/A",
        donation.OpcionalUsuarioDonador || "N/A",
      ];

      // Formato para montos
      row.getCell(7).numFmt = '"S/ "#,##0.00';
    });

    // Configurar anchos de columna
    worksheet.columns = [
      { width: 25 }, // ID
      { width: 35 }, // Razón Social
      { width: 15 }, // RUC
      { width: 30 }, // Representante
      { width: 20 }, // Cargo
      { width: 35 }, // Email
      { width: 12 }, // Monto
      { width: 15 }, // Fecha
      { width: 15 }, // Estado
      { width: 25 }, // Recolector
      { width: 35 }, // Email Rec
      { width: 40 }, // Facultad
      { width: 15 }, // Método
      { width: 30 }, // Observaciones
    ];

    // Agregar resumen al final
    const lastRow = empresas.length + 3;
    worksheet.getCell(`A${lastRow}`).value = "RESUMEN EMPRESAS";
    worksheet.getCell(`A${lastRow}`).font = { bold: true, size: 12 };

    const totalAmount = empresas.reduce(
      (sum, d) => sum + parseFloat(d.monto || 0),
      0
    );
    const avgAmount = empresas.length > 0 ? totalAmount / empresas.length : 0;

    worksheet.getCell(`A${lastRow + 1}`).value = "Total Donaciones:";
    worksheet.getCell(`B${lastRow + 1}`).value = empresas.length;

    worksheet.getCell(`A${lastRow + 2}`).value = "Monto Total:";
    worksheet.getCell(`B${lastRow + 2}`).value = totalAmount;
    worksheet.getCell(`B${lastRow + 2}`).numFmt = '"S/ "#,##0.00';

    worksheet.getCell(`A${lastRow + 3}`).value = "Monto Promedio:";
    worksheet.getCell(`B${lastRow + 3}`).value = avgAmount;
    worksheet.getCell(`B${lastRow + 3}`).numFmt = '"S/ "#,##0.00';

    // Agregar autofiltro
    if (empresas.length > 0) {
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: headers.length },
      };
    }
  }

  // Métodos auxiliares mejorados para manejar empresas y personas naturales

  getDonorName(donation) {
    if (donation.Tipo_Usuario === "PERSONA NATURAL") {
      return (
        `${donation.NombreUsuarioDonador || ""} ${
          donation.ApellidoUsuarioDonador || ""
        }`.trim() || "Sin nombre"
      );
    } else if (donation.Tipo_Usuario === "EMPRESA") {
      return donation.RazonSocialUsuarioDonador || "Sin razón social";
    } else {
      return "Usuario desconocido";
    }
  }

  getDonorDocument(donation) {
    if (donation.Tipo_Usuario === "PERSONA NATURAL") {
      return donation.DNIUsuarioDonador || "Sin DNI";
    } else if (donation.Tipo_Usuario === "EMPRESA") {
      return donation["RUC-UsuarioDonador"] || "Sin RUC";
    } else {
      return "N/A";
    }
  }

  getDonorPosition(donation) {
    if (donation.Tipo_Usuario === "EMPRESA") {
      return donation.CargoUsuarioDonador || "Sin cargo";
    } else if (donation.Tipo_Usuario === "EMPRESA") {
      return donation.RepresentanteLegalUsuarioDonador || "Sin representante";
    } else {
      return "N/A";
    }
  }

  getCollectorName(donation) {
    // Primero intentar con nombreRecolector que ya viene en algunos datos
    if (donation.nombreRecolector) {
      return donation.nombreRecolector;
    }

    // Si hay datos del recolector estructurados
    if (donation.collectorData) {
      const nombre = donation.collectorData.nombreUsuario || "";
      const apellido = donation.collectorData.apellidoUsuario || "";
      return `${nombre} ${apellido}`.trim() || "Recolector";
    }

    // Como fallback, usar el ID del recolector
    return donation.idRecolector || "Sin asignar";
  }

  // Resto de métodos auxiliares (sin cambios significativos)
  addBordersToRange(worksheet, range) {
    const [start, end] = range.split(":");
    const startCol = start.match(/[A-Z]+/)[0].charCodeAt(0) - 65;
    const startRow = parseInt(start.match(/\d+/)[0]);
    const endCol = end.match(/[A-Z]+/)[0].charCodeAt(0) - 65;
    const endRow = parseInt(end.match(/\d+/)[0]);

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const cell = worksheet.getCell(row, col + 1);
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      }
    }
  }

  addStatisticsSheet(workbook, donations) {
    const worksheet = workbook.addWorksheet("Estadísticas");
    const stats = this.calculateStatistics(donations);

    // Título principal
    worksheet.mergeCells("A1:B1");
    worksheet.getCell("A1").value = "ESTADÍSTICAS GENERALES";
    worksheet.getCell("A1").font = {
      size: 14,
      bold: true,
      color: { argb: "FF366092" },
    };

    // Estadísticas generales
    const statsData = [
      ["Total de Donaciones", stats.total],
      ["Donaciones Validadas", stats.validated],
      ["Donaciones Pendientes", stats.pending],
      ["Donaciones Rechazadas", stats.rejected],
      ["", ""],
      ["MONTOS", ""],
      ["Monto Total (S/)", stats.totalAmount],
      ["Monto Validado (S/)", stats.validatedAmount],
      ["Monto Pendiente (S/)", stats.pendingAmount],
      ["Monto Promedio (S/)", stats.averageAmount],
      ["Donación Máxima (S/)", stats.maxAmount],
      ["Donación Mínima (S/)", stats.minAmount],
      ["", ""],
      ["PORCENTAJES", ""],
      ["% Validadas", `${stats.validatedPercentage.toFixed(1)}%`],
      ["% Pendientes", `${stats.pendingPercentage.toFixed(1)}%`],
      ["% Rechazadas", `${stats.rejectedPercentage.toFixed(1)}%`],
    ];

    // Agregar datos
    statsData.forEach((row, index) => {
      const rowNum = index + 3;
      worksheet.getCell(`A${rowNum}`).value = row[0];
      worksheet.getCell(`B${rowNum}`).value = row[1];

      // Aplicar formato a títulos de sección
      if (row[0] === "MONTOS" || row[0] === "PORCENTAJES") {
        worksheet.getCell(`A${rowNum}`).font = {
          bold: true,
          size: 12,
          color: { argb: "FF366092" },
        };
      }

      // Aplicar formato de moneda
      if (row[0].includes("(S/)") && typeof row[1] === "number") {
        worksheet.getCell(`B${rowNum}`).numFmt = '"S/ "#,##0.00';
      }
    });

    // Estadísticas por tipo de usuario
    worksheet.getCell("A22").value = "ANÁLISIS POR TIPO DE USUARIO";
    worksheet.getCell("A22").font = {
      bold: true,
      size: 12,
      color: { argb: "FF366092" },
    };

    const userTypeData = this.calculateUserTypeData(donations);
    let rowNum = 24;

    worksheet.getCell("A23").value = "Tipo";
    worksheet.getCell("B23").value = "Cantidad";
    worksheet.getCell("C23").value = "Monto Total";
    worksheet.getCell("D23").value = "Monto Promedio";
    worksheet.getCell("E23").value = "% del Total";

    Object.entries(userTypeData).forEach(([type, data]) => {
      worksheet.getCell(`A${rowNum}`).value = type;
      worksheet.getCell(`B${rowNum}`).value = data.count;
      worksheet.getCell(`C${rowNum}`).value = data.amount;
      worksheet.getCell(`C${rowNum}`).numFmt = '"S/ "#,##0.00';
      worksheet.getCell(`D${rowNum}`).value = data.average;
      worksheet.getCell(`D${rowNum}`).numFmt = '"S/ "#,##0.00';
      worksheet.getCell(`E${rowNum}`).value = data.percentage / 100;
      worksheet.getCell(`E${rowNum}`).numFmt = "0.0%";
      rowNum++;
    });

    // Configurar anchos de columna
    worksheet.columns = [
      { width: 30 },
      { width: 20 },
      { width: 20 },
      { width: 20 },
      { width: 15 },
    ];
  }

  addChartsDataSheet(workbook, donations) {
    const worksheet = workbook.addWorksheet("Datos Gráficos");

    const monthlyData = this.calculateMonthlyData(donations);
    const statusData = this.calculateStatusData(donations);
    const amountRanges = this.calculateAmountRanges(donations);
    const userTypeData = this.calculateUserTypeData(donations);

    // Título
    worksheet.getCell("A1").value = "DATOS PARA GRÁFICOS";
    worksheet.getCell("A1").font = { size: 14, bold: true };

    // Datos mensuales
    worksheet.getCell("A3").value = "Datos Mensuales";
    worksheet.getCell("A3").font = { bold: true };

    const monthHeaders = ["Mes", "Cantidad", "Monto", "Promedio", "Validadas"];
    monthHeaders.forEach((header, index) => {
      worksheet.getCell(4, index + 1).value = header;
      worksheet.getCell(4, index + 1).font = { bold: true };
    });

    let currentRow = 5;
    Object.entries(monthlyData)
      .sort()
      .forEach(([month, data]) => {
        worksheet.getRow(currentRow).values = [
          month,
          data.count,
          data.amount,
          data.average,
          data.validated,
        ];
        worksheet.getCell(currentRow, 3).numFmt = '"S/ "#,##0.00';
        worksheet.getCell(currentRow, 4).numFmt = '"S/ "#,##0.00';
        currentRow++;
      });

    // Espacio
    currentRow += 2;

    // Datos por estado
    worksheet.getCell(`A${currentRow}`).value = "Datos por Estado";
    worksheet.getCell(`A${currentRow}`).font = { bold: true };
    currentRow++;

    const statusHeaders = ["Estado", "Cantidad", "Monto", "Porcentaje"];
    statusHeaders.forEach((header, index) => {
      worksheet.getCell(currentRow, index + 1).value = header;
      worksheet.getCell(currentRow, index + 1).font = { bold: true };
    });
    currentRow++;

    Object.entries(statusData).forEach(([status, data]) => {
      worksheet.getRow(currentRow).values = [
        status,
        data.count,
        data.amount,
        `${data.percentage.toFixed(1)}%`,
      ];
      worksheet.getCell(currentRow, 3).numFmt = '"S/ "#,##0.00';
      currentRow++;
    });

    // Espacio
    currentRow += 2;

    // Datos por tipo de usuario
    worksheet.getCell(`A${currentRow}`).value = "Datos por Tipo de Usuario";
    worksheet.getCell(`A${currentRow}`).font = { bold: true };
    currentRow++;

    const userTypeHeaders = [
      "Tipo",
      "Cantidad",
      "Monto Total",
      "Monto Promedio",
      "Porcentaje",
    ];
    userTypeHeaders.forEach((header, index) => {
      worksheet.getCell(currentRow, index + 1).value = header;
      worksheet.getCell(currentRow, index + 1).font = { bold: true };
    });
    currentRow++;

    Object.entries(userTypeData).forEach(([type, data]) => {
      worksheet.getRow(currentRow).values = [
        type,
        data.count,
        data.amount,
        data.average,
        `${data.percentage.toFixed(1)}%`,
      ];
      worksheet.getCell(currentRow, 3).numFmt = '"S/ "#,##0.00';
      worksheet.getCell(currentRow, 4).numFmt = '"S/ "#,##0.00';
      currentRow++;
    });

    // Espacio
    currentRow += 2;

    // Datos por rango de monto
    worksheet.getCell(`A${currentRow}`).value = "Datos por Rango de Monto";
    worksheet.getCell(`A${currentRow}`).font = { bold: true };
    currentRow++;

    const rangeHeaders = ["Rango", "Cantidad", "Monto Total", "Porcentaje"];
    rangeHeaders.forEach((header, index) => {
      worksheet.getCell(currentRow, index + 1).value = header;
      worksheet.getCell(currentRow, index + 1).font = { bold: true };
    });
    currentRow++;

    Object.entries(amountRanges).forEach(([range, data]) => {
      worksheet.getRow(currentRow).values = [
        range,
        data.count,
        data.amount,
        `${data.percentage.toFixed(1)}%`,
      ];
      worksheet.getCell(currentRow, 3).numFmt = '"S/ "#,##0.00';
      currentRow++;
    });

    // Configurar anchos de columna
    worksheet.columns = [
      { width: 20 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
    ];
  }

  // Métodos de validación de estado mejorados
  getStatusText(status) {
    if (this.isValidated(status)) {
      return "Validada";
    } else if (this.isRejected(status)) {
      return "Rechazada";
    } else {
      return "Pendiente";
    }
  }

  isValidated(status) {
    return (
      status === true ||
      status === "true" ||
      (typeof status === "string" &&
        (status.toLowerCase() === "validado" ||
          status.toLowerCase() === "aprobado" ||
          status.toLowerCase() === "validada" ||
          status.toLowerCase() === "aprobada"))
    );
  }

  isRejected(status) {
    return (
      status === false ||
      status === "false" ||
      (typeof status === "string" &&
        (status.toLowerCase() === "rechazado" ||
          status.toLowerCase() === "denegado" ||
          status.toLowerCase() === "rechazada" ||
          status.toLowerCase() === "denegada"))
    );
  }

  isPending(status) {
    return (
      status === null ||
      status === undefined ||
      status === "" ||
      (typeof status === "string" &&
        (status.toLowerCase() === "pendiente" ||
          status.toLowerCase() === "en proceso" ||
          status.toLowerCase() === "revision"))
    );
  }

  // Método para verificar si tiene voucher/comprobante
  hasVoucher(donation) {
    const possibleLocations = [
      donation.validationData?.Imagen_Comprobante,
      donation.validationData?.imagen_comprobante,
      donation.validationData?.voucher,
      donation.validationData?.comprobante,
      donation.Imagen_Comprobante,
      donation.imagen_comprobante,
      donation.voucher,
      donation.comprobante,
      donation.urlComprobante,
      donation.imagenComprobante,
    ];

    return possibleLocations.some((url) => {
      return (
        url &&
        typeof url === "string" &&
        url.trim() !== "" &&
        (url.startsWith("http") ||
          url.startsWith("data:") ||
          url.startsWith("blob:"))
      );
    });
  }

  // Métodos de manejo de fechas
  parseDate(dateInput) {
    if (!dateInput) return new Date();

    // Si es un objeto Timestamp de Firebase
    if (dateInput.toDate && typeof dateInput.toDate === "function") {
      return dateInput.toDate();
    }
    // Si es una cadena ISO
    else if (typeof dateInput === "string") {
      return new Date(dateInput);
    }
    // Si ya es una fecha
    else if (dateInput instanceof Date) {
      return dateInput;
    } else {
      return new Date();
    }
  }

  formatDate(dateInput) {
    if (!dateInput) return "N/A";

    const date = this.parseDate(dateInput);
    return date.toLocaleDateString("es-PE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }

  // Métodos de cálculo de estadísticas mejorados
  calculateStatistics(donations) {
    const total = donations.length;
    const validated = donations.filter((d) =>
      this.isValidated(d.estadoValidacion)
    ).length;
    const pending = donations.filter((d) =>
      this.isPending(d.estadoValidacion)
    ).length;
    const rejected = donations.filter((d) =>
      this.isRejected(d.estadoValidacion)
    ).length;

    const totalAmount = donations.reduce(
      (sum, d) => sum + parseFloat(d.monto || 0),
      0
    );
    const validatedAmount = donations
      .filter((d) => this.isValidated(d.estadoValidacion))
      .reduce((sum, d) => sum + parseFloat(d.monto || 0), 0);
    const pendingAmount = donations
      .filter((d) => this.isPending(d.estadoValidacion))
      .reduce((sum, d) => sum + parseFloat(d.monto || 0), 0);

    const amounts = donations.map((d) => parseFloat(d.monto || 0));
    const averageAmount = total > 0 ? totalAmount / total : 0;
    const maxAmount = amounts.length > 0 ? Math.max(...amounts) : 0;
    const minAmount = amounts.length > 0 ? Math.min(...amounts) : 0;

    return {
      total,
      validated,
      pending,
      rejected,
      totalAmount,
      validatedAmount,
      pendingAmount,
      averageAmount,
      maxAmount,
      minAmount,
      validatedPercentage: total > 0 ? (validated / total) * 100 : 0,
      pendingPercentage: total > 0 ? (pending / total) * 100 : 0,
      rejectedPercentage: total > 0 ? (rejected / total) * 100 : 0,
    };
  }

  calculateMonthlyData(donations) {
    const monthlyData = {};

    donations.forEach((donation) => {
      const date = this.parseDate(donation.fechaDonacion);
      const monthKey = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          count: 0,
          amount: 0,
          validated: 0,
        };
      }

      monthlyData[monthKey].count++;
      monthlyData[monthKey].amount += parseFloat(donation.monto || 0);

      if (this.isValidated(donation.estadoValidacion)) {
        monthlyData[monthKey].validated++;
      }
    });

    // Calcular promedios
    Object.keys(monthlyData).forEach((month) => {
      monthlyData[month].average =
        monthlyData[month].count > 0
          ? monthlyData[month].amount / monthlyData[month].count
          : 0;
    });

    return monthlyData;
  }

  calculateUserTypeData(donations) {
    const userTypeData = {};
    const totalAmount = donations.reduce(
      (sum, d) => sum + parseFloat(d.monto || 0),
      0
    );

    donations.forEach((donation) => {
      const type = donation.Tipo_Usuario || "Sin especificar";

      if (!userTypeData[type]) {
        userTypeData[type] = {
          count: 0,
          amount: 0,
        };
      }

      userTypeData[type].count++;
      userTypeData[type].amount += parseFloat(donation.monto || 0);
    });

    // Calcular promedios y porcentajes
    Object.keys(userTypeData).forEach((type) => {
      userTypeData[type].average =
        userTypeData[type].count > 0
          ? userTypeData[type].amount / userTypeData[type].count
          : 0;
      userTypeData[type].percentage =
        totalAmount > 0 ? (userTypeData[type].amount / totalAmount) * 100 : 0;
    });

    return userTypeData;
  }

  calculateStatusData(donations) {
    const statusData = {
      Validadas: { count: 0, amount: 0 },
      Pendientes: { count: 0, amount: 0 },
      Rechazadas: { count: 0, amount: 0 },
    };

    const totalAmount = donations.reduce(
      (sum, d) => sum + parseFloat(d.monto || 0),
      0
    );

    donations.forEach((donation) => {
      const amount = parseFloat(donation.monto || 0);

      if (this.isValidated(donation.estadoValidacion)) {
        statusData["Validadas"].count++;
        statusData["Validadas"].amount += amount;
      } else if (this.isRejected(donation.estadoValidacion)) {
        statusData["Rechazadas"].count++;
        statusData["Rechazadas"].amount += amount;
      } else {
        statusData["Pendientes"].count++;
        statusData["Pendientes"].amount += amount;
      }
    });

    // Calcular porcentajes
    Object.keys(statusData).forEach((status) => {
      statusData[status].percentage =
        totalAmount > 0 ? (statusData[status].amount / totalAmount) * 100 : 0;
    });

    return statusData;
  }

  calculateAmountRanges(donations) {
    const ranges = {
      "0 - 50": { count: 0, amount: 0 },
      "51 - 100": { count: 0, amount: 0 },
      "101 - 500": { count: 0, amount: 0 },
      "501 - 1000": { count: 0, amount: 0 },
      "1001+": { count: 0, amount: 0 },
    };

    const totalAmount = donations.reduce(
      (sum, d) => sum + parseFloat(d.monto || 0),
      0
    );

    donations.forEach((donation) => {
      const amount = parseFloat(donation.monto || 0);

      if (amount <= 50) {
        ranges["0 - 50"].count++;
        ranges["0 - 50"].amount += amount;
      } else if (amount <= 100) {
        ranges["51 - 100"].count++;
        ranges["51 - 100"].amount += amount;
      } else if (amount <= 500) {
        ranges["101 - 500"].count++;
        ranges["101 - 500"].amount += amount;
      } else if (amount <= 1000) {
        ranges["501 - 1000"].count++;
        ranges["501 - 1000"].amount += amount;
      } else {
        ranges["1001+"].count++;
        ranges["1001+"].amount += amount;
      }
    });

    // Calcular porcentajes
    Object.keys(ranges).forEach((range) => {
      ranges[range].percentage =
        totalAmount > 0 ? (ranges[range].amount / totalAmount) * 100 : 0;
    });

    return ranges;
  }

  // Métodos para actualizar modal y gráficos (sin cambios)
  updateExportModal(donations) {
    const stats = this.calculateStatistics(donations);

    // Actualizar estadísticas
    const elements = {
      exportStatsTotal: stats.total,
      exportStatsValidated: stats.validated,
      exportStatsPending: stats.pending,
      exportStatsAmount: `S/ ${stats.totalAmount.toFixed(2)}`,
    };

    Object.entries(elements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
      }
    });

    // Crear gráficos
    this.createCharts(donations);
  }

  createCharts(donations) {
    // Destruir gráficos existentes
    Object.values(this.charts).forEach((chart) => {
      if (chart && typeof chart.destroy === "function") {
        chart.destroy();
      }
    });
    this.charts = {};

    // Verificar si Chart.js está disponible
    if (typeof Chart === "undefined") {
      console.warn("Chart.js no está disponible");
      return;
    }

    this.createStatusChart(donations);
    this.createAmountRangeChart(donations);
    this.createMonthlyChart(donations);
    this.createUserTypeChart(donations);
  }

  createStatusChart(donations) {
    const ctx = document.getElementById("statusChart")?.getContext("2d");
    if (!ctx) return;

    const statusData = this.calculateStatusData(donations);

    this.charts.status = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: Object.keys(statusData),
        datasets: [
          {
            data: Object.values(statusData).map((d) => d.count),
            backgroundColor: ["#28a745", "#ffc107", "#dc3545"],
            borderWidth: 2,
            borderColor: "#fff",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              padding: 10,
              font: { size: 11 },
            },
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                const label = context.label || "";
                const value = context.parsed || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage =
                  total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                return `${label}: ${value} (${percentage}%)`;
              },
            },
          },
        },
      },
    });
  }

  createAmountRangeChart(donations) {
    const ctx = document.getElementById("amountRangeChart")?.getContext("2d");
    if (!ctx) return;

    const amountRanges = this.calculateAmountRanges(donations);

    this.charts.amountRange = new Chart(ctx, {
      type: "bar",
      data: {
        labels: Object.keys(amountRanges),
        datasets: [
          {
            label: "Cantidad de Donaciones",
            data: Object.values(amountRanges).map((d) => d.count),
            backgroundColor: "#17a2b8",
            borderColor: "#138496",
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              afterLabel: function (context) {
                const range = amountRanges[context.label];
                return `Monto total: S/ ${range.amount.toFixed(2)}`;
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1 },
          },
          x: {
            ticks: { font: { size: 11 } },
          },
        },
      },
    });
  }

  createMonthlyChart(donations) {
    const ctx = document.getElementById("monthlyChart")?.getContext("2d");
    if (!ctx) return;

    const monthlyData = this.calculateMonthlyData(donations);
    const sortedMonths = Object.keys(monthlyData).sort();

    this.charts.monthly = new Chart(ctx, {
      type: "line",
      data: {
        labels: sortedMonths.map((month) => {
          const [year, monthNum] = month.split("-");
          const monthNames = [
            "Ene",
            "Feb",
            "Mar",
            "Abr",
            "May",
            "Jun",
            "Jul",
            "Ago",
            "Sep",
            "Oct",
            "Nov",
            "Dic",
          ];
          return `${monthNames[parseInt(monthNum) - 1]} ${year}`;
        }),
        datasets: [
          {
            label: "Monto Total",
            data: sortedMonths.map((month) => monthlyData[month].amount),
            borderColor: "#007bff",
            backgroundColor: "rgba(0, 123, 255, 0.1)",
            tension: 0.4,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (context) {
                const month = sortedMonths[context.dataIndex];
                const data = monthlyData[month];
                return [
                  `Monto: S/ ${data.amount.toFixed(2)}`,
                  `Donaciones: ${data.count}`,
                  `Promedio: S/ ${data.average.toFixed(2)}`,
                ];
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function (value) {
                return "S/ " + value.toFixed(0);
              },
            },
          },
          x: {
            ticks: { font: { size: 10 } },
          },
        },
      },
    });
  }

  createUserTypeChart(donations) {
    const ctx = document.getElementById("userTypeChart")?.getContext("2d");
    if (!ctx) return;

    const userTypeData = this.calculateUserTypeData(donations);

    this.charts.userType = new Chart(ctx, {
      type: "pie",
      data: {
        labels: Object.keys(userTypeData),
        datasets: [
          {
            data: Object.values(userTypeData).map((d) => d.count),
            backgroundColor: ["#28a745", "#17a2b8", "#fd7e14", "#6f42c1"],
            borderWidth: 2,
            borderColor: "#fff",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              padding: 10,
              font: { size: 11 },
            },
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                const label = context.label || "";
                const data = userTypeData[label];
                return [
                  `${label}: ${data.count}`,
                  `Monto: S/ ${data.amount.toFixed(2)}`,
                  `${data.percentage.toFixed(1)}% del total`,
                ];
              },
            },
          },
        },
      },
    });
  }

  // Métodos de UI
  showSuccess(message) {
    this.showAlert(message, "success");
  }

  showError(message) {
    this.showAlert(message, "danger");
  }

  showAlert(message, type) {
    const alertDiv = document.createElement("div");
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    alertDiv.style.cssText =
      "top: 20px; right: 20px; z-index: 9999; min-width: 300px;";
    alertDiv.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alertDiv);

    setTimeout(() => {
      if (alertDiv.parentNode) {
        alertDiv.remove();
      }
    }, 5000);
  }
}

// Funciones globales para compatibilidad
window.exportDonationsToExcel = async function (donations, filename) {
  if (!window.donationsExcelJSExporter) {
    window.donationsExcelJSExporter = new DonationsExcelJSExporter();
  }

  // Esperar a que la librería se cargue
  const checkAndExport = async () => {
    if (window.donationsExcelJSExporter.ExcelJS) {
      await window.donationsExcelJSExporter.exportDonationsToExcel(
        donations,
        filename
      );
    } else {
      setTimeout(checkAndExport, 500);
    }
  };

  await checkAndExport();
};

// Función para usar con el modal de exportación
window.executeExportDonations = function (type) {
  if (window.donationsManager) {
    window.donationsManager.executeExportDonations(type);
  }
};

// Función para abrir el modal con estadísticas y gráficos actualizados
window.showExportModal = function (donations) {
  if (!window.donationsExcelJSExporter) {
    window.donationsExcelJSExporter = new DonationsExcelJSExporter();
  }

  // Actualizar estadísticas y gráficos
  window.donationsExcelJSExporter.updateExportModal(donations);

  // Mostrar el modal
  if (typeof bootstrap !== "undefined") {
    const modal = new bootstrap.Modal(
      document.getElementById("exportDonationsModal")
    );
    modal.show();
  }
};

// Inicializar cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", function () {
  window.donationsExcelJSExporter = new DonationsExcelJSExporter();

  // Verificar dependencias
  if (typeof Chart === "undefined") {
    console.warn(
      "Chart.js no está cargado. Los gráficos del modal no funcionarán correctamente."
    );
  }

  if (typeof bootstrap === "undefined") {
    console.warn(
      "Bootstrap no está cargado. Los modales pueden no funcionar correctamente."
    );
  }
});
