package com.goose.mipas.place.dto;

import com.goose.mipas.place.Photo;
import java.util.UUID;

public record PhotoResponse(UUID id, String url) {

    public static PhotoResponse from(Photo photo) {
        return new PhotoResponse(photo.getId(), "/uploads/" + photo.getFilePath());
    }
}
