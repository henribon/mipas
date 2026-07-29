package com.goose.mipas.geocoding;

public class AddressNotFoundException extends RuntimeException {

    public AddressNotFoundException(String address) {
        super("Could not resolve coordinates for address: " + address);
    }
}
