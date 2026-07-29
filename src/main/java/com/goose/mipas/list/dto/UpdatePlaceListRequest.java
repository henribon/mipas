package com.goose.mipas.list.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdatePlaceListRequest(@NotBlank String name, boolean isPublic) {
}
