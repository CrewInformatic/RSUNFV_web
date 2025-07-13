// pdf-export-manager.js - Generador de Reportes PDF Financieros para EcoVoluntarios UNFV

class PDFExportManager {
  static isGenerating = false;

  static async exportToPDF() {
    if (this.isGenerating) return;

    try {
      this.isGenerating = true;
      this.showPDFLoading(true);

      // Verificar jsPDF versión 1.5.3 (más simple y estable)
      if (typeof window.jsPDF === "undefined") {
        throw new Error(
          "jsPDF no está disponible. Verifique que la librería se haya cargado correctamente."
        );
      }

      if (typeof html2canvas === "undefined") {
        throw new Error(
          "html2canvas no está disponible. Verifique que la librería se haya cargado correctamente."
        );
      }

      // Obtener datos actuales del inventario
      const data = window.getCurrentInventoryData
        ? window.getCurrentInventoryData()
        : ExportManager.currentData;

      if (!data || (!data.collectorStats.length && !data.expenses.length)) {
        throw new Error("No hay datos disponibles para el reporte");
      }

      // Generar nombre del archivo
      const now = new Date();
      const dateStr = now.toLocaleDateString("es-PE").replace(/\//g, "-");
      const timeStr = now
        .toLocaleTimeString("es-PE", { hour12: false })
        .replace(/:/g, "-");
      const filename = `Reporte_Financiero_EcoVoluntarios_${dateStr}_${timeStr}.pdf`;

      // Crear el PDF estilo bancario con jsPDF 1.5.3
      await this.generateBankStyleFinancialReport(data, filename);

      this.showSuccess("✅ Reporte financiero generado exitosamente");
    } catch (error) {
      this.showError(`Error al generar el reporte: ${error.message}`);
    } finally {
      this.isGenerating = false;
      this.showPDFLoading(false);
    }
  }

  static async generateBankStyleFinancialReport(data, filename) {
    // Usar jsPDF 1.5.3 directamente
    const pdf = new window.jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let currentY = margin;

    // PORTADA ESTILO BANCARIO
    currentY = await this.addBankStyleHeader(
      pdf,
      pageWidth,
      margin,
      currentY,
      data
    );

    // RESUMEN EJECUTIVO
    currentY = this.addExecutiveSummary(
      pdf,
      margin,
      currentY,
      contentWidth,
      data
    );

    // ANÁLISIS FINANCIERO
    pdf.addPage();
    currentY = margin;
    currentY = this.addFinancialAnalysis(
      pdf,
      margin,
      currentY,
      contentWidth,
      data
    );

    // INDICADORES KPI
    currentY = this.addKPIIndicators(pdf, margin, currentY, contentWidth, data);

    // DISTRIBUCIÓN DE FONDOS
    currentY = this.addFundDistribution(
      pdf,
      margin,
      currentY,
      contentWidth,
      data
    );

    // RENDIMIENTO POR RECOLECTOR
    if (currentY > pageHeight - 80) {
      pdf.addPage();
      currentY = margin;
    }
    currentY = this.addCollectorPerformance(
      pdf,
      margin,
      currentY,
      contentWidth,
      data.collectorStats
    );

    // ANÁLISIS DE GASTOS
    pdf.addPage();
    currentY = margin;
    currentY = this.addExpenseAnalysis(
      pdf,
      margin,
      currentY,
      contentWidth,
      data.expenses,
      data.users
    );

    // GRÁFICOS FINANCIEROS
    await this.addFinancialCharts(pdf, margin, contentWidth, data);

    // RECOMENDACIONES
    pdf.addPage();
    currentY = margin;
    this.addRecommendations(pdf, margin, currentY, contentWidth, data);

    // PIE DE PÁGINA BANCARIO
    this.addBankStyleFooter(pdf);

    // Guardar el PDF
    pdf.save(filename);
  }

  static async addBankStyleHeader(pdf, pageWidth, margin, currentY, data) {
    // Fondo azul corporativo
    pdf.setFillColor(25, 47, 89);
    pdf.rect(0, 0, pageWidth, 60, "F");

    // Título principal en blanco
    pdf.setFontSize(32);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(255, 255, 255);

    const title = "REPORTE FINANCIERO";
    const titleWidth = pdf.getTextWidth(title);
    pdf.text(title, (pageWidth - titleWidth) / 2, currentY + 15);

    currentY += 25;

    // Subtítulo
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "normal");
    const subtitle = "EcoVoluntarios UNFV - Estado Financiero Integral";
    const subtitleWidth = pdf.getTextWidth(subtitle);
    pdf.text(subtitle, (pageWidth - subtitleWidth) / 2, currentY + 5);

    currentY += 25;

    // Información de período y fecha
    pdf.setFontSize(11);
    const reportInfo = [
      `Período: ${new Date().getFullYear()}`,
      `Fecha de corte: ${new Date().toLocaleDateString("es-PE")}`,
      `Generado: ${new Date().toLocaleString("es-PE")}`,
    ];

    reportInfo.forEach((info, index) => {
      const infoWidth = pdf.getTextWidth(info);
      pdf.text(info, (pageWidth - infoWidth) / 2, currentY + index * 6);
    });

    pdf.setTextColor(0, 0, 0);
    return 80;
  }

  static addExecutiveSummary(pdf, margin, currentY, contentWidth, data) {
    this.addSectionHeader(
      pdf,
      "RESUMEN EJECUTIVO",
      margin,
      currentY,
      contentWidth
    );
    currentY += 20;

    const totalRecaudado = data.totalStats.totalRecaudado || 0;
    const totalGastado = data.expenses.reduce(
      (sum, exp) => sum + parseFloat(exp.monto || 0),
      0
    );
    const fondosDisponibles = totalRecaudado - totalGastado;
    const porcentajeUtilizado =
      totalRecaudado > 0 ? (totalGastado / totalRecaudado) * 100 : 0;

    const estadoFinanciero =
      porcentajeUtilizado < 50
        ? "EXCELENTE"
        : porcentajeUtilizado < 80
        ? "BUENO"
        : "REQUIERE ATENCION";

    const colorEstado =
      porcentajeUtilizado < 50
        ? [40, 167, 69]
        : porcentajeUtilizado < 80
        ? [255, 193, 7]
        : [220, 53, 69];

    // Cuadro de estado
    pdf.setFillColor(248, 249, 250);
    pdf.rect(margin, currentY, contentWidth, 25, "F");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text("ESTADO FINANCIERO:", margin + 5, currentY + 8);

    pdf.setTextColor(colorEstado[0], colorEstado[1], colorEstado[2]);
    pdf.setFontSize(16);
    pdf.text(estadoFinanciero, margin + 60, currentY + 8);

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(10);
    pdf.text(
      porcentajeUtilizado.toFixed(1) + "% del presupuesto utilizado",
      margin + 5,
      currentY + 18
    );

    currentY += 35;

    // Resumen narrativo
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "normal");

    const summaryText = [
      "La organizacion EcoVoluntarios UNFV presenta un estado financiero " +
        estadoFinanciero.toLowerCase() +
        " con ",
      (data.totalStats.totalRecolectores || 0) +
        " recolectores activos que han logrado recaudar ",
      this.formatCurrency(totalRecaudado) + " en donaciones aprobadas.\n\n",
      "Durante el periodo analizado se registraron gastos por " +
        this.formatCurrency(totalGastado) +
        ", ",
      "representando el " +
        porcentajeUtilizado.toFixed(1) +
        "% del total disponible. ",
      "La organizacion mantiene " +
        this.formatCurrency(fondosDisponibles) +
        " en fondos disponibles.\n\n",
      "El nivel de actividad operativa se considera " +
        (porcentajeUtilizado < 50
          ? "conservador"
          : porcentajeUtilizado < 80
          ? "moderado"
          : "intensivo") +
        ", ",
      "con un control presupuestario " +
        (porcentajeUtilizado < 80 ? "adecuado" : "que requiere monitoreo") +
        ".",
    ].join("");

    const lines = pdf.splitTextToSize(summaryText, contentWidth);
    lines.forEach((line) => {
      if (currentY > 250) {
        pdf.addPage();
        currentY = margin;
      }
      pdf.text(line, margin, currentY);
      currentY += 5;
    });

    return currentY + 15;
  }

  static addFinancialAnalysis(pdf, margin, currentY, contentWidth, data) {
    this.addSectionHeader(
      pdf,
      "ANALISIS FINANCIERO DETALLADO",
      margin,
      currentY,
      contentWidth
    );
    currentY += 20;

    const totalRecaudado = data.totalStats.totalRecaudado || 0;
    const totalGastado = data.expenses.reduce(
      (sum, exp) => sum + parseFloat(exp.monto || 0),
      0
    );
    const fondosDisponibles = totalRecaudado - totalGastado;

    const analysisData = [
      ["CONCEPTO", "MONTO", "% DEL TOTAL", "ESTADO"],
      [
        "Ingresos Confirmados",
        this.formatCurrency(totalRecaudado),
        "100.0%",
        "CONFIRMADO",
      ],
      [
        "Gastos Ejecutados",
        this.formatCurrency(totalGastado),
        (totalRecaudado > 0
          ? ((totalGastado / totalRecaudado) * 100).toFixed(1)
          : 0) + "%",
        totalGastado < totalRecaudado * 0.8 ? "NORMAL" : "ALTO",
      ],
      [
        "Fondos Disponibles",
        this.formatCurrency(fondosDisponibles),
        (totalRecaudado > 0
          ? ((fondosDisponibles / totalRecaudado) * 100).toFixed(1)
          : 0) + "%",
        fondosDisponibles > 0 ? "POSITIVO" : "DEFICIT",
      ],
      ["", "", "", ""],
      [
        "Margen de Seguridad",
        this.formatCurrency(Math.max(0, fondosDisponibles)),
        Math.max(0, (fondosDisponibles / totalRecaudado) * 100).toFixed(1) +
          "%",
        fondosDisponibles > totalRecaudado * 0.2 ? "SALUDABLE" : "LIMITADO",
      ],
    ];

    this.drawFinancialTable(pdf, margin, currentY, contentWidth, analysisData);
    return currentY + analysisData.length * 8 + 20;
  }

  static addKPIIndicators(pdf, margin, currentY, contentWidth, data) {
    this.addSectionHeader(
      pdf,
      "INDICADORES CLAVE DE RENDIMIENTO (KPI)",
      margin,
      currentY,
      contentWidth
    );
    currentY += 20;

    const totalRecaudado = data.totalStats.totalRecaudado || 0;
    const totalGastado = data.expenses.reduce(
      (sum, exp) => sum + parseFloat(exp.monto || 0),
      0
    );
    const promedioRecolector =
      data.totalStats.totalRecolectores > 0
        ? totalRecaudado / data.totalStats.totalRecolectores
        : 0;
    const eficienciaPresupuestal =
      totalRecaudado > 0
        ? ((totalRecaudado - totalGastado) / totalRecaudado) * 100
        : 0;

    const kpis = [
      {
        titulo: "Eficiencia Presupuestal",
        valor: eficienciaPresupuestal.toFixed(1) + "%",
        estado:
          eficienciaPresupuestal > 50
            ? "EXCELENTE"
            : eficienciaPresupuestal > 20
            ? "BUENO"
            : "CRITICO",
        color:
          eficienciaPresupuestal > 50
            ? [40, 167, 69]
            : eficienciaPresupuestal > 20
            ? [255, 193, 7]
            : [220, 53, 69],
      },
      {
        titulo: "Promedio por Recolector",
        valor: this.formatCurrency(promedioRecolector),
        estado:
          promedioRecolector > 1000
            ? "ALTO"
            : promedioRecolector > 500
            ? "MEDIO"
            : "BAJO",
        color:
          promedioRecolector > 1000
            ? [40, 167, 69]
            : promedioRecolector > 500
            ? [255, 193, 7]
            : [220, 53, 69],
      },
      {
        titulo: "Indice de Actividad",
        valor: (data.totalStats.donacionesActivas || 0).toString(),
        estado: "ACTIVO",
        color: [40, 167, 69],
      },
      {
        titulo: "Liquidez Disponible",
        valor: this.formatCurrency(totalRecaudado - totalGastado),
        estado: totalRecaudado - totalGastado > 0 ? "POSITIVA" : "NEGATIVA",
        color:
          totalRecaudado - totalGastado > 0 ? [40, 167, 69] : [220, 53, 69],
      },
    ];

    const kpiWidth = (contentWidth - 10) / 2;
    const kpiHeight = 25;

    kpis.forEach((kpi, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = margin + col * (kpiWidth + 10);
      const y = currentY + row * (kpiHeight + 10);

      pdf.setFillColor(248, 249, 250);
      pdf.rect(x, y, kpiWidth, kpiHeight, "F");

      pdf.setDrawColor(200, 200, 200);
      pdf.rect(x, y, kpiWidth, kpiHeight);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(0, 0, 0);
      pdf.text(kpi.titulo, x + 3, y + 6);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.text(kpi.valor, x + 3, y + 14);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
      pdf.text(kpi.estado, x + 3, y + 21);
    });

    pdf.setTextColor(0, 0, 0);
    return currentY + 70;
  }

  static addFundDistribution(pdf, margin, currentY, contentWidth, data) {
    this.addSectionHeader(
      pdf,
      "💼 DISTRIBUCIÓN DE FONDOS",
      margin,
      currentY,
      contentWidth
    );
    currentY += 20;

    const categoryTotals = {
      educacion: 0,
      salud: 0,
      alimentacion: 0,
      vestimenta: 0,
      infraestructura: 0,
      otros: 0,
    };

    data.expenses.forEach((expense) => {
      const categoria = expense.categoria?.toLowerCase() || "otros";
      const monto = parseFloat(expense.monto) || 0;
      if (categoryTotals.hasOwnProperty(categoria)) {
        categoryTotals[categoria] += monto;
      } else {
        categoryTotals.otros += monto;
      }
    });

    const totalGastado = Object.values(categoryTotals).reduce(
      (sum, val) => sum + val,
      0
    );

    const distributionData = [
      ["CATEGORÍA", "MONTO GASTADO", "% DEL GASTO", "PRIORIDAD"],
      ...Object.entries(categoryTotals)
        .filter(([, amount]) => amount > 0)
        .sort(([, a], [, b]) => b - a)
        .map(([category, amount]) => [
          category.charAt(0).toUpperCase() + category.slice(1),
          this.formatCurrency(amount),
          `${
            totalGastado > 0 ? ((amount / totalGastado) * 100).toFixed(1) : 0
          }%`,
          amount > totalGastado * 0.3
            ? "ALTA"
            : amount > totalGastado * 0.15
            ? "MEDIA"
            : "BAJA",
        ]),
    ];

    if (distributionData.length > 1) {
      this.drawFinancialTable(
        pdf,
        margin,
        currentY,
        contentWidth,
        distributionData
      );
      currentY += distributionData.length * 8 + 10;
    } else {
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(10);
      pdf.text("No hay gastos registrados por categoría.", margin, currentY);
      currentY += 15;
    }

    return currentY;
  }

  static addCollectorPerformance(
    pdf,
    margin,
    currentY,
    contentWidth,
    collectors
  ) {
    this.addSectionHeader(
      pdf,
      "👥 RENDIMIENTO DE RECOLECTORES",
      margin,
      currentY,
      contentWidth
    );
    currentY += 20;

    if (!collectors.length) {
      pdf.setFont("helvetica", "italic");
      pdf.text("No hay recolectores registrados.", margin, currentY);
      return currentY + 10;
    }

    const topCollectors = collectors.slice(0, 10);
    const performanceData = [
      ["RECOLECTOR", "DONACIONES", "MONTO APROBADO", "EFICIENCIA"],
      ...topCollectors.map((collector) => [
        collector.fullName.length > 20
          ? collector.fullName.substring(0, 20) + "..."
          : collector.fullName,
        `${collector.approvedDonations}/${collector.totalDonations}`,
        this.formatCurrency(collector.approvedAmount),
        `${collector.progressPercentage}%`,
      ]),
    ];

    this.drawFinancialTable(
      pdf,
      margin,
      currentY,
      contentWidth,
      performanceData
    );
    return currentY + performanceData.length * 8 + 15;
  }

  static addExpenseAnalysis(
    pdf,
    margin,
    currentY,
    contentWidth,
    expenses,
    users
  ) {
    this.addSectionHeader(
      pdf,
      "📋 ANÁLISIS DE GASTOS",
      margin,
      currentY,
      contentWidth
    );
    currentY += 20;

    if (!expenses.length) {
      pdf.setFont("helvetica", "italic");
      pdf.text("No hay gastos registrados.", margin, currentY);
      return currentY + 10;
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentExpenses = expenses.filter(
      (expense) => new Date(expense.fechaGasto) >= thirtyDaysAgo
    );

    const totalRecent = recentExpenses.reduce(
      (sum, exp) => sum + parseFloat(exp.monto || 0),
      0
    );

    pdf.setFillColor(248, 249, 250);
    pdf.rect(margin, currentY, contentWidth, 20, "F");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text("ANÁLISIS TEMPORAL DE GASTOS", margin + 5, currentY + 8);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(
      `Últimos 30 días: ${this.formatCurrency(totalRecent)} (${
        recentExpenses.length
      } transacciones)`,
      margin + 5,
      currentY + 15
    );

    currentY += 30;

    const recentExpensesTable = [
      ["FECHA", "DESCRIPCIÓN", "CATEGORÍA", "MONTO"],
      ...expenses
        .slice(0, 15)
        .map((expense) => [
          new Date(expense.fechaGasto).toLocaleDateString("es-PE"),
          expense.descripcion.length > 25
            ? expense.descripcion.substring(0, 25) + "..."
            : expense.descripcion,
          expense.categoria || "N/A",
          this.formatCurrency(parseFloat(expense.monto || 0)),
        ]),
    ];

    this.drawFinancialTable(
      pdf,
      margin,
      currentY,
      contentWidth,
      recentExpensesTable
    );
    return currentY + recentExpensesTable.length * 7 + 15;
  }

  static async addFinancialCharts(pdf, margin, contentWidth, data) {
    try {
      pdf.addPage();
      let currentY = margin;

      this.addSectionHeader(
        pdf,
        "📊 GRÁFICOS FINANCIEROS",
        margin,
        currentY,
        contentWidth
      );
      currentY += 25;

      // Mensaje informativo en lugar de gráficos para mayor compatibilidad
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);

      const chartInfo = [
        "ANÁLISIS VISUAL DE DATOS:",
        "",
        "• Rendimiento por Recolector:",
        `  - Top performer: ${data.collectorStats[0]?.fullName || "N/A"}`,
        `  - Total recolectores activos: ${data.collectorStats.length}`,
        "",
        "• Distribución de Gastos:",
        `  - Total gastado: ${this.formatCurrency(
          data.expenses.reduce(
            (sum, exp) => sum + parseFloat(exp.monto || 0),
            0
          )
        )}`,
        `  - Número de transacciones: ${data.expenses.length}`,
        "",
        "Los gráficos interactivos están disponibles en la plataforma web.",
      ];

      chartInfo.forEach((line) => {
        if (currentY > 250) {
          pdf.addPage();
          currentY = margin + 20;
        }
        pdf.text(line, margin, currentY);
        currentY += 6;
      });
    } catch (error) {
      // Error silencioso para continuar sin gráficos
    }
  }

  static addRecommendations(pdf, margin, currentY, contentWidth, data) {
    this.addSectionHeader(
      pdf,
      "RECOMENDACIONES FINANCIERAS",
      margin,
      currentY,
      contentWidth
    );
    currentY += 20;

    const totalRecaudado = data.totalStats.totalRecaudado || 0;
    const totalGastado = data.expenses.reduce(
      (sum, exp) => sum + parseFloat(exp.monto || 0),
      0
    );
    const porcentajeUtilizado =
      totalRecaudado > 0 ? (totalGastado / totalRecaudado) * 100 : 0;

    let recommendations = [];

    if (porcentajeUtilizado > 80) {
      recommendations = [
        "ACCION INMEDIATA: Revisar y controlar gastos urgentemente",
        "Implementar sistema de aprobacion previa para gastos mayores a S/. 500",
        "Buscar fuentes adicionales de financiamiento",
        "Realizar auditoria de gastos innecesarios",
        "Establecer limites de gasto por categoria",
      ];
    } else if (porcentajeUtilizado > 50) {
      recommendations = [
        "MONITOREO: Mantener vigilancia del presupuesto",
        "Optimizar la asignacion de recursos por categoria",
        "Capacitar recolectores en mejores practicas",
        "Implementar reportes quincenales de seguimiento",
        "Evaluar oportunidades de ahorro operativo",
      ];
    } else {
      recommendations = [
        "ESTADO SALUDABLE: Mantener practicas actuales",
        "Considerar expansion de actividades",
        "Invertir en capacitacion y herramientas",
        "Crear fondo de reserva para emergencias",
        "Evaluar oportunidades de crecimiento sostenible",
      ];
    }

    recommendations.forEach((rec, index) => {
      if (currentY > 250) {
        pdf.addPage();
        currentY = margin + 20;
      }

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);

      pdf.setFont("helvetica", "bold");
      pdf.text(index + 1 + ".", margin, currentY);

      pdf.setFont("helvetica", "normal");
      const recText = pdf.splitTextToSize(rec, contentWidth - 10);
      pdf.text(recText, margin + 8, currentY);

      currentY += recText.length * 5 + 5;
    });

    currentY += 10;
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    const finalNote =
      "Este reporte ha sido generado automaticamente. Se recomienda validar con el equipo financiero.";
    const noteLines = pdf.splitTextToSize(finalNote, contentWidth);
    noteLines.forEach((line) => {
      pdf.text(line, margin, currentY);
      currentY += 4;
    });

    pdf.setTextColor(0, 0, 0);
    return currentY;
  }

  static addSectionHeader(pdf, title, margin, currentY, contentWidth) {
    // Limpiar título de emojis para jsPDF 1.5.3
    const cleanTitle = title.replace(/📊|💰|📈|💼|👥|📋|💡|📊/g, "").trim();

    pdf.setFillColor(25, 47, 89);
    pdf.rect(margin, currentY - 5, contentWidth, 15, "F");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(255, 255, 255);
    pdf.text(cleanTitle, margin + 5, currentY + 5);

    pdf.setTextColor(0, 0, 0);
  }

  static drawFinancialTable(pdf, margin, currentY, contentWidth, data) {
    const rowHeight = 7;
    const colWidths = this.calculateColumnWidths(contentWidth, data[0].length);

    data.forEach((row, rowIndex) => {
      let xPos = margin;

      if (rowIndex === 0) {
        pdf.setFillColor(25, 47, 89);
        pdf.rect(margin, currentY - 4, contentWidth, rowHeight, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.setTextColor(255, 255, 255);
      } else if (rowIndex % 2 === 0) {
        pdf.setFillColor(248, 249, 250);
        pdf.rect(margin, currentY - 4, contentWidth, rowHeight, "F");
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(0, 0, 0);
      } else {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(0, 0, 0);
      }

      row.forEach((cell, colIndex) => {
        if (cell) {
          pdf.text(cell.toString(), xPos + 2, currentY);
        }
        xPos += colWidths[colIndex];
      });

      currentY += rowHeight;
    });

    pdf.setDrawColor(200, 200, 200);
    pdf.rect(
      margin,
      currentY - data.length * rowHeight - 4,
      contentWidth,
      data.length * rowHeight
    );
    pdf.setTextColor(0, 0, 0);
  }

  static calculateColumnWidths(totalWidth, numColumns) {
    switch (numColumns) {
      case 2:
        return [totalWidth * 0.6, totalWidth * 0.4];
      case 3:
        return [totalWidth * 0.5, totalWidth * 0.25, totalWidth * 0.25];
      case 4:
        return [
          totalWidth * 0.4,
          totalWidth * 0.2,
          totalWidth * 0.2,
          totalWidth * 0.2,
        ];
      default:
        return Array(numColumns).fill(totalWidth / numColumns);
    }
  }

  static addBankStyleFooter(pdf) {
    const pageCount = pdf.internal.getNumberOfPages();

    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);

      const pageHeight = pdf.internal.pageSize.getHeight();
      const pageWidth = pdf.internal.pageSize.getWidth();

      // Línea superior del pie
      pdf.setDrawColor(25, 47, 89);
      pdf.setLineWidth(0.5);
      pdf.line(20, pageHeight - 20, pageWidth - 20, pageHeight - 20);

      // Información del pie - CORREGIDO
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(25, 47, 89);

      // Texto izquierdo
      const footerLeft = "EcoVoluntarios UNFV - Reporte Financiero";
      pdf.text(footerLeft, 20, pageHeight - 12);

      // Texto central - fecha y hora
      const footerCenter =
        "Generado: " +
        new Date().toLocaleDateString("es-PE") +
        " " +
        new Date().toLocaleTimeString("es-PE", { hour12: false });
      const centerX = (pageWidth - pdf.getTextWidth(footerCenter)) / 2;
      pdf.text(footerCenter, centerX, pageHeight - 12);

      // Texto derecho - número de página
      const footerRight = "Pagina " + i + " de " + pageCount;
      const rightX = pageWidth - 20 - pdf.getTextWidth(footerRight);
      pdf.text(footerRight, rightX, pageHeight - 12);

      // Disclaimer en la parte inferior
      pdf.setFontSize(6);
      pdf.setTextColor(128, 128, 128);
      const disclaimer =
        "Documento confidencial - Solo para uso interno de EcoVoluntarios UNFV";
      const disclaimerX = (pageWidth - pdf.getTextWidth(disclaimer)) / 2;
      pdf.text(disclaimer, disclaimerX, pageHeight - 5);
    }

    // Restaurar color de texto
    pdf.setTextColor(0, 0, 0);
  }

  static formatCurrency(amount) {
    return `S/. ${amount.toLocaleString("es-PE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  static showPDFLoading(show) {
    const pdfBtn = document.querySelector(".btn-danger");
    if (pdfBtn && pdfBtn.textContent.includes("PDF")) {
      pdfBtn.disabled = show;
      if (show) {
        pdfBtn.innerHTML =
          '<i class="fas fa-spinner fa-spin me-1"></i>Generando PDF...';
      } else {
        pdfBtn.innerHTML = '<i class="fas fa-file-pdf me-1"></i>Exportar PDF';
      }
    }
  }

  static showError(message) {
    if (typeof ExpenseManager !== "undefined" && ExpenseManager.showError) {
      ExpenseManager.showError(message);
    } else {
      alert(message);
    }
  }

  static showSuccess(message) {
    if (typeof ExpenseManager !== "undefined" && ExpenseManager.showSuccess) {
      ExpenseManager.showSuccess(message);
    } else {
      const toast = document.createElement("div");
      toast.className =
        "toast align-items-center text-white bg-success border-0";
      toast.innerHTML = `
        <div class="d-flex">
          <div class="toast-body">${message}</div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
      `;

      document.body.appendChild(toast);
      const bsToast = new bootstrap.Toast(toast, {
        autohide: true,
        delay: 3000,
      });
      bsToast.show();

      toast.addEventListener("hidden.bs.toast", () => {
        toast.remove();
      });
    }
  }
}

// INTEGRACIÓN GLOBAL
window.PDFExportManager = PDFExportManager;

// Función de compatibilidad
window.generateInventoryPDF = async (
  collectorStats,
  expenses,
  totalStats,
  users,
  filename
) => {
  const tempData = {
    collectorStats: collectorStats || [],
    expenses: expenses || [],
    totalStats: totalStats || {},
    users: users || [],
  };

  const originalGetData = window.getCurrentInventoryData;
  window.getCurrentInventoryData = () => tempData;

  try {
    await PDFExportManager.exportToPDF();
  } finally {
    window.getCurrentInventoryData = originalGetData;
  }
};

// Auto-inicialización
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    // Módulo cargado
  });
}

// INTEGRACIÓN GLOBAL
window.PDFExportManager = PDFExportManager;

// Función de compatibilidad
window.generateInventoryPDF = async (
  collectorStats,
  expenses,
  totalStats,
  users,
  filename
) => {
  const tempData = {
    collectorStats: collectorStats || [],
    expenses: expenses || [],
    totalStats: totalStats || {},
    users: users || [],
  };

  const originalGetData = window.getCurrentInventoryData;
  window.getCurrentInventoryData = () => tempData;

  try {
    await PDFExportManager.exportToPDF();
  } finally {
    window.getCurrentInventoryData = originalGetData;
  }
};

// Auto-inicialización
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    // Módulo cargado
  });
}

// INTEGRACIÓN GLOBAL
window.PDFExportManager = PDFExportManager;

// Función de compatibilidad
window.generateInventoryPDF = async (
  collectorStats,
  expenses,
  totalStats,
  users,
  filename
) => {
  const tempData = {
    collectorStats: collectorStats || [],
    expenses: expenses || [],
    totalStats: totalStats || {},
    users: users || [],
  };

  const originalGetData = window.getCurrentInventoryData;
  window.getCurrentInventoryData = () => tempData;

  try {
    await PDFExportManager.exportToPDF();
  } finally {
    window.getCurrentInventoryData = originalGetData;
  }
};

// Auto-inicialización
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    // Módulo cargado
  });
}
