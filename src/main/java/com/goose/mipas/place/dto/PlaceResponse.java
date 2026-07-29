package com.goose.mipas.place.dto;

import com.goose.mipas.place.Photo;
import com.goose.mipas.place.Place;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record PlaceResponse(
        UUID id,
        String displayName,
        String address,
        double latitude,
        double longitude,
        String description,
        Instant createdAt,
        List<PhotoResponse> photos) {

    public static PlaceResponse from(Place place, List<Photo> photos) {
        return new PlaceResponse(
                place.getId(),
                place.getDisplayName(),
                place.getAddress(),
                place.getLatitude(),
                place.getLongitude(),
                place.getDescription(),
                place.getCreatedAt(),
                photos.stream().map(PhotoResponse::from).toList());
    }
}
