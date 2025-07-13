// inventory.js - Sistema de Inventario EcoVoluntarios UNFV
import {
  db,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  getDoc,
  orderBy,
  limit,
  serverTimestamp,
  updateDoc,
  onAuthStateChanged,
  auth,
} from "./firebase_config.js";

// ==================== CONSTANTES Y CONFIGURACIÓN ====================
const COLLECTION_NAMES = {
  DONATIONS: "donaciones",
  USERS: "usuarios",
  PAYMENTS: "payment_history",
  VALIDATION: "validacion",
};

const CLOUDINARY_CONFIG = {
  cloudName: "dupkeaqnz",
  uploadPreset: "u5jbjfxu",
  apiKey: "572426943132833",
};

const FILE_IO_CONFIG = {
  apiUrl: "https://file.io",
  maxSizeMB: 10,
};

const VALIDATION_STATES = {
  APPROVED: "true",
  APPROVED_BOOL: true,
  PENDING: "pendiente",
  REJECTED: "false",
  REJECTED_BOOL: false,
};

const EXPENSE_CATEGORIES = {
  EDUCACION: "educacion",
  SALUD: "salud",
  ALIMENTACION: "alimentacion",
  VESTIMENTA: "vestimenta",
  INFRAESTRUCTURA: "infraestructura",
  OTROS: "otros",
};

// ==================== CLASES DE DATOS ====================
class DonationData {
  constructor(donationId, donationData, user) {
    this.id = donationId;
    this.donorId = donationData.IDUsuarioDonador;
    this.amount = parseFloat(donationData.monto) || 0;
    this.date = donationData.fechaDonacion;
    this.validationState = this.normalizeValidationState(
      donationData.estadoValidacion
    );

    this.collector = {
      id: donationData.idRecolector,
      name: user?.nombreUsuario || "Usuario desconocido",
      lastName: user?.apellidoUsuario || "",
      fullName: `${user?.nombreUsuario || ""} ${
        user?.apellidoUsuario || ""
      }`.trim(),
    };
  }

  normalizeValidationState(estado) {
    if (estado === undefined || estado === null)
      return VALIDATION_STATES.PENDING;
    if (estado === true || estado === "true") return VALIDATION_STATES.APPROVED;
    if (estado === false || estado === "false")
      return VALIDATION_STATES.REJECTED;
    if (estado === "pendiente") return VALIDATION_STATES.PENDING;
    return VALIDATION_STATES.PENDING;
  }

  get isApproved() {
    return (
      this.validationState === VALIDATION_STATES.APPROVED ||
      this.validationState === VALIDATION_STATES.APPROVED_BOOL
    );
  }

  get isPending() {
    return this.validationState === VALIDATION_STATES.PENDING;
  }

  get isRejected() {
    return (
      this.validationState === VALIDATION_STATES.REJECTED ||
      this.validationState === VALIDATION_STATES.REJECTED_BOOL
    );
  }

  get statusLabel() {
    if (this.isApproved) return "Aprobado";
    if (this.isPending) return "Pendiente";
    if (this.isRejected) return "Rechazado";
    return "Desconocido";
  }

  get statusClass() {
    if (this.isApproved) return "badge bg-success";
    if (this.isPending) return "badge bg-warning";
    if (this.isRejected) return "badge bg-danger";
    return "badge bg-secondary";
  }
}

class CollectorStats {
  constructor(collectorId) {
    this.id = collectorId;
    this.name = "";
    this.fullName = "";
    this.approvedAmount = 0;
    this.pendingAmount = 0;
    this.rejectedAmount = 0;
    this.totalDonations = 0;
    this.approvedDonations = 0;
    this.pendingDonations = 0;
    this.rejectedDonations = 0;
  }

  get totalAmount() {
    return this.approvedAmount + this.pendingAmount;
  }

  get progressPercentage() {
    if (this.totalAmount === 0) return 0;
    return Math.round((this.approvedAmount / this.totalAmount) * 100);
  }

  get statusLabel() {
    if (this.pendingDonations > 0) return "Con pendientes";
    if (this.approvedDonations > 0) return "Activo";
    return "Inactivo";
  }

  get statusClass() {
    if (this.pendingDonations > 0) return "badge bg-warning";
    if (this.approvedDonations > 0) return "badge bg-success";
    return "badge bg-secondary";
  }
}

// ==================== SERVICIOS DE DATOS ====================
class DataService {
  static async fetchDonations() {
    try {
      const donationsRef = collection(db, COLLECTION_NAMES.DONATIONS);
      const snapshot = await getDocs(donationsRef);
      const donations = [];

      snapshot.docs.forEach((doc) => {
        donations.push({ id: doc.id, ...doc.data() });
      });

      return donations;
    } catch (error) {
      throw new Error("Error al obtener donaciones");
    }
  }

  static async fetchUsers() {
    try {
      const usersRef = collection(db, COLLECTION_NAMES.USERS);
      const snapshot = await getDocs(usersRef);
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw new Error("Error al obtener usuarios");
    }
  }

  static async fetchExpenses() {
    try {
      const expensesRef = collection(db, COLLECTION_NAMES.PAYMENTS);
      const q = query(expensesRef, orderBy("fechaGasto", "desc"), limit(50));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw new Error("Error al obtener gastos");
    }
  }

  static async addExpense(expenseData) {
    try {
      const expensesRef = collection(db, COLLECTION_NAMES.PAYMENTS);
      const cleanedData = this.cleanFirestoreData(expenseData);
      const docRef = await addDoc(expensesRef, cleanedData);
      return docRef.id;
    } catch (error) {
      throw new Error(`Error al registrar gasto: ${error.message}`);
    }
  }

  static cleanFirestoreData(data) {
    const cleaned = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        if (value === null) {
          cleaned[key] = null;
        } else if (typeof value === "object" && value.constructor === Object) {
          cleaned[key] = this.cleanFirestoreData(value);
        } else {
          cleaned[key] = value;
        }
      }
    }
    return cleaned;
  }
}

// ==================== PROCESAMIENTO DE DATOS ====================
class DataProcessor {
  static processDonationsData(donations, users) {
    const userMap = new Map(users.map((user) => [user.idUsuario, user]));

    const processedDonations = donations
      .map((donation) => {
        const user = userMap.get(donation.idRecolector);
        const donationData = new DonationData(donation.id, donation, user);
        return donationData;
      })
      .filter(() => true);

    return processedDonations;
  }

  static generateCollectorStats(processedDonations) {
    const statsMap = new Map();

    processedDonations.forEach((donation) => {
      const collectorId = donation.collector.id;

      if (!statsMap.has(collectorId)) {
        const stats = new CollectorStats(collectorId);
        stats.name = donation.collector.name;
        stats.fullName = donation.collector.fullName;
        statsMap.set(collectorId, stats);
      }

      const stats = statsMap.get(collectorId);
      stats.totalDonations++;

      if (donation.isApproved) {
        stats.approvedAmount += donation.amount;
        stats.approvedDonations++;
      } else if (donation.isPending) {
        stats.pendingAmount += donation.amount;
        stats.pendingDonations++;
      } else if (donation.isRejected) {
        stats.rejectedAmount += donation.amount;
        stats.rejectedDonations++;
      }
    });

    const collectorStats = Array.from(statsMap.values()).sort(
      (a, b) => b.totalAmount - a.totalAmount
    );

    return collectorStats;
  }

  static calculateTotalStats(collectorStats) {
    const stats = {
      totalRecolectores: collectorStats.length,
      totalRecaudado: collectorStats.reduce(
        (sum, collector) => sum + collector.approvedAmount,
        0
      ),
      donacionesActivas: collectorStats.reduce(
        (sum, collector) => sum + collector.approvedDonations,
        0
      ),
      donacionesPendientes: collectorStats.reduce(
        (sum, collector) => sum + collector.pendingDonations,
        0
      ),
    };

    return stats;
  }

  static prepareChartData(collectorStats, expenses = []) {
    const topCollectors = collectorStats.slice(0, 10);
    const expensesByCategory = this.processExpensesByCategory(expenses);

    return {
      performance: {
        labels: topCollectors.map((c) => c.name),
        approved: topCollectors.map((c) => c.approvedAmount),
        pending: topCollectors.map((c) => c.pendingAmount),
      },
      expenses: expensesByCategory,
    };
  }

  static processExpensesByCategory(expenses) {
    const categoryTotals = {
      educacion: 0,
      salud: 0,
      alimentacion: 0,
      vestimenta: 0,
      infraestructura: 0,
      otros: 0,
    };

    expenses.forEach((expense) => {
      const categoria = expense.categoria?.toLowerCase() || "otros";
      const monto = parseFloat(expense.monto) || 0;

      if (categoryTotals.hasOwnProperty(categoria)) {
        categoryTotals[categoria] += monto;
      } else {
        categoryTotals.otros += monto;
      }
    });

    const labels = Object.keys(categoryTotals).map(
      (cat) => cat.charAt(0).toUpperCase() + cat.slice(1)
    );

    const data = Object.values(categoryTotals);

    return {
      labels: labels,
      data: data,
    };
  }
}

// ==================== SISTEMA DE ALERTAS DE PRESUPUESTO ====================
class BudgetAlertManager {
  static showBudgetAlert(totalAvailable, totalSpent) {
    const percentage =
      totalAvailable > 0 ? (totalSpent / totalAvailable) * 100 : 0;
    const remaining = totalAvailable - totalSpent;

    this.hideAllAlerts();
    this.updateFinancialSummary(
      totalAvailable,
      totalSpent,
      remaining,
      percentage
    );

    if (percentage >= 80) {
      this.showCriticalAlert(totalAvailable, totalSpent, percentage);
      this.showBudgetToast(
        "🚨 ¡Presupuesto crítico! Gastos superiores al 80%",
        "danger"
      );
    } else if (percentage >= 50) {
      this.showWarningAlert(totalAvailable, totalSpent, percentage);
      this.showBudgetToast(
        "⚠️ Cuidado: Gastos superiores al 50% del presupuesto",
        "warning"
      );
    } else {
      this.showHealthyAlert(totalAvailable, totalSpent, percentage);
    }
  }

  static updateFinancialSummary(
    totalAvailable,
    totalSpent,
    remaining,
    percentage
  ) {
    const elements = {
      totalAvailableBudget: document.getElementById("totalAvailableBudget"),
      totalSpentBudget: document.getElementById("totalSpentBudget"),
      remainingBudget: document.getElementById("remainingBudget"),
      budgetPercentage: document.getElementById("budgetPercentage"),
      budgetProgressText: document.getElementById("budgetProgressText"),
      mainBudgetProgressBar: document.getElementById("mainBudgetProgressBar"),
      totalBudgetDisplay: document.getElementById("totalBudgetDisplay"),
    };

    if (elements.totalAvailableBudget) {
      elements.totalAvailableBudget.textContent =
        this.formatCurrency(totalAvailable);
    }
    if (elements.totalSpentBudget) {
      elements.totalSpentBudget.textContent = this.formatCurrency(totalSpent);
    }
    if (elements.remainingBudget) {
      elements.remainingBudget.textContent = this.formatCurrency(remaining);
      if (remaining < 0) {
        elements.remainingBudget.className = "fw-bold text-danger";
      } else if (percentage >= 80) {
        elements.remainingBudget.className = "fw-bold text-warning";
      } else {
        elements.remainingBudget.className = "fw-bold text-success";
      }
    }
    if (elements.budgetPercentage) {
      elements.budgetPercentage.textContent = `${percentage.toFixed(1)}%`;
    }
    if (elements.budgetProgressText) {
      elements.budgetProgressText.textContent = `${percentage.toFixed(
        1
      )}% utilizado`;
    }
    if (elements.totalBudgetDisplay) {
      elements.totalBudgetDisplay.textContent =
        this.formatCurrency(totalAvailable);
    }

    if (elements.mainBudgetProgressBar) {
      const clampedPercentage = Math.min(percentage, 100);
      elements.mainBudgetProgressBar.style.width = `${clampedPercentage}%`;
      elements.mainBudgetProgressBar.setAttribute(
        "aria-valuenow",
        clampedPercentage
      );

      elements.mainBudgetProgressBar.className = "progress-bar";
      if (percentage >= 80) {
        elements.mainBudgetProgressBar.classList.add("bg-danger");
      } else if (percentage >= 50) {
        elements.mainBudgetProgressBar.classList.add("bg-warning");
      } else {
        elements.mainBudgetProgressBar.classList.add("bg-success");
      }
    }
  }

  static showCriticalAlert(totalAvailable, totalSpent, percentage) {
    const alert = document.getElementById("criticalBudgetAlert");
    const message = document.getElementById("criticalAlertMessage");
    const progressBar = document.getElementById("criticalProgressBar");
    const details = document.getElementById("criticalBudgetDetails");

    if (alert && message && progressBar && details) {
      const remaining = totalAvailable - totalSpent;

      if (remaining < 0) {
        message.textContent = `¡Se ha excedido el presupuesto! Déficit de ${this.formatCurrency(
          Math.abs(remaining)
        )}.`;
      } else {
        message.textContent = `¡Presupuesto crítico! Solo quedan ${this.formatCurrency(
          remaining
        )} disponibles.`;
      }

      progressBar.style.width = `${Math.min(percentage, 100)}%`;
      details.textContent = `Gastos: ${this.formatCurrency(
        totalSpent
      )} de ${this.formatCurrency(totalAvailable)} disponibles`;

      alert.classList.remove("d-none");
      alert.classList.add("budget-alert-animate");
    }
  }

  static showWarningAlert(totalAvailable, totalSpent, percentage) {
    const alert = document.getElementById("highBudgetAlert");
    const message = document.getElementById("warningAlertMessage");
    const progressBar = document.getElementById("warningProgressBar");
    const details = document.getElementById("warningBudgetDetails");

    if (alert && message && progressBar && details) {
      const remaining = totalAvailable - totalSpent;

      message.textContent = `Gastos altos: ${percentage.toFixed(
        1
      )}% del presupuesto utilizado. Quedan ${this.formatCurrency(remaining)}.`;
      progressBar.style.width = `${percentage}%`;
      details.textContent = `Gastos: ${this.formatCurrency(
        totalSpent
      )} de ${this.formatCurrency(totalAvailable)} disponibles`;

      alert.classList.remove("d-none");
    }
  }

  static showHealthyAlert(totalAvailable, totalSpent, percentage) {
    const alert = document.getElementById("healthyBudgetAlert");
    const progressBar = document.getElementById("healthyProgressBar");
    const details = document.getElementById("healthyBudgetDetails");

    if (alert && progressBar && details) {
      progressBar.style.width = `${percentage}%`;
      details.textContent = `Gastos: ${this.formatCurrency(
        totalSpent
      )} de ${this.formatCurrency(totalAvailable)} disponibles`;

      if (totalSpent > 0 || totalAvailable > 0) {
        alert.classList.remove("d-none");
      }
    }
  }

  static hideAllAlerts() {
    const alerts = [
      "criticalBudgetAlert",
      "highBudgetAlert",
      "healthyBudgetAlert",
    ];
    alerts.forEach((alertId) => {
      const alert = document.getElementById(alertId);
      if (alert) {
        alert.classList.add("d-none");
        alert.classList.remove("budget-alert-animate");
      }
    });
  }

  static showBudgetToast(message, type = "warning") {
    const toast = document.getElementById("budgetToast");
    const toastMessage = document.getElementById("budgetToastMessage");

    if (toast && toastMessage) {
      toast.className = "toast align-items-center border-0";
      switch (type) {
        case "danger":
          toast.classList.add("text-white", "bg-danger");
          break;
        case "warning":
          toast.classList.add("text-white", "bg-warning");
          break;
        case "success":
          toast.classList.add("text-white", "bg-success");
          break;
        default:
          toast.classList.add("text-white", "bg-warning");
      }

      toastMessage.textContent = message;

      const bsToast = new bootstrap.Toast(toast, {
        autohide: true,
        delay: 8000,
      });
      bsToast.show();
    }
  }

  static formatCurrency(amount) {
    return `S/. ${amount.toLocaleString("es-PE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
}

// ==================== RENDERIZADO DE UI ====================
class UIRenderer {
  static updateStatsCards(stats, expenses = 0) {
    const elements = {
      totalRecolectores: document.getElementById("totalRecolectores"),
      totalRecaudado: document.getElementById("totalRecaudado"),
      donacionesActivas: document.getElementById("donacionesActivas"),
      gastosRegistrados: document.getElementById("gastosRegistrados"),
    };

    if (elements.totalRecolectores) {
      elements.totalRecolectores.textContent = stats.totalRecolectores;
    }
    if (elements.totalRecaudado) {
      elements.totalRecaudado.textContent = this.formatCurrency(
        stats.totalRecaudado
      );
    }
    if (elements.donacionesActivas) {
      elements.donacionesActivas.textContent = stats.donacionesActivas;
    }
    if (elements.gastosRegistrados) {
      elements.gastosRegistrados.textContent = this.formatCurrency(expenses);
    }
  }

  static formatCurrency(amount) {
    return `S/. ${amount.toLocaleString("es-PE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  static renderCollectorsTable(collectorStats) {
    const tbody = document.getElementById("recolectoresTableBody");
    if (!tbody) return;

    tbody.innerHTML = collectorStats
      .map(
        (collector) => `
        <tr>
          <td>
            <div>
              <h6 class="mb-0">${collector.fullName}</h6>
              <small class="text-muted">ID: ${collector.id}</small>
            </div>
          </td>
          <td>
            <div>
              <strong>${collector.totalDonations}</strong>
              <small class="text-muted d-block">
                ${collector.approvedDonations} aprobadas
                ${
                  collector.pendingDonations > 0
                    ? `, ${collector.pendingDonations} pendientes`
                    : ""
                }
                ${
                  collector.rejectedDonations > 0
                    ? `, ${collector.rejectedDonations} rechazadas`
                    : ""
                }
              </small>
            </div>
          </td>
          <td>
            <div>
              <strong>${this.formatCurrency(collector.approvedAmount)}</strong>
              ${
                collector.pendingAmount > 0
                  ? `<small class="text-warning d-block">+ ${this.formatCurrency(
                      collector.pendingAmount
                    )} pendiente</small>`
                  : ""
              }
              ${
                collector.rejectedAmount > 0
                  ? `<small class="text-danger d-block">- ${this.formatCurrency(
                      collector.rejectedAmount
                    )} rechazado</small>`
                  : ""
              }
            </div>
          </td>
          <td>
            <div class="progress mb-1" style="height: 8px;">
              <div class="progress-bar bg-success" style="width: ${
                collector.progressPercentage
              }%"></div>
            </div>
            <small class="text-muted">${
              collector.progressPercentage
            }% confirmado</small>
          </td>
          <td>
            <span class="${collector.statusClass}">${
          collector.statusLabel
        }</span>
          </td>
        </tr>
      `
      )
      .join("");
  }

  static renderExpensesTable(expenses, users) {
    const tbody = document.getElementById("expensesTableBody");
    if (!tbody) return;

    const userMap = new Map(users.map((user) => [user.idUsuario, user]));

    tbody.innerHTML = expenses
      .map((expense) => {
        const responsible = userMap.get(expense.responsable);
        const responsibleName = responsible
          ? `${responsible.nombreUsuario} ${responsible.apellidoUsuario}`.trim()
          : expense.responsable || "No especificado";

        return `
        <tr>
          <td>${new Date(expense.fechaGasto).toLocaleDateString("es-PE")}</td>
          <td>
            <div>
              <strong>${expense.descripcion}</strong>
              ${
                expense.justificacion
                  ? `<small class="text-muted d-block">${expense.justificacion}</small>`
                  : ""
              }
            </div>
          </td>
          <td>
            <span class="badge bg-secondary">${expense.categoria}</span>
          </td>
          <td>
            <strong>${this.formatCurrency(expense.monto)}</strong>
          </td>
          <td>
            <small class="text-muted">${responsibleName}</small>
          </td>
          <td>
            ${
              expense.comprobante
                ? `<a href="${expense.comprobante}" target="_blank" class="btn btn-sm btn-outline-primary" title="Ver comprobante">
                  <i class="fas fa-file-alt"></i>
                </a>`
                : '<span class="text-muted">Sin comprobante</span>'
            }
          </td>
        </tr>
      `;
      })
      .join("");
  }

  static populateExpenseSelects(collectorStats, processedDonations) {
    const donationSelect = document.getElementById("expenseDonation");
    if (donationSelect) {
      donationSelect.innerHTML =
        '<option value="">Seleccionar donación</option>' +
        processedDonations
          .filter((donation) => donation.isApproved)
          .map(
            (donation) => `
            <option value="${donation.id}">
              ${donation.collector.fullName} - ${this.formatCurrency(
              donation.amount
            )} (${new Date(donation.date).toLocaleDateString("es-PE")})
            </option>
          `
          )
          .join("");
    }

    const responsibleSelect = document.getElementById("expenseResponsible");
    if (responsibleSelect) {
      responsibleSelect.innerHTML =
        '<option value="">Seleccionar responsable</option>' +
        collectorStats
          .map(
            (collector) => `
            <option value="${collector.id}">${collector.fullName}</option>
          `
          )
          .join("");
    }
  }
}

// ==================== GRÁFICOS ====================
class ChartManager {
  static performanceChart = null;
  static expensesChart = null;

  static initPerformanceChart(chartData) {
    const ctx = document.getElementById("performanceChart");
    if (!ctx) return;

    if (this.performanceChart) {
      this.performanceChart.destroy();
    }

    this.performanceChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: chartData.performance.labels,
        datasets: [
          {
            label: "Donaciones Aprobadas",
            data: chartData.performance.approved,
            backgroundColor: "rgba(40, 167, 69, 0.8)",
            borderColor: "rgba(40, 167, 69, 1)",
            borderWidth: 1,
          },
          {
            label: "Donaciones Pendientes",
            data: chartData.performance.pending,
            backgroundColor: "rgba(255, 193, 7, 0.8)",
            borderColor: "rgba(255, 193, 7, 1)",
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function (value) {
                return "S/. " + value.toLocaleString("es-PE");
              },
            },
          },
        },
      },
    });
  }

  static initExpensesChart(chartData) {
    const ctx = document.getElementById("expensesChart");
    if (!ctx) return;

    if (this.expensesChart) {
      this.expensesChart.destroy();
    }

    const hasData = chartData.expenses.data.some((value) => value > 0);

    if (!hasData) {
      ctx.getContext("2d").clearRect(0, 0, ctx.width, ctx.height);
      const context = ctx.getContext("2d");
      context.font = "16px Arial";
      context.fillStyle = "#666";
      context.textAlign = "center";
      context.fillText(
        "No hay gastos registrados",
        ctx.width / 2,
        ctx.height / 2
      );
      return;
    }

    this.expensesChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: chartData.expenses.labels,
        datasets: [
          {
            data: chartData.expenses.data,
            backgroundColor: [
              "#FF6384",
              "#36A2EB",
              "#FFCE56",
              "#4BC0C0",
              "#9966FF",
              "#FF9F40",
            ],
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
              padding: 15,
              usePointStyle: true,
              font: {
                size: 12,
              },
            },
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                const label = context.label || "";
                const value = context.parsed || 0;
                return `${label}: S/. ${value.toLocaleString("es-PE", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`;
              },
            },
          },
        },
        animation: {
          animateScale: true,
          animateRotate: true,
        },
      },
    });
  }
}

// ==================== GESTIÓN DE GASTOS ====================
class ExpenseManager {
  static isProcessing = false;

  static async saveExpense() {
    if (this.isProcessing) return;

    try {
      this.isProcessing = true;
      const formData = this.getFormData();
      const validationResult = this.validateForm(formData);

      if (!validationResult.isValid) {
        this.showError(validationResult.message);
        return;
      }

      this.showLoading(true);

      const expenseData = await this.prepareExpenseData(formData);
      const expenseId = await DataService.addExpense(expenseData);

      this.showSuccess("Gasto registrado exitosamente");
      this.resetForm();
      this.hideModal();

      setTimeout(async () => {
        await InventoryManager.loadData();
      }, 1000);
    } catch (error) {
      this.showError("Error al registrar el gasto: " + error.message);
    } finally {
      this.showLoading(false);
      this.isProcessing = false;
    }
  }

  static getFormData() {
    return {
      date: document.getElementById("expenseDate").value,
      amount: parseFloat(document.getElementById("expenseAmount").value),
      description: document.getElementById("expenseDescription").value,
      category: document.getElementById("expenseCategory").value,
      donation: document.getElementById("expenseDonation").value,
      receipt: document.getElementById("expenseReceipt").files[0],
      justification: document.getElementById("expenseJustification").value,
      location: document.getElementById("expenseLocation").value,
      responsible: document.getElementById("expenseResponsible").value,
      notes: document.getElementById("expenseNotes").value,
    };
  }

  static validateForm(data) {
    if (!data.date) return { isValid: false, message: "La fecha es requerida" };
    if (!data.amount || data.amount <= 0)
      return { isValid: false, message: "El monto debe ser mayor a 0" };
    if (!data.description.trim())
      return { isValid: false, message: "La descripción es requerida" };
    if (!data.category)
      return { isValid: false, message: "La categoría es requerida" };
    if (!data.donation)
      return {
        isValid: false,
        message: "Debe seleccionar una donación de origen",
      };

    if (data.receipt) {
      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "application/pdf",
      ];
      if (!allowedTypes.includes(data.receipt.type)) {
        return {
          isValid: false,
          message: "Solo se permiten archivos JPG, PNG o PDF",
        };
      }

      const maxSizeMB = 10;
      const fileSizeMB = data.receipt.size / (1024 * 1024);
      if (fileSizeMB > maxSizeMB) {
        return {
          isValid: false,
          message: `El archivo es demasiado grande. Máximo ${maxSizeMB}MB`,
        };
      }
    }

    if (!data.justification.trim())
      return { isValid: false, message: "La justificación es requerida" };
    if (!data.location.trim())
      return { isValid: false, message: "El lugar de compra es requerido" };
    if (!data.responsible)
      return { isValid: false, message: "Debe seleccionar un responsable" };

    return { isValid: true };
  }

  static async prepareExpenseData(formData) {
    try {
      let receiptUrl = "";
      let fileType = null;

      if (formData.receipt) {
        try {
          this.showUploadProgress("Subiendo comprobante...");
          fileType = formData.receipt.type.startsWith("image/")
            ? "image"
            : "pdf";
          receiptUrl = await this.uploadReceipt(formData.receipt);

          if (!receiptUrl || typeof receiptUrl !== "string") {
            throw new Error("No se obtuvo una URL válida del archivo");
          }

          this.showUploadProgress("Comprobante subido exitosamente");
        } catch (error) {
          this.showUploadProgress(
            "Error al subir comprobante. Continuando sin archivo..."
          );
          receiptUrl = "";
          fileType = null;
        }
      }

      const expenseData = {
        fechaGasto: formData.date,
        monto: formData.amount,
        descripcion: formData.description,
        categoria: formData.category,
        donacionOrigen: formData.donation,
        comprobante: receiptUrl,
        tipoComprobante: fileType,
        justificacion: formData.justification,
        lugarCompra: formData.location,
        responsable: formData.responsible,
        notas: formData.notes || "",
        fechaRegistro: serverTimestamp(),
      };

      return expenseData;
    } catch (error) {
      throw error;
    }
  }

  static async uploadReceipt(file) {
    try {
      const fileType = file.type;
      const fileSizeMB = file.size / (1024 * 1024);

      if (fileSizeMB > 10) {
        throw new Error("El archivo es demasiado grande. Máximo 10MB.");
      }

      if (fileType.startsWith("image/")) {
        return await this.uploadImageToCloudinary(file);
      } else if (fileType === "application/pdf") {
        return await this.uploadToFileIO(file);
      } else {
        throw new Error("Tipo de archivo no soportado. Use JPG, PNG o PDF.");
      }
    } catch (error) {
      throw error;
    }
  }

  static async uploadImageToCloudinary(file) {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", CLOUDINARY_CONFIG.uploadPreset);
      formData.append("cloud_name", CLOUDINARY_CONFIG.cloudName);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const data = await response.json();

      if (data.secure_url) {
        return data.secure_url;
      } else {
        throw new Error("No se recibió URL de la imagen");
      }
    } catch (error) {
      throw error;
    }
  }

  static async uploadToFileIO(file) {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("https://file.io", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Error al subir PDF");
      }

      return data.link;
    } catch (error) {
      const base64Data = await this.convertToBase64(file);
      return base64Data;
    }
  }

  static async convertToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = function (e) {
        resolve(e.target.result);
      };
      reader.onerror = function (error) {
        reject(new Error("Error al procesar el archivo"));
      };
      reader.readAsDataURL(file);
    });
  }

  static showError(message) {
    this.showToast(message, "bg-danger");
  }

  static showSuccess(message) {
    this.showToast(message, "bg-success");
  }

  static showToast(message, bgClass) {
    let toastContainer = document.querySelector(".toast-container");
    if (!toastContainer) {
      toastContainer = document.createElement("div");
      toastContainer.className =
        "toast-container position-fixed top-0 end-0 p-3";
      toastContainer.style.zIndex = "9999";
      document.body.appendChild(toastContainer);
    }

    const toastHtml = `
      <div class="toast align-items-center text-white ${bgClass} border-0" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="d-flex">
          <div class="toast-body">${message}</div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
      </div>
    `;

    const toastWrapper = document.createElement("div");
    toastWrapper.innerHTML = toastHtml;
    const toastElement = toastWrapper.firstElementChild;
    toastContainer.appendChild(toastElement);

    const toast = new bootstrap.Toast(toastElement, {
      autohide: true,
      delay: 5000,
    });
    toast.show();

    toastElement.addEventListener("hidden.bs.toast", () => {
      toastElement.remove();
    });
  }

  static showUploadProgress(message) {
    const button = document.querySelector("#addExpenseModal .btn-warning");
    if (button) {
      button.innerHTML = `<i class="fas fa-cloud-upload-alt me-1"></i>${message}`;
    }
  }

  static showLoading(show) {
    const button = document.querySelector("#addExpenseModal .btn-warning");
    if (button) {
      button.disabled = show;
      button.innerHTML = show
        ? '<i class="fas fa-spinner fa-spin me-1"></i>Guardando...'
        : '<i class="fas fa-save me-1"></i>Registrar Gasto';
    }
  }

  static resetForm() {
    const form = document.getElementById("addExpenseForm");
    if (form) {
      form.reset();
      const expenseDate = document.getElementById("expenseDate");
      if (expenseDate) {
        expenseDate.value = new Date().toISOString().split("T")[0];
      }
    }
  }

  static hideModal() {
    const modal = bootstrap.Modal.getInstance(
      document.getElementById("addExpenseModal")
    );
    if (modal) modal.hide();
  }
}

// ==================== GESTOR DE EXPORTACIÓN ====================
class ExportManager {
  static currentData = {
    collectorStats: [],
    expenses: [],
    totalStats: {},
    users: [],
  };

  static updateCurrentData(collectorStats, expenses, totalStats, users) {
    this.currentData = {
      collectorStats,
      expenses,
      totalStats,
      users,
    };
  }

  static async exportToExcel() {
    try {
      this.showExportLoading(true, "excel");

      if (
        !this.currentData.collectorStats.length &&
        !this.currentData.expenses.length
      ) {
        this.showError("No hay datos disponibles para exportar");
        return;
      }

      const now = new Date();
      const dateStr = now.toISOString().split("T")[0];
      const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-");
      const filename = `inventario_donaciones_${dateStr}_${timeStr}.xlsx`;

      if (typeof window.exportInventoryToExcel === "function") {
        await window.exportInventoryToExcel(
          this.currentData.collectorStats,
          this.currentData.expenses,
          this.currentData.totalStats,
          this.currentData.users,
          filename
        );
      } else {
        throw new Error("Exportador de Excel no disponible");
      }
    } catch (error) {
      this.showError("Error al exportar el inventario: " + error.message);
    } finally {
      this.showExportLoading(false, "excel");
    }
  }

  static async exportToPDF() {
    try {
      this.showExportLoading(true, "pdf");

      if (
        !this.currentData.collectorStats.length &&
        !this.currentData.expenses.length
      ) {
        this.showError("No hay datos disponibles para exportar");
        return;
      }

      // Verificar si el generador PDF está disponible
      if (
        typeof window.PDFExportManager !== "undefined" &&
        window.PDFExportManager.exportToPDF
      ) {
        await window.PDFExportManager.exportToPDF();
        this.showSuccess("Reporte PDF generado exitosamente");
      } else {
        // Cargar el módulo PDF dinámicamente
        await this.loadPDFModule();

        // Intentar nuevamente después de cargar
        if (
          typeof window.PDFExportManager !== "undefined" &&
          window.PDFExportManager.exportToPDF
        ) {
          await window.PDFExportManager.exportToPDF();
          this.showSuccess("Reporte PDF generado exitosamente");
        } else {
          throw new Error("No se pudo cargar el generador de reportes PDF");
        }
      }
    } catch (error) {
      this.showError("Error al generar el reporte PDF: " + error.message);
    } finally {
      this.showExportLoading(false, "pdf");
    }
  }

  static async loadPDFModule() {
    return new Promise((resolve, reject) => {
      // Verificar si ya existe el script
      if (document.querySelector('script[src*="pdf-export-manager.js"]')) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = "./js/pdf-export-manager.js";
      script.onload = () => {
        resolve();
      };
      script.onerror = () => {
        reject(new Error("No se pudo cargar el módulo de exportación PDF"));
      };

      document.head.appendChild(script);
    });
  }

  static showExportLoading(show, type = "excel") {
    const excelBtn = document.querySelector(".btn-success");
    const pdfBtn = document.querySelector(".btn-danger");

    if (type === "excel" && excelBtn) {
      excelBtn.disabled = show;
      excelBtn.innerHTML = show
        ? '<i class="fas fa-spinner fa-spin me-1"></i>Exportando...'
        : '<i class="fas fa-file-excel me-1"></i>Exportar Excel';
    }

    if (type === "pdf" && pdfBtn) {
      pdfBtn.disabled = show;
      pdfBtn.innerHTML = show
        ? '<i class="fas fa-spinner fa-spin me-1"></i>Generando PDF...'
        : '<i class="fas fa-file-pdf me-1"></i>Exportar PDF';
    }
  }

  static showError(message) {
    ExpenseManager.showError(message);
  }

  static showSuccess(message) {
    ExpenseManager.showSuccess(message);
  }
}

// ==================== GESTOR PRINCIPAL ====================
class InventoryManager {
  static currentUsers = [];

  static async init() {
    try {
      await this.checkAuthentication();
      await this.loadData();
      this.setupEventListeners();
      this.setupRealtimeUpdates();
    } catch (error) {
      this.showError("Error al inicializar el sistema");
    }
  }

  static async checkAuthentication() {
    return new Promise((resolve) => {
      onAuthStateChanged(auth, (user) => {
        if (user) {
          resolve(user);
        } else {
          window.location.href = "login.html";
        }
      });
    });
  }

  static async loadData() {
    try {
      this.showLoading(true);

      const [donations, users, expenses] = await Promise.all([
        DataService.fetchDonations(),
        DataService.fetchUsers(),
        DataService.fetchExpenses(),
      ]);

      this.currentUsers = users;

      const processedDonations = DataProcessor.processDonationsData(
        donations,
        users
      );
      const collectorStats =
        DataProcessor.generateCollectorStats(processedDonations);
      const totalStats = DataProcessor.calculateTotalStats(collectorStats);
      const chartData = DataProcessor.prepareChartData(
        collectorStats,
        expenses
      );

      const totalExpenses = expenses.reduce(
        (sum, exp) => sum + parseFloat(exp.monto || 0),
        0
      );
      const totalAvailable = totalStats.totalRecaudado;

      UIRenderer.updateStatsCards(totalStats, totalExpenses);
      UIRenderer.renderCollectorsTable(collectorStats);
      UIRenderer.renderExpensesTable(expenses, users);
      UIRenderer.populateExpenseSelects(collectorStats, processedDonations);

      ChartManager.initPerformanceChart(chartData);
      ChartManager.initExpensesChart(chartData);

      BudgetAlertManager.showBudgetAlert(totalAvailable, totalExpenses);
      ExportManager.updateCurrentData(
        collectorStats,
        expenses,
        totalStats,
        users
      );
    } catch (error) {
      this.showError("Error al cargar los datos");
    } finally {
      this.showLoading(false);
    }
  }

  static setupEventListeners() {
    // Event listener para guardar gastos
    const saveExpenseBtn = document.querySelector(
      "#addExpenseModal .btn-warning"
    );
    if (saveExpenseBtn) {
      saveExpenseBtn.replaceWith(saveExpenseBtn.cloneNode(true));
      const newButton = document.querySelector("#addExpenseModal .btn-warning");
      newButton.addEventListener("click", (e) => {
        e.preventDefault();
        ExpenseManager.saveExpense();
      });
    }

    // Botón de exportar Excel
    const exportExcelBtn = document.querySelector(".btn-success");
    if (
      exportExcelBtn &&
      exportExcelBtn.textContent.includes("Exportar Excel")
    ) {
      exportExcelBtn.addEventListener("click", (e) => {
        e.preventDefault();
        ExportManager.exportToExcel();
      });
    }

    // Botón de exportar PDF
    const exportPdfBtn = document.querySelector(".btn-danger");
    if (exportPdfBtn && exportPdfBtn.textContent.includes("Exportar PDF")) {
      exportPdfBtn.addEventListener("click", (e) => {
        e.preventDefault();
        ExportManager.exportToPDF();
      });
    }

    // Configurar fecha por defecto
    const expenseDate = document.getElementById("expenseDate");
    if (expenseDate) {
      expenseDate.value = new Date().toISOString().split("T")[0];
    }
  }

  static setupRealtimeUpdates() {
    setInterval(async () => {
      try {
        await this.loadData();
      } catch (error) {
        // Error silencioso para evitar spam
      }
    }, 30000);
  }

  static showLoading(show) {
    const loader = document.querySelector(".loading-overlay");
    if (loader) {
      loader.style.display = show ? "block" : "none";
    }
  }

  static showError(message) {
    ExpenseManager.showError(message);
  }

  static showSuccess(message) {
    ExpenseManager.showSuccess(message);
  }
}

// ==================== FUNCIONES GLOBALES ====================
window.saveExpense = () => ExpenseManager.saveExpense();
window.navigateToPage = (page) => {
  window.location.href = page;
};
window.exportInventoryManually = () => {
  ExportManager.exportToExcel();
};
window.exportInventoryToPDF = () => {
  ExportManager.exportToPDF();
};
window.getCurrentInventoryData = () => {
  return ExportManager.currentData;
};

// ==================== INICIALIZACIÓN ====================
document.addEventListener("DOMContentLoaded", () => {
  InventoryManager.init();
});

export { InventoryManager, DataService, ExpenseManager, ExportManager };
