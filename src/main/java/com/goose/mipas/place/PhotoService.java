package com.goose.mipas.place;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@Transactional
public class PhotoService {

    private final PhotoRepository photoRepository;
    private final PlaceRepository placeRepository;
    private final Path uploadsDir;

    public PhotoService(
            PhotoRepository photoRepository,
            PlaceRepository placeRepository,
            @Value("${mipas.uploads.dir}") String uploadsDir) {
        this.photoRepository = photoRepository;
        this.placeRepository = placeRepository;
        this.uploadsDir = Path.of(uploadsDir);
    }

    @Transactional(readOnly = true)
    public List<Photo> getForPlace(UUID placeId) {
        return photoRepository.findByPlaceId(placeId);
    }

    public Photo upload(UUID placeId, MultipartFile file) {
        Place place = placeRepository.findById(placeId).orElseThrow(NoSuchElementException::new);

        String extension = extractExtension(file.getOriginalFilename());
        String storedFileName = UUID.randomUUID() + extension;

        try {
            Files.createDirectories(uploadsDir);
            Files.copy(file.getInputStream(), uploadsDir.resolve(storedFileName));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }

        Photo photo = new Photo();
        photo.setPlace(place);
        photo.setFilePath(storedFileName);
        return photoRepository.save(photo);
    }

    public void delete(UUID photoId) {
        Photo photo = photoRepository.findById(photoId).orElseThrow(NoSuchElementException::new);
        deleteFile(photo);
        photoRepository.delete(photo);
    }

    void deleteAllForPlace(UUID placeId) {
        List<Photo> photos = photoRepository.findByPlaceId(placeId);
        photos.forEach(this::deleteFile);
        photoRepository.deleteAll(photos);
    }

    private void deleteFile(Photo photo) {
        try {
            Files.deleteIfExists(uploadsDir.resolve(photo.getFilePath()));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private String extractExtension(String originalFilename) {
        if (originalFilename == null) {
            return "";
        }
        int dotIndex = originalFilename.lastIndexOf('.');
        return dotIndex >= 0 ? originalFilename.substring(dotIndex) : "";
    }
}
