package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"cassandra/middleware"
	"cassandra/models"
	"cassandra/repository"

	"github.com/go-chi/chi/v5"
)

type FinanzasHandler struct {
	repo *repository.FinanzasRepository
}

func NewFinanzasHandler(repo *repository.FinanzasRepository) *FinanzasHandler {
	return &FinanzasHandler{repo: repo}
}

// ==========================================
// 1. BANCO (Cuentas, Tarjetas, Billeteras)
// ==========================================

// CreateBanco atiende POST /api/finanzas/bancos
func (h *FinanzasHandler) CreateBanco(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	var req models.BancoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[HANDLER:Finanzas.CreateBanco] JSON inválido: %v | user_id=%d", err, userID)
		http.Error(w, "JSON inválido: "+err.Error(), http.StatusBadRequest)
		return
	}

	req.Nombre = strings.TrimSpace(req.Nombre)
	if req.Nombre == "" {
		http.Error(w, "El nombre del banco/cuenta es obligatorio", http.StatusBadRequest)
		return
	}

	tipo := strings.ToLower(strings.TrimSpace(req.Tipo))
	if tipo == "" {
		tipo = "efectivo"
	}
	switch tipo {
	case "debito", "credito", "prepago", "efectivo":
		req.Tipo = tipo
	default:
		http.Error(w, "Tipo de banco inválido. Debe ser: debito, credito, prepago o efectivo", http.StatusBadRequest)
		return
	}

	req.UserID = userID
	banco, err := h.repo.CreateBanco(r.Context(), &req)
	if err != nil {
		log.Printf("[HANDLER:Finanzas.CreateBanco] Error en repositorio: %v | user_id=%d", err, userID)
		http.Error(w, "Error al crear el banco: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(banco)
}

// GetBancos atiende GET /api/finanzas/bancos
func (h *FinanzasHandler) GetBancos(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	bancos, err := h.repo.GetBancos(r.Context(), userID)
	if err != nil {
		log.Printf("[HANDLER:Finanzas.GetBancos] Error en repositorio: %v | user_id=%d", err, userID)
		http.Error(w, "Error al obtener los bancos: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(bancos)
}

// GetBancoByID atiende GET /api/finanzas/bancos/{id}
func (h *FinanzasHandler) GetBancoByID(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		http.Error(w, "ID de banco inválido", http.StatusBadRequest)
		return
	}

	banco, err := h.repo.GetBancoByID(r.Context(), id, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(banco)
}

// UpdateBanco atiende PUT /api/finanzas/bancos/{id}
func (h *FinanzasHandler) UpdateBanco(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		http.Error(w, "ID de banco inválido", http.StatusBadRequest)
		return
	}

	var req models.BancoUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON inválido: "+err.Error(), http.StatusBadRequest)
		return
	}

	if req.Nombre != nil {
		trimmed := strings.TrimSpace(*req.Nombre)
		if trimmed == "" {
			http.Error(w, "El nombre del banco no puede estar vacío", http.StatusBadRequest)
			return
		}
		req.Nombre = &trimmed
	}

	if req.Tipo != nil {
		tipo := strings.ToLower(strings.TrimSpace(*req.Tipo))
		switch tipo {
		case "debito", "credito", "prepago", "efectivo":
			req.Tipo = &tipo
		default:
			http.Error(w, "Tipo de banco inválido. Debe ser: debito, credito, prepago o efectivo", http.StatusBadRequest)
			return
		}
	}

	banco, err := h.repo.UpdateBanco(r.Context(), id, userID, &req)
	if err != nil {
		log.Printf("[HANDLER:Finanzas.UpdateBanco] Error en repositorio: %v | id=%d user_id=%d", err, id, userID)
		http.Error(w, "Error al actualizar el banco: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(banco)
}

// DeleteBanco atiende DELETE /api/finanzas/bancos/{id}
func (h *FinanzasHandler) DeleteBanco(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		http.Error(w, "ID de banco inválido", http.StatusBadRequest)
		return
	}

	if err := h.repo.DeleteBanco(r.Context(), id, userID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"mensaje": "Banco eliminado exitosamente"})
}

// ==========================================
// 2. GRUPO ITEM FINANZAS (Categorías)
// ==========================================

// CreateGrupoItem atiende POST /api/finanzas/grupos
func (h *FinanzasHandler) CreateGrupoItem(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	var req models.GrupoItemFinanzasRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON inválido: "+err.Error(), http.StatusBadRequest)
		return
	}

	req.Nombre = strings.TrimSpace(req.Nombre)
	if req.Nombre == "" {
		http.Error(w, "El nombre del grupo/categoría es obligatorio", http.StatusBadRequest)
		return
	}

	req.UserID = userID
	grupo, err := h.repo.CreateGrupoItem(r.Context(), &req)
	if err != nil {
		log.Printf("[HANDLER:Finanzas.CreateGrupoItem] Error en repositorio: %v | user_id=%d", err, userID)
		http.Error(w, "Error al crear el grupo: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(grupo)
}

// GetGruposItems atiende GET /api/finanzas/grupos
func (h *FinanzasHandler) GetGruposItems(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	grupos, err := h.repo.GetGruposItems(r.Context(), userID)
	if err != nil {
		log.Printf("[HANDLER:Finanzas.GetGruposItems] Error en repositorio: %v | user_id=%d", err, userID)
		http.Error(w, "Error al obtener grupos: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(grupos)
}

// GetGrupoItemByID atiende GET /api/finanzas/grupos/{id}
func (h *FinanzasHandler) GetGrupoItemByID(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		http.Error(w, "ID de grupo inválido", http.StatusBadRequest)
		return
	}

	grupo, err := h.repo.GetGrupoItemByID(r.Context(), id, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(grupo)
}

// UpdateGrupoItem atiende PUT /api/finanzas/grupos/{id}
func (h *FinanzasHandler) UpdateGrupoItem(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		http.Error(w, "ID de grupo inválido", http.StatusBadRequest)
		return
	}

	var req models.GrupoItemFinanzasUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON inválido: "+err.Error(), http.StatusBadRequest)
		return
	}

	if req.Nombre != nil {
		trimmed := strings.TrimSpace(*req.Nombre)
		if trimmed == "" {
			http.Error(w, "El nombre del grupo no puede estar vacío", http.StatusBadRequest)
			return
		}
		req.Nombre = &trimmed
	}

	grupo, err := h.repo.UpdateGrupoItem(r.Context(), id, userID, &req)
	if err != nil {
		log.Printf("[HANDLER:Finanzas.UpdateGrupoItem] Error en repositorio: %v | id=%d user_id=%d", err, id, userID)
		http.Error(w, "Error al actualizar grupo: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(grupo)
}

// DeleteGrupoItem atiende DELETE /api/finanzas/grupos/{id}
func (h *FinanzasHandler) DeleteGrupoItem(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		http.Error(w, "ID de grupo inválido", http.StatusBadRequest)
		return
	}

	if err := h.repo.DeleteGrupoItem(r.Context(), id, userID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"mensaje": "Grupo de finanzas eliminado exitosamente"})
}

// ==========================================
// 3. MOVIMIENTO ESPERADO FINANZAS (Destinos)
// ==========================================

// CreateMovimientoEsperado atiende POST /api/finanzas/movimientos-esperados
func (h *FinanzasHandler) CreateMovimientoEsperado(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	var req models.MovimientoEsperadoFinanzasRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON inválido: "+err.Error(), http.StatusBadRequest)
		return
	}

	req.Nombre = strings.TrimSpace(req.Nombre)
	if req.Nombre == "" {
		http.Error(w, "El nombre del movimiento esperado es obligatorio", http.StatusBadRequest)
		return
	}

	req.UserID = userID
	mov, err := h.repo.CreateMovimientoEsperado(r.Context(), &req)
	if err != nil {
		log.Printf("[HANDLER:Finanzas.CreateMovimientoEsperado] Error en repositorio: %v | user_id=%d", err, userID)
		http.Error(w, "Error al crear movimiento esperado: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(mov)
}

// GetMovimientosEsperados atiende GET /api/finanzas/movimientos-esperados
func (h *FinanzasHandler) GetMovimientosEsperados(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	movs, err := h.repo.GetMovimientosEsperados(r.Context(), userID)
	if err != nil {
		log.Printf("[HANDLER:Finanzas.GetMovimientosEsperados] Error en repositorio: %v | user_id=%d", err, userID)
		http.Error(w, "Error al obtener movimientos esperados: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(movs)
}

// GetMovimientoEsperadoByID atiende GET /api/finanzas/movimientos-esperados/{id}
func (h *FinanzasHandler) GetMovimientoEsperadoByID(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		http.Error(w, "ID de movimiento esperado inválido", http.StatusBadRequest)
		return
	}

	mov, err := h.repo.GetMovimientoEsperadoByID(r.Context(), id, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(mov)
}

// UpdateMovimientoEsperado atiende PUT /api/finanzas/movimientos-esperados/{id}
func (h *FinanzasHandler) UpdateMovimientoEsperado(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		http.Error(w, "ID de movimiento esperado inválido", http.StatusBadRequest)
		return
	}

	var req models.MovimientoEsperadoFinanzasUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON inválido: "+err.Error(), http.StatusBadRequest)
		return
	}

	if req.Nombre != nil {
		trimmed := strings.TrimSpace(*req.Nombre)
		if trimmed == "" {
			http.Error(w, "El nombre del movimiento esperado no puede estar vacío", http.StatusBadRequest)
			return
		}
		req.Nombre = &trimmed
	}

	mov, err := h.repo.UpdateMovimientoEsperado(r.Context(), id, userID, &req)
	if err != nil {
		log.Printf("[HANDLER:Finanzas.UpdateMovimientoEsperado] Error en repositorio: %v | id=%d user_id=%d", err, id, userID)
		http.Error(w, "Error al actualizar movimiento esperado: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(mov)
}

// DeleteMovimientoEsperado atiende DELETE /api/finanzas/movimientos-esperados/{id}
func (h *FinanzasHandler) DeleteMovimientoEsperado(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		http.Error(w, "ID de movimiento esperado inválido", http.StatusBadRequest)
		return
	}

	if err := h.repo.DeleteMovimientoEsperado(r.Context(), id, userID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"mensaje": "Movimiento esperado eliminado exitosamente"})
}

// ==========================================
// 4. FINANZAS PLANTILLA (Movimientos Mensuales)
// ==========================================

// CreatePlantilla atiende POST /api/finanzas/plantilla
func (h *FinanzasHandler) CreatePlantilla(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	var req models.FinanzasPlantillaRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[HANDLER:Finanzas.CreatePlantilla] JSON inválido: %v | user_id=%d", err, userID)
		http.Error(w, "JSON inválido: "+err.Error(), http.StatusBadRequest)
		return
	}

	req.Nombre = strings.TrimSpace(req.Nombre)
	if req.Nombre == "" {
		http.Error(w, "El nombre del ítem financiero es obligatorio", http.StatusBadRequest)
		return
	}

	tipo := strings.ToLower(strings.TrimSpace(req.Tipo))
	if tipo != "ingreso" && tipo != "egreso" {
		http.Error(w, "Tipo inválido. Debe ser: ingreso o egreso", http.StatusBadRequest)
		return
	}
	req.Tipo = tipo

	if req.Mes < 1 || req.Mes > 12 {
		http.Error(w, "El mes debe estar entre 1 y 12", http.StatusBadRequest)
		return
	}

	if req.Anio <= 2000 {
		http.Error(w, "El año debe ser válido (mayor a 2000)", http.StatusBadRequest)
		return
	}

	if req.Estado != "" {
		estado := strings.ToLower(strings.TrimSpace(req.Estado))
		switch estado {
		case "pendiente", "en proceso", "completado":
			req.Estado = estado
		default:
			http.Error(w, "Estado inválido. Debe ser: pendiente, en proceso o completado", http.StatusBadRequest)
			return
		}
	} else {
		req.Estado = "pendiente"
	}

	req.UserID = userID
	item, err := h.repo.CreatePlantilla(r.Context(), &req)
	if err != nil {
		log.Printf("[HANDLER:Finanzas.CreatePlantilla] Error en repositorio: %v | user_id=%d", err, userID)
		http.Error(w, "Error al registrar ítem de finanzas: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(item)
}

// GetPlantillaByPeriodo atiende GET /api/finanzas/plantilla?anio=YYYY&mes=M
func (h *FinanzasHandler) GetPlantillaByPeriodo(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	now := time.Now()
	anio := now.Year()
	mes := int(now.Month())

	if anioParam := r.URL.Query().Get("anio"); anioParam != "" {
		if a, err := strconv.Atoi(anioParam); err == nil && a > 2000 {
			anio = a
		}
	}

	if mesParam := r.URL.Query().Get("mes"); mesParam != "" {
		if m, err := strconv.Atoi(mesParam); err == nil && m >= 1 && m <= 12 {
			mes = m
		}
	}

	log.Printf("[HANDLER:Finanzas.GetPlantillaByPeriodo] user_id=%d consultando anio=%d mes=%d (query: anio=%q mes=%q)", userID, anio, mes, r.URL.Query().Get("anio"), r.URL.Query().Get("mes"))

	items, err := h.repo.GetPlantillaByPeriodo(r.Context(), userID, anio, mes)
	if err != nil {
		log.Printf("[HANDLER:Finanzas.GetPlantillaByPeriodo] Error en repositorio: %v | user_id=%d anio=%d mes=%d", err, userID, anio, mes)
		http.Error(w, "Error al obtener finanzas: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

// GetPlantillaByID atiende GET /api/finanzas/plantilla/{id}
func (h *FinanzasHandler) GetPlantillaByID(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		http.Error(w, "ID de ítem de finanzas inválido", http.StatusBadRequest)
		return
	}

	item, err := h.repo.GetPlantillaByID(r.Context(), id, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(item)
}

// UpdatePlantilla atiende PUT /api/finanzas/plantilla/{id}
func (h *FinanzasHandler) UpdatePlantilla(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		http.Error(w, "ID de ítem de finanzas inválido", http.StatusBadRequest)
		return
	}

	var req models.FinanzasPlantillaUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON inválido: "+err.Error(), http.StatusBadRequest)
		return
	}

	if req.Nombre != nil {
		trimmed := strings.TrimSpace(*req.Nombre)
		if trimmed == "" {
			http.Error(w, "El nombre del ítem no puede estar vacío", http.StatusBadRequest)
			return
		}
		req.Nombre = &trimmed
	}

	if req.Tipo != nil {
		tipo := strings.ToLower(strings.TrimSpace(*req.Tipo))
		if tipo != "ingreso" && tipo != "egreso" {
			http.Error(w, "Tipo inválido. Debe ser: ingreso o egreso", http.StatusBadRequest)
			return
		}
		req.Tipo = &tipo
	}

	if req.Mes != nil && (*req.Mes < 1 || *req.Mes > 12) {
		http.Error(w, "El mes debe estar entre 1 y 12", http.StatusBadRequest)
		return
	}

	if req.Anio != nil && *req.Anio <= 2000 {
		http.Error(w, "El año debe ser válido", http.StatusBadRequest)
		return
	}

	if req.Estado != nil {
		estado := strings.ToLower(strings.TrimSpace(*req.Estado))
		switch estado {
		case "pendiente", "en proceso", "completado":
			req.Estado = &estado
		default:
			http.Error(w, "Estado inválido. Debe ser: pendiente, en proceso o completado", http.StatusBadRequest)
			return
		}
	}

	item, err := h.repo.UpdatePlantilla(r.Context(), id, userID, &req)
	if err != nil {
		log.Printf("[HANDLER:Finanzas.UpdatePlantilla] Error en repositorio: %v | id=%d user_id=%d", err, id, userID)
		http.Error(w, "Error al actualizar ítem de finanzas: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(item)
}

// DeletePlantilla atiende DELETE /api/finanzas/plantilla/{id}
func (h *FinanzasHandler) DeletePlantilla(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		http.Error(w, "ID de ítem de finanzas inválido", http.StatusBadRequest)
		return
	}

	if err := h.repo.DeletePlantilla(r.Context(), id, userID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"mensaje": "Ítem de finanzas eliminado exitosamente"})
}

// ==========================================
// 5. RESUMEN Y CLONACIÓN
// ==========================================

// GetResumenPeriodo atiende GET /api/finanzas/resumen?anio=YYYY&mes=M
func (h *FinanzasHandler) GetResumenPeriodo(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	now := time.Now()
	anio := now.Year()
	mes := int(now.Month())

	if anioParam := r.URL.Query().Get("anio"); anioParam != "" {
		if a, err := strconv.Atoi(anioParam); err == nil && a > 2000 {
			anio = a
		}
	}

	if mesParam := r.URL.Query().Get("mes"); mesParam != "" {
		if m, err := strconv.Atoi(mesParam); err == nil && m >= 1 && m <= 12 {
			mes = m
		}
	}

	log.Printf("[HANDLER:Finanzas.GetResumenPeriodo] user_id=%d consultando anio=%d mes=%d (query: anio=%q mes=%q)", userID, anio, mes, r.URL.Query().Get("anio"), r.URL.Query().Get("mes"))

	resumen, err := h.repo.GetResumenPeriodo(r.Context(), userID, anio, mes)
	if err != nil {
		log.Printf("[HANDLER:Finanzas.GetResumenPeriodo] Error en repositorio: %v | user_id=%d anio=%d mes=%d", err, userID, anio, mes)
		http.Error(w, "Error al obtener resumen de finanzas: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resumen)
}

// ClonarPeriodo atiende POST /api/finanzas/clonar
func (h *FinanzasHandler) ClonarPeriodo(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Usuario no autenticado", http.StatusUnauthorized)
		return
	}

	var req models.ClonarPeriodoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON inválido: "+err.Error(), http.StatusBadRequest)
		return
	}

	if req.MesOrigen < 1 || req.MesOrigen > 12 || req.MesDestino < 1 || req.MesDestino > 12 {
		http.Error(w, "Los meses de origen y destino deben estar entre 1 y 12", http.StatusBadRequest)
		return
	}

	if req.AnioOrigen <= 2000 || req.AnioDestino <= 2000 {
		http.Error(w, "Los años de origen y destino deben ser válidos (mayores a 2000)", http.StatusBadRequest)
		return
	}

	clonados, err := h.repo.ClonarPeriodo(r.Context(), userID, req.AnioOrigen, req.MesOrigen, req.AnioDestino, req.MesDestino)
	if err != nil {
		log.Printf("[HANDLER:Finanzas.ClonarPeriodo] Error en repositorio: %v | user_id=%d", err, userID)
		http.Error(w, "Error al clonar período: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"mensaje":            "Período clonado exitosamente",
		"registros_clonados": clonados,
		"mes_destino":        req.MesDestino,
		"anio_destino":       req.AnioDestino,
	})
}
