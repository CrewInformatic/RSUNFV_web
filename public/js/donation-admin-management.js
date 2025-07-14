// donations_management.js - Optimizado para producción con seguridad de recolectores
import {
  auth,
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  updateDoc,
  onAuthStateChanged,
  Timestamp,
} from "./firebase_config.js";
import { EmailManager } from "./donation-correo.js";

class DonationsManager {
  constructor() {
    this.donations = [];
    this.filteredDonations = [];
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.totalPages = 0;
    this.selectedDonations = new Set();
    this.currentUser = null;
    this.currentUserData = null; // Datos completos del usuario actual
    this.usersCache = new Map();
    this.chartInstances = new Map();
    this.modalCleanupHandlers = new Map();
    this.emailManager = null;
    this.init();
  }

  async init() {
    try {
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          this.currentUser = user;
          // Cargar datos completos del usuario actual
          await this.loadCurrentUserData();
          this.loadDonations();
        } else {
          this.redirectToLogin();
        }
      });

      this.setupEventListeners();
    } catch (error) {
      this.showError("Error al inicializar la aplicación");
    }
  }

  // Cargar datos completos del usuario actual
  async loadCurrentUserData() {
    try {
      if (this.currentUser) {
        const userData = await this.getUserData(this.currentUser.uid);
        this.currentUserData = userData;
      }
    } catch (error) {
      this.currentUserData = null;
    }
  }

  // Verificar si el usuario actual puede gestionar la donación
  canManageDonation(donation) {
    if (!this.currentUser || !donation) {
      return { canManage: false, reason: "Datos incompletos" };
    }

    // Si la donación no tiene recolector asignado, cualquiera puede gestionarla
    if (!donation.idRecolector) {
      return { canManage: true, reason: "Sin recolector asignado" };
    }

    // Si el usuario actual es el recolector asignado
    if (donation.idRecolector === this.currentUser.uid) {
      return { canManage: true, reason: "Recolector asignado" };
    }

    // Si el usuario actual es administrador (opcional - puedes quitar esta línea si no quieres que los admins puedan gestionar todo)
    if (this.currentUserData && this.currentUserData.rol === "administrador") {
      return { canManage: true, reason: "Administrador" };
    }

    return {
      canManage: false,
      reason: "Solo el recolector asignado puede gestionar esta donación",
    };
  }

  // Verificar permisos antes de abrir modal de cambio de estado
  openChangeStatusModal(donationId) {
    const donation = this.donations.find((d) => d.id === donationId);
    if (!donation) {
      this.showError("Donación no encontrada");
      return;
    }

    const permission = this.canManageDonation(donation);
    if (!permission.canManage) {
      this.showError(
        `No tienes permisos para gestionar esta donación. ${permission.reason}`
      );
      return;
    }

    try {
      // Llenar los datos del modal
      document.getElementById("changeStatusDonationId").value = donationId;
      document.getElementById(
        "changeStatusDonorInfo"
      ).textContent = `${this.getDonorName(donation)} - ${
        donation.EmailUsuarioDonador || "Sin email"
      }`;
      document.getElementById("changeStatusCurrent").textContent =
        this.getStatusText(donation.estadoValidacion);

      // Limpiar formulario
      document.getElementById("newStatus").value = "";
      document.getElementById("statusComment").value = "";
      document.getElementById("assignCollector").value = "";
      document.getElementById("receptionDescription").value = "";

      // Ocultar secciones condicionales
      document.getElementById("collectorAssignmentDiv").style.display = "none";
      document.getElementById("receptionDescriptionDiv").style.display = "none";

      this.showModal("changeStatusModal");
    } catch (error) {
      this.showError("Error al abrir el modal");
    }
  }

  // Verificar permisos antes de validar donación
  async validateDonation(donationId) {
    const donation = this.donations.find((d) => d.id === donationId);
    if (!donation) {
      this.showError("Donación no encontrada");
      return;
    }

    const permission = this.canManageDonation(donation);
    if (!permission.canManage) {
      this.showError(`No puedes validar esta donación. ${permission.reason}`);
      return;
    }

    try {
      const donationRef = doc(db, "donaciones", donationId);
      await updateDoc(donationRef, {
        estadoValidacion: true,
        UsuarioEstadoValidacion: this.currentUser.uid,
        fechaValidacion: Timestamp.now(),
      });

      this.showSuccess("Donación validada exitosamente");
      await this.loadDonations();
    } catch (error) {
      this.showError("Error al validar la donación");
    }
  }

  // Verificar permisos antes de rechazar donación
  async rejectDonation(donationId) {
    const donation = this.donations.find((d) => d.id === donationId);
    if (!donation) {
      this.showError("Donación no encontrada");
      return;
    }

    const permission = this.canManageDonation(donation);
    if (!permission.canManage) {
      this.showError(`No puedes rechazar esta donación. ${permission.reason}`);
      return;
    }

    try {
      const donationRef = doc(db, "donaciones", donationId);
      await updateDoc(donationRef, {
        estadoValidacion: false,
        UsuarioEstadoValidacion: this.currentUser.uid,
        fechaRechazo: Timestamp.now(),
      });

      this.showSuccess("Donación rechazada");
      await this.loadDonations();
    } catch (error) {
      this.showError("Error al rechazar la donación");
    }
  }

  // Verificar permisos antes de actualizar estado
  async updateDonationStatus() {
    const donationId = document.getElementById("changeStatusDonationId").value;
    const donation = this.donations.find((d) => d.id === donationId);

    if (!donation) {
      this.showError("Donación no encontrada");
      return;
    }

    const permission = this.canManageDonation(donation);
    if (!permission.canManage) {
      this.showError(
        `No tienes permisos para actualizar esta donación. ${permission.reason}`
      );
      return;
    }

    const newStatus = document.getElementById("newStatus").value;
    const comment = document.getElementById("statusComment").value;
    const assignedCollector = document.getElementById("assignCollector").value;
    const receptionDescription = document.getElementById(
      "receptionDescription"
    ).value;

    if (!donationId || !newStatus) {
      this.showWarning("Por favor completa todos los campos requeridos");
      return;
    }

    try {
      const donationRef = doc(db, "donaciones", donationId);
      const updateData = {
        estadoValidacion: this.convertStatusToBoolean(newStatus),
        UsuarioEstadoValidacion: this.currentUser.uid,
        fechaActualizacionEstado: Timestamp.now(),
        comentarioEstado: comment || null,
      };

      // Agregar campos adicionales según el estado
      if (newStatus === "validado") {
        if (assignedCollector) {
          updateData.idRecolector = assignedCollector;
        }
        if (receptionDescription) {
          updateData.descripcionRecepcion = receptionDescription;
        }
        updateData.fechaValidacion = Timestamp.now();
      } else if (newStatus === "rechazado") {
        updateData.fechaRechazo = Timestamp.now();
      }

      await updateDoc(donationRef, updateData);

      // Cerrar modal
      this.closeModal("changeStatusModal");

      // Mostrar mensaje de éxito
      this.showSuccess(`Estado cambiado a: ${this.getStatusText(newStatus)}`);

      // Recargar donaciones
      await this.loadDonations();
    } catch (error) {
      this.showError("Error al actualizar el estado de la donación");
    }
  }

  // Verificar permisos para validación masiva
  async validateAllSelected() {
    if (this.selectedDonations.size === 0) {
      this.showWarning("Selecciona al menos una donación");
      return;
    }

    // Verificar permisos para cada donación seleccionada
    const unauthorizedDonations = [];
    const authorizedDonations = [];

    for (const donationId of this.selectedDonations) {
      const donation = this.donations.find((d) => d.id === donationId);
      if (donation) {
        const permission = this.canManageDonation(donation);
        if (permission.canManage) {
          authorizedDonations.push(donationId);
        } else {
          unauthorizedDonations.push({
            id: donationId,
            donor: this.getDonorName(donation),
          });
        }
      }
    }

    if (unauthorizedDonations.length > 0) {
      const donorNames = unauthorizedDonations.map((d) => d.donor).join(", ");
      this.showError(
        `No tienes permisos para validar las donaciones de: ${donorNames}`
      );
      return;
    }

    if (authorizedDonations.length === 0) {
      this.showWarning("No hay donaciones autorizadas para validar");
      return;
    }

    try {
      const promises = authorizedDonations.map((donationId) => {
        const donationRef = doc(db, "donaciones", donationId);
        return updateDoc(donationRef, {
          estadoValidacion: true,
          UsuarioEstadoValidacion: this.currentUser.uid,
          fechaValidacion: Timestamp.now(),
        });
      });

      await Promise.all(promises);
      this.selectedDonations.clear();
      this.showSuccess(`${promises.length} donaciones validadas exitosamente`);
      await this.loadDonations();
    } catch (error) {
      this.showError("Error al validar las donaciones seleccionadas");
    }
  }

  // Modificar la creación de filas para mostrar botones según permisos
  createDonationRow(donation) {
    const row = document.createElement("tr");
    row.className = "donation-row";
    row.dataset.donationId = donation.id;

    const hasVoucher = this.checkVoucherExists(donation);
    const isChecked = this.selectedDonations.has(donation.id);
    const permission = this.canManageDonation(donation);

    // Determinar si los botones deben estar habilitados
    const canValidate =
      permission.canManage && !this.isValidated(donation.estadoValidacion);
    const canReject =
      permission.canManage && !this.isRejected(donation.estadoValidacion);
    const canChangeStatus = permission.canManage;

    row.innerHTML = `
    <td>
      <input type="checkbox" class="form-check-input donation-checkbox" 
             value="${donation.id}" ${isChecked ? "checked" : ""}>
    </td>
    <td>
      <div class="d-flex align-items-center">
        <div class="avatar-circle me-2">
          <i class="fas fa-user"></i>
        </div>
        <div>
          <div class="fw-bold">${this.getDonorName(donation)}</div>
          <small class="text-muted">${donation.Tipo_Usuario}</small>
          ${
            !permission.canManage && donation.idRecolector
              ? `<small class="text-warning d-block"><i class="fas fa-lock"></i> Asignada a otro recolector</small>`
              : ""
          }
        </div>
      </div>
    </td>
    <td>
      <span class="fw-bold text-success">S/ ${parseFloat(
        donation.monto
      ).toFixed(2)}</span>
    </td>
    <td>
      <span class="text-muted">${donation.fechaFormateada}</span>
    </td>
    <td class="text-center">
      ${
        hasVoucher
          ? `<button class="btn btn-sm btn-outline-primary" onclick="donationsManager.viewVoucher('${donation.id}')">
            <i class="fas fa-eye"></i>
          </button>`
          : `<span class="text-muted">Sin voucher</span>`
      }
    </td>
    <td>${this.getStatusBadge(donation.estadoValidacion)}</td>
    <td>
      <span class="text-muted">${this.getCollectorName(donation)}</span>
    </td>
    <td>
      <div class="btn-group" role="group">
        <button class="btn btn-sm btn-outline-info" 
                onclick="donationsManager.openChangeStatusModal('${
                  donation.id
                }')"
                title="${
                  canChangeStatus
                    ? "Cambiar Estado"
                    : "Sin permisos para cambiar estado"
                }"
                ${!canChangeStatus ? "disabled" : ""}>
        </button>
        <button class="btn btn-sm btn-outline-success" 
                onclick="donationsManager.validateDonation('${donation.id}')"
                title="${
                  canValidate
                    ? "Validar"
                    : permission.canManage
                    ? "Ya validada"
                    : "Sin permisos"
                }"
                ${!canValidate ? "disabled" : ""}>
          <i class="fas fa-check"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger" 
                onclick="donationsManager.rejectDonation('${donation.id}')"
                title="${
                  canReject
                    ? "Rechazar"
                    : permission.canManage
                    ? "Ya rechazada"
                    : "Sin permisos"
                }"
                ${!canReject ? "disabled" : ""}>
          <i class="fas fa-times"></i>
        </button>
      </div>
    </td>
  `;

    const checkbox = row.querySelector(".donation-checkbox");
    checkbox.addEventListener("change", (e) => {
      if (e.target.checked) {
        this.selectedDonations.add(donation.id);
      } else {
        this.selectedDonations.delete(donation.id);
      }
      this.updateSelectAllState();
    });

    return row;
  }

  openSendEmailModal() {
    try {
      // Inicializar EmailManager si no existe
      if (!this.emailManager) {
        this.emailManager = new EmailManager();
      }

      // Pasar las donaciones cargadas al EmailManager
      if (this.emailManager && this.donations.length > 0) {
        this.emailManager.allDonations = [...this.donations];
      }

      // Actualizar selecciones
      if (this.emailManager && this.selectedDonations.size > 0) {
        this.emailManager.selectedDonations = new Set(this.selectedDonations);
      }

      // Mostrar el modal
      this.emailManager.showModal("sendEmailModal");
    } catch (error) {
      this.showError("Error al abrir el modal de correos");
    }
  }

  syncWithEmailManager() {
    if (this.emailManager) {
      this.emailManager.allDonations = [...this.donations];
      this.emailManager.selectedDonations = new Set(this.selectedDonations);
    }
  }

  getSelectedDonations() {
    return Array.from(this.selectedDonations)
      .map((donationId) => {
        return this.donations.find((d) => d.id === donationId);
      })
      .filter((donation) => donation !== undefined);
  }

  // Función para manejar el cambio de estado en el select
  handleStatusChange() {
    const newStatus = document.getElementById("newStatus").value;
    const collectorDiv = document.getElementById("collectorAssignmentDiv");
    const receptionDiv = document.getElementById("receptionDescriptionDiv");

    // Mostrar/ocultar secciones según el estado seleccionado
    if (newStatus === "validado") {
      collectorDiv.style.display = "block";
      receptionDiv.style.display = "block";
    } else {
      collectorDiv.style.display = "none";
      receptionDiv.style.display = "none";
    }
  }

  // Función auxiliar para convertir string a boolean
  convertStatusToBoolean(status) {
    switch (status.toLowerCase()) {
      case "validado":
        return true;
      case "rechazado":
        return false;
      case "pendiente":
      default:
        return null;
    }
  }

  // Función auxiliar para obtener texto del estado
  getStatusText(status) {
    if (status === true || status === "validado") return "Validado";
    if (status === false || status === "rechazado") return "Rechazado";
    return "Pendiente";
  }

  // Función para cerrar modal
  closeModal(modalId) {
    try {
      const modalElement = document.getElementById(modalId);
      if (modalElement) {
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
          modal.hide();
        }
      }
    } catch (error) {}
  }

  setupEventListeners() {
    const elements = {
      searchDonations: () => this.filterDonations(),
      filterStatus: () => this.filterDonations(),
      filterAmount: () => this.filterDonations(),
      filterDate: () => this.filterDonations(),
      selectAllDonations: (e) => this.toggleSelectAll(e.target.checked),
      exportDonations: () => this.exportToExcel(),
    };

    Object.entries(elements).forEach(([id, handler]) => {
      const element = document.getElementById(id);
      if (element) {
        const eventType =
          element.type === "checkbox"
            ? "change"
            : element.tagName === "INPUT"
            ? "input"
            : "click";
        element.addEventListener(eventType, handler);
      }
    });
  }

  redirectToLogin() {
    this.showError("Sesión expirada. Redirigiendo...");
    setTimeout(() => {
      window.location.href = "/login";
    }, 2000);
  }

  async getUserData(userId) {
    if (!userId || this.usersCache.has(userId)) {
      return this.usersCache.get(userId) || null;
    }

    try {
      const userDoc = await getDoc(doc(db, "usuarios", userId));
      const userData = userDoc.exists() ? userDoc.data() : null;
      this.usersCache.set(userId, userData);
      return userData;
    } catch (error) {
      this.usersCache.set(userId, null);
      return null;
    }
  }

  async loadDonations() {
    try {
      this.showLoading(true);
      const donationsRef = collection(db, "donaciones");
      const q = query(donationsRef, orderBy("fechaDonacion", "desc"));
      const querySnapshot = await getDocs(q);

      this.donations = await Promise.all(
        querySnapshot.docs.map(async (docSnap) => {
          const donationData = docSnap.data();
          const donationId = docSnap.id;

          const [validationData, collectorData] = await Promise.all([
            this.getValidationData(donationData.IDValidacion),
            this.getUserData(donationData.idRecolector),
          ]);

          return {
            id: donationId,
            ...donationData,
            validationData,
            collectorData,
            fechaFormateada: this.formatDate(donationData.fechaDonacion),
          };
        })
      );

      this.filteredDonations = [...this.donations];
      this.updateStatistics();
      this.renderDonationsTable();
      this.showLoading(false);

      // Sincronizar con EmailManager si existe
      this.syncWithEmailManager();
    } catch (error) {
      this.showError("Error al cargar las donaciones");
      this.showLoading(false);
    }
  }

  async getValidationData(validationId) {
    if (!validationId) return null;

    try {
      const validationDoc = await getDoc(doc(db, "validacion", validationId));
      return validationDoc.exists() ? validationDoc.data() : null;
    } catch (error) {
      return null;
    }
  }

  filterDonations() {
    const filters = {
      search:
        document.getElementById("searchDonations")?.value.toLowerCase() || "",
      status: document.getElementById("filterStatus")?.value || "",
      amount: document.getElementById("filterAmount")?.value || "",
      date: document.getElementById("filterDate")?.value || "",
    };

    this.filteredDonations = this.donations.filter((donation) => {
      const matchesSearch =
        !filters.search ||
        this.getDonorName(donation).toLowerCase().includes(filters.search) ||
        donation.EmailUsuarioDonador?.toLowerCase().includes(filters.search) ||
        donation.id.toLowerCase().includes(filters.search) ||
        this.getCollectorName(donation)
          .toLowerCase()
          .includes(filters.search) ||
        this.getCollectorSearchText(donation)
          .toLowerCase()
          .includes(filters.search);

      const matchesStatus =
        !filters.status ||
        this.getStatusString(donation.estadoValidacion) === filters.status;

      const matchesAmount =
        !filters.amount ||
        this.matchesAmountRange(donation.monto, filters.amount);

      const matchesDate =
        !filters.date ||
        this.formatDateForFilter(donation.fechaDonacion) === filters.date;

      return matchesSearch && matchesStatus && matchesAmount && matchesDate;
    });

    this.currentPage = 1;
    this.renderDonationsTable();
    this.updateStatistics();
  }

  // Función auxiliar para obtener texto de búsqueda del recolector
  getCollectorSearchText(donation) {
    if (donation.collectorData) {
      const nombre = donation.collectorData.nombreUsuario || "";
      const apellido = donation.collectorData.apellidoUsuario || "";
      const email = donation.collectorData.emailUsuario || "";
      const telefono = donation.collectorData.telefonoUsuario || "";

      // Crear texto combinado para búsqueda más amplia
      return `${nombre} ${apellido} ${email} ${telefono}`.trim();
    }

    // Si no hay datos del recolector pero hay ID, incluir el ID
    if (donation.idRecolector) {
      return donation.idRecolector;
    }

    return "sin asignar no asignado";
  }

  matchesAmountRange(amount, range) {
    const numAmount = parseFloat(amount);
    const ranges = {
      "0-50": [0, 50],
      "51-100": [51, 100],
      "101-500": [101, 500],
      "501+": [501, Infinity],
    };

    const [min, max] = ranges[range] || [0, Infinity];
    return numAmount >= min && numAmount <= max;
  }

  renderDonationsTable() {
    const tbody = document.getElementById("donationsTableBody");
    if (!tbody) return;

    this.totalPages = Math.ceil(
      this.filteredDonations.length / this.itemsPerPage
    );
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const pageData = this.filteredDonations.slice(
      startIndex,
      startIndex + this.itemsPerPage
    );

    tbody.innerHTML = "";

    if (pageData.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-4">
            <i class="fas fa-inbox fa-2x text-muted mb-2"></i>
            <p class="text-muted">No se encontraron donaciones</p>
          </td>
        </tr>
      `;
    } else {
      pageData.forEach((donation) => {
        tbody.appendChild(this.createDonationRow(donation));
      });
    }

    this.renderPagination();
    this.updateTableInfo();
  }

  checkVoucherExists(donation) {
    const locations = [
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

    return locations.some(
      (url) =>
        url &&
        typeof url === "string" &&
        url.trim() !== "" &&
        (url.startsWith("http") ||
          url.startsWith("data:") ||
          url.startsWith("blob:"))
    );
  }

  getDonorName(donation) {
    if (donation.Tipo_Usuario === "PERSONA NATURAL") {
      return `${donation.NombreUsuarioDonador || ""} ${
        donation.ApellidoUsuarioDonador || ""
      }`.trim();
    }
    return donation.RazonSocialUsuarioDonador || "Empresa";
  }

  getCollectorName(donation) {
    if (donation.collectorData) {
      const nombre = donation.collectorData.nombreUsuario || "";
      const apellido = donation.collectorData.apellidoUsuario || "";
      return `${nombre} ${apellido}`.trim() || "Recolector";
    }
    return donation.idRecolector || "Sin asignar";
  }

  getStatusString(status) {
    if (typeof status === "string") {
      const normalized = status.toLowerCase();
      if (normalized === "validado" || normalized === "aprobado")
        return "validado";
      if (normalized === "rechazado" || normalized === "denegado")
        return "rechazado";
      if (normalized === "pendiente") return "pendiente";
    }

    if (status === true) return "validado";
    if (status === false) return "rechazado";
    return "pendiente";
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

  getStatusBadge(status) {
    if (this.isValidated(status)) {
      return '<span class="badge bg-success"><i class="fas fa-check me-1"></i>Validado</span>';
    } else if (this.isRejected(status)) {
      return '<span class="badge bg-danger"><i class="fas fa-times me-1"></i>Rechazado</span>';
    }
    return '<span class="badge bg-warning"><i class="fas fa-clock me-1"></i>Pendiente</span>';
  }

  viewVoucher(donationId) {
    const donation = this.donations.find((d) => d.id === donationId);
    if (!donation) {
      this.showWarning("Donación no encontrada");
      return;
    }

    const voucherUrl = this.getVoucherUrl(donation);
    if (!voucherUrl) {
      this.showWarning("No hay voucher disponible");
      return;
    }

    try {
      document.getElementById("voucherDonorName").textContent =
        this.getDonorName(donation);
      document.getElementById("voucherAmount").textContent = `S/ ${parseFloat(
        donation.monto
      ).toFixed(2)}`;
      document.getElementById("voucherDate").textContent =
        donation.fechaFormateada;
      document.getElementById("voucherStatus").innerHTML = this.getStatusBadge(
        donation.estadoValidacion
      );
      document.getElementById("voucherImage").src = voucherUrl;

      this.showModal("viewVoucherModal");
    } catch (error) {
      this.showError("Error al mostrar el voucher");
    }
  }

  downloadVoucher() {
    const imgSrc = document.getElementById("voucherImage").src;
    if (imgSrc) {
      const link = document.createElement("a");
      link.href = imgSrc;
      link.download = "voucher_donacion.jpg";
      link.click();
    }
  }

  exportToExcel() {
    try {
      this.updateExportModalStats();
      this.generateExportCharts();
      this.showModal("exportDonationsModal");
    } catch (error) {
      this.showError("Error al abrir el modal de exportación");
    }
  }

  showModal(modalId) {
    const modalElement = document.getElementById(modalId);
    if (!modalElement) return;

    this.cleanupModal(modalId);
    const modal = new bootstrap.Modal(modalElement, {
      backdrop: "static",
      keyboard: false,
    });

    const cleanupHandler = () => this.handleModalClose(modalId);
    modalElement.addEventListener("hidden.bs.modal", cleanupHandler, {
      once: true,
    });
    this.modalCleanupHandlers.set(modalId, cleanupHandler);

    modal.show();
  }

  cleanupModal(modalId) {
    const existingModal = bootstrap.Modal.getInstance(
      document.getElementById(modalId)
    );
    if (existingModal) {
      existingModal.dispose();
    }

    const existingHandler = this.modalCleanupHandlers.get(modalId);
    if (existingHandler) {
      document
        .getElementById(modalId)
        .removeEventListener("hidden.bs.modal", existingHandler);
      this.modalCleanupHandlers.delete(modalId);
    }
  }

  handleModalClose(modalId) {
    try {
      const backdrops = document.querySelectorAll(".modal-backdrop");
      backdrops.forEach((backdrop) => backdrop.remove());

      document.body.classList.remove("modal-open");
      document.body.style.removeProperty("overflow");
      document.body.style.removeProperty("padding-right");

      if (modalId === "exportDonationsModal") {
        this.destroyExistingCharts();
      }

      this.modalCleanupHandlers.delete(modalId);
    } catch (error) {
      // Error silencioso en producción
    }
  }

  updateExportModalStats() {
    const stats = {
      total: this.donations.length,
      validated: this.donations.filter((d) =>
        this.isValidated(d.estadoValidacion)
      ).length,
      pending: this.donations.filter((d) => this.isPending(d.estadoValidacion))
        .length,
      totalAmount: this.donations.reduce(
        (sum, d) => sum + parseFloat(d.monto || 0),
        0
      ),
    };

    document.getElementById("exportStatsTotal").textContent = stats.total;
    document.getElementById("exportStatsValidated").textContent =
      stats.validated;
    document.getElementById("exportStatsPending").textContent = stats.pending;
    document.getElementById(
      "exportStatsAmount"
    ).textContent = `S/ ${stats.totalAmount.toFixed(2)}`;
  }

  generateExportCharts() {
    if (typeof Chart === "undefined") return;

    this.destroyExistingCharts();

    const charts = [
      { id: "statusChart", method: "createStatusChart" },
      { id: "amountRangeChart", method: "createAmountRangeChart" },
      { id: "monthlyChart", method: "createMonthlyChart" },
      { id: "userTypeChart", method: "createUserTypeChart" },
    ];

    charts.forEach(({ id, method }) => {
      try {
        this[method]();
      } catch (error) {
        // Error silencioso en producción
      }
    });
  }

  destroyExistingCharts() {
    [
      "statusChart",
      "amountRangeChart",
      "monthlyChart",
      "userTypeChart",
    ].forEach((chartId) => {
      const chartInstance = Chart.getChart(chartId);
      if (chartInstance) {
        chartInstance.destroy();
      }
    });
  }

  createStatusChart() {
    const ctx = document.getElementById("statusChart");
    if (!ctx) return;

    const data = {
      validated: this.donations.filter((d) =>
        this.isValidated(d.estadoValidacion)
      ).length,
      pending: this.donations.filter((d) => this.isPending(d.estadoValidacion))
        .length,
      rejected: this.donations.filter((d) =>
        this.isRejected(d.estadoValidacion)
      ).length,
    };

    new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Validadas", "Pendientes", "Rechazadas"],
        datasets: [
          {
            data: [data.validated, data.pending, data.rejected],
            backgroundColor: ["#28a745", "#ffc107", "#dc3545"],
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
      },
    });
  }

  createAmountRangeChart() {
    const ctx = document.getElementById("amountRangeChart");
    if (!ctx) return;

    const ranges = {
      "0-50": this.donations.filter((d) => parseFloat(d.monto) <= 50).length,
      "51-100": this.donations.filter(
        (d) => parseFloat(d.monto) > 50 && parseFloat(d.monto) <= 100
      ).length,
      "101-500": this.donations.filter(
        (d) => parseFloat(d.monto) > 100 && parseFloat(d.monto) <= 500
      ).length,
      "501+": this.donations.filter((d) => parseFloat(d.monto) > 500).length,
    };

    new Chart(ctx, {
      type: "bar",
      data: {
        labels: Object.keys(ranges),
        datasets: [
          {
            label: "Cantidad de Donaciones",
            data: Object.values(ranges),
            backgroundColor: "#007bff",
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1 },
          },
        },
        plugins: { legend: { display: false } },
      },
    });
  }

  createMonthlyChart() {
    const ctx = document.getElementById("monthlyChart");
    if (!ctx) return;

    const monthlyData = {};
    this.donations.forEach((donation) => {
      const date =
        donation.fechaDonacion instanceof Timestamp
          ? donation.fechaDonacion.toDate()
          : new Date(donation.fechaDonacion);

      const monthKey = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;
      monthlyData[monthKey] = (monthlyData[monthKey] || 0) + 1;
    });

    const sortedData = Object.entries(monthlyData).sort((a, b) =>
      a[0].localeCompare(b[0])
    );

    new Chart(ctx, {
      type: "line",
      data: {
        labels: sortedData.map(([month]) => month),
        datasets: [
          {
            label: "Donaciones por Mes",
            data: sortedData.map(([, count]) => count),
            borderColor: "#28a745",
            backgroundColor: "rgba(40, 167, 69, 0.1)",
            fill: true,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1 },
          },
        },
      },
    });
  }

  createUserTypeChart() {
    const ctx = document.getElementById("userTypeChart");
    if (!ctx) return;

    const userTypes = {};
    this.donations.forEach((donation) => {
      const type = donation.Tipo_Usuario || "Sin especificar";
      userTypes[type] = (userTypes[type] || 0) + 1;
    });

    new Chart(ctx, {
      type: "pie",
      data: {
        labels: Object.keys(userTypes),
        datasets: [
          {
            data: Object.values(userTypes),
            backgroundColor: [
              "#007bff",
              "#28a745",
              "#ffc107",
              "#dc3545",
              "#6c757d",
            ],
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
      },
    });
  }

  executeExportDonations(type) {
    const dataMap = {
      filtered: this.filteredDonations,
      all: this.donations,
      validated: this.donations.filter((d) =>
        this.isValidated(d.estadoValidacion)
      ),
      pending: this.donations.filter((d) => this.isPending(d.estadoValidacion)),
    };

    const dataToExport = dataMap[type] || this.filteredDonations;
    this.closeExportModal();

    setTimeout(() => {
      try {
        if (typeof window.exportDonationsToExcel === "function") {
          window.exportDonationsToExcel(dataToExport);
          this.showSuccess(`Exportando ${dataToExport.length} donaciones...`);
        } else {
          this.showError("Error: Función de exportación no disponible");
        }
      } catch (error) {
        this.showError("Error al exportar las donaciones");
      }
    }, 300);
  }

  closeExportModal() {
    try {
      const modalElement = document.getElementById("exportDonationsModal");
      if (modalElement) {
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
          modal.hide();
        }
      }
    } catch (error) {
      this.forceCleanModal();
    }
  }

  forceCleanModal() {
    try {
      const backdrops = document.querySelectorAll(".modal-backdrop");
      backdrops.forEach((backdrop) => backdrop.remove());

      const modalElement = document.getElementById("exportDonationsModal");
      if (modalElement) {
        modalElement.classList.remove("show");
        modalElement.style.display = "none";
        modalElement.setAttribute("aria-hidden", "true");
        modalElement.removeAttribute("aria-modal");
      }

      document.body.classList.remove("modal-open");
      document.body.style.removeProperty("overflow");
      document.body.style.removeProperty("padding-right");

      this.destroyExistingCharts();
    } catch (error) {
      // Error silencioso en producción
    }
  }

  toggleSelectAll(checked) {
    const checkboxes = document.querySelectorAll(".donation-checkbox");
    checkboxes.forEach((checkbox) => {
      checkbox.checked = checked;
      const donationId = checkbox.value;
      if (checked) {
        this.selectedDonations.add(donationId);
      } else {
        this.selectedDonations.delete(donationId);
      }
    });
  }

  getVoucherUrl(donation) {
    const locations = [
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

    return (
      locations.find(
        (url) =>
          url &&
          typeof url === "string" &&
          url.trim() !== "" &&
          (url.startsWith("http") ||
            url.startsWith("data:") ||
            url.startsWith("blob:"))
      ) || null
    );
  }

  updateSelectAllState() {
    const selectAllCheckbox = document.getElementById("selectAllDonations");
    const checkboxes = document.querySelectorAll(".donation-checkbox");
    const checkedCount = document.querySelectorAll(
      ".donation-checkbox:checked"
    ).length;

    if (selectAllCheckbox) {
      selectAllCheckbox.checked =
        checkedCount === checkboxes.length && checkboxes.length > 0;
      selectAllCheckbox.indeterminate =
        checkedCount > 0 && checkedCount < checkboxes.length;
    }
  }

  updateStatistics() {
    const stats = {
      total: this.donations.length,
      validated: this.donations.filter((d) =>
        this.isValidated(d.estadoValidacion)
      ).length,
      rejected: this.donations.filter((d) =>
        this.isRejected(d.estadoValidacion)
      ).length,
      pending: this.donations.filter((d) => this.isPending(d.estadoValidacion))
        .length,
      totalAmount: this.donations.reduce(
        (sum, d) => sum + parseFloat(d.monto || 0),
        0
      ),
    };

    const elements = {
      totalDonationsCount: stats.total,
      validatedDonationsCount: stats.validated,
      pendingDonationsCount: stats.pending,
      rejectedDonationsCount: stats.rejected,
      totalAmountRaised: `S/ ${stats.totalAmount.toFixed(2)}`,
    };

    Object.entries(elements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
      }
    });
  }

  renderPagination() {
    const paginationList = document.getElementById("paginationList");
    if (!paginationList) return;

    paginationList.innerHTML = "";

    if (this.totalPages <= 1) return;

    // Botón anterior
    const prevLi = document.createElement("li");
    prevLi.className = `page-item ${this.currentPage === 1 ? "disabled" : ""}`;
    prevLi.innerHTML = `<a class="page-link" href="#">Anterior</a>`;
    prevLi.addEventListener("click", (e) => {
      e.preventDefault();
      if (this.currentPage > 1) {
        this.currentPage--;
        this.renderDonationsTable();
      }
    });
    paginationList.appendChild(prevLi);

    // Números de página
    const maxVisible = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(this.totalPages, startPage + maxVisible - 1);

    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      const li = document.createElement("li");
      li.className = `page-item ${i === this.currentPage ? "active" : ""}`;
      li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
      li.addEventListener("click", (e) => {
        e.preventDefault();
        this.currentPage = i;
        this.renderDonationsTable();
      });
      paginationList.appendChild(li);
    }

    // Botón siguiente
    const nextLi = document.createElement("li");
    nextLi.className = `page-item ${
      this.currentPage === this.totalPages ? "disabled" : ""
    }`;
    nextLi.innerHTML = `<a class="page-link" href="#">Siguiente</a>`;
    nextLi.addEventListener("click", (e) => {
      e.preventDefault();
      if (this.currentPage < this.totalPages) {
        this.currentPage++;
        this.renderDonationsTable();
      }
    });
    paginationList.appendChild(nextLi);
  }

  updateTableInfo() {
    const start = (this.currentPage - 1) * this.itemsPerPage + 1;
    const end = Math.min(
      this.currentPage * this.itemsPerPage,
      this.filteredDonations.length
    );
    const total = this.filteredDonations.length;

    document.getElementById("showingStart").textContent = start;
    document.getElementById("showingEnd").textContent = end;
    document.getElementById("totalRecords").textContent = total;
  }

  // Utilidades
  formatDate(dateInput) {
    if (!dateInput) return "N/A";

    let date;
    if (dateInput instanceof Timestamp) {
      date = dateInput.toDate();
    } else if (typeof dateInput === "string") {
      date = new Date(dateInput);
    } else {
      date = dateInput;
    }

    return date.toLocaleDateString("es-PE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }

  formatDateForFilter(dateInput) {
    if (!dateInput) return "";

    let date;
    if (dateInput instanceof Timestamp) {
      date = dateInput.toDate();
    } else if (typeof dateInput === "string") {
      date = new Date(dateInput);
    } else {
      date = dateInput;
    }

    return date.toISOString().split("T")[0];
  }

  showLoading(show) {
    const tbody = document.getElementById("donationsTableBody");
    if (!tbody) return;

    if (show) {
      tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-4">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Cargando...</span>
                        </div>
                        <p class="text-muted mt-2">Cargando donaciones...</p>
                    </td>
                </tr>
            `;
    }
  }

  showSuccess(message) {
    this.showAlert(message, "success");
  }

  showError(message) {
    this.showAlert(message, "danger");
  }

  showWarning(message) {
    this.showAlert(message, "warning");
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

    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (alertDiv.parentNode) {
        alertDiv.remove();
      }
    }, 5000);
  }
}

// Funciones globales para los botones del HTML
window.refreshDonations = function () {
  if (window.donationsManager) {
    window.donationsManager.loadDonations();
  }
};

window.clearFilters = function () {
  document.getElementById("searchDonations").value = "";
  document.getElementById("filterStatus").value = "";
  document.getElementById("filterAmount").value = "";
  document.getElementById("filterDate").value = "";

  if (window.donationsManager) {
    window.donationsManager.filterDonations();
  }
};

window.validateAllSelected = function () {
  if (window.donationsManager) {
    window.donationsManager.validateAllSelected();
  }
};

window.downloadVoucher = function () {
  if (window.donationsManager) {
    window.donationsManager.downloadVoucher();
  }
};

// Inicializar cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", function () {
  window.donationsManager = new DonationsManager();
});

// Agregar estilos CSS adicionales
const additionalStyles = `
    <style>
        .avatar-circle {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background-color: #e9ecef;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            color: #6c757d;
        }
        
        .donation-row:hover {
            background-color: #f8f9fa;
        }
        
        .btn-group .btn {
            border-radius: 0.375rem;
            margin-right: 2px;
        }
        
        .table-responsive {
            border-radius: 0.5rem;
        }
        
        .badge {
            font-size: 0.75em;
        }
        
        .spinner-border {
            width: 3rem;
            height: 3rem;
        }

        /* Estilos para indicadores de seguridad */
        .text-warning {
            color: #856404 !important;
        }
        
        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .donation-row .text-warning {
            font-size: 0.75em;
            font-weight: 500;
        }
        
        .security-indicator {
            background-color: rgba(255, 193, 7, 0.1);
            border-left: 3px solid #ffc107;
            padding: 2px 6px;
            border-radius: 0 4px 4px 0;
        }
    </style>
`;

// Agregar estilos al head
document.head.insertAdjacentHTML("beforeend", additionalStyles);

// Funciones globales corregidas
window.exportDonations = function () {
  if (window.donationsManager) {
    window.donationsManager.exportToExcel();
  }
};

// Función global para ejecutar exportación desde el modal
window.executeExportDonations = function (type) {
  if (window.donationsManager) {
    window.donationsManager.executeExportDonations(type);
  }
};

// Función global para cerrar modal manualmente
window.closeExportModal = function () {
  if (window.donationsManager) {
    window.donationsManager.closeExportModal();
  }
};

// Función de emergencia para limpiar modales
window.forceCleanModals = function () {
  try {
    // Remover todos los backdrops
    const backdrops = document.querySelectorAll(".modal-backdrop");
    backdrops.forEach((backdrop) => backdrop.remove());

    // Restaurar el body
    document.body.classList.remove("modal-open");
    document.body.style.removeProperty("overflow");
    document.body.style.removeProperty("padding-right");
  } catch (error) {}
};

window.updateDonationStatus = function () {
  if (window.donationsManager) {
    window.donationsManager.updateDonationStatus();
  }
};

// Función global para abrir modal de cambio de estado
window.openChangeStatusModal = function (donationId) {
  if (window.donationsManager) {
    window.donationsManager.openChangeStatusModal(donationId);
  }
};

// Event listener para el cambio de estado en el select
document.addEventListener("DOMContentLoaded", function () {
  const statusSelect = document.getElementById("newStatus");
  if (statusSelect) {
    statusSelect.addEventListener("change", function () {
      if (window.donationsManager) {
        window.donationsManager.handleStatusChange();
      }
    });
  }
});

window.openSendEmailModal = async function () {
  try {
    if (window.donationsManager) {
      await window.donationsManager.openSendEmailModal();
    } else {
      alert("Error: El sistema de donaciones no está inicializado");
    }
  } catch (error) {
    alert("Error al abrir el modal de correos: " + error.message);
  }
};

// Funciones globales para el sistema de correos
window.sendEmailsToRecipients = function () {
  if (window.donationsManager && window.donationsManager.emailManager) {
    window.donationsManager.emailManager.sendEmailsToRecipients();
  } else {
    alert(
      "Error: El sistema de correos no está inicializado. Por favor, abre primero el modal desde el botón 'Enviar Correos' del header."
    );
  }
};

window.previewEmail = function () {
  if (window.donationsManager && window.donationsManager.emailManager) {
    window.donationsManager.emailManager.previewEmail();
  } else {
    alert("Error: El sistema de correos no está inicializado");
  }
};

// FUNCIÓN PARA CARGAR PLANTILLAS
window.loadEmailTemplate = function () {
  if (window.donationsManager && window.donationsManager.emailManager) {
    window.donationsManager.emailManager.loadEmailTemplate();
  } else {
  }
};

// FUNCIÓN PARA ABRIR HISTORIAL
window.openEmailHistory = function () {
  if (window.donationsManager && window.donationsManager.emailManager) {
    window.donationsManager.emailManager.showModal("emailHistoryModal");
  } else {
    alert("Error: El sistema de correos no está inicializado");
  }
};

// FUNCIONES PARA MANEJO DE ARCHIVOS PDF
window.handlePdfAttachment = function (input) {
  if (window.donationsManager && window.donationsManager.emailManager) {
    window.donationsManager.emailManager.handlePdfAttachment(input);
  }
};

window.clearPdfAttachment = function () {
  if (window.donationsManager && window.donationsManager.emailManager) {
    window.donationsManager.emailManager.clearPdfAttachment();
  }
};

window.removePdfAttachment = function () {
  if (window.donationsManager && window.donationsManager.emailManager) {
    window.donationsManager.emailManager.removePdfAttachment();
  }
};

window.saveEmailConfig = function () {
  if (window.donationsManager && window.donationsManager.emailManager) {
    window.donationsManager.emailManager.saveEmailConfig();
  } else {
  }
};
