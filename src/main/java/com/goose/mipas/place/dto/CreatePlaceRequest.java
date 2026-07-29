package com.goose.mipas.place.dto;

import jakarta.validation.constraints.NotBlank;

public record CreatePlaceRequest(@NotBlank String displayName, @NotBlank String address, String description) {
}
