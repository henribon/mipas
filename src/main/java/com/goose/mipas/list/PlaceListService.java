package com.goose.mipas.list;

import com.goose.mipas.config.DefaultUserProvider;
import com.goose.mipas.list.dto.CreatePlaceListRequest;
import com.goose.mipas.list.dto.UpdatePlaceListRequest;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class PlaceListService {

    private final PlaceListRepository placeListRepository;
    private final DefaultUserProvider defaultUserProvider;

    public PlaceListService(PlaceListRepository placeListRepository, DefaultUserProvider defaultUserProvider) {
        this.placeListRepository = placeListRepository;
        this.defaultUserProvider = defaultUserProvider;
    }

    @Transactional(readOnly = true)
    public List<PlaceList> getAll() {
        return placeListRepository.findAll();
    }

    @Transactional(readOnly = true)
    public PlaceList getById(UUID id) {
        return placeListRepository.findById(id).orElseThrow(NoSuchElementException::new);
    }

    public PlaceList create(CreatePlaceListRequest request) {
        PlaceList list = new PlaceList();
        list.setOwner(defaultUserProvider.get());
        list.setName(request.name());
        list.setPublic(request.isPublic());
        return placeListRepository.save(list);
    }

    public PlaceList update(UUID id, UpdatePlaceListRequest request) {
        PlaceList list = getById(id);
        list.setName(request.name());
        list.setPublic(request.isPublic());
        return placeListRepository.save(list);
    }

    public void delete(UUID id) {
        PlaceList list = getById(id);
        list.getPlaces().clear();
        placeListRepository.save(list);
        placeListRepository.delete(list);
    }
}
