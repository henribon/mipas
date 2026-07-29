package com.goose.mipas.list;

import com.goose.mipas.list.dto.CreatePlaceListRequest;
import com.goose.mipas.list.dto.PlaceListResponse;
import com.goose.mipas.list.dto.UpdatePlaceListRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/lists")
public class PlaceListController {

    private final PlaceListService placeListService;

    public PlaceListController(PlaceListService placeListService) {
        this.placeListService = placeListService;
    }

    @GetMapping
    public List<PlaceListResponse> getAll() {
        return placeListService.getAll().stream().map(PlaceListResponse::from).toList();
    }

    @GetMapping("/{id}")
    public PlaceListResponse getById(@PathVariable UUID id) {
        return PlaceListResponse.from(placeListService.getById(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PlaceListResponse create(@Valid @RequestBody CreatePlaceListRequest request) {
        return PlaceListResponse.from(placeListService.create(request));
    }

    @PutMapping("/{id}")
    public PlaceListResponse update(@PathVariable UUID id, @Valid @RequestBody UpdatePlaceListRequest request) {
        return PlaceListResponse.from(placeListService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        placeListService.delete(id);
    }
}
