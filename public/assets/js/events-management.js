import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
  Timestamp,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

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

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// =============================================
// FUNCIONES DE GESTIÓN DE SESIÓN (Reutilizadas)
// =============================================

function getStoredSession() {
  try {
    const storedSession = localStorage.getItem("userSession");
    if (storedSession) {
      return JSON.parse(storedSession);
    }
    return null;
  } catch (error) {
    console.error("Error al obtener sesión:", error);
    localStorage.removeItem("userSession");
    return null;
  }
}

function clearSession() {
  try {
    localStorage.removeItem("userSession");
    console.log("Sesión limpiada");
  } catch (error) {
    console.error("Error al limpiar sesión:", error);
  }
}

function checkAuthentication() {
  const session = getStoredSession();
  if (!session) {
    console.log("No hay sesión activa, redirigiendo al login");
    window.location.href = "index.html";
    return null;
  }

  if (!session.esAdmin) {
    console.log("Usuario sin privilegios de administrador");
    alert("No tienes permisos para acceder a esta página");
    window.location.href = "portal_test.html";
    return null;
  }

  return session;
}

// =============================================
// FUNCIONES DE NAVEGACIÓN (Reutilizadas)
// =============================================

window.navigateToPage = function (pageName) {
  const session = getStoredSession();
  if (!session) {
    window.location.href = "index.html";
    return;
  }

  const adminPages = [
    "eventos.html",
    "administradores.html",
    "usuarios.html",
    "configuracion.html",
    "reportes.html",
  ];
  if (adminPages.includes(pageName) && !session.esAdmin) {
    alert("No tienes permisos para acceder a esta página");
    return;
  }

  window.location.href = pageName;
};

window.showProfile = function () {
  const session = getStoredSession();
  if (session) {
    alert(
      `Perfil de Usuario:\n\nNombre: ${session.nombre}\nCorreo: ${
        session.correo
      }\nRol: ${
        session.esAdmin ? "Administrador" : "Usuario"
      }\nÚltimo acceso: ${new Date(session.loginTime).toLocaleString()}`
    );
  }
};

window.showSettings = function () {
  alert("Página de configuración en desarrollo");
};

window.handleLogout = function () {
  const confirmed = confirm("¿Estás seguro de que deseas cerrar sesión?");
  if (confirmed) {
    console.log("Cerrando sesión...");
    clearSession();
    alert("Sesión cerrada exitosamente");
    window.location.href = "index.html";
  }
};

// =============================================
// FUNCIONES DE GESTIÓN DE EVENTOS
// =============================================

// Cargar eventos futuros
async function loadUpcomingEvents() {
  const loadingEl = document.getElementById("upcomingLoading");
  const eventsContainer = document.getElementById("upcomingEvents");

  try {
    if (loadingEl) loadingEl.style.display = "block";

    const now = new Date();
    const eventosRef = collection(db, "eventos");
    const q = query(
      eventosRef,
      where("fechaInicio", ">=", Timestamp.fromDate(now)),
      orderBy("fechaInicio", "asc")
    );

    const querySnapshot = await getDocs(q);
    const events = [];

    querySnapshot.forEach((doc) => {
      events.push({ id: doc.id, ...doc.data() });
    });

    displayUpcomingEvents(events);
  } catch (error) {
    console.error("Error al cargar eventos futuros:", error);
    if (eventsContainer) {
      eventsContainer.innerHTML = `
        <div class="text-center py-4">
          <i class="fas fa-exclamation-triangle fa-2x text-warning mb-2"></i>
          <div>Error al cargar eventos futuros</div>
          <small class="text-muted">Intenta recargar la página</small>
        </div>
      `;
    }
  } finally {
    if (loadingEl) loadingEl.style.display = "none";
  }
}

// Mostrar eventos futuros
function displayUpcomingEvents(events) {
  const eventsContainer = document.getElementById("upcomingEvents");
  if (!eventsContainer) return;

  if (events.length === 0) {
    eventsContainer.innerHTML = `
      <div class="text-center py-5">
        <i class="fas fa-calendar-plus fa-3x text-muted mb-3"></i>
        <h5>No hay eventos futuros programados</h5>
        <p class="text-muted">Crea un nuevo evento usando la pestaña "Crear Evento"</p>
      </div>
    `;
    return;
  }

  let eventsHTML = "";
  events.forEach((event) => {
    const fechaInicio = event.fechaInicio
      ? event.fechaInicio.toDate()
      : new Date();
    const fechaFin = event.fechaFin ? event.fechaFin.toDate() : null;

    eventsHTML += `
      <div class="event-card" data-event-id="${event.id}">
        <div class="event-card-header">
          <div class="d-flex justify-content-between align-items-start">
            <h5 class="event-title">${event.titulo || "Sin título"}</h5>
            <span class="status-badge status-upcoming">Próximo</span>
          </div>
        </div>
        <div class="event-card-body">
          <div class="event-meta">
            <div class="event-meta-item">
              <i class="fas fa-calendar"></i>
              <span>${fechaInicio.toLocaleDateString("es-ES", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}</span>
            </div>
            <div class="event-meta-item">
              <i class="fas fa-clock"></i>
              <span>${event.horaInicio || "No definida"} - ${
      event.horaFin || "No definida"
    }</span>
            </div>
            <div class="event-meta-item">
              <i class="fas fa-map-marker-alt"></i>
              <span>${event.ubicacion || "No especificada"}</span>
            </div>
            <div class="event-meta-item">
              <i class="fas fa-users"></i>
              <span>${
                event.voluntariosRegistrados || 0
              } voluntarios registrados</span>
            </div>
            ${
              event.maxVoluntarios
                ? `
            <div class="event-meta-item">
              <i class="fas fa-user-plus"></i>
              <span>Máximo: ${event.maxVoluntarios} voluntarios</span>
            </div>
            `
                : ""
            }
          </div>
          <p class="event-description">
            ${event.descripcion || "Sin descripción disponible"}
          </p>
          <div class="event-actions">
            <button class="btn btn-primary btn-sm" onclick="editEvent('${
              event.id
            }')">
              <i class="fas fa-edit me-1"></i>Editar
            </button>
            <button class="btn btn-outline-secondary btn-sm" onclick="viewVolunteers('${
              event.id
            }')">
              <i class="fas fa-users me-1"></i>Ver Voluntarios
            </button>
            <button class="btn btn-outline-danger btn-sm" onclick="cancelEvent('${
              event.id
            }')">
              <i class="fas fa-trash me-1"></i>Cancelar
            </button>
          </div>
        </div>
      </div>
    `;
  });

  eventsContainer.innerHTML = eventsHTML;
}

// Cargar eventos pasados
async function loadPastEvents() {
  const loadingEl = document.getElementById("pastLoading");
  const eventsContainer = document.getElementById("pastEvents");

  try {
    if (loadingEl) loadingEl.style.display = "block";

    const now = new Date();
    const eventosRef = collection(db, "eventos");
    const q = query(
      eventosRef,
      where("fechaFin", "<", Timestamp.fromDate(now)),
      orderBy("fechaFin", "desc")
    );

    const querySnapshot = await getDocs(q);
    const events = [];

    querySnapshot.forEach((doc) => {
      events.push({ id: doc.id, ...doc.data() });
    });

    displayPastEvents(events);
  } catch (error) {
    console.error("Error al cargar eventos pasados:", error);
    if (eventsContainer) {
      eventsContainer.innerHTML = `
        <div class="text-center py-4">
          <i class="fas fa-exclamation-triangle fa-2x text-warning mb-2"></i>
          <div>Error al cargar eventos pasados</div>
          <small class="text-muted">Intenta recargar la página</small>
        </div>
      `;
    }
  } finally {
    if (loadingEl) loadingEl.style.display = "none";
  }
}

// Mostrar eventos pasados
function displayPastEvents(events) {
  const eventsContainer = document.getElementById("pastEvents");
  if (!eventsContainer) return;

  if (events.length === 0) {
    eventsContainer.innerHTML = `
      <div class="text-center py-5">
        <i class="fas fa-history fa-3x text-muted mb-3"></i>
        <h5>No hay eventos pasados</h5>
        <p class="text-muted">Los eventos completados aparecerán aquí</p>
      </div>
    `;
    return;
  }

  let eventsHTML = "";
  events.forEach((event) => {
    const fechaInicio = event.fechaInicio
      ? event.fechaInicio.toDate()
      : new Date();

    eventsHTML += `
      <div class="event-card" data-event-id="${event.id}">
        <div class="event-card-header">
          <div class="d-flex justify-content-between align-items-start">
            <h5 class="event-title">${event.titulo || "Sin título"}</h5>
            <span class="status-badge status-completed">Completado</span>
          </div>
        </div>
        <div class="event-card-body">
          <div class="event-meta">
            <div class="event-meta-item">
              <i class="fas fa-calendar"></i>
              <span>${fechaInicio.toLocaleDateString("es-ES", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}</span>
            </div>
            <div class="event-meta-item">
              <i class="fas fa-map-marker-alt"></i>
              <span>${event.ubicacion || "No especificada"}</span>
            </div>
            <div class="event-meta-item">
              <i class="fas fa-users"></i>
              <span>${
                event.voluntariosRegistrados || 0
              } voluntarios participaron</span>
            </div>
            ${
              event.resultados
                ? `
            <div class="event-meta-item">
              <i class="fas fa-check-circle"></i>
              <span>${event.resultados}</span>
            </div>
            `
                : ""
            }
          </div>
          <p class="event-description">
            ${event.descripcion || "Sin descripción disponible"}
          </p>
          <div class="event-actions">
            <button class="btn btn-outline-secondary btn-sm" onclick="viewEventReport('${
              event.id
            }')">
              <i class="fas fa-chart-bar me-1"></i>Ver Reporte
            </button>
            <button class="btn btn-outline-secondary btn-sm" onclick="viewEventPhotos('${
              event.id
            }')">
              <i class="fas fa-camera me-1"></i>Ver Fotos
            </button>
          </div>
        </div>
      </div>
    `;
  });

  eventsContainer.innerHTML = eventsHTML;
}

// =============================================
// CONFIGURACIÓN DE CLOUDINARY
// =============================================

const CLOUDINARY_CONFIG = {
  cloudName: "dupkeaqnz",
  uploadPreset: "u5jbjfxu",
  apiKey: "572426943132833",
};

// =============================================
// VARIABLES GLOBALES DE CONTROL
// =============================================
let currentFiles = [];
let isCreatingEvent = false;
let isFormInitialized = false; // NUEVO: Prevenir múltiples inicializaciones

// =============================================
// FUNCIONES DE SUBIDA DE FOTOS
// =============================================

async function uploadImageToCloudinary(file) {
  if (!file) {
    throw new Error("No se proporcionó ningún archivo");
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("El archivo no es una imagen válida");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("La imagen es demasiado grande. Máximo 10MB");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_CONFIG.uploadPreset);
  formData.append("cloud_name", CLOUDINARY_CONFIG.cloudName);
  formData.append("timestamp", Date.now().toString());

  try {
    console.log(
      `Subiendo imagen: ${file.name} (${(file.size / 1024 / 1024).toFixed(
        2
      )}MB)`
    );

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Error response from Cloudinary:", errorData);
      throw new Error(`Error HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.secure_url) {
      throw new Error("No se recibió URL de la imagen subida");
    }

    console.log(`Imagen subida exitosamente: ${data.secure_url}`);

    return {
      success: true,
      url: data.secure_url,
      publicId: data.public_id,
      originalName: file.name,
    };
  } catch (error) {
    console.error(`Error uploading ${file.name} to Cloudinary:`, error);
    return {
      success: false,
      error: error.message,
      fileName: file.name,
    };
  }
}

async function uploadMultipleImages(files, progressCallback = null) {
  if (!files || files.length === 0) {
    return {
      success: true,
      successfulUploads: [],
      failedUploads: [],
      urls: [],
    };
  }

  const results = [];
  const totalFiles = files.length;

  for (let i = 0; i < totalFiles; i++) {
    const file = files[i];

    try {
      if (progressCallback) {
        progressCallback({
          current: i + 1,
          total: totalFiles,
          fileName: file.name,
          percentage: Math.round(((i + 1) / totalFiles) * 100),
        });
      }

      const result = await uploadImageToCloudinary(file);
      results.push(result);

      if (i < totalFiles - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error);
      results.push({
        success: false,
        error: error.message,
        fileName: file.name,
      });
    }
  }

  const successfulUploads = results.filter((result) => result.success);
  const failedUploads = results.filter((result) => !result.success);

  return {
    success: failedUploads.length === 0,
    successfulUploads,
    failedUploads,
    urls: successfulUploads.map((upload) => upload.url),
    totalProcessed: results.length,
  };
}

// =============================================
// MANEJO DE VISTA PREVIA DE IMÁGENES
// =============================================

function showImagePreviews(files, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // CORREGIDO: No duplicar archivos, usar los archivos tal como vienen
  currentFiles = Array.from(files);
  container.innerHTML = "";

  if (currentFiles.length === 0) {
    container.innerHTML =
      '<p class="text-muted">No hay imágenes seleccionadas</p>';
    return;
  }

  currentFiles.forEach((file, index) => {
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = function (e) {
        const previewDiv = document.createElement("div");
        previewDiv.className = "image-preview-item";
        previewDiv.innerHTML = `
          <div class="preview-image-container">
            <img src="${e.target.result}" alt="Preview ${
          index + 1
        }" class="preview-image">
            <button type="button" class="btn btn-sm btn-danger remove-image-btn" onclick="removeImagePreview(${index})">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="preview-info">
            <small class="text-muted">${file.name}</small>
            <small class="text-muted d-block">${(
              file.size /
              1024 /
              1024
            ).toFixed(2)} MB</small>
          </div>
        `;
        container.appendChild(previewDiv);
      };
      reader.readAsDataURL(file);
    }
  });
}

window.removeImagePreview = function (index) {
  if (index < 0 || index >= currentFiles.length) return;

  currentFiles.splice(index, 1);

  const fileInput = document.getElementById("eventImages");
  if (fileInput) {
    const dt = new DataTransfer();
    currentFiles.forEach((file) => dt.items.add(file));
    fileInput.files = dt.files;
  }

  showImagePreviews(currentFiles, "imagePreviewContainer");
};

// =============================================
// FUNCIÓN MEJORADA PARA CREAR EVENTO
// =============================================

async function createEvent(eventData) {
  // CORREGIDO: Verificación más estricta para prevenir duplicación
  if (isCreatingEvent) {
    console.warn("Ya se está creando un evento, operación cancelada");
    throw new Error("Ya se está procesando una creación de evento");
  }

  isCreatingEvent = true;
  console.log("=== INICIO CREACIÓN DE EVENTO ===");

  try {
    const session = getStoredSession();
    if (!session) {
      throw new Error("Sesión no válida");
    }

    let imageUrls = [];

    // CORREGIDO: Solo subir imágenes si realmente existen
    if (eventData.images && eventData.images.length > 0) {
      console.log(`Subiendo ${eventData.images.length} imágenes únicas...`);

      const progressCallback = (progress) => {
        updateUploadProgress(progress);
      };

      const uploadResult = await uploadMultipleImages(
        Array.from(eventData.images), // CORREGIDO: Convertir FileList a Array sin duplicar
        progressCallback
      );

      if (uploadResult.successfulUploads.length > 0) {
        imageUrls = uploadResult.urls;
        console.log(
          `${uploadResult.successfulUploads.length} imágenes subidas exitosamente`
        );
      }

      if (uploadResult.failedUploads.length > 0) {
        console.warn(
          `${uploadResult.failedUploads.length} imágenes fallaron:`,
          uploadResult.failedUploads
        );
      }
    }

    if (!eventData.titulo || !eventData.descripcion || !eventData.fechaInicio) {
      throw new Error("Faltan campos requeridos (título, descripción o fecha)");
    }

    const newEvent = {
      titulo: eventData.titulo.trim(),
      descripcion: eventData.descripcion.trim(),
      tipo: eventData.tipo || "general",
      fechaInicio: Timestamp.fromDate(new Date(eventData.fechaInicio)),
      fechaFin: eventData.fechaFin
        ? Timestamp.fromDate(new Date(eventData.fechaFin))
        : null,
      horaInicio: eventData.horaInicio || "",
      horaFin: eventData.horaFin || "",
      ubicacion: eventData.ubicacion?.trim() || "",
      maxVoluntarios: eventData.maxVoluntarios
        ? parseInt(eventData.maxVoluntarios)
        : null,
      requisitos: eventData.requisitos?.trim() || "",
      materiales: eventData.materiales?.trim() || "",
      foto: imageUrls, // CORREGIDO: Solo las URLs únicas
      createdBy: session.correo,
      createdAt: serverTimestamp(),
      voluntariosRegistrados: 0,
      estado: "activo",
    };

    console.log("Creando evento en base de datos...", {
      titulo: newEvent.titulo,
      foto: newEvent.foto.length,
    });

    // CORREGIDO: Una sola operación de escritura a la base de datos
    const docRef = await addDoc(collection(db, "eventos"), newEvent);
    console.log("=== EVENTO CREADO EXITOSAMENTE ===", docRef.id);

    return {
      success: true,
      id: docRef.id,
      imageUrls: imageUrls,
      totalImages: imageUrls.length,
      failedImages: eventData.images
        ? eventData.images.length - imageUrls.length
        : 0,
    };
  } catch (error) {
    console.error("=== ERROR EN CREACIÓN DE EVENTO ===", error);
    throw error; // CORREGIDO: Lanzar error para que sea manejado por el formulario
  } finally {
    isCreatingEvent = false;
    console.log("=== FIN PROCESO CREACIÓN ===");
  }
}

function updateUploadProgress(progress) {
  const progressDiv = document.getElementById("uploadProgress");
  if (progressDiv) {
    const progressBar = progressDiv.querySelector(".progress-bar");
    const progressText = progressDiv.querySelector(".upload-text");

    if (progressBar) {
      progressBar.style.width = `${progress.percentage}%`;
    }

    if (progressText) {
      progressText.textContent = `Subiendo ${progress.fileName} (${progress.current}/${progress.total})`;
    }
  }
}

// =============================================
// MANEJO MEJORADO DEL FORMULARIO
// =============================================

function initializeEventForm() {
  // CORREGIDO: Prevenir múltiples inicializaciones
  if (isFormInitialized) {
    console.log("Formulario ya inicializado, saltando...");
    return;
  }

  const form = document.getElementById("createEventForm");
  if (!form) {
    console.warn("Formulario de evento no encontrado");
    return;
  }

  console.log("Inicializando formulario de eventos...");

  // CORREGIDO: Remover listeners existentes antes de agregar nuevos
  const imageInput = document.getElementById("eventImages");
  if (imageInput) {
    // Remover event listeners existentes clonando el elemento
    const newImageInput = imageInput.cloneNode(true);
    imageInput.parentNode.replaceChild(newImageInput, imageInput);

    // Agregar nuevo listener
    newImageInput.addEventListener("change", function (e) {
      handleImageSelection(e.target.files);
    });

    const uploadSection = newImageInput.closest(".image-upload-section");
    if (uploadSection) {
      setupDragAndDrop(uploadSection, newImageInput);
    }
  }

  // CORREGIDO: Remover listener del formulario existente
  const newForm = form.cloneNode(true);
  form.parentNode.replaceChild(newForm, form);

  // CORREGIDO: Un solo event listener para submit
  newForm.addEventListener("submit", handleFormSubmit, { once: false });

  isFormInitialized = true;
  console.log("Formulario inicializado correctamente");
}

let isProcessingFiles = false; // Nueva variable global

function handleImageSelection(files) {
  // ✅ Prevenir procesamiento recursivo
  if (isProcessingFiles) {
    console.log("Ya procesando archivos, ignorando...");
    return;
  }

  if (files.length === 0) return;

  isProcessingFiles = true; // Establecer bandera

  console.log(`Procesando ${files.length} archivos seleccionados`);

  const validFiles = [];
  const errors = [];

  Array.from(files).forEach((file) => {
    if (!file.type.startsWith("image/")) {
      errors.push(`${file.name} no es una imagen válida`);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      errors.push(`${file.name} es demasiado grande (máximo 10MB)`);
      return;
    }

    validFiles.push(file);
  });

  if (errors.length > 0) {
    alert("Errores encontrados:\n" + errors.join("\n"));
  }

  if (validFiles.length > 0) {
    console.log(`${validFiles.length} archivos válidos encontrados`);

    // Solo actualizar si hay archivos inválidos filtrados
    if (validFiles.length !== files.length) {
      const dt = new DataTransfer();
      validFiles.forEach((file) => dt.items.add(file));
      document.getElementById("eventImages").files = dt.files;
    }

    showImagePreviews(validFiles, "imagePreviewContainer");
    currentFiles = validFiles;
  }

  isProcessingFiles = false; // Limpiar bandera
}

function setupDragAndDrop(uploadSection, fileInput) {
  // CORREGIDO: Remover listeners existentes
  const newUploadSection = uploadSection.cloneNode(true);
  uploadSection.parentNode.replaceChild(newUploadSection, uploadSection);

  newUploadSection.addEventListener("dragover", function (e) {
    e.preventDefault();
    newUploadSection.classList.add("dragover");
  });

  newUploadSection.addEventListener("dragleave", function (e) {
    e.preventDefault();
    newUploadSection.classList.remove("dragover");
  });

  newUploadSection.addEventListener("drop", function (e) {
    e.preventDefault();
    newUploadSection.classList.remove("dragover");

    const files = e.dataTransfer.files;
    const input = document.getElementById("eventImages");
    if (input) {
      input.files = files;
      handleImageSelection(files);
    }
  });
}

// CORREGIDO: Variable para prevenir envíos múltiples del formulario
let isSubmitting = false;

async function handleFormSubmit(e) {
  e.preventDefault();
  e.stopPropagation(); // CORREGIDO: Prevenir propagación del evento

  // CORREGIDO: Verificación más estricta para prevenir envíos múltiples
  if (isSubmitting || isCreatingEvent) {
    console.warn("Ya se está procesando un evento, ignorando envío duplicado");
    return false;
  }

  isSubmitting = true;
  console.log("=== INICIO ENVÍO DE FORMULARIO ===");

  const form = e.target;
  const submitBtn = form.querySelector('button[type="submit"]');

  if (!submitBtn) {
    console.error("Botón de envío no encontrado");
    isSubmitting = false;
    return false;
  }

  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML =
    '<i class="fas fa-spinner fa-spin me-1"></i>Creando evento...';
  submitBtn.disabled = true;

  try {
    const eventData = collectFormData(form);
    console.log("Datos recopilados:", {
      titulo: eventData.titulo,
      imagenes: eventData.images ? eventData.images.length : 0,
    });

    const validation = validateEventData(eventData);
    if (!validation.valid) {
      alert("Errores en el formulario:\n" + validation.errors.join("\n"));
      return false;
    }

    if (eventData.images && eventData.images.length > 0) {
      showUploadProgress(eventData.images.length);
    }

    // CORREGIDO: Solo una llamada a createEvent
    const result = await createEvent(eventData);

    hideUploadProgress();

    if (result.success) {
      let message = "¡Evento creado exitosamente!";
      if (result.totalImages > 0) {
        message += `\n${result.totalImages} imagen(es) subida(s).`;
      }
      if (result.failedImages > 0) {
        message += `\n${result.failedImages} imagen(es) no se pudieron subir.`;
      }

      alert(message);
      resetForm();

      if (typeof loadUpcomingEvents === "function") {
        await loadUpcomingEvents();
      }
    }
  } catch (error) {
    console.error("=== ERROR EN ENVÍO DE FORMULARIO ===", error);
    alert(`Error al crear evento: ${error.message || "Error desconocido"}`);
    hideUploadProgress();
  } finally {
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
    isSubmitting = false;
    console.log("=== FIN ENVÍO DE FORMULARIO ===");
  }

  return false;
}

function collectFormData(form) {
  const imageFiles = document.getElementById("eventImages")?.files;

  return {
    titulo: document.getElementById("eventTitle")?.value || "",
    descripcion: document.getElementById("eventDescription")?.value || "",
    tipo: document.getElementById("eventType")?.value || "general",
    fechaInicio: document.getElementById("eventDate")?.value || "",
    horaInicio: document.getElementById("eventStartTime")?.value || "",
    horaFin: document.getElementById("eventEndTime")?.value || "",
    ubicacion: document.getElementById("eventLocation")?.value || "",
    maxVoluntarios: document.getElementById("maxVolunteers")?.value || "",
    requisitos: document.getElementById("requirements")?.value || "",
    materiales: document.getElementById("materials")?.value || "",
    images: imageFiles && imageFiles.length > 0 ? imageFiles : null,
  };
}

function validateEventData(eventData) {
  const errors = [];

  if (!eventData.titulo.trim()) {
    errors.push("El título es requerido");
  }

  if (!eventData.descripcion.trim()) {
    errors.push("La descripción es requerida");
  }

  if (!eventData.fechaInicio) {
    errors.push("La fecha es requerida");
  } else {
    const eventDate = new Date(eventData.fechaInicio);
    const now = new Date();
    if (eventDate <= now) {
      errors.push("La fecha del evento debe ser futura");
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors,
  };
}

function showUploadProgress(totalImages) {
  // CORREGIDO: Remover progreso existente antes de crear uno nuevo
  hideUploadProgress();

  const progressDiv = document.createElement("div");
  progressDiv.id = "uploadProgress";
  progressDiv.className = "alert alert-info mt-3";
  progressDiv.innerHTML = `
    <div class="d-flex align-items-center">
      <i class="fas fa-cloud-upload-alt me-2"></i>
      <div class="flex-grow-1">
        <div class="upload-text">Preparando subida de ${totalImages} imagen(es)...</div>
        <div class="progress mt-2">
          <div class="progress-bar progress-bar-striped progress-bar-animated" style="width: 0%"></div>
        </div>
      </div>
    </div>
  `;

  const form = document.getElementById("createEventForm");
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.parentNode.insertBefore(progressDiv, submitBtn);
}

function hideUploadProgress() {
  const progressDiv = document.getElementById("uploadProgress");
  if (progressDiv) {
    progressDiv.remove();
  }
}

function resetForm() {
  const form = document.getElementById("createEventForm");
  if (form) {
    form.reset();
    currentFiles = [];

    const previewContainer = document.getElementById("imagePreviewContainer");
    if (previewContainer) {
      previewContainer.innerHTML = "";
    }
  }
}

// =============================================
// FUNCIONES DE EVENTOS
// =============================================

window.editEvent = function (eventId) {
  alert(`Funcionalidad de edición en desarrollo para evento: ${eventId}`);
};

window.viewVolunteers = function (eventId) {
  alert(`Ver voluntarios del evento: ${eventId}`);
};

window.cancelEvent = async function (eventId) {
  const confirmed = confirm(
    "¿Estás seguro de que deseas cancelar este evento?"
  );
  if (!confirmed) return;

  try {
    const eventRef = doc(db, "eventos", eventId);
    await updateDoc(eventRef, {
      estado: "cancelado",
      fechaCancelacion: serverTimestamp(),
    });

    alert("Evento cancelado exitosamente");
    if (typeof loadUpcomingEvents === "function") {
      await loadUpcomingEvents();
    }
  } catch (error) {
    console.error("Error al cancelar evento:", error);
    alert("Error al cancelar el evento. Intenta de nuevo.");
  }
};

window.viewEventReport = function (eventId) {
  alert(`Ver reporte del evento: ${eventId}`);
};

window.viewEventPhotos = function (eventId) {
  alert(`Ver fotos del evento: ${eventId}`);
};

window.resetForm = resetForm;

// =============================================
// INICIALIZACIÓN CORREGIDA
// =============================================

// CORREGIDO: Solo inicializar una vez cuando el DOM esté completamente listo
function initializeOnce() {
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      function () {
        setTimeout(initializeEventForm, 100); // Pequeño delay para asegurar que todo esté listo
      },
      { once: true }
    );
  } else {
    setTimeout(initializeEventForm, 100);
  }
}

// Ejecutar inicialización
initializeOnce();
// =============================================
// FUNCIONES DE SIDEBAR Y NAVEGACIÓN
// =============================================

function initializeSidebar() {
  const sidebarToggle = document.getElementById("sidebarToggle");
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");

  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", function () {
      sidebar.classList.toggle("show");
      sidebarOverlay.classList.toggle("show");
    });
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener("click", function () {
      sidebar.classList.remove("show");
      sidebarOverlay.classList.remove("show");
    });
  }

  // Manejar clicks en los enlaces del sidebar
  const navLinks = document.querySelectorAll(".nav-link[data-section]");
  navLinks.forEach((link) => {
    link.addEventListener("click", function () {
      navLinks.forEach((l) => l.classList.remove("active"));
      this.classList.add("active");

      if (window.innerWidth < 992) {
        sidebar.classList.remove("show");
        sidebarOverlay.classList.remove("show");
      }
    });
  });
}

// =============================================
// FUNCIONES DE INICIALIZACIÓN
// =============================================

function updateUserInfo(session) {
  const userDisplayName = document.getElementById("userDisplayName");
  if (userDisplayName) {
    userDisplayName.textContent = session.nombre || session.correo;
  }
}

async function initializeEventsPage() {
  console.log("Inicializando página de eventos...");

  // Verificar autenticación
  const session = checkAuthentication();
  if (!session) return;

  // Actualizar información del usuario
  updateUserInfo(session);

  // Inicializar sidebar
  initializeSidebar();

  // Inicializar formulario
  initializeEventForm();

  // Cargar eventos iniciales
  await loadUpcomingEvents();

  // Configurar event listeners para las pestañas
  const upcomingTab = document.getElementById("upcoming-tab");
  const pastTab = document.getElementById("past-tab");

  if (upcomingTab) {
    upcomingTab.addEventListener("shown.bs.tab", loadUpcomingEvents);
  }

  if (pastTab) {
    pastTab.addEventListener("shown.bs.tab", loadPastEvents);
  }

  console.log("Página de eventos inicializada correctamente");
}

// =============================================
// EVENT LISTENERS Y INICIALIZACIÓN
// =============================================

document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM cargado, inicializando página de eventos...");
  initializeEventsPage();
});

// Manejar cambios de tamaño de ventana
window.addEventListener("resize", function () {
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");

  if (window.innerWidth >= 992) {
    if (sidebar) sidebar.classList.remove("show");
    if (sidebarOverlay) sidebarOverlay.classList.remove("show");
  }
});

// Función para refrescar eventos
window.refreshEvents = function () {
  const activeTab = document.querySelector(".nav-link.active");
  if (activeTab && activeTab.id === "past-tab") {
    loadPastEvents();
  } else {
    loadUpcomingEvents();
  }
};

// Exportar funciones para uso global
window.getStoredSession = getStoredSession;
window.clearSession = clearSession;
window.checkAuthentication = checkAuthentication;
