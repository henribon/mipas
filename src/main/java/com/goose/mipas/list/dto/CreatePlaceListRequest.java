package com.goose.mipas.list.dto;

import jakarta.validation.constraints.NotBlank;

public record CreatePlaceListRequest(@NotBlank String name, boolean isPublic) {
}
