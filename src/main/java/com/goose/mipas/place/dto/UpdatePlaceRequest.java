package com.goose.mipas.place.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdatePlaceRequest(@NotBlank String displayName, @NotBlank String address, String description) {
}
