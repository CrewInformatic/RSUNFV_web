// create-event.js - Creación de Nuevos Eventos
import {
  collection,
  addDoc,
  serverTimestamp,
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
// FUNCIÓN PARA OBTENER FIRESTORE DB
// =============================================
function getFirestoreDB() {
  // Intentar obtener de la ventana global
  if (window.firebaseDB) {
    return window.firebaseDB;
  }

  // Si no está disponible, mostrar error
  console.error("❌ Firebase DB no está disponible");
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
    // Intentar usar la función global si está disponible
    if (window.getStoredSession) {
      return window.getStoredSession();
    }

    // Fallback a método directo
    const storedSession = sessionStorage.getItem("userSession");
    if (storedSession) {
      return JSON.parse(storedSession);
    }
    return null;
  } catch (error) {
    console.error("❌ Error al obtener sesión:", error);
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
    console.log(
      `📤 Subiendo imagen: ${file.name} (${(file.size / 1024 / 1024).toFixed(
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
      console.error("❌ Error response from Cloudinary:", errorData);
      throw new Error(`Error HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.secure_url) {
      throw new Error("No se recibió URL de la imagen subida");
    }

    console.log(`✅ Imagen subida exitosamente: ${data.secure_url}`);

    return {
      success: true,
      url: data.secure_url,
      publicId: data.public_id,
      originalName: file.name,
    };
  } catch (error) {
    console.error(`❌ Error uploading ${file.name} to Cloudinary:`, error);
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
    console.error(`❌ Error processing file ${firstFile.name}:`, error);
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
    console.warn("⚠️ Ya se está creando un evento, operación cancelada");
    throw new Error("Ya se está procesando una creación de evento");
  }

  isCreatingEvent = true;
  console.log("=== 🚀 INICIO CREACIÓN DE EVENTO ===");

  try {
    // Obtener base de datos
    const db = getFirestoreDB();

    const session = getStoredSession();
    if (!session) {
      throw new Error("Sesión no válida. Por favor, inicia sesión nuevamente.");
    }

    let imageUrl = "";

    // Subir imagen si existe
    if (eventData.images && eventData.images.length > 0) {
      console.log(`📤 Subiendo imagen: ${eventData.images[0].name}...`);

      const progressCallback = (progress) => {
        updateUploadProgress(progress);
      };

      const uploadResult = await uploadSingleImage(
        Array.from(eventData.images),
        progressCallback
      );

      if (uploadResult.success && uploadResult.imageUrl) {
        imageUrl = uploadResult.imageUrl;
        console.log(`✅ Imagen subida exitosamente: ${imageUrl}`);
      } else if (uploadResult.error) {
        console.warn(`⚠️ Error al subir imagen: ${uploadResult.error}`);
        // No lanzar error, continuar sin imagen
      }
    }

    // Validar campos requeridos
    if (!eventData.titulo || !eventData.descripcion || !eventData.fechaInicio) {
      throw new Error("Faltan campos requeridos (título, descripción o fecha)");
    }

    // Crear objeto del evento
    const newEvent = {
      titulo: eventData.titulo.trim(),
      descripcion: eventData.descripcion.trim(),
      tipo: eventData.tipo || "general",
      fechaInicio: eventData.fechaInicio, // Guardar como string
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
      createdAt: serverTimestamp(),
      voluntariosInscritos: [], // Array vacío de strings
      estado: "activo",
    };

    console.log("💾 Creando evento en base de datos...", {
      titulo: newEvent.titulo,
      foto: newEvent.foto,
      createdBy: newEvent.createdBy,
      fechaInicio: newEvent.fechaInicio,
      voluntariosInscritos: newEvent.voluntariosInscritos,
    });

    // Guardar en Firestore
    const docRef = await addDoc(collection(db, "eventos"), newEvent);
    console.log("=== ✅ EVENTO CREADO EXITOSAMENTE ===", docRef.id);

    return {
      success: true,
      id: docRef.id,
      imageUrl: imageUrl,
      hasImage: imageUrl !== "",
    };
  } catch (error) {
    console.error("=== ❌ ERROR EN CREACIÓN DE EVENTO ===", error);
    throw error;
  } finally {
    isCreatingEvent = false;
    console.log("=== 🏁 FIN PROCESO CREACIÓN ===");
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
    console.error("❌ Firebase no está disponible");
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
    console.log("📝 Formulario ya inicializado, saltando...");
    return;
  }

  // Verificar que Firebase esté disponible
  if (!checkFirebaseAvailable()) {
    console.log("⏳ Firebase no disponible, reintentando en 1 segundo...");
    setTimeout(initializeEventForm, 1000);
    return;
  }

  const form = document.getElementById("createEventForm");
  if (!form) {
    console.warn("⚠️ Formulario de evento no encontrado");
    return;
  }

  console.log("📝 Inicializando formulario de eventos...");

  // SOLO configurar event listeners si no están ya configurados
  if (!form.hasEventListener) {
    // Configurar formulario
    form.addEventListener("submit", handleFormSubmit);
    form.hasEventListener = true; // Flag para evitar duplicados

    // Configurar input de imágenes
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
  console.log("✅ Formulario inicializado correctamente");
}

/**
 * Manejar selección de imágenes
 */
function handleImageSelection(files) {
  if (isProcessingFiles) {
    console.log("⚠️ Ya procesando archivos, ignorando...");
    return;
  }

  if (files.length === 0) return;

  isProcessingFiles = true;

  console.log(
    `📁 Procesando ${files.length} archivos seleccionados (solo se usará el primero)`
  );

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
    console.log(`✅ Imagen válida encontrada: ${validFiles[0].name}`);
    showImagePreviews([validFiles[0]], "imagePreviewContainer");
    currentFiles = [validFiles[0]];
  }

  isProcessingFiles = false;
}

/**
 * Configurar drag and drop
 */
function setupDragAndDrop(uploadSection, fileInput) {
  if (uploadSection.hasDragDrop) return; // Evitar duplicados

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
      // Actualizar el input de archivo
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
    console.warn(
      "⚠️ Ya se está procesando un evento, ignorando envío duplicado"
    );
    return false;
  }

  // Verificar que Firebase esté disponible antes de proceder
  if (!checkFirebaseAvailable()) {
    return false;
  }

  isSubmitting = true;
  console.log("=== 📤 INICIO ENVÍO DE FORMULARIO ===");

  const form = e.target;
  const submitBtn = form.querySelector('button[type="submit"]');

  if (!submitBtn) {
    console.error("❌ Botón de envío no encontrado");
    isSubmitting = false;
    return false;
  }

  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML =
    '<i class="fas fa-spinner fa-spin me-1"></i>Creando evento...';
  submitBtn.disabled = true;

  try {
    const eventData = collectFormData(form);
    console.log("📋 Datos recopilados:", {
      titulo: eventData.titulo,
      fechaInicio: eventData.fechaInicio,
      imagenes: eventData.images ? eventData.images.length : 0,
    });

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

      // Recargar eventos si la función existe
      if (typeof window.loadUpcomingEvents === "function") {
        console.log("🔄 Recargando eventos futuros...");
        await window.loadUpcomingEvents();
      }

      // También intentar refrescar eventos de forma general
      if (typeof window.refreshEvents === "function") {
        console.log("🔄 Refrescando eventos...");
        window.refreshEvents();
      }
    }
  } catch (error) {
    console.error("=== ❌ ERROR EN ENVÍO DE FORMULARIO ===", error);

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
    console.log("=== 🏁 FIN ENVÍO DE FORMULARIO ===");
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
};

// =============================================
// FUNCIONES GLOBALES (para compatibilidad)
// =============================================

// Hacer funciones disponibles globalmente para onclick en HTML
window.removeImagePreview = removeImagePreview;
window.resetForm = resetForm;

// =============================================
// INICIALIZACIÓN RETARDADA
// =============================================

/**
 * Inicializar cuando el DOM esté listo Y Firebase esté disponible
 */
function initializeOnce() {
  const attemptInit = () => {
    // Verificar si Firebase está disponible
    if (window.firebaseDB) {
      console.log("🔥 Firebase disponible, inicializando formulario...");
      initializeEventForm();
    } else {
      console.log("⏳ Esperando a que Firebase esté disponible...");
      setTimeout(attemptInit, 500); // Reintentar cada 500ms
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

// Ejecutar inicialización
initializeOnce();

// Exportar función de inicialización
window.initializeCreateEvent = initializeEventForm;

console.log("📝 Módulo create-event.js cargado correctamente");
