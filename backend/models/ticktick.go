package models

import "time"

type TickTickConnection struct {
	Available        bool       `json:"available"`
	Connected        bool       `json:"connected"`
	NeedsReauthorize bool       `json:"needs_reauthorize"`
	ConnectedAt      *time.Time `json:"connected_at"`
	RevocationFailed bool       `json:"revocation_failed,omitempty"`
}

type TickTickTask struct {
	ID        string `json:"id"`
	ProjectID string `json:"project_id"`
	List      string `json:"list"`
	Title     string `json:"title"`
	Priority  int    `json:"priority"`
	DueDate   string `json:"due_date"`
	TimeZone  string `json:"time_zone"`
	IsAllDay  bool   `json:"is_all_day"`
}

type TickTickToday struct {
	State     string         `json:"state"`
	Date      string         `json:"date"`
	TimeZone  string         `json:"time_zone"`
	Tasks     []TickTickTask `json:"tasks"`
	FetchedAt *time.Time     `json:"fetched_at"`
	Warnings  []string       `json:"warnings"`
	InboxRead bool           `json:"inbox_read"`
}
