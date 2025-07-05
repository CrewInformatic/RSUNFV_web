// donation-upload-service.js
import {
  doc,
  setDoc,
  collection,
  addDoc,
  serverTimestamp,
  getFirestore,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, getStorage } from "firebase/storage";
import { app } from "./firebase_config.js"; // Asume que tienes configuración de Firebase

export class DonationUploadService {
  static db = getFirestore(app);
  static storage = getStorage(app);

  /**
   * Sube una donación completa a Firebase
   * @param {Object} donationData - Datos de la donación
   * @returns {Promise<Object>} - Resultado de la subida
   */
  static async uploadDonation(donationData) {
    try {
      console.log("Iniciando subida a Firebase...", donationData);

      // 1. Subir archivo de comprobante
      const fileURL = await this.uploadPaymentProof(
        donationData.payment.proofFile
      );

      // 2. Preparar datos para Firestore
      const firestoreData = this.prepareFirestoreData(donationData, fileURL);

      // 3. Subir a Firestore
      const docRef = await addDoc(
        collection(this.db, "donaciones"),
        firestoreData
      );

      console.log("Donación subida exitosamente con ID:", docRef.id);

      return {
        id: docRef.id,
        fileURL: fileURL,
        timestamp: new Date().toISOString(),
        success: true,
      };
    } catch (error) {
      console.error("Error al subir donación a Firebase:", error);
      throw new Error(`Error de Firebase: ${error.message}`);
    }
  }

  /**
   * Sube el comprobante de pago a Firebase Storage
   * @param {File} file - Archivo del comprobante
   * @returns {Promise<string>} - URL del archivo subido
   */
  static async uploadPaymentProof(file) {
    if (!file) {
      throw new Error("No se proporcionó archivo de comprobante");
    }

    try {
      // Generar nombre único para el archivo
      const timestamp = Date.now();
      const fileName = `payment-proofs/${timestamp}-${file.name}`;

      // Crear referencia en Storage
      const storageRef = ref(this.storage, fileName);

      // Subir archivo
      const snapshot = await uploadBytes(storageRef, file);
      console.log("Archivo subido a Storage:", snapshot.ref.fullPath);

      // Obtener URL de descarga
      const downloadURL = await getDownloadURL(snapshot.ref);
      console.log("URL de descarga obtenida:", downloadURL);

      return downloadURL;
    } catch (error) {
      console.error("Error al subir archivo a Storage:", error);
      throw new Error(`Error al subir comprobante: ${error.message}`);
    }
  }

  /**
   * Prepara los datos para Firestore
   * @param {Object} donationData - Datos originales
   * @param {string} fileURL - URL del archivo subido
   * @returns {Object} - Datos preparados para Firestore
   */
  static prepareFirestoreData(donationData, fileURL) {
    return {
      // Información del donante
      donor: {
        type: donationData.donor.type,
        firstName: donationData.donor.firstName || "",
        lastName: donationData.donor.lastName || "",
        companyName: donationData.donor.companyName || "",
        dni: donationData.donor.dni || "",
        ruc: donationData.donor.ruc || "",
        email: donationData.donor.email,
        phone: donationData.donor.phone || "",
        address: donationData.donor.address || "",
        representative: donationData.donor.representative || "",
        position: donationData.donor.position || "",
        message: donationData.donor.message || "",
        newsletter: donationData.donor.newsletter || false,
        fullName: donationData.donor.fullName,
      },

      // Información del recolector
      collector: {
        id: donationData.collector.id,
        name: donationData.collector.name,
        email: donationData.collector.email,
        phone: donationData.collector.phone,
        faculty: donationData.collector.faculty,
      },

      // Información del pago
      payment: {
        amount: donationData.payment.amount,
        method: donationData.payment.method,
        methodDetails: donationData.payment.methodDetails,
        proofFileURL: fileURL,
        status: donationData.payment.status,
        verificationStatus: "pending",
        verifiedAt: null,
        verifiedBy: null,
      },

      // Metadatos y timestamps
      metadata: {
        ...donationData.metadata,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        version: "1.0",
      },

      // Estados de seguimiento
      status: {
        current: "submitted",
        history: [
          {
            status: "submitted",
            timestamp: serverTimestamp(),
            note: "Donación enviada por el usuario",
          },
        ],
      },
    };
  }

  /**
   * Actualiza el estado de una donación
   * @param {string} donationId - ID de la donación
   * @param {string} newStatus - Nuevo estado
   * @param {string} note - Nota opcional
   * @returns {Promise<void>}
   */
  static async updateDonationStatus(donationId, newStatus, note = "") {
    try {
      const donationRef = doc(this.db, "donations", donationId);

      await setDoc(
        donationRef,
        {
          "status.current": newStatus,
          "status.history": arrayUnion({
            status: newStatus,
            timestamp: serverTimestamp(),
            note: note,
          }),
          "metadata.updatedAt": serverTimestamp(),
        },
        { merge: true }
      );

      console.log(
        `Estado actualizado para donación ${donationId}: ${newStatus}`
      );
    } catch (error) {
      console.error("Error al actualizar estado:", error);
      throw error;
    }
  }

  /**
   * Obtiene una donación por ID
   * @param {string} donationId - ID de la donación
   * @returns {Promise<Object>} - Datos de la donación
   */
  static async getDonation(donationId) {
    try {
      const donationRef = doc(this.db, "donations", donationId);
      const donationSnap = await getDoc(donationRef);

      if (donationSnap.exists()) {
        return {
          id: donationSnap.id,
          ...donationSnap.data(),
        };
      } else {
        throw new Error("Donación no encontrada");
      }
    } catch (error) {
      console.error("Error al obtener donación:", error);
      throw error;
    }
  }

  /**
   * Valida los datos antes de subir
   * @param {Object} donationData - Datos a validar
   * @returns {Object} - Resultado de la validación
   */
  static validateDonationData(donationData) {
    const errors = [];

    // Validar donante
    if (!donationData.donor) {
      errors.push("Datos del donante son requeridos");
    } else {
      if (!donationData.donor.email) {
        errors.push("Email del donante es requerido");
      }
      if (!donationData.donor.fullName) {
        errors.push("Nombre completo del donante es requerido");
      }
    }

    // Validar recolector
    if (!donationData.collector) {
      errors.push("Datos del recolector son requeridos");
    } else {
      if (!donationData.collector.id) {
        errors.push("ID del recolector es requerido");
      }
    }

    // Validar pago
    if (!donationData.payment) {
      errors.push("Datos del pago son requeridos");
    } else {
      if (!donationData.payment.amount || donationData.payment.amount <= 0) {
        errors.push("Monto del pago debe ser mayor a 0");
      }
      if (!donationData.payment.method) {
        errors.push("Método de pago es requerido");
      }
      if (!donationData.payment.proofFile) {
        errors.push("Comprobante de pago es requerido");
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
    };
  }

  /**
   * Método de utilidad para logs
   * @param {string} message - Mensaje a loggear
   * @param {Object} data - Datos adicionales
   */
  static log(message, data = {}) {
    console.log(`[DonationUploadService] ${message}`, data);
  }
}

// Exportar también como default
export default DonationUploadService;
