package com.goose.mipas.list;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlaceListRepository extends JpaRepository<PlaceList, UUID> {

    List<PlaceList> findByPlaces_Id(UUID placeId);
}
