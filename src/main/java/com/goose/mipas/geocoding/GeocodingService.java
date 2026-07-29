package com.goose.mipas.geocoding;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class GeocodingService {

    private final RestClient restClient;

    public GeocodingService() {
        this.restClient = RestClient.builder()
                .baseUrl("https://nominatim.openstreetmap.org")
                .defaultHeader("User-Agent", "mipas-personal-project/1.0")
                .build();
    }

    public GeocodingResult resolve(String address) {
        List<NominatimResult> results = restClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/search")
                        .queryParam("q", address)
                        .queryParam("format", "json")
                        .queryParam("limit", 1)
                        .build())
                .retrieve()
                .body(new org.springframework.core.ParameterizedTypeReference<List<NominatimResult>>() {});

        if (results == null || results.isEmpty()) {
            throw new AddressNotFoundException(address);
        }

        NominatimResult result = results.get(0);
        return new GeocodingResult(Double.parseDouble(result.lat()), Double.parseDouble(result.lon()));
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record NominatimResult(String lat, String lon) {
    }
}
