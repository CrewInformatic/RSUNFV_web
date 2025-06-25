// create-event.js - Creación de Nuevos Eventos
import {
  collection,
  addDoc,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

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
let isFormInitialized = false;
let isProcessingFiles = false;
let isSubmitting = false;

// =============================================
// FUNCIONES DE FORMATO DE FECHA/HORA
// =============================================

/**
 * Formatear fecha y hora al formato ISO personalizado
 */
function formatDateTimeToISO(date, time = null) {
  let dateObj;

  if (typeof date === "string") {
    // Si es una fecha en formato YYYY-MM-DD
    dateObj = new Date(date);
  } else if (date instanceof Date) {
    dateObj = date;
  } else {
    return null;
  }

  // Verificar que la fecha sea válida
  if (isNaN(dateObj.getTime())) {
    return null;
  }

  if (time) {
    // Si se proporciona hora (formato HH:MM)
    const [hours, minutes] = time.split(":");
    dateObj.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  } else {
    // Si no hay hora, usar 00:00:00
    dateObj.setHours(0, 0, 0, 0);
  }

  // Formatear al formato ISO personalizado: YYYY-MM-DDTHH:mm:ss.SSS
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  const hours = String(dateObj.getHours()).padStart(2, "0");
  const minutes = String(dateObj.getMinutes()).padStart(2, "0");
  const seconds = String(dateObj.getSeconds()).padStart(2, "0");
  const milliseconds = String(dateObj.getMilliseconds()).padStart(3, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}`;
}

/**
 * Obtener timestamp actual en formato ISO personalizado
 */
function getCurrentTimestamp() {
  return formatDateTimeToISO(new Date());
}

// =============================================
// FUNCIÓN PARA OBTENER FIRESTORE DB
// =============================================
function getFirestoreDB() {
  if (window.firebaseDB) {
    return window.firebaseDB;
  }

  console.error("Firebase DB no está disponible");
  throw new Error("Base de datos no inicializada. Recarga la página.");
}

// =============================================
// FUNCIONES DE GESTIÓN DE SESIÓN
// =============================================

/**
 * Obtener sesión almacenada
 */
function getStoredSession() {
  try {
    if (window.getStoredSession) {
      return window.getStoredSession();
    }

    const storedSession = sessionStorage.getItem("userSession");
    if (storedSession) {
      return JSON.parse(storedSession);
    }
    return null;
  } catch (error) {
    sessionStorage.removeItem("userSession");
    return null;
  }
}

// =============================================
// FUNCIONES DE SUBIDA DE IMÁGENES
// =============================================

/**
 * Subir imagen a Cloudinary
 */
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
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Error HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.secure_url) {
      throw new Error("No se recibió URL de la imagen subida");
    }

    return {
      success: true,
      url: data.secure_url,
      publicId: data.public_id,
      originalName: file.name,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      fileName: file.name,
    };
  }
}

/**
 * Subir una sola imagen (primera del array)
 */
async function uploadSingleImage(files, progressCallback = null) {
  if (!files || files.length === 0) {
    return {
      success: true,
      imageUrl: "",
    };
  }

  const firstFile = files[0];

  try {
    if (progressCallback) {
      progressCallback({
        current: 1,
        total: 1,
        fileName: firstFile.name,
        percentage: 50,
      });
    }

    const result = await uploadImageToCloudinary(firstFile);

    if (progressCallback) {
      progressCallback({
        current: 1,
        total: 1,
        fileName: firstFile.name,
        percentage: 100,
      });
    }

    if (result.success) {
      return {
        success: true,
        imageUrl: result.url,
        uploadedImage: result,
      };
    } else {
      return {
        success: false,
        imageUrl: "",
        error: result.error,
      };
    }
  } catch (error) {
    return {
      success: false,
      imageUrl: "",
      error: error.message,
    };
  }
}

// =============================================
// MANEJO DE VISTA PREVIA DE IMÁGENES
// =============================================

/**
 * Mostrar vista previa de imágenes
 */
function showImagePreviews(files, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const firstFile = files[0];
  if (!firstFile) {
    container.innerHTML =
      '<p class="text-muted">No hay imagen seleccionada</p>';
    return;
  }

  currentFiles = [firstFile];
  container.innerHTML = "";

  if (firstFile.type.startsWith("image/")) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const previewDiv = document.createElement("div");
      previewDiv.className = "image-preview-item";
      previewDiv.innerHTML = `
        <div class="preview-image-container">
          <img src="${e.target.result}" alt="Preview" class="preview-image">
          <button type="button" class="btn btn-sm btn-danger remove-image-btn" onclick="removeImagePreview(0)">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="preview-info">
          <small class="text-muted">${firstFile.name}</small>
          <small class="text-muted d-block">${(
            firstFile.size /
            1024 /
            1024
          ).toFixed(2)} MB</small>
        </div>
      `;
      container.appendChild(previewDiv);
    };
    reader.readAsDataURL(firstFile);
  }

  if (files.length > 1) {
    const infoDiv = document.createElement("div");
    infoDiv.className = "alert alert-info mt-2";
    infoDiv.innerHTML = `
      <i class="fas fa-info-circle me-1"></i>
      Solo se utilizará la primera imagen. ${
        files.length - 1
      } imagen(es) adicional(es) ignorada(s).
    `;
    container.appendChild(infoDiv);
  }
}

/**
 * Remover vista previa de imagen
 */
function removeImagePreview(index) {
  currentFiles = [];

  const fileInput = document.getElementById("eventImages");
  if (fileInput) {
    fileInput.value = "";
  }

  const container = document.getElementById("imagePreviewContainer");
  if (container) {
    container.innerHTML =
      '<p class="text-muted">No hay imagen seleccionada</p>';
  }
}

// =============================================
// FUNCIÓN PRINCIPAL PARA CREAR EVENTO
// =============================================

/**
 * Crear nuevo evento en la base de datos
 */
async function createEvent(eventData) {
  if (isCreatingEvent) {
    throw new Error("Ya se está procesando una creación de evento");
  }

  isCreatingEvent = true;

  try {
    const db = getFirestoreDB();

    const session = getStoredSession();
    if (!session) {
      throw new Error("Sesión no válida. Por favor, inicia sesión nuevamente.");
    }

    let imageUrl = "";

    // Subir imagen si existe
    if (eventData.images && eventData.images.length > 0) {
      const progressCallback = (progress) => {
        updateUploadProgress(progress);
      };

      const uploadResult = await uploadSingleImage(
        Array.from(eventData.images),
        progressCallback
      );

      if (uploadResult.success && uploadResult.imageUrl) {
        imageUrl = uploadResult.imageUrl;
      }
    }

    // Validar campos requeridos
    if (!eventData.titulo || !eventData.descripcion || !eventData.fechaInicio) {
      throw new Error("Faltan campos requeridos (título, descripción o fecha)");
    }

    // Formatear fechas y horas
    const fechaInicioFormatted = formatDateTimeToISO(
      eventData.fechaInicio,
      eventData.horaInicio
    );
    const fechaFinFormatted = eventData.horaFin
      ? formatDateTimeToISO(eventData.fechaInicio, eventData.horaFin)
      : "";

    if (!fechaInicioFormatted) {
      throw new Error("Error al formatear la fecha de inicio");
    }

    // Crear objeto del evento
    const newEvent = {
      titulo: eventData.titulo.trim(),
      descripcion: eventData.descripcion.trim(),
      tipo: eventData.tipo || "general",
      fechaInicio: fechaInicioFormatted,
      fechaFin: fechaFinFormatted,
      horaInicio: eventData.horaInicio || "",
      horaFin: eventData.horaFin || "",
      ubicacion: eventData.ubicacion?.trim() || "",
      cantidadVoluntariosMax: eventData.maxVoluntarios
        ? parseInt(eventData.maxVoluntarios)
        : null,
      requisitos: eventData.requisitos?.trim() || "",
      materiales: eventData.materiales?.trim() || "",
      foto: imageUrl,
      createdBy: session.correo,
      createdAt: getCurrentTimestamp(),
      voluntariosInscritos: [],
      estado: "activo",
    };

    // Guardar en Firestore
    const docRef = await addDoc(collection(db, "eventos"), newEvent);

    return {
      success: true,
      id: docRef.id,
      imageUrl: imageUrl,
      hasImage: imageUrl !== "",
    };
  } catch (error) {
    console.error("Error al crear evento:", error);
    throw error;
  } finally {
    isCreatingEvent = false;
  }
}

// =============================================
// FUNCIONES DE PROGRESO Y UI
// =============================================

/**
 * Actualizar progreso de subida
 */
function updateUploadProgress(progress) {
  const progressDiv = document.getElementById("uploadProgress");
  if (progressDiv) {
    const progressBar = progressDiv.querySelector(".progress-bar");
    const progressText = progressDiv.querySelector(".upload-text");

    if (progressBar) {
      progressBar.style.width = `${progress.percentage}%`;
    }

    if (progressText) {
      progressText.textContent = `Subiendo ${progress.fileName}...`;
    }
  }
}

/**
 * Mostrar progreso de subida
 */
function showUploadProgress(totalImages) {
  hideUploadProgress();

  const progressDiv = document.createElement("div");
  progressDiv.id = "uploadProgress";
  progressDiv.className = "alert alert-info mt-3";
  progressDiv.innerHTML = `
    <div class="d-flex align-items-center">
      <i class="fas fa-cloud-upload-alt me-2"></i>
      <div class="flex-grow-1">
        <div class="upload-text">Preparando subida de imagen...</div>
        <div class="progress mt-2">
          <div class="progress-bar progress-bar-striped progress-bar-animated" style="width: 0%"></div>
        </div>
      </div>
    </div>
  `;

  const form = document.getElementById("createEventForm");
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn && submitBtn.parentNode) {
    submitBtn.parentNode.insertBefore(progressDiv, submitBtn);
  }
}

/**
 * Ocultar progreso de subida
 */
function hideUploadProgress() {
  const progressDiv = document.getElementById("uploadProgress");
  if (progressDiv) {
    progressDiv.remove();
  }
}

// =============================================
// MANEJO DEL FORMULARIO
// =============================================

/**
 * Verificar si Firebase está disponible
 */
function checkFirebaseAvailable() {
  if (!window.firebaseDB) {
    alert("Sistema no inicializado. Por favor, recarga la página.");
    return false;
  }
  return true;
}

/**
 * Inicializar formulario de eventos
 */
function initializeEventForm() {
  if (isFormInitialized) {
    return;
  }

  if (!checkFirebaseAvailable()) {
    setTimeout(initializeEventForm, 1000);
    return;
  }

  const form = document.getElementById("createEventForm");
  if (!form) {
    return;
  }

  if (!form.hasEventListener) {
    form.addEventListener("submit", handleFormSubmit);
    form.hasEventListener = true;

    const imageInput = document.getElementById("eventImages");
    if (imageInput && !imageInput.hasEventListener) {
      imageInput.addEventListener("change", function (e) {
        handleImageSelection(e.target.files);
      });
      imageInput.hasEventListener = true;

      const uploadSection = imageInput.closest(".image-upload-section");
      if (uploadSection) {
        setupDragAndDrop(uploadSection, imageInput);
      }
    }
  }

  isFormInitialized = true;
}

/**
 * Manejar selección de imágenes
 */
function handleImageSelection(files) {
  if (isProcessingFiles) {
    return;
  }

  if (files.length === 0) return;

  isProcessingFiles = true;

  const validFiles = [];
  const errors = [];

  const firstFile = files[0];

  if (!firstFile.type.startsWith("image/")) {
    errors.push(`${firstFile.name} no es una imagen válida`);
  } else if (firstFile.size > 10 * 1024 * 1024) {
    errors.push(`${firstFile.name} es demasiado grande (máximo 10MB)`);
  } else {
    validFiles.push(firstFile);
  }

  if (errors.length > 0) {
    alert("Error encontrado:\n" + errors.join("\n"));
  }

  if (validFiles.length > 0) {
    showImagePreviews([validFiles[0]], "imagePreviewContainer");
    currentFiles = [validFiles[0]];
  }

  isProcessingFiles = false;
}

/**
 * Configurar drag and drop
 */
function setupDragAndDrop(uploadSection, fileInput) {
  if (uploadSection.hasDragDrop) return;

  uploadSection.addEventListener("dragover", function (e) {
    e.preventDefault();
    uploadSection.classList.add("dragover");
  });

  uploadSection.addEventListener("dragleave", function (e) {
    e.preventDefault();
    uploadSection.classList.remove("dragover");
  });

  uploadSection.addEventListener("drop", function (e) {
    e.preventDefault();
    uploadSection.classList.remove("dragover");

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const dt = new DataTransfer();
      dt.items.add(files[0]);
      fileInput.files = dt.files;
      handleImageSelection(dt.files);
    }
  });

  uploadSection.hasDragDrop = true;
}

/**
 * Manejar envío del formulario
 */
async function handleFormSubmit(e) {
  e.preventDefault();
  e.stopPropagation();

  if (isSubmitting || isCreatingEvent) {
    return false;
  }

  if (!checkFirebaseAvailable()) {
    return false;
  }

  isSubmitting = true;

  const form = e.target;
  const submitBtn = form.querySelector('button[type="submit"]');

  if (!submitBtn) {
    isSubmitting = false;
    return false;
  }

  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML =
    '<i class="fas fa-spinner fa-spin me-1"></i>Creando evento...';
  submitBtn.disabled = true;

  try {
    const eventData = collectFormData(form);

    const validation = validateEventData(eventData);
    if (!validation.valid) {
      alert("Errores en el formulario:\n" + validation.errors.join("\n"));
      return false;
    }

    if (eventData.images && eventData.images.length > 0) {
      showUploadProgress(1);
    }

    const result = await createEvent(eventData);

    hideUploadProgress();

    if (result.success) {
      let message = "¡Evento creado exitosamente!";
      if (result.hasImage) {
        message += "\nImagen subida correctamente.";
      }

      alert(message);
      resetForm();

      if (typeof window.loadUpcomingEvents === "function") {
        await window.loadUpcomingEvents();
      }

      if (typeof window.refreshEvents === "function") {
        window.refreshEvents();
      }
    }
  } catch (error) {
    let errorMessage = "Error al crear evento";
    if (error.message) {
      errorMessage += `: ${error.message}`;
    }

    alert(errorMessage);
    hideUploadProgress();
  } finally {
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
    isSubmitting = false;
  }

  return false;
}

/**
 * Recopilar datos del formulario
 */
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

/**
 * Validar datos del evento
 */
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

  // Validar formato de hora si se proporciona
  if (
    eventData.horaInicio &&
    !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(eventData.horaInicio)
  ) {
    errors.push("El formato de hora de inicio debe ser HH:MM");
  }

  if (
    eventData.horaFin &&
    !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(eventData.horaFin)
  ) {
    errors.push("El formato de hora de fin debe ser HH:MM");
  }

  // Validar que hora fin sea posterior a hora inicio
  if (eventData.horaInicio && eventData.horaFin) {
    const [startHour, startMin] = eventData.horaInicio.split(":").map(Number);
    const [endHour, endMin] = eventData.horaFin.split(":").map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (endMinutes <= startMinutes) {
      errors.push("La hora de fin debe ser posterior a la hora de inicio");
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors,
  };
}

/**
 * Resetear formulario
 */
function resetForm() {
  const form = document.getElementById("createEventForm");
  if (form) {
    form.reset();
    currentFiles = [];

    const previewContainer = document.getElementById("imagePreviewContainer");
    if (previewContainer) {
      previewContainer.innerHTML =
        '<p class="text-muted">No hay imagen seleccionada</p>';
    }
  }
}

// =============================================
// EXPORTACIÓN DE FUNCIONES
// =============================================

export {
  initializeEventForm,
  createEvent,
  resetForm,
  removeImagePreview,
  getStoredSession,
  formatDateTimeToISO,
  getCurrentTimestamp,
};

// =============================================
// FUNCIONES GLOBALES (para compatibilidad)
// =============================================

window.removeImagePreview = removeImagePreview;
window.resetForm = resetForm;
window.formatDateTimeToISO = formatDateTimeToISO;
window.getCurrentTimestamp = getCurrentTimestamp;

// =============================================
// INICIALIZACIÓN RETARDADA
// =============================================

/**
 * Inicializar cuando el DOM esté listo Y Firebase esté disponible
 */
function initializeOnce() {
  const attemptInit = () => {
    if (window.firebaseDB) {
      initializeEventForm();
    } else {
      setTimeout(attemptInit, 500);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      function () {
        setTimeout(attemptInit, 200);
      },
      { once: true }
    );
  } else {
    setTimeout(attemptInit, 200);
  }
}

initializeOnce();

window.initializeCreateEvent = initializeEventForm;
