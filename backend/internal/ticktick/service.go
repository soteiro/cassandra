package ticktick

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"
	_ "time/tzdata"

	"cassandra/models"
	"golang.org/x/sync/singleflight"
)

type cacheEntry struct {
	result    models.TickTickToday
	attempted time.Time
	err       error
}
type Service struct {
	client *Client
	now    func() time.Time
	mu     sync.Mutex
	cache  map[string]cacheEntry
	epoch  map[int]uint64
	flight singleflight.Group
}

func NewService(client *Client) *Service {
	return &Service{client: client, now: time.Now, cache: map[string]cacheEntry{}, epoch: map[int]uint64{}}
}

func Day(date, zone string, now time.Time) (time.Time, time.Time, error) {
	if zone == "" || len(zone) > 100 || zone == "Local" {
		return time.Time{}, time.Time{}, errors.New("indica una zona horaria IANA válida")
	}
	loc, err := time.LoadLocation(zone)
	if err != nil {
		return time.Time{}, time.Time{}, errors.New("indica una zona horaria IANA válida")
	}
	if date == "" {
		date = now.In(loc).Format(time.DateOnly)
	}
	parsed, err := time.Parse(time.DateOnly, date)
	if err != nil || parsed.Format(time.DateOnly) != date {
		return time.Time{}, time.Time{}, errors.New("indica una fecha válida en formato YYYY-MM-DD")
	}
	boundary := func(day time.Time) time.Time {
		y, m, d := day.Date()
		value := time.Date(y, m, d, 0, 0, 0, 0, loc)
		// Santiago adelanta el reloj a las 00:00: su primera hora es 01:00.
		for range 4 {
			if value.Format(time.DateOnly) >= day.Format(time.DateOnly) {
				break
			}
			value = value.Add(time.Hour)
		}
		return value
	}
	start, end := boundary(parsed), boundary(parsed.AddDate(0, 0, 1))
	if start.Format(time.DateOnly) != date {
		return time.Time{}, time.Time{}, errors.New("la fecha no existe en esa zona horaria")
	}
	return start, end, nil
}

func Empty(state, date, zone string) models.TickTickToday {
	return models.TickTickToday{State: state, Date: date, TimeZone: zone, Tasks: []models.TickTickTask{}, Warnings: []string{}}
}

func (s *Service) Invalidate(userID int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.epoch[userID]++
	for key := range s.cache {
		if strings.HasPrefix(key, fmt.Sprintf("%d:", userID)) {
			delete(s.cache, key)
		}
	}
}

func (s *Service) Today(ctx context.Context, userID int, version int64, token, date, zone string, refresh bool) (models.TickTickToday, error) {
	start, end, err := Day(date, zone, s.now())
	if err != nil {
		return models.TickTickToday{}, err
	}
	date = start.Format(time.DateOnly)
	s.mu.Lock()
	epoch := s.epoch[userID]
	key := fmt.Sprintf("%d:%d:%d:%s:%s", userID, version, epoch, date, zone)
	entry, ok := s.cache[key]
	age := s.now().Sub(entry.attempted)
	if ok && age >= 0 && (age < 30*time.Second || (!refresh && entry.err == nil && entry.result.State == "ready" && age < 5*time.Minute)) {
		s.mu.Unlock()
		return clone(entry.result), entry.err
	}
	s.mu.Unlock()
	call := s.flight.DoChan(key, func() (any, error) {
		// Un cliente que cierre Home no cancela la consulta compartida por otros.
		fetchCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 25*time.Second)
		defer cancel()
		out, err := s.fetch(fetchCtx, token, start, end, zone)
		if err != nil && ok && entry.result.FetchedAt != nil && !errors.Is(err, ErrAuthorization) {
			out = clone(entry.result)
			out.State = "stale"
			out.Warnings = append(out.Warnings, "No se pudo actualizar TickTick; se muestran datos de la última consulta.")
			err = nil
		}
		if err != nil && out.State == "" {
			out = Empty("error", date, zone)
		}
		s.mu.Lock()
		if s.epoch[userID] == epoch {
			if len(s.cache) >= 256 {
				for old := range s.cache {
					delete(s.cache, old)
					break
				}
			}
			s.cache[key] = cacheEntry{result: clone(out), attempted: s.now(), err: err}
		}
		s.mu.Unlock()
		return out, err
	})
	select {
	case <-ctx.Done():
		return models.TickTickToday{}, ctx.Err()
	case result := <-call:
		if result.Val == nil {
			return models.TickTickToday{}, result.Err
		}
		return clone(result.Val.(models.TickTickToday)), result.Err
	}
}

func clone(value models.TickTickToday) models.TickTickToday {
	value.Tasks = append([]models.TickTickTask{}, value.Tasks...)
	value.Warnings = append([]string{}, value.Warnings...)
	return value
}

func (s *Service) fetch(ctx context.Context, token string, start, end time.Time, zone string) (models.TickTickToday, error) {
	out := Empty("ready", start.Format(time.DateOnly), zone)
	projects, partial, err := s.client.Projects(ctx, token)
	if err != nil {
		return out, err
	}
	if partial {
		out.Warnings = append(out.Warnings, "Se consultaron las primeras 50 listas; hay más listas en TickTick.")
	}
	inbox, err := s.client.ProjectTasks(ctx, token, "inbox")
	if err != nil && !errors.Is(err, ErrAuthorization) {
		inbox, err = s.client.InboxUndone(ctx, token, start, end)
		if err == nil {
			out.Warnings = append(out.Warnings, "Inbox se consultó por un rango de fechas alternativo; la lectura podría estar incompleta.")
		}
	}
	if errors.Is(err, ErrAuthorization) {
		return out, err
	}
	if err != nil {
		out.Warnings = append(out.Warnings, "No se pudo leer Inbox. La consulta de hoy está incompleta.")
	} else {
		out.InboxRead = true
	}
	seen := map[string]bool{}
	add := func(tasks []RawTask, list string) {
		for _, task := range tasks {
			if task.Status == nil || task.ID == "" || task.ProjectID == "" {
				partial = true
				continue
			}
			if *task.Status != 0 || task.Kind == "NOTE" || task.DueDate == "" {
				continue
			}
			key := task.ProjectID + ":" + task.ID
			if seen[key] {
				continue
			}
			seen[key] = true
			matches, valid := dueToday(task, start)
			if !valid {
				partial = true
				continue
			}
			if !matches {
				continue
			}
			out.Tasks = append(out.Tasks, models.TickTickTask{ID: task.ID, ProjectID: task.ProjectID, List: list, Title: task.Title, Priority: task.Priority, DueDate: task.DueDate, TimeZone: task.TimeZone, IsAllDay: task.IsAllDay})
		}
	}
	if out.InboxRead {
		add(inbox, "Inbox")
	}
	// Tres consultas simultáneas como máximo; el proveedor no bloquea tareas locales.
	type projectResult struct {
		index int
		tasks []RawTask
		err   error
	}
	results := make(chan projectResult, len(projects))
	semaphore := make(chan struct{}, 3)
	for i, p := range projects {
		if p.Closed || p.Kind == "NOTE" || p.ID == "inbox" || strings.HasPrefix(p.ID, "inbox") {
			continue
		}
		go func(i int, p Project) {
			select {
			case semaphore <- struct{}{}:
				defer func() { <-semaphore }()
			case <-ctx.Done():
				results <- projectResult{index: i, err: ErrUnavailable}
				return
			}
			tasks, err := s.client.ProjectTasks(ctx, token, p.ID)
			results <- projectResult{index: i, tasks: tasks, err: err}
		}(i, p)
	}
	count := 0
	for _, p := range projects {
		if !p.Closed && p.Kind != "NOTE" && p.ID != "inbox" && !strings.HasPrefix(p.ID, "inbox") {
			count++
		}
	}
	authFailed := false
	listFailed := false
	ordered := make([]projectResult, len(projects))
	for range count {
		result := <-results
		ordered[result.index] = result
		if errors.Is(result.err, ErrAuthorization) {
			authFailed = true
		}
		if result.err != nil {
			listFailed = true
			continue
		}
	}
	for i, result := range ordered {
		if result.err == nil {
			add(result.tasks, projects[i].Name)
		}
	}
	if listFailed {
		out.Warnings = append(out.Warnings, "No se pudieron consultar algunas listas de TickTick.")
	}
	if authFailed {
		return out, ErrAuthorization
	}
	if partial {
		out.Warnings = append(out.Warnings, "Hay límites o datos que impiden asegurar que la lista esté completa.")
	}
	if !out.InboxRead && len(out.Tasks) == 0 && count == 0 {
		return out, ErrUnavailable
	}
	if len(out.Warnings) > 0 {
		out.State = "partial"
	}
	sort.SliceStable(out.Tasks, func(i, j int) bool {
		a, b := out.Tasks[i], out.Tasks[j]
		if a.Priority != b.Priority {
			return a.Priority > b.Priority
		}
		if a.DueDate != b.DueDate {
			return a.DueDate < b.DueDate
		}
		if a.Title != b.Title {
			return a.Title < b.Title
		}
		return a.ProjectID+":"+a.ID < b.ProjectID+":"+b.ID
	})
	if len(out.Tasks) > 200 {
		out.Tasks = out.Tasks[:200]
		out.State = "partial"
		out.Warnings = append(out.Warnings, "Se muestran las primeras 200 tareas de hoy, ordenadas por prioridad.")
	}
	now := s.now()
	out.FetchedAt = &now
	return out, nil
}

func dueToday(task RawTask, start time.Time) (bool, bool) {
	var due time.Time
	var err error
	for _, format := range []string{time.RFC3339Nano, "2006-01-02T15:04:05.000-0700", "2006-01-02T15:04:05-0700"} {
		due, err = time.Parse(format, task.DueDate)
		if err == nil {
			break
		}
	}
	if err != nil {
		return false, false
	}
	loc := start.Location()
	if task.IsAllDay && task.TimeZone == "" {
		// Sin zona declarada, la fecha civil es la del propio vencimiento.
		return due.Format(time.DateOnly) == start.Format(time.DateOnly), true
	}
	if task.IsAllDay && task.TimeZone != "" {
		loc, err = time.LoadLocation(task.TimeZone)
		if err != nil {
			return false, false
		}
	}
	return due.In(loc).Format(time.DateOnly) == start.Format(time.DateOnly), true
}
