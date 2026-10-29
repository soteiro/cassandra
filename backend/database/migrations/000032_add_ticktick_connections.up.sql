CREATE TABLE ticktick_connections (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    access_token BYTEA,
    version BIGINT NOT NULL DEFAULT 0,
    connected_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    needs_reauthorize BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE ticktick_oauth_states (
    state_hash CHAR(64) PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES ticktick_connections(user_id) ON DELETE CASCADE,
    connection_version BIGINT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    UNIQUE (user_id)
);
