package com.goose.mipas.list.dto;

import com.goose.mipas.list.PlaceList;
import java.time.Instant;
import java.util.UUID;

public record PlaceListResponse(UUID id, String name, boolean isPublic, int placeCount, Instant createdAt) {

    public static PlaceListResponse from(PlaceList list) {
        return new PlaceListResponse(
                list.getId(), list.getName(), list.isPublic(), list.getPlaces().size(), list.getCreatedAt());
    }
}
