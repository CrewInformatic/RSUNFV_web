// donations_exceljs_exporter.js - VERSIÓN CORREGIDA
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

      // Agregar hojas - Usar versión sin imágenes por ahora
      this.addDashboardWithoutImages(workbook, donations);
      this.addDonationsSheet(workbook, donations);
      this.addStatisticsSheet(workbook, donations);
      this.addChartsDataSheet(workbook, donations);

      // Opcionalmente, agregar dashboard con gráficos nativos si es soportado
      try {
        this.addDashboardWithNativeCharts(workbook, donations);
      } catch (chartError) {
        console.warn("No se pudieron agregar gráficos nativos:", chartError);
      }

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

  // Dashboard sin imágenes (versión más compatible)
  addDashboardWithoutImages(workbook, donations) {
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

    // KPIs
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

    // ANÁLISIS POR ESTADO
    const statusData = this.calculateStatusData(donations);

    worksheet.getCell("A12").value = "Análisis por Estado";
    worksheet.getCell("A12").font = { bold: true, size: 12 };

    worksheet.getCell("A13").value = "Estado";
    worksheet.getCell("B13").value = "Cantidad";
    worksheet.getCell("C13").value = "Porcentaje";
    worksheet.getCell("D13").value = "Monto";

    let row = 14;
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

    worksheet.getCell("A19").value = "Evolución Mensual";
    worksheet.getCell("A19").font = { bold: true, size: 12 };

    worksheet.getCell("A20").value = "Mes";
    worksheet.getCell("B20").value = "Cantidad";
    worksheet.getCell("C20").value = "Monto";
    worksheet.getCell("D20").value = "Promedio";

    row = 21;
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

    // DISTRIBUCIÓN POR MONTO
    const amountRanges = this.calculateAmountRanges(donations);

    worksheet.getCell("A29").value = "Distribución por Monto";
    worksheet.getCell("A29").font = { bold: true, size: 12 };

    worksheet.getCell("A30").value = "Rango";
    worksheet.getCell("B30").value = "Cantidad";
    worksheet.getCell("C30").value = "Monto Total";
    worksheet.getCell("D30").value = "Porcentaje";

    row = 31;
    Object.entries(amountRanges).forEach(([range, data]) => {
      worksheet.getCell(`A${row}`).value = range;
      worksheet.getCell(`B${row}`).value = data.count;
      worksheet.getCell(`C${row}`).value = data.amount;
      worksheet.getCell(`C${row}`).numFmt = '"S/ "#,##0.00';
      worksheet.getCell(`D${row}`).value = data.percentage / 100;
      worksheet.getCell(`D${row}`).numFmt = "0.0%";
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
    this.addBordersToRange(worksheet, "A13:D16");
    this.addBordersToRange(worksheet, "A20:D26");
    this.addBordersToRange(worksheet, "A30:D34");
  }

  // Método auxiliar para agregar bordes
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

  // Dashboard con gráficos nativos de Excel (método mejorado)
  addDashboardWithNativeCharts(workbook, donations) {
    const worksheet = workbook.addWorksheet("Dashboard Gráficos");
    const statusData = this.calculateStatusData(donations);
    const monthlyData = this.calculateMonthlyData(donations);
    const amountRanges = this.calculateAmountRanges(donations);

    // Título
    worksheet.mergeCells("A1:F1");
    worksheet.getCell("A1").value = "DASHBOARD CON GRÁFICOS";
    worksheet.getCell("A1").font = { size: 16, bold: true };
    worksheet.getCell("A1").alignment = { horizontal: "center" };

    // DATOS Y GRÁFICO 1: Estado de Donaciones
    worksheet.getCell("A3").value = "Estado de Donaciones";
    worksheet.getCell("A3").font = { bold: true };

    worksheet.getCell("A4").value = "Estado";
    worksheet.getCell("B4").value = "Cantidad";

    let currentRow = 5;
    Object.entries(statusData).forEach(([status, data]) => {
      worksheet.getCell(`A${currentRow}`).value = status;
      worksheet.getCell(`B${currentRow}`).value = data.count;
      currentRow++;
    });

    // DATOS Y GRÁFICO 2: Evolución Mensual
    worksheet.getCell("A10").value = "Evolución Mensual";
    worksheet.getCell("A10").font = { bold: true };

    worksheet.getCell("A11").value = "Mes";
    worksheet.getCell("B11").value = "Donaciones";
    worksheet.getCell("C11").value = "Monto";

    currentRow = 12;
    const sortedMonths = Object.keys(monthlyData).sort().slice(-6);
    sortedMonths.forEach((month) => {
      const data = monthlyData[month];
      worksheet.getCell(`A${currentRow}`).value = month;
      worksheet.getCell(`B${currentRow}`).value = data.count;
      worksheet.getCell(`C${currentRow}`).value = data.amount;
      currentRow++;
    });

    // DATOS Y GRÁFICO 3: Rangos de Monto
    worksheet.getCell("A20").value = "Distribución por Rangos de Monto";
    worksheet.getCell("A20").font = { bold: true };

    worksheet.getCell("A21").value = "Rango";
    worksheet.getCell("B21").value = "Cantidad";

    currentRow = 22;
    Object.entries(amountRanges).forEach(([range, data]) => {
      worksheet.getCell(`A${currentRow}`).value = range;
      worksheet.getCell(`B${currentRow}`).value = data.count;
      currentRow++;
    });

    // Ajustar anchos de columna
    worksheet.columns = [
      { width: 20 },
      { width: 15 },
      { width: 15 },
      { width: 10 },
      { width: 10 },
      { width: 10 },
    ];

    // Nota: Los gráficos nativos de Excel pueden no estar completamente soportados
    // en todas las versiones de ExcelJS, por lo que esta es una implementación básica
  }

  // Agregar hoja de donaciones detalladas
  addDonationsSheet(workbook, donations) {
    const worksheet = workbook.addWorksheet("Donaciones");

    // Headers
    const headers = [
      "ID",
      "Tipo Usuario",
      "Nombre/Razón Social",
      "Email",
      "Monto (S/)",
      "Fecha",
      "Estado",
      "Recolector",
      "Tiene Voucher",
      "Método Pago",
      "Banco",
      "Número Operación",
      "Observaciones",
    ];

    // Agregar headers
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
        donation.id,
        donation.Tipo_Usuario || "N/A",
        this.getDonorName(donation),
        donation.EmailUsuarioDonador || "N/A",
        parseFloat(donation.monto || 0),
        this.formatDate(donation.fechaDonacion),
        this.getStatusText(donation.estadoValidacion),
        this.getCollectorName(donation),
        this.hasVoucher(donation) ? "Sí" : "No",
        donation.metodoPago || "N/A",
        donation.banco || "N/A",
        donation.numeroOperacion || "N/A",
        donation.observaciones || "N/A",
      ];

      // Formato para montos
      row.getCell(5).numFmt = '"S/ "#,##0.00';
    });

    // Configurar anchos de columna
    worksheet.columns = [
      { width: 15 },
      { width: 20 },
      { width: 30 },
      { width: 35 },
      { width: 12 },
      { width: 15 },
      { width: 15 },
      { width: 25 },
      { width: 12 },
      { width: 15 },
      { width: 20 },
      { width: 18 },
      { width: 30 },
    ];

    // Agregar autofiltro
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length },
    };
  }

  // Agregar hoja de estadísticas
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

    // Estadísticas
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

    // Tipos de usuario
    worksheet.getCell("A22").value = "TIPOS DE USUARIO";
    worksheet.getCell("A22").font = {
      bold: true,
      size: 12,
      color: { argb: "FF366092" },
    };

    let rowNum = 23;
    Object.entries(stats.userTypes).forEach(([type, count]) => {
      worksheet.getCell(`A${rowNum}`).value = type;
      worksheet.getCell(`B${rowNum}`).value = count;
      rowNum++;
    });

    // Configurar anchos de columna
    worksheet.columns = [{ width: 30 }, { width: 20 }];
  }

  // Agregar hoja con datos para gráficos
  addChartsDataSheet(workbook, donations) {
    const worksheet = workbook.addWorksheet("Datos Gráficos");

    const monthlyData = this.calculateMonthlyData(donations);
    const statusData = this.calculateStatusData(donations);
    const amountRanges = this.calculateAmountRanges(donations);

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

  // Métodos auxiliares (los mismos que en el código anterior)
  getDonorName(donation) {
    if (donation.Tipo_Usuario === "PERSONA NATURAL") {
      return `${donation.NombreUsuarioDonador || ""} ${
        donation.ApellidoUsuarioDonador || ""
      }`.trim();
    } else {
      return donation.RazonSocialUsuarioDonador || "Empresa";
    }
  }

  getCollectorName(donation) {
    if (donation.collectorData) {
      const nombre = donation.collectorData.nombreUsuario || "";
      const apellido = donation.collectorData.apellidoUsuario || "";
      return `${nombre} ${apellido}`.trim() || "Recolector";
    }
    return donation.idRecolector || "Sin asignar";
  }

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
      (typeof status === "string" &&
        (status.toLowerCase() === "validado" ||
          status.toLowerCase() === "aprobado"))
    );
  }

  isRejected(status) {
    return (
      status === false ||
      (typeof status === "string" &&
        (status.toLowerCase() === "rechazado" ||
          status.toLowerCase() === "denegado"))
    );
  }

  isPending(status) {
    return (
      status === null ||
      status === undefined ||
      (typeof status === "string" && status.toLowerCase() === "pendiente")
    );
  }

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

  parseDate(dateInput) {
    if (!dateInput) return new Date();

    if (dateInput.toDate && typeof dateInput.toDate === "function") {
      return dateInput.toDate();
    } else if (typeof dateInput === "string") {
      return new Date(dateInput);
    } else {
      return dateInput;
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

  // Métodos de cálculo
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

    const userTypes = {};
    donations.forEach((d) => {
      const type = d.Tipo_Usuario || "Sin especificar";
      userTypes[type] = (userTypes[type] || 0) + 1;
    });

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
      userTypes,
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
        monthlyData[month].amount / monthlyData[month].count;
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
        userTypeData[type].amount / userTypeData[type].count;
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
      "501+": { count: 0, amount: 0 },
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
      } else {
        ranges["501+"].count++;
        ranges["501+"].amount += amount;
      }
    });

    // Calcular porcentajes
    Object.keys(ranges).forEach((range) => {
      ranges[range].percentage =
        totalAmount > 0 ? (ranges[range].amount / totalAmount) * 100 : 0;
    });

    return ranges;
  }

  // Actualizar estadísticas y gráficos en el modal
  updateExportModal(donations) {
    const stats = this.calculateStatistics(donations);

    // Actualizar estadísticas
    document.getElementById("exportStatsTotal").textContent = stats.total;
    document.getElementById("exportStatsValidated").textContent =
      stats.validated;
    document.getElementById("exportStatsPending").textContent = stats.pending;
    document.getElementById(
      "exportStatsAmount"
    ).textContent = `S/ ${stats.totalAmount.toFixed(2)}`;

    // Crear gráficos
    this.createCharts(donations);
  }

  // Crear todos los gráficos del modal
  createCharts(donations) {
    // Destruir gráficos existentes
    Object.values(this.charts).forEach((chart) => {
      if (chart) chart.destroy();
    });

    this.createStatusChart(donations);
    this.createAmountRangeChart(donations);
    this.createMonthlyChart(donations);
    this.createUserTypeChart(donations);
  }

  // Gráfico de Estados
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
                const percentage = ((value / total) * 100).toFixed(1);
                return `${label}: ${value} (${percentage}%)`;
              },
            },
          },
        },
      },
    });
  }

  // Gráfico de Rangos de Monto
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

  // Gráfico de Evolución Mensual
  createMonthlyChart(donations) {
    const ctx = document.getElementById("monthlyChart")?.getContext("2d");
    if (!ctx) return;

    const monthlyData = this.calculateMonthlyData(donations);

    // Ordenar meses cronológicamente
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

  // Gráfico de Tipos de Usuario
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
            backgroundColor: ["#6f42c1", "#e83e8c", "#fd7e14", "#20c997"],
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
  const modal = new bootstrap.Modal(
    document.getElementById("exportDonationsModal")
  );
  modal.show();
};

// Inicializar cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", function () {
  window.donationsExcelJSExporter = new DonationsExcelJSExporter();

  // Verificar dependencias
  if (typeof Chart === "undefined") {
    console.error(
      "Chart.js no está cargado. Asegúrate de incluir Chart.js en tu HTML."
    );
  }
});
