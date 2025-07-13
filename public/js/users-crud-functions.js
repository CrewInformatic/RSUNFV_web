// users-management-optimized.js - Gestión CRUD de Usuarios OPTIMIZADO (Con integración de roles y participaciones)
import {
  db,
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
} from "./firebase_config.js";

// Importar funciones del módulo de roles
import {
  loadRoles,
  getRoleDisplayBadge,
  generateRoleDisplayHTML,
} from "./role-management.js";
import "./admin-register.js";
import {
  exportUsers,
  exportUsersToExcel,
  exportFilteredUsersToExcel,
  exportAllUsersToExcel,
  executeExport,
  updateExportData,
  initializeExportSystem,
} from "./export-users-excel.js";

// =============================================
// CONFIGURACIÓN Y ESTADO GLOBAL
// =============================================
const CONFIG = {
  USERS_PER_PAGE: 10,
  CACHE_DURATION: 10 * 60 * 1000,
  SEARCH_DEBOUNCE: 300,
  COLLECTIONS: {
    USUARIOS: "usuarios",
    ESCUELA: "escuela",
    FACULTAD: "facultad",
    ROLES: "roles",
    EVENTOS: "eventos",
  },
};

let state = {
  allUsers: [],
  filteredUsers: [],
  currentPage: 1,
  isLoading: false,
  cache: new Map(),
  searchTimeout: null,
  rolesData: [], // Cache para roles
  participationMap: new Map(), // Cache para participaciones
};

// =============================================
// UTILIDADES
// =============================================
const utils = {
  showToast(title, message, type = "info") {
    const toastElement = document.getElementById("liveToast");
    const toastTitle = document.getElementById("toastTitle");
    const toastBody = document.getElementById("toastBody");

    if (!toastElement || !toastTitle || !toastBody) return;

    const typeColors = {
      success: "text-success",
      error: "text-danger",
      warning: "text-warning",
      info: "text-primary",
    };

    toastTitle.textContent = title;
    toastBody.textContent = message;

    const iconElement = toastElement.querySelector("i");
    if (iconElement) {
      const icons = {
        success: "check-circle",
        error: "exclamation-triangle",
        warning: "exclamation-circle",
        info: "info-circle",
      };
      iconElement.className = `fas fa-${icons[type]} ${typeColors[type]} me-2`;
    }

    new bootstrap.Toast(toastElement, { delay: 4000 }).show();
  },

  handleError(error, context, showUser = true) {
    console.error(`❌ Error en ${context}:`, error);
    if (showUser)
      this.showToast("Error", error.message || `Error ${context}`, "error");
  },

  validateEmail: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),

  formatDate(dateString) {
    if (!dateString) return "No disponible";
    try {
      return new Date(dateString).toLocaleDateString("es-PE", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Fecha inválida";
    }
  },

  calculateAge(birthDate) {
    if (!birthDate) return null;
    try {
      const birth = new Date(birthDate);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();

      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < birth.getDate())
      ) {
        age--;
      }
      return age;
    } catch {
      return null;
    }
  },

  async getCachedData(key, fetchFn) {
    const cached = state.cache.get(key);
    if (cached && Date.now() - cached.timestamp < CONFIG.CACHE_DURATION) {
      return cached.data;
    }

    const data = await fetchFn();
    state.cache.set(key, { data, timestamp: Date.now() });
    return data;
  },
};

// =============================================
// MÓDULO DE PARTICIPACIONES EN EVENTOS
// =============================================
const participationModule = {
  /**
   * Cargar eventos y crear mapa de participaciones
   */
  async loadEventsParticipation() {
    try {
      const eventosRef = collection(db, CONFIG.COLLECTIONS.EVENTOS);
      const eventsSnapshot = await getDocs(eventosRef);

      const participationMap = new Map();

      eventsSnapshot.forEach((doc) => {
        const eventData = doc.data();

        // Verificar si el evento tiene voluntarios inscritos
        if (
          eventData.voluntariosInscritos &&
          Array.isArray(eventData.voluntariosInscritos)
        ) {
          eventData.voluntariosInscritos.forEach((userId) => {
            // Contar participación para cada usuario
            const currentCount = participationMap.get(userId) || 0;
            participationMap.set(userId, currentCount + 1);
          });
        }
      });

      state.participationMap = participationMap;
      return participationMap;
    } catch (error) {
      console.error("Error al cargar participaciones:", error);
      return new Map();
    }
  },

  /**
   * Obtener clase CSS para el badge según número de participaciones
   */
  getParticipationBadgeClass(count) {
    if (count === 0) return "bg-secondary";
    if (count <= 2) return "bg-info";
    if (count <= 5) return "bg-primary";
    if (count <= 10) return "bg-success";
    return "bg-warning text-dark";
  },

  /**
   * Ver eventos específicos de un usuario
   */
  async viewUserEvents(userId) {
    try {
      const user = state.allUsers.find((u) => u.id === userId);
      if (!user) {
        utils.showToast("Error", "Usuario no encontrado", "error");
        return;
      }

      // Cargar eventos donde participa el usuario
      const eventosRef = collection(db, CONFIG.COLLECTIONS.EVENTOS);
      const eventsSnapshot = await getDocs(eventosRef);

      const userEvents = [];

      eventsSnapshot.forEach((doc) => {
        const eventData = doc.data();

        if (
          eventData.voluntariosInscritos &&
          Array.isArray(eventData.voluntariosInscritos) &&
          eventData.voluntariosInscritos.includes(userId)
        ) {
          userEvents.push({
            id: doc.id,
            titulo: eventData.titulo || "Sin título",
            descripcion: eventData.descripcion || "Sin descripción",
            fechaInicio: eventData.fechaInicio,
            ubicacion: eventData.ubicacion || "No especificada",
            estado: this.getEventStatusFromDate(
              eventData.fechaInicio,
              eventData.fechaFin
            ),
          });
        }
      });

      // Mostrar modal con eventos del usuario
      this.showUserEventsModal(user, userEvents);
    } catch (error) {
      utils.handleError(error, "al cargar eventos del usuario");
    }
  },

  /**
   * Mostrar modal con eventos del usuario
   */
  showUserEventsModal(user, events) {
    const modalHtml = `
      <div class="modal fade" id="userEventsModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">
                <i class="fas fa-calendar-alt me-2"></i>
                Eventos de ${user.nombreCompleto}
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              ${
                events.length === 0
                  ? `<div class="text-center text-muted py-4">
                  <i class="fas fa-calendar-times fa-3x mb-3"></i>
                  <h5>Sin participaciones</h5>
                  <p>Este usuario no ha participado en ningún evento.</p>
                </div>`
                  : `<div class="table-responsive">
                  <table class="table table-hover">
                    <thead>
                      <tr>
                        <th>Evento</th>
                        <th>Fecha</th>
                        <th>Ubicación</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${events
                        .map(
                          (event) => `
                        <tr>
                          <td>
                            <div class="fw-bold">${event.titulo}</div>
                            <small class="text-muted">${
                              event.descripcion.length > 50
                                ? event.descripcion.substring(0, 50) + "..."
                                : event.descripcion
                            }</small>
                          </td>
                          <td>
                            <small>${utils.formatDate(
                              event.fechaInicio
                            )}</small>
                          </td>
                          <td>
                            <small>${event.ubicacion}</small>
                          </td>
                          <td>
                            <span class="badge ${event.estado.class}">${
                            event.estado.text
                          }</span>
                          </td>
                        </tr>
                      `
                        )
                        .join("")}
                    </tbody>
                  </table>
                </div>`
              }
              <div class="mt-3">
                <div class="row text-center">
                  <div class="col">
                    <div class="border rounded p-3">
                      <h4 class="mb-1 text-primary">${events.length}</h4>
                      <small class="text-muted">Total Eventos</small>
                    </div>
                  </div>
                  <div class="col">
                    <div class="border rounded p-3">
                      <h4 class="mb-1 text-success">${
                        events.filter((e) =>
                          e.estado.text.includes("Completado")
                        ).length
                      }</h4>
                      <small class="text-muted">Completados</small>
                    </div>
                  </div>
                  <div class="col">
                    <div class="border rounded p-3">
                      <h4 class="mb-1 text-info">${
                        events.filter((e) => e.estado.text.includes("Próximo"))
                          .length
                      }</h4>
                      <small class="text-muted">Próximos</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Remover modal existente si existe
    const existingModal = document.getElementById("userEventsModal");
    if (existingModal) {
      existingModal.remove();
    }

    // Agregar nuevo modal
    document.body.insertAdjacentHTML("beforeend", modalHtml);

    // Mostrar modal
    const modal = new bootstrap.Modal(
      document.getElementById("userEventsModal")
    );
    modal.show();

    // Limpiar modal cuando se cierre
    document
      .getElementById("userEventsModal")
      .addEventListener("hidden.bs.modal", function () {
        this.remove();
      });
  },

  /**
   * Obtener estado del evento basado en fechas
   */
  getEventStatusFromDate(fechaInicio, fechaFin) {
    if (!fechaInicio) {
      return { class: "bg-secondary", text: "Pendiente" };
    }

    try {
      const now = new Date();
      const startDate = new Date(fechaInicio);
      const endDate = fechaFin ? new Date(fechaFin) : null;

      if (endDate && now > endDate) {
        return { class: "bg-success", text: "Completado" };
      } else if (now >= startDate && (!endDate || now <= endDate)) {
        return { class: "bg-warning", text: "En curso" };
      } else if (now < startDate) {
        return { class: "bg-info", text: "Próximo" };
      }

      return { class: "bg-secondary", text: "Pendiente" };
    } catch (error) {
      return { class: "bg-danger", text: "Error" };
    }
  },
};

const exportModule = {
  /**
   * Función principal de exportación - integrada con el sistema completo
   */
  exportUsers() {
    console.log("📊 Iniciando exportación desde CRUD...");

    // Actualizar datos en el módulo de exportación
    this.updateExportData();

    // Llamar al sistema de exportación completo
    exportUsers();
  },

  /**
   * Actualizar datos en el módulo de exportación
   */
  updateExportData() {
    const event = new CustomEvent("exportDataUpdated", {
      detail: {
        allUsers: state.allUsers,
        filteredUsers: state.filteredUsers,
      },
    });
    document.dispatchEvent(event);

    if (window.updateExportData) {
      window.updateExportData(state.allUsers, state.filteredUsers);
    }
  },
};

// =============================================
// CARGA DE DATOS
// =============================================
const dataLoader = {
  async loadSchools() {
    return utils.getCachedData("schools", async () => {
      const snapshot = await getDocs(
        collection(db, CONFIG.COLLECTIONS.ESCUELA)
      );
      return snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: data.idEscuela,
          name: data.nombreEscuela,
          facultadId: data.facultadID,
        };
      });
    });
  },

  async loadFaculties() {
    return utils.getCachedData("faculties", async () => {
      const snapshot = await getDocs(
        collection(db, CONFIG.COLLECTIONS.FACULTAD)
      );
      return snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: data.idFacultad,
          name: data.nombreFacultad,
        };
      });
    });
  },

  async loadRolesData() {
    try {
      state.rolesData = await loadRoles();
      console.log("🔍 Roles cargados en gestión de usuarios:", state.rolesData);
      return state.rolesData;
    } catch (error) {
      console.error("❌ Error al cargar roles:", error);
      state.rolesData = [];
      return [];
    }
  },

  async loadAllUsers() {
    try {
      const usersSnapshot = await getDocs(
        collection(db, CONFIG.COLLECTIONS.USUARIOS)
      );

      if (usersSnapshot.empty) {
        state.allUsers = state.filteredUsers = [];
        ui.updateTable([]);
        ui.updateStatistics();
        return;
      }

      const [schools, faculties, roles, participationMap] = await Promise.all([
        this.loadSchools(),
        this.loadFaculties(),
        this.loadRolesData(),
        participationModule.loadEventsParticipation(),
      ]);

      // Crear mapas para búsqueda rápida
      const schoolsMap = new Map(schools.map((s) => [s.id, s]));
      const facultiesMap = new Map(faculties.map((f) => [f.id, f]));
      const rolesMap = new Map(roles.map((r) => [r.id, r]));

      const users = usersSnapshot.docs
        .map((doc) => {
          const userData = doc.data();
          const school = schoolsMap.get(userData.escuelaID);
          const faculty = facultiesMap.get(userData.facultadID);
          const role = rolesMap.get(userData.idRol);

          return {
            id: doc.id,
            ...userData,
            nombreEscuela: school?.name || "No disponible",
            nombreFacultad: faculty?.name || "No disponible",
            nombreCompleto: `${userData.nombreUsuario || ""} ${
              userData.apellidoUsuario || ""
            }`.trim(),
            edad: userData.fechaNacimiento
              ? utils.calculateAge(userData.fechaNacimiento)
              : userData.edad,
            // Datos del rol
            nombreRol: role?.name || null,
            descripcionRol: role?.description || null,
            permisosRol: role?.permissions || [],
            // 🎯 NUEVO: Contador de eventos participados
            eventosParticipados: participationMap.get(doc.id) || 0,
          };
        })
        .sort(
          (a, b) =>
            new Date(b.fechaRegistro || 0) - new Date(a.fechaRegistro || 0)
        );

      state.allUsers = users;
      state.filteredUsers = [...users];

      ui.updateTable(ui.getCurrentPageUsers());
      ui.updateStatistics();
      ui.updatePagination();
    } catch (error) {
      utils.handleError(error, "al cargar usuarios");
      state.allUsers = state.filteredUsers = [];
      ui.updateTable([]);
      ui.updateStatistics();
    }
  },
};

// =============================================
// INTERFAZ DE USUARIO
// =============================================
const ui = {
  getCurrentPageUsers() {
    const start = (state.currentPage - 1) * CONFIG.USERS_PER_PAGE;
    const end = start + CONFIG.USERS_PER_PAGE;
    return state.filteredUsers.slice(start, end);
  },

  getRoleDisplayBadge(user) {
    // Usar la función del módulo de roles para mostrar badges
    return getRoleDisplayBadge(user);
  },

  // Función updateTable modificada para incluir participaciones en eventos
  updateTable(users) {
    const tableBody = document.getElementById("usersTableBody");
    if (!tableBody) return;

    if (users.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-4 text-muted">
            <i class="fas fa-users fa-2x mb-2"></i>
            <p class="mb-0">No se encontraron usuarios</p>
          </td>
        </tr>`;
      return;
    }

    tableBody.innerHTML = users
      .map(
        (user) => `
      <tr>
        <td>
          <div class="d-flex align-items-center">
            <i class="fas fa-user-circle fa-2x text-secondary me-3"></i>
            <div>
              <div class="fw-bold">${user.nombreCompleto || "Sin nombre"}</div>
              <small class="text-muted">${user.correo || "Sin email"}</small>
              ${
                // Solo mostrar código si NO es administrador
                !user.esAdmin && user.codigoUsuario
                  ? `<br><small class="text-muted">Código: ${user.codigoUsuario}</small>`
                  : ""
              }
            </div>
          </div>
        </td>
        <td>
          <span class="badge bg-light text-dark">${
            user.nombreEscuela
          }</span><br>
          <small class="text-muted">${user.nombreFacultad}</small>
        </td>
        <td>${this.getRoleDisplayBadge(user)}</td>
        <td><small>${utils.formatDate(user.fechaRegistro)}</small></td>
        <td>
          <div class="d-flex flex-column align-items-center">
            <span class="badge ${participationModule.getParticipationBadgeClass(
              user.eventosParticipados
            )}">${user.eventosParticipados}</span>
            <small class="text-muted">${
              user.eventosParticipados === 1 ? "Evento" : "Eventos"
            }</small>
          </div>
        </td>
        <td>
          <div class="form-check form-switch">
            <input class="form-check-input status-toggle" type="checkbox" 
                   ${user.estadoActivo ? "checked" : ""} 
                   data-user-id="${user.id}"
                   onchange="toggleUserStatus('${user.id}', this.checked)">
            <label class="form-check-label">
              <small class="${
                user.estadoActivo ? "text-success" : "text-danger"
              }">
                ${user.estadoActivo ? "Activo" : "Inactivo"}
              </small>
            </label>
          </div>
        </td>
        <td>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary" onclick="viewUserDetails('${
              user.id
            }')" title="Ver detalles">
              <i class="fas fa-eye"></i>
            </button>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown" title="Más opciones">
                <i class="fas fa-ellipsis-v"></i>
              </button>
              <ul class="dropdown-menu">
                <li><a class="dropdown-item" href="#" onclick="assignRole('${
                  user.id
                }')">
                  <i class="fas fa-user-tag me-2 text-info"></i>
                  Asignar Rol
                </a></li>
                <li><a class="dropdown-item" href="#" onclick="viewUserEvents('${
                  user.id
                }')">
                  <i class="fas fa-calendar-alt me-2 text-primary"></i>
                  Ver Eventos (${user.eventosParticipados})
                </a></li>
                <li><a class="dropdown-item" href="#" onclick="toggleAdminRole('${
                  user.id
                }', ${!user.esAdmin})">
                  <i class="fas ${
                    user.esAdmin ? "fa-user-minus" : "fa-user-plus"
                  } me-2"></i>
                  ${user.esAdmin ? "Quitar Admin" : "Hacer Admin"}
                </a></li>
                <li><hr class="dropdown-divider"></li>
                <li><a class="dropdown-item text-danger" href="#" onclick="deleteUser('${
                  user.id
                }')">
                  <i class="fas fa-trash me-2"></i>Eliminar
                </a></li>
              </ul>
            </div>
          </div>
        </td>
      </tr>
    `
      )
      .join("");
  },

  updateStatistics() {
    const activeUsers = state.allUsers.filter(
      (user) => user.estadoActivo
    ).length;
    const schools = new Set(
      state.allUsers.map((user) => user.escuelaID).filter(Boolean)
    );

    const elements = {
      totalUsersCount: state.allUsers.length,
      activeUsersCount: activeUsers,
      schoolsCount: schools.size,
    };

    Object.entries(elements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    });

    this.updateTableInfo();
  },

  updateTableInfo() {
    const start = (state.currentPage - 1) * CONFIG.USERS_PER_PAGE + 1;
    const end = Math.min(
      state.currentPage * CONFIG.USERS_PER_PAGE,
      state.filteredUsers.length
    );

    const elements = {
      showingStart: state.filteredUsers.length > 0 ? start : 0,
      showingEnd: end,
      totalRecords: state.filteredUsers.length,
    };

    Object.entries(elements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    });
  },

  updatePagination() {
    const paginationList = document.getElementById("paginationList");
    if (!paginationList) return;

    const totalPages = Math.ceil(
      state.filteredUsers.length / CONFIG.USERS_PER_PAGE
    );
    if (totalPages <= 1) {
      paginationList.innerHTML = "";
      return;
    }

    let html = `
      <li class="page-item ${state.currentPage === 1 ? "disabled" : ""}">
        <a class="page-link" href="#" onclick="changePage(${
          state.currentPage - 1
        })">
          <i class="fas fa-chevron-left"></i>
        </a>
      </li>`;

    const startPage = Math.max(1, state.currentPage - 2);
    const endPage = Math.min(totalPages, state.currentPage + 2);

    for (let i = startPage; i <= endPage; i++) {
      html += `
        <li class="page-item ${i === state.currentPage ? "active" : ""}">
          <a class="page-link" href="#" onclick="changePage(${i})">${i}</a>
        </li>`;
    }

    html += `
      <li class="page-item ${
        state.currentPage === totalPages ? "disabled" : ""
      }">
        <a class="page-link" href="#" onclick="changePage(${
          state.currentPage + 1
        })">
          <i class="fas fa-chevron-right"></i>
        </a>
      </li>`;

    paginationList.innerHTML = html;
  },
};

// =============================================
// FILTROS Y BÚSQUEDA
// =============================================
const filters = {
  apply() {
    const searchTerm =
      document.getElementById("searchUsers")?.value.toLowerCase() || "";
    const schoolFilter = document.getElementById("filterSchool")?.value || "";
    const statusFilter = document.getElementById("filterStatus")?.value || "";

    state.filteredUsers = state.allUsers.filter((user) => {
      const matchesSearch =
        !searchTerm ||
        user.nombreCompleto.toLowerCase().includes(searchTerm) ||
        (user.correo && user.correo.toLowerCase().includes(searchTerm));

      const matchesSchool = !schoolFilter || user.escuelaID === schoolFilter;

      const matchesStatus =
        !statusFilter ||
        (statusFilter === "activo" && user.estadoActivo) ||
        (statusFilter === "inactivo" && !user.estadoActivo);

      return matchesSearch && matchesSchool && matchesStatus;
    });

    state.currentPage = 1;
    ui.updateTable(ui.getCurrentPageUsers());
    ui.updateTableInfo();
    ui.updatePagination();
  },

  setupSearch() {
    const searchInput = document.getElementById("searchUsers");
    if (!searchInput) return;

    searchInput.addEventListener("input", () => {
      clearTimeout(state.searchTimeout);
      state.searchTimeout = setTimeout(() => {
        this.apply();
      }, CONFIG.SEARCH_DEBOUNCE);
    });
  },
};

// =============================================
// OPERACIONES CRUD
// =============================================
const crud = {
  async toggleUserStatus(userId, newStatus) {
    if (state.isLoading) return;

    try {
      const user = state.allUsers.find((u) => u.id === userId);
      if (!user) throw new Error("Usuario no encontrado");

      if (!newStatus && user.esAdmin) {
        const confirmed = await this.showConfirmDialog(
          "Confirmar Desactivación",
          `¿Desactivar al administrador "${user.nombreCompleto}"?`,
          "warning"
        );
        if (!confirmed) {
          document.querySelector(`[data-user-id="${userId}"]`).checked =
            !newStatus;
          return;
        }
      }

      await updateDoc(doc(db, CONFIG.COLLECTIONS.USUARIOS, userId), {
        estadoActivo: newStatus,
        fechaActualizacion: new Date().toISOString(),
      });

      const userIndex = state.allUsers.findIndex((u) => u.id === userId);
      if (userIndex !== -1) {
        state.allUsers[userIndex].estadoActivo = newStatus;
      }

      filters.apply();
      ui.updateStatistics();
      utils.showToast(
        "Estado Actualizado",
        `Usuario ${newStatus ? "activado" : "desactivado"}`,
        "success"
      );
    } catch (error) {
      utils.handleError(error, "al cambiar estado");
    }
  },

  /**
   * Inspecciona un usuario mostrando todos sus datos
   */
  async viewUserDetails(userId) {
    try {
      const user = state.allUsers.find((u) => u.id === userId);
      if (!user) throw new Error("Usuario no encontrado");

      const modal = document.getElementById("inspectUserModal");
      if (!modal) throw new Error("Modal de inspección no encontrado");

      // Llenar datos del usuario
      const fields = {
        inspectUserName: user.nombreCompleto || "Sin nombre",
        inspectUserEmail: user.correo || "Sin email",
        inspectUserCode: user.codigoUsuario || "N/A",
        inspectUserPhone: user.celular || "No especificado",
        inspectUserBirthDate: utils.formatDate(user.fechaNacimiento),
        inspectUserAge: user.edad ? user.edad.toString() : "No especificado",
        inspectUserSchool: user.nombreEscuela || "No especificado",
        inspectUserFaculty: user.nombreFacultad || "No especificado",
        inspectUserRegistrationDate: utils.formatDate(user.fechaRegistro),
        inspectUserLastUpdate: utils.formatDate(user.fechaActualizacion),
      };

      Object.entries(fields).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
      });

      // Estado del usuario
      const statusBadge = document.getElementById("inspectUserStatus");
      if (statusBadge) {
        statusBadge.innerHTML = user.estadoActivo
          ? '<span class="badge bg-success"><i class="fas fa-check-circle me-1"></i>Activo</span>'
          : '<span class="badge bg-danger"><i class="fas fa-times-circle me-1"></i>Inactivo</span>';
      }

      // Información de participaciones en eventos
      const eventsInfo = document.getElementById("inspectUserEvents");
      if (eventsInfo) {
        const eventCount = user.eventosParticipados || 0;
        eventsInfo.innerHTML = `
          <div class="d-flex align-items-center">
            <span class="badge ${participationModule.getParticipationBadgeClass(
              eventCount
            )} me-2">${eventCount}</span>
            <span>${
              eventCount === 1 ? "Evento participado" : "Eventos participados"
            }</span>
          </div>
        `;
      }

      // Información del rol con ID y nombre
      const roleInfo = document.getElementById("inspectUserRole");
      if (roleInfo) {
        let roleDisplay = "";

        // Mostrar información del rol si existe
        if (user.idRol) {
          const roleName = user.nombreRol || "Rol desconocido";
          roleDisplay = `
        <div class="mb-2">
          <strong></strong> ${roleName}
        </div>
        <div class="mb-2">
          <strong>ID del Rol:</strong> <code>${user.idRol}</code>
        </div>
      `;

          // Añadir descripción si existe
          if (user.descripcionRol) {
            roleDisplay += `
          <div class="mb-2">
            <strong>Descripción:</strong> ${user.descripcionRol}
          </div>
        `;
          }

          // Añadir permisos si existen
          if (user.permisosRol && user.permisosRol.length > 0) {
            roleDisplay += `
          <div class="mb-2">
            <strong>Permisos:</strong>
            <div class="mt-1">
              ${user.permisosRol
                .map(
                  (permiso) =>
                    `<span class="badge bg-info me-1">${permiso}</span>`
                )
                .join("")}
            </div>
          </div>
        `;
          }
        } else {
          roleDisplay = '<div class="text-muted">Sin rol asignado</div>';
        }

        roleInfo.innerHTML = roleDisplay;
      }

      // Tipo de usuario con información de roles
      const userTypeBadge = document.getElementById("inspectUserType");
      if (userTypeBadge) {
        let typeDisplay = "";

        const roleBadge = ui.getRoleDisplayBadge(user);
        if (roleBadge !== "-") {
          typeDisplay += roleBadge;
        }

        userTypeBadge.innerHTML =
          typeDisplay ||
          '<span class="badge bg-secondary">Usuario Regular</span>';
      }

      // Información adicional de permisos
      const permissionsInfo = document.getElementById("inspectUserPermissions");
      if (permissionsInfo && user.permisosRol && user.permisosRol.length > 0) {
        permissionsInfo.innerHTML = `
      <h6>Permisos del Rol:</h6>
      <div class="permissions-list">
        ${user.permisosRol
          .map(
            (permiso) => `
          <div class="permission-item mb-1">
            <i class="fas fa-check-circle text-success me-2"></i>
            <span>${permiso
              .replace(/_/g, " ")
              .replace(/\b\w/g, (l) => l.toUpperCase())}</span>
          </div>
        `
          )
          .join("")}
      </div>
    `;
      } else if (permissionsInfo) {
        permissionsInfo.innerHTML =
          '<div class="text-muted">Sin permisos específicos asignados</div>';
      }

      new bootstrap.Modal(modal).show();
    } catch (error) {
      utils.handleError(error, "al inspeccionar usuario");
    }
  },

  /**
   * Elimina un usuario con validaciones
   */
  async deleteUser(userId) {
    if (state.isLoading) return;

    try {
      const user = state.allUsers.find((u) => u.id === userId);
      if (!user) throw new Error("Usuario no encontrado");

      let warningMessage = `¿Eliminar permanentemente a "${user.nombreCompleto}"?`;

      // Verificaciones adicionales
      if (user.esAdmin) {
        const activeAdmins = state.allUsers.filter(
          (u) => u.esAdmin && u.estadoActivo
        ).length;
        if (activeAdmins <= 1) {
          throw new Error(
            "No se puede eliminar el último administrador activo"
          );
        }
        warningMessage += "\n\n⚠️ Este usuario es administrador del sistema.";
      }

      if (user.estadoActivo) {
        warningMessage += "\n\n⚠️ El usuario está actualmente activo.";
      }

      if (user.eventosParticipados > 0) {
        warningMessage += `\n\n⚠️ El usuario ha participado en ${user.eventosParticipados} eventos.`;
      }

      warningMessage += "\n\nEsta acción no se puede deshacer.";

      const confirmed = await this.showConfirmDialog(
        "Eliminar Usuario",
        warningMessage,
        "danger"
      );

      if (!confirmed) return;

      state.isLoading = true;

      await deleteDoc(doc(db, CONFIG.COLLECTIONS.USUARIOS, userId));

      // Actualizar cache local
      const userIndex = state.allUsers.findIndex((u) => u.id === userId);
      if (userIndex !== -1) {
        state.allUsers.splice(userIndex, 1);
      }

      filters.apply();
      ui.updateStatistics();
      utils.showToast(
        "Usuario Eliminado",
        "Usuario eliminado correctamente",
        "success"
      );
    } catch (error) {
      utils.handleError(error, "al eliminar usuario");
    } finally {
      state.isLoading = false;
    }
  },

  showConfirmDialog(title, message, type = "info") {
    return new Promise((resolve) => {
      const modal = document.getElementById("confirmModal");
      const titleElement = document.getElementById("confirmModalTitle");
      const bodyElement = document.getElementById("confirmModalBody");
      const confirmBtn = document.getElementById("confirmModalBtn");

      if (!modal || !titleElement || !bodyElement || !confirmBtn) {
        resolve(false);
        return;
      }

      titleElement.textContent = title;
      bodyElement.textContent = message;

      const typeClasses = {
        danger: "btn-danger",
        warning: "btn-warning",
        info: "btn-info",
        success: "btn-success",
      };
      confirmBtn.className = `btn ${typeClasses[type] || "btn-primary"}`;

      const handleConfirm = () => {
        cleanup();
        resolve(true);
      };

      const handleCancel = () => {
        cleanup();
        resolve(false);
      };

      const cleanup = () => {
        confirmBtn.removeEventListener("click", handleConfirm);
        modal.removeEventListener("hidden.bs.modal", handleCancel);
        const bootstrapModal = bootstrap.Modal.getInstance(modal);
        if (bootstrapModal) bootstrapModal.hide();
      };

      confirmBtn.addEventListener("click", handleConfirm);
      modal.addEventListener("hidden.bs.modal", handleCancel, { once: true });

      new bootstrap.Modal(modal).show();
    });
  },
};

// =============================================
// INTEGRACIÓN CON MÓDULO DE ROLES
// =============================================

// Escuchar eventos del módulo de roles
document.addEventListener("requestAllUsers", (event) => {
  if (event.detail && event.detail.callback) {
    event.detail.callback(state.allUsers);
  }
});

document.addEventListener("reloadUsers", () => {
  dataLoader.loadAllUsers();
});

// =============================================
// FUNCIONES GLOBALES
// =============================================
window.exportUsers = exportModule.exportUsers.bind(exportModule);
window.toggleUserStatus = crud.toggleUserStatus.bind(crud);
window.viewUserDetails = crud.viewUserDetails.bind(crud);
window.deleteUser = crud.deleteUser.bind(crud);
window.viewUserEvents =
  participationModule.viewUserEvents.bind(participationModule);

// Funciones que utilizan el módulo de roles (ya definidas en role-management.js)
// window.assignRole - definida en role-management.js
// window.updateUserRole - definida en role-management.js
// window.toggleAdminRole - definida en role-management.js

window.changePage = function (page) {
  const totalPages = Math.ceil(
    state.filteredUsers.length / CONFIG.USERS_PER_PAGE
  );
  if (page < 1 || page > totalPages) return;

  state.currentPage = page;
  ui.updateTable(ui.getCurrentPageUsers());
  ui.updateTableInfo();
  ui.updatePagination();

  document.querySelector(".table-card")?.scrollIntoView({ behavior: "smooth" });
};

// =============================================
// INICIALIZACIÓN
// =============================================
async function populateModalSelects() {
  try {
    // Cargar datos frescos
    const [schools, faculties] = await Promise.all([
      dataLoader.loadSchools(),
      dataLoader.loadFaculties(),
    ]);

    // Poblar select de escuelas
    const schoolSelect = document.getElementById("userSchool");
    if (schoolSelect) {
      schoolSelect.innerHTML =
        '<option value="">Seleccionar Escuela</option>' +
        schools
          .map((s) => `<option value="${s.id}">${s.name}</option>`)
          .join("");
    }

    // Poblar select de facultades
    const facultySelect = document.getElementById("userFaculty");
    if (facultySelect) {
      facultySelect.innerHTML =
        '<option value="">Seleccionar Facultad</option>' +
        faculties
          .map((f) => `<option value="${f.id}">${f.name}</option>`)
          .join("");
    }

    console.log("✅ Selects del modal poblados correctamente");
  } catch (error) {
    console.error("❌ Error al poblar selects del modal:", error);
    utils.showToast("Error", "Error al cargar datos del formulario", "error");
  }
}

function handleAdminRegistered(event) {
  console.log("🎉 Nuevo administrador registrado:", event.detail);

  // Mostrar mensaje de éxito
  utils.showToast(
    "Administrador Creado",
    `El administrador ${event.detail.adminData.nombreUsuario} ${event.detail.adminData.apellidoUsuario} ha sido creado exitosamente.`,
    "success"
  );

  // Recargar la lista de usuarios para mostrar el nuevo admin
  setTimeout(() => {
    dataLoader.loadAllUsers();
  }, 1000);
}

async function initialize() {
  try {
    console.log(
      "🚀 Inicializando gestión de usuarios con roles y participaciones..."
    );

    // Configurar eventos de filtros
    ["filterSchool", "filterStatus"].forEach((id) => {
      const element = document.getElementById(id);
      if (element)
        element.addEventListener("change", filters.apply.bind(filters));
    });

    // Configurar búsqueda
    filters.setupSearch();
    setupAddAdminButton();
    document.addEventListener("adminRegistered", handleAdminRegistered);

    // Cargar datos iniciales
    const [schools, faculties] = await Promise.all([
      dataLoader.loadSchools(),
      dataLoader.loadFaculties(),
    ]);

    // Inicializar selector de filtro de escuelas
    const filterSchool = document.getElementById("filterSchool");
    if (filterSchool) {
      filterSchool.innerHTML =
        '<option value="">Todas las Escuelas</option>' +
        schools
          .map((s) => `<option value="${s.id}">${s.name}</option>`)
          .join("");
    }

    // Cargar usuarios (incluye roles y participaciones automáticamente)
    await dataLoader.loadAllUsers();
    window.exportUsers = exportModule.exportUsers.bind(exportModule);
    window.executeExport = executeExport;
    window.exportAllUsersToExcel = exportAllUsersToExcel;
    console.log(
      "✅ Gestión de usuarios con roles y participaciones inicializada"
    );
  } catch (error) {
    console.error("❌ Error al inicializar:", error);
    utils.showToast("Error", "Error al cargar el sistema", "error");
  }
}

function setupAddAdminButton() {
  // Buscar el botón que abre el modal
  const addAdminButton = document.querySelector(
    '[data-bs-target="#addUserModal"]'
  );

  if (addAdminButton) {
    console.log("✅ Botón de agregar administrador encontrado y configurado");

    // El botón ya debería abrir el modal automáticamente por Bootstrap
    // Solo necesitamos asegurarnos de que el modal esté configurado correctamente

    const modal = document.getElementById("addUserModal");
    if (modal) {
      // Evento cuando se abre el modal
      modal.addEventListener("show.bs.modal", function () {
        console.log("📝 Modal de agregar administrador abierto");

        // Asegurarse de que los selects tengan datos
        populateModalSelects();
      });

      // Evento cuando se cierra el modal
      modal.addEventListener("hidden.bs.modal", function () {
        console.log("❌ Modal de agregar administrador cerrado");
      });
    }
  } else {
    console.warn("⚠️ No se encontró el botón para agregar administrador");
  }
}

// Función para refrescar datos cuando se crea/modifica un evento
window.refreshUserParticipations = async function () {
  try {
    console.log("🔄 Refrescando participaciones de usuarios...");

    // Recargar mapa de participaciones
    await participationModule.loadEventsParticipation();

    // Actualizar todos los usuarios con las nuevas participaciones
    state.allUsers = state.allUsers.map((user) => ({
      ...user,
      eventosParticipados: state.participationMap.get(user.id) || 0,
    }));

    // Actualizar usuarios filtrados
    state.filteredUsers = state.filteredUsers.map((user) => ({
      ...user,
      eventosParticipados: state.participationMap.get(user.id) || 0,
    }));

    // Actualizar la tabla
    ui.updateTable(ui.getCurrentPageUsers());

    console.log("✅ Participaciones actualizadas");
  } catch (error) {
    console.error("❌ Error al refrescar participaciones:", error);
  }
};

// Inicializar cuando el DOM esté listo
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}

export {
  dataLoader,
  filters,
  exportModule,
  participationModule,
  initialize,
  setupAddAdminButton,
  handleAdminRegistered,
  populateModalSelects,
};
