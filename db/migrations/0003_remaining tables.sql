CREATE TABLE IF NOT EXISTS product_images (
    id UUID NOT NULL PRIMARY KEY,
    product_id UUID,
    image_url TEXT NOT NULL,
    created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS reviews (
    id UUID NOT NULL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL,
    product_id UUID NOT NULL,
    user_id UUID NOT NULL,
    rating INT NOT NULL,
    review_text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_rooms (
    id UUID NOT NULL PRIMARY KEY,
    created_at TIMESTAMPTZ,
    buyer_id UUID,
    seller_id UUID,
    product_id UUID
);

CREATE TABLE IF NOT EXISTS chats (
    id UUID NOT NULL PRIMARY KEY,
    product_id UUID NOT NULL,
    sender_id UUID NOT NULL,
    receiver_id UUID NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID NOT NULL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL,
    room_id UUID,
    sender_id UUID,
    message_text TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID NOT NULL PRIMARY KEY,
    user_id UUID NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    reference_id TEXT,
    read BOOL NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS email_verifications (
    id UUID NOT NULL PRIMARY KEY,
    user_id UUID,
    email TEXT NOT NULL,
    otp_hash TEXT NOT NULL,
    attempts INT NOT NULL,
    verified BOOL NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);