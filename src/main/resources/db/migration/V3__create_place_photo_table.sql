CREATE TABLE place_photo (
    id UUID PRIMARY KEY,
    place_id UUID NOT NULL REFERENCES place (id),
    file_path VARCHAR(500) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_place_photo_place_id ON place_photo (place_id);
