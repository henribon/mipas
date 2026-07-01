CREATE TABLE app_user (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE place (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES app_user (id),
    display_name VARCHAR(255) NOT NULL,
    address VARCHAR(500) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_place_owner_id ON place (owner_id);

CREATE TABLE place_comment (
    id UUID PRIMARY KEY,
    place_id UUID NOT NULL REFERENCES place (id),
    author_id UUID NOT NULL REFERENCES app_user (id),
    content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_place_comment_place_id ON place_comment (place_id);

CREATE TABLE event (
    id UUID PRIMARY KEY,
    place_id UUID NOT NULL REFERENCES place (id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    starts_at TIMESTAMP NOT NULL,
    ends_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_place_id ON event (place_id);

CREATE TABLE place_list (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES app_user (id),
    name VARCHAR(255) NOT NULL,
    is_public BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_place_list_owner_id ON place_list (owner_id);

CREATE TABLE place_list_item (
    place_list_id UUID NOT NULL REFERENCES place_list (id),
    place_id UUID NOT NULL REFERENCES place (id),
    PRIMARY KEY (place_list_id, place_id)
);

CREATE INDEX idx_place_list_item_place_id ON place_list_item (place_id);
