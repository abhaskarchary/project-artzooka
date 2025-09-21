package com.artzooka.artzooka.room;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.Locale;
import java.util.Optional;

@Service
public class RoomService {
private final RoomRepository roomRepository;
private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
private static final SecureRandom RANDOM = new SecureRandom();

public RoomService(RoomRepository roomRepository) {
this.roomRepository = roomRepository;
}

@Transactional
public Room createRoom() {
Room room = new Room();
room.setCode(generateUniqueCode(6));
return roomRepository.save(room);
}

    @Transactional(readOnly = true)
    public Optional<Room> findByCode(String code) {
        return roomRepository.findByCode(code);
    }

private String generateUniqueCode(int length) {
String code;
do {
code = randomCode(length);
} while (roomRepository.existsByCode(code));
return code;
}

private String randomCode(int length) {
StringBuilder sb = new StringBuilder(length);
for (int i = 0; i < length; i++) {
sb.append(CODE_ALPHABET.charAt(RANDOM.nextInt(CODE_ALPHABET.length())));
}
return sb.toString().toUpperCase(Locale.ROOT);
}
}
