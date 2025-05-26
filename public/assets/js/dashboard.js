// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAUBAyRnT0XEoKLlv-9GAmxi6F12peZd7c",
  authDomain: "rsunfv.firebaseapp.com",
  projectId: "rsunfv",
  storageBucket: "rsunfv.firebasestorage.app",
  messagingSenderId: "125433829660",
  appId: "1:125433829660:web:ef60f4871bf4ad74ae02d9",
  measurementId: "G-QCWGD7EJ46",
};

// Inicializar Firebase (solo si no está inicializado)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// Variables globales
let currentUserData = null;

auth.onAuthStateChanged(async (user) => {
  if (user) {
    try {
      // Obtener datos del usuario desde Firestore
      const userDoc = await db.collection("usuarios").doc(user.uid).get();
      if (userDoc.exists) {
        currentUserData = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          ...userDoc.data(),
        };
        // Ahora puedes usar currentUserData en todo el dashboard
        // Ejemplo: mostrar nombre
        const displayNameElement = document.getElementById("userDisplayName");
        if (displayNameElement) {
          displayNameElement.textContent =
            currentUserData.nombre || currentUserData.email;
        }
        // Cargar datos del dashboard
        await loadDashboardData();
      } else {
        showMessage("Usuario no encontrado en la base de datos", "error");
        await auth.signOut();
        window.location.href = "login.html";
      }
    } catch (error) {
      showMessage("Error al obtener datos del usuario", "error");
    }
  } else {
    window.location.href = "login.html";
  }
});

// Función para cargar datos del dashboard
async function loadDashboardData() {
  try {
    // Cargar eventos
    await loadEvents();

    // Cargar usuarios y calcular estadísticas
    await loadUsersStats();

    showMessage("Dashboard cargado exitosamente", "success");
  } catch (error) {
    console.error("Error al cargar datos:", error);
    showMessage("Error al cargar datos del dashboard", "error");
  }
}

// Función para cargar eventos
async function loadEvents() {
  try {
    const snapshot = await db
      .collection("eventos")
      .orderBy("fechaCreacion", "desc")
      .limit(10)
      .get();
    events = [];

    snapshot.forEach((doc) => {
      events.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    // Actualizar contador de eventos
    document.getElementById("totalEvents").textContent = events.length;

    // Actualizar tabla de eventos
    updateEventsTable();
  } catch (error) {
    console.error("Error al cargar eventos:", error);
    showMessage("Error al cargar eventos", "error");
  }
}

// Función para actualizar tabla de eventos
function updateEventsTable() {
  const tbody = document.getElementById("eventsTable");

  if (events.length === 0) {
    tbody.innerHTML = `
                    <tr>
                        <td colspan="5" class="text-center py-4">
                            <i class="fas fa-calendar-times fa-2x text-muted mb-2"></i>
                            <div>No hay eventos registrados</div>
                        </td>
                    </tr>
                `;
    return;
  }

  tbody.innerHTML = events
    .map((evento) => {
      const fechaInicio = evento.fechaInicio
        ? new Date(evento.fechaInicio.seconds * 1000).toLocaleDateString(
            "es-ES"
          )
        : "No definida";
      const estado = evento.idEstado === "est_001" ? "Activo" : "Inactivo";
      const badgeClass =
        evento.idEstado === "est_001" ? "status-active" : "status-pending";

      return `
                    <tr>
                        <td>
                            <strong>${evento.titulo || "Sin título"}</strong>
                            <br>
                            <small class="text-muted">${
                              evento.descripcion
                                ? evento.descripcion.substring(0, 50) + "..."
                                : "Sin descripción"
                            }</small>
                        </td>
                        <td>
                            <i class="fas fa-map-marker-alt text-danger me-1"></i>
                            ${evento.ubicacion || "No especificada"}
                        </td>
                        <td>${fechaInicio}</td>
                        <td>
                            <span class="badge bg-primary">${
                              evento.cantidadVoluntarios || 0
                            }</span>
                        </td>
                        <td>
                            <span class="status-badge ${badgeClass}">${estado}</span>
                        </td>
                    </tr>
                `;
    })
    .join("");
}

// Función para cargar estadísticas de usuarios
async function loadUsersStats() {
  try {
    const snapshot = await db.collection("usuarios").get();
    users = [];
    let admins = 0;
    let volunteers = 0;

    snapshot.forEach((doc) => {
      const userData = doc.data();
      users.push({
        id: doc.id,
        ...userData,
      });

      if (userData.esAdmin === true) {
        admins++;
      } else {
        volunteers++;
      }
    });

    // Actualizar contadores
    document.getElementById("totalVolunteers").textContent = volunteers;
    document.getElementById("totalAdmins").textContent = admins;
    document.getElementById("totalParticipants").textContent = users.length;

    // Actualizar tabla de usuarios recientes
    updateUsersTable();
  } catch (error) {
    console.error("Error al cargar usuarios:", error);
    showMessage("Error al cargar estadísticas de usuarios", "error");
  }
}

// Función para actualizar tabla de usuarios
function updateUsersTable() {
  const tbody = document.getElementById("usersTable");

  if (!tbody) return; // Si no existe la tabla, salir

  if (users.length === 0) {
    tbody.innerHTML = `
                    <tr>
                        <td colspan="4" class="text-center py-4">
                            <i class="fas fa-users-slash fa-2x text-muted mb-2"></i>
                            <div>No hay usuarios registrados</div>
                        </td>
                    </tr>
                `;
    return;
  }

  // Mostrar los últimos 10 usuarios
  const recentUsers = users.slice(0, 10);

  tbody.innerHTML = recentUsers
    .map((usuario) => {
      const fechaRegistro = usuario.fechaRegistro
        ? new Date(usuario.fechaRegistro.seconds * 1000).toLocaleDateString(
            "es-ES"
          )
        : "No definida";

      const tipoUsuario =
        usuario.esAdmin === true ? "Administrador" : "Voluntario";
      const badgeClass = usuario.esAdmin === true ? "bg-warning" : "bg-success";

      return `
                    <tr>
                        <td>
                            <div class="d-flex align-items-center">
                                <div class="avatar-sm me-3">
                                    <div class="avatar-title rounded-circle bg-light text-primary">
                                        ${(
                                          usuario.nombre ||
                                          usuario.email ||
                                          "U"
                                        )
                                          .charAt(0)
                                          .toUpperCase()}
                                    </div>
                                </div>
                                <div>
                                    <strong>${
                                      usuario.nombre || "Sin nombre"
                                    }</strong>
                                    <br>
                                    <small class="text-muted">${
                                      usuario.email || "Sin email"
                                    }</small>
                                </div>
                            </div>
                        </td>
                        <td>
                            <span class="badge ${badgeClass}">${tipoUsuario}</span>
                        </td>
                        <td>${fechaRegistro}</td>
                        <td>
                            <div class="dropdown">
                                <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                                    <i class="fas fa-ellipsis-v"></i>
                                </button>
                                <ul class="dropdown-menu">
                                    <li><a class="dropdown-item" href="#" onclick="viewUser('${
                                      usuario.id
                                    }')">
                                        <i class="fas fa-eye me-2"></i>Ver detalles
                                    </a></li>
                                    <li><a class="dropdown-item" href="#" onclick="editUser('${
                                      usuario.id
                                    }')">
                                        <i class="fas fa-edit me-2"></i>Editar
                                    </a></li>
                                    ${
                                      !usuario.esAdmin
                                        ? `
                                    <li><hr class="dropdown-divider"></li>
                                    <li><a class="dropdown-item text-danger" href="#" onclick="deleteUser('${usuario.id}')">
                                        <i class="fas fa-trash me-2"></i>Eliminar
                                    </a></li>
                                    `
                                        : ""
                                    }
                                </ul>
                            </div>
                        </td>
                    </tr>
                `;
    })
    .join("");
}

// Función para ver detalles del usuario
function viewUser(userId) {
  const user = users.find((u) => u.id === userId);
  if (!user) {
    showMessage("Usuario no encontrado", "error");
    return;
  }

  // Aquí puedes implementar un modal o redirección para ver detalles
  console.log("Ver usuario:", user);
  showMessage(`Viendo detalles de ${user.nombre || user.email}`, "info");
}

// Función para editar usuario
function editUser(userId) {
  const user = users.find((u) => u.id === userId);
  if (!user) {
    showMessage("Usuario no encontrado", "error");
    return;
  }

  // Aquí puedes implementar la lógica de edición
  console.log("Editar usuario:", user);
  showMessage(`Editando ${user.nombre || user.email}`, "info");
}

// Función para eliminar usuario
async function deleteUser(userId) {
  const user = users.find((u) => u.id === userId);
  if (!user) {
    showMessage("Usuario no encontrado", "error");
    return;
  }

  if (user.esAdmin) {
    showMessage("No se puede eliminar un administrador", "error");
    return;
  }

  if (
    confirm(
      `¿Estás seguro de que deseas eliminar al usuario ${
        user.nombre || user.email
      }?`
    )
  ) {
    try {
      showMessage("Eliminando usuario...", "loading");

      await db.collection("usuarios").doc(userId).delete();

      // Recargar estadísticas
      await loadUsersStats();

      showMessage("Usuario eliminado exitosamente", "success");
    } catch (error) {
      console.error("Error al eliminar usuario:", error);
      showMessage("Error al eliminar usuario", "error");
    }
  }
}

// Función para mostrar perfil
function showProfile() {
  showMessage("Funcionalidad de perfil en desarrollo", "info");
}

// Función para mostrar configuración
function showSettings() {
  showMessage("Funcionalidad de configuración en desarrollo", "info");
}

// Función para manejar el logout (llamada desde el HTML)
async function handleLogout() {
  if (confirm("¿Estás seguro de que deseas cerrar sesión?")) {
    try {
      showMessage("Cerrando sesión...", "loading");
      isLoggingOut = true; // Marcar que estamos cerrando sesión manualmente
      await auth.signOut();
      // El onAuthStateChanged se encargará de la redirección
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      showMessage("Error al cerrar sesión", "error");
      isLoggingOut = false; // Resetear en caso de error
    }
  }
}

// Función para cerrar sesión (uso interno)
async function logout() {
  try {
    showMessage("Cerrando sesión...", "loading");
    isLoggingOut = true;
    await auth.signOut();
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
    showMessage("Error al cerrar sesión", "error");
    isLoggingOut = false;
  }
}

// Función para refrescar datos
async function refreshData() {
  try {
    showMessage("Actualizando datos...", "loading");
    await loadDashboardData();
  } catch (error) {
    console.error("Error al refrescar datos:", error);
    showMessage("Error al actualizar datos", "error");
  }
}

// Event listeners para botones
document.addEventListener("DOMContentLoaded", function () {
  // Botón de refresh (si existe)
  const refreshBtn = document.getElementById("refreshBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", refreshData);
  }

  // Auto-refresh cada 5 minutos
  setInterval(refreshData, 5 * 60 * 1000);
});

// Agregar estilos CSS para animaciones
const style = document.createElement("style");
style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .avatar-sm {
                height: 2rem;
                width: 2rem;
            }
            
            .avatar-title {
                align-items: center;
                display: flex;
                height: 100%;
                justify-content: center;
                width: 100%;
                font-weight: 600;
            }
            
            .status-badge {
                padding: 0.25rem 0.5rem;
                border-radius: 0.375rem;
                font-size: 0.75rem;
                font-weight: 500;
            }
            
            .status-active {
                background-color: #d4edda;
                color: #155724;
            }
            
            .status-pending {
                background-color: #f8d7da;
                color: #721c24;
            }
            
            .custom-alert {
                border-left: 4px solid rgba(255,255,255,0.3);
            }
        `;
document.head.appendChild(style);
