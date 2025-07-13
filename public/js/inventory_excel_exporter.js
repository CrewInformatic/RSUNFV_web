// inventory_excel_exporter.js - Exportador de Excel para Inventario de Donaciones
class InventoryExcelExporter {
  constructor() {
    this.ExcelJS = null;
    this.users = []; // Inicializar array de usuarios
    this.initializeLibrary();
  }

  async initializeLibrary() {
    try {
      // Cargar ExcelJS desde CDN
      await this.loadScript(
        "https://cdn.jsdelivr.net/npm/exceljs@4.3.0/dist/exceljs.min.js"
      );
      this.ExcelJS = window.ExcelJS;
      console.log("ExcelJS cargado correctamente para inventario");
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

  // Método principal de exportación
  async exportInventoryToExcel(
    collectorStats,
    expenses,
    totalStats,
    users = [],
    filename = "inventario_donaciones.xlsx"
  ) {
    if (!this.ExcelJS) {
      this.showError("La librería de exportación no está disponible");
      return;
    }

    try {
      // Guardar usuarios para usar en getResponsibleName
      this.users = users;

      const workbook = new this.ExcelJS.Workbook();
      workbook.creator = "Sistema de Inventario EcoVoluntarios";
      workbook.created = new Date();

      // Agregar hojas
      this.addDashboardSheet(workbook, collectorStats, expenses, totalStats);
      this.addCollectorsSheet(workbook, collectorStats);
      this.addExpensesSheet(workbook, expenses);
      this.addBudgetAnalysisSheet(workbook, totalStats, expenses);
      this.addStatisticsSheet(workbook, collectorStats, expenses, totalStats);

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

      this.showSuccess(`Inventario exportado exitosamente: ${filename}`);
    } catch (error) {
      console.error("Error al exportar inventario:", error);
      this.showError("Error al generar el reporte de inventario");
    }
  }

  // Dashboard principal del inventario
  addDashboardSheet(workbook, collectorStats, expenses, totalStats) {
    const worksheet = workbook.addWorksheet("Dashboard Inventario");

    // Título principal
    worksheet.mergeCells("A1:H1");
    worksheet.getCell("A1").value = "DASHBOARD DE INVENTARIO DE DONACIONES";
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

    // Resumen financiero
    worksheet.getCell("A4").value = "RESUMEN FINANCIERO";
    worksheet.getCell("A4").font = {
      size: 14,
      bold: true,
      color: { argb: "FF366092" },
    };

    const totalExpenses = expenses.reduce(
      (sum, exp) => sum + parseFloat(exp.monto || 0),
      0
    );
    const remainingBudget = totalStats.totalRecaudado - totalExpenses;
    const usagePercentage =
      totalStats.totalRecaudado > 0
        ? (totalExpenses / totalStats.totalRecaudado) * 100
        : 0;

    // KPIs financieros
    const financialKpis = [
      {
        label: "Total Disponible:",
        value: `S/ ${totalStats.totalRecaudado.toFixed(2)}`,
        col: "A",
        row: 6,
      },
      {
        label: "Total Gastado:",
        value: `S/ ${totalExpenses.toFixed(2)}`,
        col: "D",
        row: 6,
      },
      {
        label: "Dinero Restante:",
        value: `S/ ${remainingBudget.toFixed(2)}`,
        col: "A",
        row: 7,
      },
      {
        label: "% Utilizado:",
        value: `${usagePercentage.toFixed(1)}%`,
        col: "D",
        row: 7,
      },
      {
        label: "Recolectores Activos:",
        value: totalStats.totalRecolectores,
        col: "A",
        row: 8,
      },
      {
        label: "Donaciones Activas:",
        value: totalStats.donacionesActivas,
        col: "D",
        row: 8,
      },
      {
        label: "Donaciones Pendientes:",
        value: totalStats.donacionesPendientes,
        col: "A",
        row: 9,
      },
      {
        label: "Gastos Registrados:",
        value: expenses.length,
        col: "D",
        row: 9,
      },
    ];

    financialKpis.forEach((kpi) => {
      worksheet.getCell(`${kpi.col}${kpi.row}`).value = kpi.label;
      worksheet.getCell(`${kpi.col}${kpi.row}`).font = { bold: true };
      const valueCol = String.fromCharCode(kpi.col.charCodeAt(0) + 1);
      worksheet.getCell(`${valueCol}${kpi.row}`).value = kpi.value;
    });

    // Estado del presupuesto
    worksheet.getCell("A12").value = "ESTADO DEL PRESUPUESTO";
    worksheet.getCell("A12").font = { bold: true, size: 12 };

    let budgetStatus = "Saludable";
    let statusColor = "FF28a745"; // Verde
    if (usagePercentage >= 80) {
      budgetStatus = "Crítico - Se requiere atención inmediata";
      statusColor = "FFdc3545"; // Rojo
    } else if (usagePercentage >= 50) {
      budgetStatus = "Advertencia - Monitorear gastos";
      statusColor = "FFffc107"; // Amarillo
    }

    worksheet.getCell("A13").value = "Estado:";
    worksheet.getCell("B13").value = budgetStatus;
    worksheet.getCell("B13").font = {
      bold: true,
      color: { argb: statusColor },
    };

    // TOP 5 recolectores
    worksheet.getCell("A16").value = "TOP 5 RECOLECTORES";
    worksheet.getCell("A16").font = { bold: true, size: 12 };

    const headers = [
      "Recolector",
      "Total Donaciones",
      "Monto Aprobado",
      "Monto Pendiente",
      "% Progreso",
    ];
    headers.forEach((header, index) => {
      worksheet.getCell(17, index + 1).value = header;
      worksheet.getCell(17, index + 1).font = { bold: true };
    });

    const top5Collectors = collectorStats.slice(0, 5);
    top5Collectors.forEach((collector, index) => {
      const row = 18 + index;
      worksheet.getRow(row).values = [
        collector.fullName,
        collector.totalDonations,
        collector.approvedAmount,
        collector.pendingAmount,
        `${collector.progressPercentage}%`,
      ];

      // Formato para montos
      worksheet.getCell(row, 3).numFmt = '"S/ "#,##0.00';
      worksheet.getCell(row, 4).numFmt = '"S/ "#,##0.00';
    });

    // Configurar anchos de columna
    worksheet.columns = [
      { width: 25 },
      { width: 20 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
    ];

    // Agregar bordes
    this.addBordersToRange(worksheet, "A6:E9");
    this.addBordersToRange(worksheet, "A17:E22");
  }

  // Hoja de recolectores
  addCollectorsSheet(workbook, collectorStats) {
    const worksheet = workbook.addWorksheet("Recolectores");

    // Headers
    const headers = [
      "Nombre Completo",
      "ID Recolector",
      "Total Donaciones",
      "Donaciones Aprobadas",
      "Donaciones Pendientes",
      "Monto Aprobado (S/)",
      "Monto Pendiente (S/)",
      "Monto Total (S/)",
      "% Progreso",
      "Estado",
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

    // Agregar datos de recolectores
    collectorStats.forEach((collector, rowIndex) => {
      const row = worksheet.getRow(rowIndex + 2);
      row.values = [
        collector.fullName,
        collector.id,
        collector.totalDonations,
        collector.approvedDonations,
        collector.pendingDonations,
        collector.approvedAmount,
        collector.pendingAmount,
        collector.totalAmount,
        collector.progressPercentage,
        collector.statusLabel,
      ];

      // Formato para montos
      row.getCell(6).numFmt = '"S/ "#,##0.00';
      row.getCell(7).numFmt = '"S/ "#,##0.00';
      row.getCell(8).numFmt = '"S/ "#,##0.00';
      row.getCell(9).numFmt = '0"%"';
    });

    // Configurar anchos de columna
    worksheet.columns = [
      { width: 30 }, // Nombre
      { width: 35 }, // ID
      { width: 15 }, // Total
      { width: 18 }, // Aprobadas
      { width: 18 }, // Pendientes
      { width: 18 }, // Monto Aprobado
      { width: 18 }, // Monto Pendiente
      { width: 15 }, // Monto Total
      { width: 12 }, // Progreso
      { width: 15 }, // Estado
    ];

    // Agregar autofiltro
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length },
    };

    // Resumen al final
    const lastRow = collectorStats.length + 3;
    worksheet.getCell(`A${lastRow}`).value = "RESUMEN DE RECOLECTORES";
    worksheet.getCell(`A${lastRow}`).font = { bold: true, size: 12 };

    const totalApproved = collectorStats.reduce(
      (sum, c) => sum + c.approvedAmount,
      0
    );
    const totalPending = collectorStats.reduce(
      (sum, c) => sum + c.pendingAmount,
      0
    );

    worksheet.getCell(`A${lastRow + 1}`).value = "Total Recolectores:";
    worksheet.getCell(`B${lastRow + 1}`).value = collectorStats.length;

    worksheet.getCell(`A${lastRow + 2}`).value = "Monto Total Aprobado:";
    worksheet.getCell(`B${lastRow + 2}`).value = totalApproved;
    worksheet.getCell(`B${lastRow + 2}`).numFmt = '"S/ "#,##0.00';

    worksheet.getCell(`A${lastRow + 3}`).value = "Monto Total Pendiente:";
    worksheet.getCell(`B${lastRow + 3}`).value = totalPending;
    worksheet.getCell(`B${lastRow + 3}`).numFmt = '"S/ "#,##0.00';
  }

  // Hoja de gastos
  addExpensesSheet(workbook, expenses) {
    const worksheet = workbook.addWorksheet("Historial de Gastos");

    // Headers
    const headers = [
      "Fecha",
      "Descripción",
      "Justificación",
      "Categoría",
      "Monto (S/)",
      "Lugar de Compra",
      "Responsable",
      "Donación Origen",
      "Comprobante",
      "Notas",
      "Fecha Registro",
    ];

    // Agregar headers con estilo
    headers.forEach((header, index) => {
      const cell = worksheet.getCell(1, index + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFdc3545" }, // Rojo para gastos
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });

    // Agregar datos de gastos
    expenses.forEach((expense, rowIndex) => {
      const row = worksheet.getRow(rowIndex + 2);
      row.values = [
        this.formatDate(expense.fechaGasto),
        expense.descripcion || "N/A",
        expense.justificacion || "N/A",
        expense.categoria || "N/A",
        parseFloat(expense.monto || 0),
        expense.lugarCompra || "N/A",
        this.getResponsibleName(expense.responsable) || "N/A",
        expense.donacionOrigen || "N/A",
        expense.comprobante ? "Sí" : "No",
        expense.notas || "N/A",
        this.formatDate(expense.fechaRegistro),
      ];

      // Formato para monto
      row.getCell(5).numFmt = '"S/ "#,##0.00';
    });

    // Configurar anchos de columna
    worksheet.columns = [
      { width: 12 }, // Fecha
      { width: 30 }, // Descripción
      { width: 35 }, // Justificación
      { width: 15 }, // Categoría
      { width: 12 }, // Monto
      { width: 25 }, // Lugar
      { width: 20 }, // Responsable
      { width: 25 }, // Donación
      { width: 12 }, // Comprobante
      { width: 30 }, // Notas
      { width: 15 }, // Fecha Registro
    ];

    // Agregar autofiltro
    if (expenses.length > 0) {
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: headers.length },
      };
    }

    // Resumen por categoría
    const lastRow = expenses.length + 3;
    worksheet.getCell(`A${lastRow}`).value = "RESUMEN POR CATEGORÍA";
    worksheet.getCell(`A${lastRow}`).font = { bold: true, size: 12 };

    const categoryTotals = this.calculateCategoryTotals(expenses);
    let currentRow = lastRow + 2;

    worksheet.getCell(`A${currentRow}`).value = "Categoría";
    worksheet.getCell(`B${currentRow}`).value = "Cantidad";
    worksheet.getCell(`C${currentRow}`).value = "Monto Total";
    worksheet.getCell(`A${currentRow}`).font = { bold: true };
    worksheet.getCell(`B${currentRow}`).font = { bold: true };
    worksheet.getCell(`C${currentRow}`).font = { bold: true };
    currentRow++;

    Object.entries(categoryTotals).forEach(([category, data]) => {
      worksheet.getCell(`A${currentRow}`).value = category;
      worksheet.getCell(`B${currentRow}`).value = data.count;
      worksheet.getCell(`C${currentRow}`).value = data.amount;
      worksheet.getCell(`C${currentRow}`).numFmt = '"S/ "#,##0.00';
      currentRow++;
    });
  }

  // Hoja de análisis presupuestal
  addBudgetAnalysisSheet(workbook, totalStats, expenses) {
    const worksheet = workbook.addWorksheet("Análisis Presupuestal");

    const totalExpenses = expenses.reduce(
      (sum, exp) => sum + parseFloat(exp.monto || 0),
      0
    );
    const remainingBudget = totalStats.totalRecaudado - totalExpenses;
    const usagePercentage =
      totalStats.totalRecaudado > 0
        ? (totalExpenses / totalStats.totalRecaudado) * 100
        : 0;

    // Título
    worksheet.mergeCells("A1:D1");
    worksheet.getCell("A1").value = "ANÁLISIS PRESUPUESTAL DETALLADO";
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

    // Análisis principal
    const budgetData = [
      ["PRESUPUESTO DISPONIBLE", ""],
      ["Total Recaudado", `S/ ${totalStats.totalRecaudado.toFixed(2)}`],
      ["Total Gastado", `S/ ${totalExpenses.toFixed(2)}`],
      ["Dinero Restante", `S/ ${remainingBudget.toFixed(2)}`],
      ["Porcentaje Utilizado", `${usagePercentage.toFixed(1)}%`],
      ["", ""],
      ["ESTADO DEL PRESUPUESTO", ""],
    ];

    // Determinar estado
    let budgetStatus = "SALUDABLE";
    let recommendations = [
      "El presupuesto se encuentra en buen estado",
      "Continuar con el monitoreo regular de gastos",
      "Mantener registros actualizados",
    ];

    if (usagePercentage >= 80) {
      budgetStatus = "CRÍTICO";
      recommendations = [
        "Se ha utilizado más del 80% del presupuesto",
        "Revisar gastos urgentemente",
        "Considerar suspender gastos no esenciales",
        "Buscar fuentes adicionales de financiamiento",
      ];
    } else if (usagePercentage >= 50) {
      budgetStatus = "ADVERTENCIA";
      recommendations = [
        "Se ha utilizado más del 50% del presupuesto",
        "Monitorear gastos más frecuentemente",
        "Revisar prioridades de gastos",
        "Planificar gastos futuros cuidadosamente",
      ];
    }

    budgetData.push(["Estado", budgetStatus]);

    // Agregar datos
    budgetData.forEach((row, index) => {
      const rowNum = index + 3;
      worksheet.getCell(`A${rowNum}`).value = row[0];
      worksheet.getCell(`B${rowNum}`).value = row[1];

      if (row[0].includes("PRESUPUESTO") || row[0].includes("ESTADO")) {
        worksheet.getCell(`A${rowNum}`).font = {
          bold: true,
          size: 12,
          color: { argb: "FF366092" },
        };
      }
    });

    // Recomendaciones
    worksheet.getCell("A15").value = "RECOMENDACIONES";
    worksheet.getCell("A15").font = {
      bold: true,
      size: 12,
      color: { argb: "FF366092" },
    };

    recommendations.forEach((rec, index) => {
      worksheet.getCell(`A${16 + index}`).value = `• ${rec}`;
    });

    // Proyección mensual
    worksheet.getCell("A22").value = "PROYECCIÓN MENSUAL";
    worksheet.getCell("A22").font = {
      bold: true,
      size: 12,
      color: { argb: "FF366092" },
    };

    const monthlyAverage =
      expenses.length > 0 ? totalExpenses / this.getMonthsSpan(expenses) : 0;
    const projectedMonths =
      remainingBudget > 0 ? remainingBudget / monthlyAverage : 0;

    worksheet.getCell("A24").value = "Gasto promedio mensual:";
    worksheet.getCell("B24").value = `S/ ${monthlyAverage.toFixed(2)}`;

    worksheet.getCell("A25").value = "Meses restantes (aprox):";
    worksheet.getCell("B25").value =
      projectedMonths > 0 ? `${projectedMonths.toFixed(1)} meses` : "N/A";

    // Configurar anchos
    worksheet.columns = [
      { width: 30 },
      { width: 25 },
      { width: 15 },
      { width: 15 },
    ];
  }

  // Hoja de estadísticas generales
  addStatisticsSheet(workbook, collectorStats, expenses, totalStats) {
    const worksheet = workbook.addWorksheet("Estadísticas");

    // Título
    worksheet.getCell("A1").value = "ESTADÍSTICAS GENERALES DEL INVENTARIO";
    worksheet.getCell("A1").font = { size: 14, bold: true };

    const totalExpenses = expenses.reduce(
      (sum, exp) => sum + parseFloat(exp.monto || 0),
      0
    );

    // Estadísticas principales
    const stats = [
      ["RECOLECTORES", ""],
      ["Total de Recolectores", totalStats.totalRecolectores],
      [
        "Recolectores con Donaciones Aprobadas",
        collectorStats.filter((c) => c.approvedDonations > 0).length,
      ],
      [
        "Recolectores con Donaciones Pendientes",
        collectorStats.filter((c) => c.pendingDonations > 0).length,
      ],
      ["", ""],
      ["DONACIONES", ""],
      ["Donaciones Activas", totalStats.donacionesActivas],
      ["Donaciones Pendientes", totalStats.donacionesPendientes],
      ["Monto Total Recaudado", `S/ ${totalStats.totalRecaudado.toFixed(2)}`],
      ["", ""],
      ["GASTOS", ""],
      ["Total de Gastos Registrados", expenses.length],
      ["Monto Total Gastado", `S/ ${totalExpenses.toFixed(2)}`],
      [
        "Gasto Promedio",
        `S/ ${(expenses.length > 0
          ? totalExpenses / expenses.length
          : 0
        ).toFixed(2)}`,
      ],
      ["", ""],
      ["PRESUPUESTO", ""],
      [
        "Dinero Restante",
        `S/ ${(totalStats.totalRecaudado - totalExpenses).toFixed(2)}`,
      ],
      [
        "Porcentaje Utilizado",
        `${(totalStats.totalRecaudado > 0
          ? (totalExpenses / totalStats.totalRecaudado) * 100
          : 0
        ).toFixed(1)}%`,
      ],
    ];

    // Agregar estadísticas
    stats.forEach((row, index) => {
      const rowNum = index + 3;
      worksheet.getCell(`A${rowNum}`).value = row[0];
      worksheet.getCell(`B${rowNum}`).value = row[1];

      if (
        row[0] === "RECOLECTORES" ||
        row[0] === "DONACIONES" ||
        row[0] === "GASTOS" ||
        row[0] === "PRESUPUESTO"
      ) {
        worksheet.getCell(`A${rowNum}`).font = {
          bold: true,
          size: 12,
          color: { argb: "FF366092" },
        };
      }
    });

    // Estadísticas por categoría de gastos
    worksheet.getCell("A25").value = "GASTOS POR CATEGORÍA";
    worksheet.getCell("A25").font = {
      bold: true,
      size: 12,
      color: { argb: "FF366092" },
    };

    const categoryTotals = this.calculateCategoryTotals(expenses);
    let currentRow = 27;

    worksheet.getCell("A26").value = "Categoría";
    worksheet.getCell("B26").value = "Cantidad";
    worksheet.getCell("C26").value = "Monto Total";
    worksheet.getCell("D26").value = "% del Total";

    Object.entries(categoryTotals).forEach(([category, data]) => {
      worksheet.getCell(`A${currentRow}`).value = category;
      worksheet.getCell(`B${currentRow}`).value = data.count;
      worksheet.getCell(`C${currentRow}`).value = data.amount;
      worksheet.getCell(`C${currentRow}`).numFmt = '"S/ "#,##0.00';
      worksheet.getCell(`D${currentRow}`).value = data.percentage / 100;
      worksheet.getCell(`D${currentRow}`).numFmt = "0.0%";
      currentRow++;
    });

    // Configurar anchos
    worksheet.columns = [
      { width: 30 },
      { width: 20 },
      { width: 15 },
      { width: 15 },
    ];
  }

  // ✅ MÉTODO FALTANTE AGREGADO
  getResponsibleName(responsibleId) {
    if (!responsibleId || !this.users) return "No especificado";

    // Buscar el usuario en el array de usuarios
    const user = this.users.find((user) => user.idUsuario === responsibleId);

    if (user) {
      const fullName = `${user.nombreUsuario || ""} ${
        user.apellidoUsuario || ""
      }`.trim();
      return fullName || "Nombre no disponible";
    }

    // Si no se encuentra el usuario, devolver el ID
    return responsibleId;
  }

  // Métodos auxiliares
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

  formatDate(dateInput) {
    if (!dateInput) return "N/A";

    try {
      // Si es un timestamp de Firebase
      if (dateInput.toDate && typeof dateInput.toDate === "function") {
        return dateInput.toDate().toLocaleDateString("es-PE");
      }
      // Si es una cadena ISO o fecha
      const date = new Date(dateInput);
      return date.toLocaleDateString("es-PE");
    } catch (error) {
      return "N/A";
    }
  }

  calculateCategoryTotals(expenses) {
    const categoryTotals = {};
    const totalAmount = expenses.reduce(
      (sum, exp) => sum + parseFloat(exp.monto || 0),
      0
    );

    expenses.forEach((expense) => {
      const category = expense.categoria || "Sin categoría";
      const amount = parseFloat(expense.monto || 0);

      if (!categoryTotals[category]) {
        categoryTotals[category] = {
          count: 0,
          amount: 0,
        };
      }

      categoryTotals[category].count++;
      categoryTotals[category].amount += amount;
    });

    // Calcular porcentajes
    Object.keys(categoryTotals).forEach((category) => {
      categoryTotals[category].percentage =
        totalAmount > 0
          ? (categoryTotals[category].amount / totalAmount) * 100
          : 0;
    });

    return categoryTotals;
  }

  getMonthsSpan(expenses) {
    if (expenses.length === 0) return 1;

    const dates = expenses
      .map((exp) => new Date(exp.fechaGasto))
      .filter((date) => !isNaN(date));
    if (dates.length === 0) return 1;

    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    const monthsDiff =
      (maxDate.getFullYear() - minDate.getFullYear()) * 12 +
      (maxDate.getMonth() - minDate.getMonth());

    return Math.max(1, monthsDiff + 1);
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

// ✅ FUNCIÓN GLOBAL CORREGIDA - Incluye parámetro users
window.exportInventoryToExcel = async function (
  collectorStats,
  expenses,
  totalStats,
  users = [], // ✅ Parámetro users agregado
  filename = "inventario_donaciones.xlsx"
) {
  if (!window.inventoryExcelExporter) {
    window.inventoryExcelExporter = new InventoryExcelExporter();
  }

  // Esperar a que la librería se cargue
  const checkAndExport = async () => {
    if (window.inventoryExcelExporter.ExcelJS) {
      await window.inventoryExcelExporter.exportInventoryToExcel(
        collectorStats,
        expenses,
        totalStats,
        users, // ✅ Pasar usuarios al exportador
        filename
      );
    } else {
      setTimeout(checkAndExport, 500);
    }
  };

  await checkAndExport();
};

// Inicializar cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", function () {
  window.inventoryExcelExporter = new InventoryExcelExporter();
});
