// Mapeo completo de las facultades de la UNFV con todas sus carreras
const facultadEscuelas = {
  1: [
    // Facultad de Administración
    { value: "1", text: "Administración de Empresas" },
    { value: "2", text: "Administración Pública" },
    { value: "3", text: "Administración de Turismo" },
    { value: "4", text: "Marketing" },
    { value: "5", text: "Negocios Internacionales" },
  ],
  2: [
    // Facultad de Ciencias Económicas
    { value: "6", text: "Economía" },
  ],
  3: [
    // Facultad de Ciencias Financieras y Contables
    { value: "7", text: "Contabilidad" },
  ],
  4: [
    // Facultad de Ciencias Sociales
    { value: "8", text: "Ciencias de la Comunicación" },
    { value: "9", text: "Sociología" },
    { value: "10", text: "Trabajo Social" },
  ],
  5: [
    // Facultad de Derecho y Ciencias Políticas
    { value: "11", text: "Derecho" },
    { value: "12", text: "Ciencia Política" },
  ],
  6: [
    // Facultad de Educación
    { value: "13", text: "Educación Inicial" },
    { value: "14", text: "Educación Primaria" },
    { value: "15", text: "Educación Secundaria - Ciencias Histórico-Sociales" },
    { value: "16", text: "Educación Secundaria - Lengua y Literatura" },
    { value: "17", text: "Educación Secundaria - Matemática y Física" },
    { value: "18", text: "Educación Secundaria - Ciencias Naturales" },
    { value: "19", text: "Educación Secundaria - Computación e Informática" },
    { value: "20", text: "Educación Secundaria - Inglés" },
    {
      value: "21",
      text: "Educación Secundaria - Filosofía y Ciencias Sociales",
    },
    { value: "22", text: "Educación Física" },
  ],
  7: [
    // Facultad de Humanidades
    { value: "23", text: "Antropología" },
    { value: "24", text: "Arqueología" },
    { value: "25", text: "Filosofía" },
    { value: "26", text: "Lingüística" },
    { value: "27", text: "Literatura" },
    { value: "28", text: "Historia" },
  ],
  8: [
    // Facultad de Arquitectura y Urbanismo
    { value: "29", text: "Arquitectura" },
  ],
  9: [
    // Facultad de Ingeniería Civil
    { value: "30", text: "Ingeniería Civil" },
  ],
  10: [
    // Facultad de Ingeniería Industrial y de Sistemas
    { value: "31", text: "Ingeniería de Sistemas" },
    { value: "32", text: "Ingeniería de Transportes" },
    { value: "33", text: "Ingeniería Agroindustrial" },
    { value: "34", text: "Ingeniería Industrial" },
  ],
  11: [
    // Facultad de Ingeniería Geográfica, Ambiental y Ecoturismo
    { value: "35", text: "Ingeniería Geográfica" },
    { value: "36", text: "Ingeniería Ambiental" },
    { value: "37", text: "Ingeniería de Ecoturismo" },
  ],
  12: [
    // Facultad de Oceanografía, Pesquería, Ciencias Alimentarias y Acuicultura
    { value: "38", text: "Ingeniería Alimentaria" },
    { value: "39", text: "Ingeniería en Acuicultura" },
    { value: "40", text: "Ingeniería Pesquera" },
  ],
  13: [
    // Facultad de Ingeniería Electrónica e Informática
    { value: "41", text: "Ingeniería Electrónica" },
    { value: "42", text: "Ingeniería Informática" },
    { value: "43", text: "Ingeniería Mecatrónica" },
    { value: "44", text: "Ingeniería de Telecomunicaciones" },
  ],
  14: [
    // Facultad de Ciencias Naturales y Matemática
    { value: "45", text: "Biología" },
    { value: "46", text: "Física" },
    { value: "47", text: "Matemática" },
    { value: "48", text: "Estadística" },
    { value: "49", text: "Química" },
  ],
  15: [
    // Facultad de Medicina "Hipólito Unanue" (Ciencias de la Salud)
    { value: "50", text: "Medicina" },
    { value: "51", text: "Enfermería" },
    { value: "52", text: "Nutrición" },
    { value: "53", text: "Obstetricia" },
    { value: "54", text: "Odontología" },
  ],
  16: [
    // Facultad de Tecnología Médica
    { value: "55", text: "Terapia Física y Rehabilitación" },
    { value: "56", text: "Radiología" },
    { value: "57", text: "Optometría" },
    { value: "58", text: "Terapia del Lenguaje" },
    { value: "59", text: "Laboratorio y Anatomía Patológica" },
  ],
  17: [
    // Facultad de Psicología
    { value: "60", text: "Psicología" },
  ],
};

// Función principal para filtrar escuelas según la facultad seleccionada
function filterEscuelas() {
  const facultadSelect = document.getElementById("facultadID");
  const escuelaSelect = document.getElementById("escuelaID");
  const facultadValue = facultadSelect.value;

  // Limpiar el select de escuelas
  escuelaSelect.innerHTML = '<option value="">Selecciona tu escuela</option>';

  if (facultadValue && facultadEscuelas[facultadValue]) {
    // Agregar las escuelas correspondientes a la facultad seleccionada
    facultadEscuelas[facultadValue].forEach((escuela) => {
      const option = document.createElement("option");
      option.value = escuela.value;
      option.textContent = escuela.text;
      escuelaSelect.appendChild(option);
    });

    escuelaSelect.disabled = false;
  } else {
    // Si no hay facultad seleccionada, deshabilitar el select de escuelas
    escuelaSelect.innerHTML =
      '<option value="">Primero selecciona una facultad</option>';
    escuelaSelect.disabled = true;
  }
}

// Función para manejar la selección de escuela (opcional)
function updateEscuelaDisplay() {
  const escuelaSelect = document.getElementById("escuelaID");
  const selectedValue = escuelaSelect.value;
  const selectedText = escuelaSelect.options[escuelaSelect.selectedIndex].text;

  if (selectedValue) {
    console.log("Escuela seleccionada:", selectedText, "ID:", selectedValue);
    // Aquí puedes agregar más lógica si necesitas hacer algo con la escuela seleccionada
  }
}

// Función para manejar la selección de facultad (opcional)
function updateFacultadDisplay() {
  const facultadSelect = document.getElementById("facultadID");
  const selectedValue = facultadSelect.value;
  const selectedText =
    facultadSelect.options[facultadSelect.selectedIndex].text;

  if (selectedValue) {
    console.log("Facultad seleccionada:", selectedText, "ID:", selectedValue);
    // Aquí puedes agregar más lógica si necesitas hacer algo con la facultad seleccionada
  }
}

// Inicializar el formulario cuando se carga la página
document.addEventListener("DOMContentLoaded", function () {
  const escuelaSelect = document.getElementById("escuelaID");
  escuelaSelect.disabled = true;
});

// Función utilitaria para obtener el nombre de la facultad por ID
function getFacultadName(facultadId) {
  const facultadSelect = document.getElementById("facultadID");
  const option = facultadSelect.querySelector(`option[value="${facultadId}"]`);
  return option ? option.textContent : null;
}

// Función utilitaria para obtener el nombre de la escuela por ID
function getEscuelaName(escuelaId) {
  const escuelaSelect = document.getElementById("escuelaID");
  const option = escuelaSelect.querySelector(`option[value="${escuelaId}"]`);
  return option ? option.textContent : null;
}
