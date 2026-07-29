package com.goose.mipas.config;

import com.goose.mipas.user.User;
import com.goose.mipas.user.UserRepository;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class DefaultUserProvider {

    public static final UUID DEFAULT_USER_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    private final UserRepository userRepository;

    public DefaultUserProvider(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public User get() {
        return userRepository.getReferenceById(DEFAULT_USER_ID);
    }
}
