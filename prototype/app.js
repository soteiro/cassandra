/* ==========================================================================
   Cassandra HQ — Prototype Interactive Logic (Vanilla JS)
   Feature Set: Cmd+K Command Palette, Hiperenfoque Mode, Toggle Completadas & A11y
   ========================================================================== */

// Base de datos local en memoria
const tasksData = [
  {
    id: 1,
    title: "Diseñar arquitectura del frontend en Angular",
    project: "cassandra",
    priority: "high",
    desc: "Crear componentes modulares para tareas y drawer de detalles.",
    isDone: true,
    timeEst: "45 min",
    subtasks: [
      { text: "Estructurar componentes Standalone", done: true },
      { text: "Configurar Tailwind CSS v4", done: true },
      { text: "Crear servicios de comunicación con Go API", done: true }
    ]
  },
  {
    id: 2,
    title: "Conectar backend Go con base PostgreSQL en Hetzner",
    project: "cassandra",
    priority: "high",
    desc: "Validar migraciones SQL y endpoints de autenticación.",
    isDone: true,
    timeEst: "60 min",
    subtasks: [
      { text: "Crear tabla de usuarios y proyectos", done: true },
      { text: "Implementar JWT Auth middleware", done: true }
    ]
  },
  {
    id: 3,
    title: "Revisar sincronización con Actual Budget",
    project: "personal",
    priority: "medium",
    desc: "Verificar estado de cuentas del mes actual.",
    isDone: false,
    timeEst: "30 min",
    subtasks: [
      { text: "Exportar transacciones de prueba", done: true },
      { text: "Mapear categorías de gastos", done: false }
    ]
  },
  {
    id: 4,
    title: "Integración con TickTick y Google Calendar",
    project: "cassandra",
    priority: "medium",
    desc: "Sincronizar eventos diarios automáticamente.",
    isDone: false,
    timeEst: "90 min",
    subtasks: [
      { text: "Obtener API Keys de Google Cloud Console", done: false },
      { text: "Configurar webhook para TickTick", done: false },
      { text: "Probar sincronización bidireccional", done: false },
      { text: "Manejar errores de token expirado", done: false }
    ]
  },
  {
    id: 5,
    title: "Migrar ingesta de emails de Aurora hacia Cassandra",
    project: "aurora",
    priority: "low",
    desc: "Reemplazar código antiguo de Aurora y conectar al nuevo backend.",
    isDone: false,
    timeEst: "120 min",
    subtasks: [
      { text: "Analizar parser IMAP actual", done: true },
      { text: "Reescribir módulo en Go", done: false },
      { text: "Deprecar repositorio Aurora", done: false }
    ]
  },
  {
    id: 6,
    title: "Configurar presupuesto mensual de servidores Hetzner",
    project: "personal",
    priority: "low",
    desc: "Asegurar límites de gasto para hosting.",
    isDone: true,
    timeEst: "15 min",
    subtasks: [
      { text: "Establecer alerta en €25/mes", done: true },
      { text: "Revisar facturación previa", done: true }
    ]
  }
];

let activeTaskId = null;
let lastDeletedSubtask = null;
let showCompletedTasks = false;

// Elementos DOM
const drawerOverlay = document.getElementById('drawer-overlay');
const slideDrawer = document.getElementById('slide-drawer');
const drawerTitle = document.getElementById('drawer-title');
const drawerProject = document.getElementById('drawer-project');
const drawerPriority = document.getElementById('drawer-priority');
const drawerNotes = document.getElementById('drawer-notes');
const subtasksContainer = document.getElementById('subtasks-container');
const subtasksCount = document.getElementById('subtasks-count');
const btnAddSubtask = document.getElementById('btn-add-subtask');
const btnNewTask = document.getElementById('btn-new-task');
const toastContainer = document.getElementById('toast-container');
const emptyStateMsg = document.getElementById('empty-state-msg');
const btnToggleCompleted = document.getElementById('btn-toggle-completed');
const btnCompletedLabel = document.getElementById('btn-completed-label');

// Command Palette & Hiperenfoque DOM
const cmdOverlay = document.getElementById('cmd-overlay');
const cmdSearchInput = document.getElementById('cmd-search-input');
const btnCmdTrigger = document.getElementById('btn-cmd-trigger');
const hyperfocusScreen = document.getElementById('hyperfocus-screen');
const btnStartHyperfocus = document.getElementById('btn-start-hyperfocus');
const btnExitHyperfocus = document.getElementById('btn-exit-hyperfocus');
const hyperfocusTitle = document.getElementById('hyperfocus-title');
const hyperfocusDesc = document.getElementById('hyperfocus-desc');

// Inicialización de eventos
document.addEventListener('DOMContentLoaded', () => {
  setupCheckboxes();
  setupFilters();
  setupKeyboardA11y();
  setupCmdPalette();
  setupHyperfocus();
  applyTaskVisibility();

  btnNewTask.addEventListener('click', openNewTaskDrawer);
  btnAddSubtask.addEventListener('click', () => {
    addSubtaskRow('', false);
    updateSubtasksCounter();
  });
});

// --------------------------------------------------------------------------
// TECLADO Y ACCESIBILIDAD (A11y)
// --------------------------------------------------------------------------
function setupKeyboardA11y() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!cmdOverlay.hidden) closeCmdPalette();
      else if (hyperfocusScreen.style.display !== 'none' && !hyperfocusScreen.hidden) exitHyperfocus();
      else if (slideDrawer.classList.contains('open')) closeDrawer();
    }

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openCmdPalette();
    }
  });

  const taskRows = document.querySelectorAll('.task-row[tabindex="0"]');
  taskRows.forEach(row => {
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const taskId = parseInt(row.getAttribute('data-id'), 10);
        openDrawer(taskId);
      }
    });
  });
}

// --------------------------------------------------------------------------
// DRAWER DE DETALLE DE TAREA
// --------------------------------------------------------------------------
function openDrawer(taskId) {
  const task = tasksData.find(t => t.id === taskId);
  if (!task) return;

  activeTaskId = taskId;
  drawerTitle.value = task.title;
  drawerProject.value = task.project;
  drawerPriority.value = task.priority;
  drawerNotes.value = task.desc || '';

  subtasksContainer.innerHTML = '';
  if (task.subtasks && task.subtasks.length > 0) {
    task.subtasks.forEach(st => addSubtaskRow(st.text, st.done));
  }
  updateSubtasksCounter();

  drawerOverlay.classList.add('active');
  drawerOverlay.removeAttribute('aria-hidden');
  slideDrawer.classList.add('open');
  slideDrawer.removeAttribute('hidden');

  setTimeout(() => drawerTitle.focus(), 100);
}

function openNewTaskDrawer() {
  activeTaskId = null;
  drawerTitle.value = 'Nueva Tarea de Ejemplo';
  drawerProject.value = 'cassandra';
  drawerPriority.value = 'high';
  drawerNotes.value = '';
  subtasksContainer.innerHTML = '';
  addSubtaskRow('Primera subtarea', false);
  updateSubtasksCounter();

  drawerOverlay.classList.add('active');
  drawerOverlay.removeAttribute('aria-hidden');
  slideDrawer.classList.add('open');
  slideDrawer.removeAttribute('hidden');

  setTimeout(() => drawerTitle.focus(), 100);
}

function closeDrawer() {
  drawerOverlay.classList.remove('active');
  drawerOverlay.setAttribute('aria-hidden', 'true');
  slideDrawer.classList.remove('open');
  slideDrawer.setAttribute('hidden', 'true');
  activeTaskId = null;
}

function saveDrawerTask() {
  if (!drawerTitle.value.trim()) {
    showToast('⚠️ El título de la tarea no puede estar vacío');
    drawerTitle.focus();
    return;
  }

  if (activeTaskId) {
    const task = tasksData.find(t => t.id === activeTaskId);
    if (task) {
      task.title = drawerTitle.value.trim();
      task.project = drawerProject.value;
      task.priority = drawerPriority.value;
      task.desc = drawerNotes.value.trim();

      const rows = subtasksContainer.querySelectorAll('.subtask-row');
      task.subtasks = Array.from(rows).map(row => {
        const input = row.querySelector('.subtask-input');
        const check = row.querySelector('input[type="checkbox"]');
        return { text: input.value, done: check.checked };
      });

      const taskTitleElem = document.querySelector(`.task-row[data-id="${activeTaskId}"] .task-title`);
      if (taskTitleElem) taskTitleElem.textContent = task.title;
    }
  } else {
    const newId = tasksData.length + 1;
    tasksData.push({
      id: newId,
      title: drawerTitle.value.trim(),
      project: drawerProject.value,
      priority: drawerPriority.value,
      desc: drawerNotes.value.trim(),
      isDone: false,
      timeEst: '30 min',
      subtasks: []
    });
    showToast('✨ Tarea creada exitosamente');
  }

  closeDrawer();
  applyTaskVisibility();
}

// --------------------------------------------------------------------------
// SUBTAREAS & TOAST UNDO
// --------------------------------------------------------------------------
function addSubtaskRow(text = '', isChecked = false) {
  const row = document.createElement('div');
  row.className = 'subtask-row';
  row.innerHTML = `
    <label class="custom-checkbox">
      <input type="checkbox" ${isChecked ? 'checked' : ''} aria-label="Marcar subtarea">
      <span class="checkmark"></span>
    </label>
    <input type="text" class="subtask-input" value="${text}" placeholder="Escribe un paso...">
    <button class="btn-del-subtask" aria-label="Eliminar subtarea">✕</button>
  `;

  row.querySelector('.btn-del-subtask').addEventListener('click', () => {
    lastDeletedSubtask = { text: row.querySelector('.subtask-input').value, isChecked: row.querySelector('input[type="checkbox"]').checked };
    row.remove();
    updateSubtasksCounter();
    showToast('Subtarea eliminada', true);
  });

  row.querySelector('input[type="checkbox"]').addEventListener('change', updateSubtasksCounter);
  subtasksContainer.appendChild(row);
}

function updateSubtasksCounter() {
  const rows = subtasksContainer.querySelectorAll('.subtask-row');
  const total = rows.length;
  let doneCount = 0;
  rows.forEach(r => {
    if (r.querySelector('input[type="checkbox"]').checked) doneCount++;
  });
  subtasksCount.textContent = `${doneCount} / ${total}`;
}

function showToast(msg, allowUndo = false) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <span>${msg}</span>
    ${allowUndo ? '<button class="btn-toast-undo">Deshacer</button>' : ''}
  `;

  if (allowUndo) {
    toast.querySelector('.btn-toast-undo').addEventListener('click', () => {
      if (lastDeletedSubtask) {
        addSubtaskRow(lastDeletedSubtask.text, lastDeletedSubtask.isChecked);
        updateSubtasksCounter();
        lastDeletedSubtask = null;
      }
      toast.remove();
    });
  }

  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// --------------------------------------------------------------------------
// CHECKBOXES Y VISIBILIDAD DE COMPLETADAS
// --------------------------------------------------------------------------
function setupCheckboxes() {
  const checkboxes = document.querySelectorAll('.custom-checkbox input[data-task-id]');
  checkboxes.forEach(cb => {
    cb.addEventListener('change', (e) => {
      const taskId = parseInt(e.target.getAttribute('data-task-id'), 10);
      const isChecked = e.target.checked;
      
      const task = tasksData.find(t => t.id === taskId);
      if (task) task.isDone = isChecked;

      const relatedCbs = document.querySelectorAll(`input[data-task-id="${taskId}"]`);
      relatedCbs.forEach(rcb => rcb.checked = isChecked);

      const taskNames = document.querySelectorAll(`.task-row[data-id="${taskId}"] .task-title`);
      taskNames.forEach(tn => {
        if (isChecked) tn.classList.add('is-done');
        else tn.classList.remove('is-done');
      });

      applyTaskVisibility();
    });
  });
}

function setupFilters() {
  const projectSelect = document.getElementById('project-select-filter');
  const projectGroups = document.querySelectorAll('.project-stream-group');

  btnToggleCompleted.addEventListener('click', () => {
    showCompletedTasks = !showCompletedTasks;
    btnToggleCompleted.setAttribute('aria-pressed', showCompletedTasks ? 'true' : 'false');

    if (showCompletedTasks) {
      btnToggleCompleted.classList.add('active');
    } else {
      btnToggleCompleted.classList.remove('active');
    }

    applyTaskVisibility();
  });

  projectSelect.addEventListener('change', (e) => {
    const selectedProject = e.target.value;
    projectGroups.forEach(group => {
      const proj = group.getAttribute('data-project');
      group.style.display = (selectedProject === 'all' || proj === selectedProject) ? 'flex' : 'none';
    });
  });
}

function applyTaskVisibility() {
  const taskRows = document.querySelectorAll('.task-row');
  const completedCount = tasksData.filter(t => t.isDone).length;
  let visibleCount = 0;

  btnCompletedLabel.textContent = showCompletedTasks
    ? `Ocultar completadas (${completedCount})`
    : `Mostrar completadas (${completedCount})`;

  taskRows.forEach(item => {
    const taskId = parseInt(item.getAttribute('data-id'), 10);
    const task = tasksData.find(t => t.id === taskId);
    
    if (task && task.isDone) {
      item.style.display = showCompletedTasks ? 'flex' : 'none';
      if (showCompletedTasks) visibleCount++;
    } else {
      item.style.display = 'flex';
      visibleCount++;
    }
  });

  emptyStateMsg.hidden = (visibleCount > 0);
}

// --------------------------------------------------------------------------
// PALETA DE COMANDOS (Cmd+K)
// --------------------------------------------------------------------------
function setupCmdPalette() {
  btnCmdTrigger.addEventListener('click', openCmdPalette);

  cmdOverlay.addEventListener('click', (e) => {
    if (e.target === cmdOverlay) closeCmdPalette();
  });

  const cmdItems = document.querySelectorAll('.cmd-item');
  cmdItems.forEach(item => {
    item.addEventListener('click', () => {
      const action = item.getAttribute('data-action');
      closeCmdPalette();

      if (action === 'new-task') openNewTaskDrawer();
      else if (action === 'hyperfocus') enterHyperfocus();
      else if (action === 'open-task-1') openDrawer(1);
    });
  });
}

function openCmdPalette() {
  cmdOverlay.hidden = false;
  cmdOverlay.style.display = 'flex';
  setTimeout(() => cmdSearchInput.focus(), 50);
}

function closeCmdPalette() {
  cmdOverlay.hidden = true;
  cmdOverlay.style.display = 'none';
}

// --------------------------------------------------------------------------
// MODO HIPERENFOQUE (Sin Temporizador Pomodoro)
// --------------------------------------------------------------------------
function setupHyperfocus() {
  btnStartHyperfocus.addEventListener('click', enterHyperfocus);
  btnExitHyperfocus.addEventListener('click', exitHyperfocus);

  const btnCompleteHyperfocus = document.getElementById('btn-complete-hyperfocus');
  if (btnCompleteHyperfocus) {
    btnCompleteHyperfocus.addEventListener('click', () => {
      const activeTask = tasksData.find(t => !t.isDone) || tasksData[0];
      if (activeTask) {
        activeTask.isDone = true;
        const cb = document.querySelector(`input[data-task-id="${activeTask.id}"]`);
        if (cb) cb.checked = true;
        const taskTitleElem = document.querySelector(`.task-row[data-id="${activeTask.id}"] .task-title`);
        if (taskTitleElem) taskTitleElem.classList.add('is-done');
        applyTaskVisibility();
        showToast('🎉 Tarea completada con éxito');
      }
      exitHyperfocus();
    });
  }
}

function enterHyperfocus() {
  const activeTask = tasksData.find(t => !t.isDone) || tasksData[0];
  hyperfocusTitle.textContent = activeTask.title;
  hyperfocusDesc.textContent = activeTask.desc || 'Sin notas adicionales.';

  hyperfocusScreen.hidden = false;
  hyperfocusScreen.style.display = 'flex';
}

function exitHyperfocus() {
  hyperfocusScreen.hidden = true;
  hyperfocusScreen.style.display = 'none';
}

// --------------------------------------------------------------------------
// LÓGICA VISTA PRINCIPAL (Navegación: Tareas vs CRM vs Calendario)
// --------------------------------------------------------------------------
function switchMainView(viewTarget) {
  const sectionTasks = document.getElementById('view-section-tasks');
  const sectionCrm = document.getElementById('view-section-crm');
  const sectionCalendar = document.getElementById('view-section-calendar');

  const navTasks = document.getElementById('nav-item-tasks');
  const navCrm = document.getElementById('nav-item-crm');
  const navCalendar = document.getElementById('nav-item-calendar');

  // Ocultar todas las secciones primero
  if (sectionTasks) sectionTasks.hidden = true;
  if (sectionCrm) sectionCrm.hidden = true;
  if (sectionCalendar) sectionCalendar.hidden = true;

  // Remover clase activa de todos los links del menú
  if (navTasks) { navTasks.classList.remove('active'); navTasks.removeAttribute('aria-current'); }
  if (navCrm) { navCrm.classList.remove('active'); navCrm.removeAttribute('aria-current'); }
  if (navCalendar) { navCalendar.classList.remove('active'); navCalendar.removeAttribute('aria-current'); }

  if (viewTarget === 'crm') {
    if (sectionCrm) sectionCrm.hidden = false;
    if (navCrm) { navCrm.classList.add('active'); navCrm.setAttribute('aria-current', 'page'); }
  } else if (viewTarget === 'calendar') {
    if (sectionCalendar) sectionCalendar.hidden = false;
    if (navCalendar) { navCalendar.classList.add('active'); navCalendar.setAttribute('aria-current', 'page'); }
  } else {
    if (sectionTasks) sectionTasks.hidden = false;
    if (navTasks) { navTasks.classList.add('active'); navTasks.setAttribute('aria-current', 'page'); }
  }
}

// --------------------------------------------------------------------------
// LÓGICA CRM & BITÁCORA DE LOGS
// --------------------------------------------------------------------------
function filterCrmLogs(logType) {
  const rows = document.querySelectorAll('.log-item-row');
  const pills = document.querySelectorAll('#view-section-crm .pill-btn');

  pills.forEach(p => p.classList.remove('active'));
  if (event && event.target) {
    event.target.classList.add('active');
  }

  rows.forEach(r => {
    const type = r.getAttribute('data-type');
    if (logType === 'all' || type === logType) {
      r.style.display = 'flex';
    } else {
      r.style.display = 'none';
    }
  });
}

function focusQuickLogInput() {
  const input = document.getElementById('quick-log-input');
  if (input) {
    input.focus();
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function submitQuickLog() {
  const input = document.getElementById('quick-log-input');
  const typeSelect = document.getElementById('quick-log-type');
  const contactSelect = document.getElementById('quick-log-contact');
  const logsList = document.getElementById('crm-logs-list');

  if (!input || !input.value.trim()) {
    showToast('⚠️ Escribe una nota o resumen antes de guardar');
    if (input) input.focus();
    return;
  }

  const text = input.value.trim();
  const typeVal = typeSelect ? typeSelect.value : 'chat';
  const contactName = contactSelect ? contactSelect.options[contactSelect.selectedIndex].text.split('(')[0].trim() : 'Contacto';
  
  let typeLabel = 'Conversación';
  let badgeClass = 'badge-chat';
  let icon = '💬';

  if (typeVal === 'note') { typeLabel = 'Nota Personal'; badgeClass = 'badge-note'; icon = '📝'; }
  else if (typeVal === 'date') { typeLabel = 'Fecha Importante'; badgeClass = 'badge-date'; icon = '🎂'; }
  else if (typeVal === 'agreement') { typeLabel = 'Acuerdo'; badgeClass = 'badge-agreement'; icon = '🤝'; }

  const newLog = document.createElement('div');
  newLog.className = 'log-item-row';
  newLog.setAttribute('data-type', typeVal);
  newLog.innerHTML = `
    <div class="log-left-col">
      <div class="crm-avatar avatar-amber">${contactName.charAt(0)}</div>
      <span class="log-type-icon">${icon}</span>
    </div>
    <div class="log-main-col">
      <div class="log-header-line">
        <span class="log-person-name">${contactName}</span>
        <span class="log-category-badge ${badgeClass}">${typeLabel}</span>
        <span class="log-date-stamp">Ahora mismo</span>
      </div>
      <p class="log-body-text">"${text}"</p>
      <div class="log-tags-row">
        <span class="log-tag">#Nuevo</span>
      </div>
    </div>
  `;

  logsList.prepend(newLog);
  input.value = '';
  showToast('✨ Registro guardado en la bitácora');
}

function switchCalView(mode) {
  const pills = document.querySelectorAll('.cal-view-pills .pill-btn');
  pills.forEach(p => p.classList.remove('active'));
  
  if (event && event.target) {
    event.target.classList.add('active');
  }
  showToast(`📅 Vista cambiada a: ${mode.toUpperCase()}`);
}

function changeCalPeriod(offset) {
  showToast(offset > 0 ? '📅 Siguiente período' : '📅 Período anterior');
}

function goTodayCal() {
  document.getElementById('cal-date-title').textContent = 'Julio 2026';
  showToast('📅 Mostrando eventos de Hoy');
}

function openNewEventModal() {
  showToast('🗓️ Sincronizando nuevo evento con Google Calendar & TickTick...');
}
