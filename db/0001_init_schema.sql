CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY,

    updated_at TIMESTAMPTZ DEFAULT now(),

    username TEXT,
    full_name TEXT,
    avatar_url TEXT,

    college TEXT,
    location TEXT,
    address TEXT,

    student_verified BOOL DEFAULT false,
    seller_verified BOOL DEFAULT false,

    college_name TEXT,
    location_name TEXT,

    college_id_url TEXT,
    pan_url TEXT,
    payment_qr_url TEXT,

    phone TEXT,

    email_verified BOOL NOT NULL DEFAULT false,
    is_admin BOOL NOT NULL DEFAULT false,

    student_reviewed_at TIMESTAMPTZ,
    student_reviewed_by UUID,

    seller_reviewed_at TIMESTAMPTZ,
    seller_reviewed_by UUID
);

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    title TEXT NOT NULL,
    description TEXT,

    price DECIMAL NOT NULL,

    category TEXT,
    condition TEXT,

    status TEXT DEFAULT 'available',

    delivery_date DATE,
    payment_methods TEXT,

    seller_id TEXT,
    user_id UUID,

    college_name TEXT,

    is_sold BOOL DEFAULT false,
    sold BOOL DEFAULT false,
    sold_at TIMESTAMPTZ,

    campus TEXT,
    campus_lat FLOAT8,
    campus_lng FLOAT8,
    campus_place_id TEXT,

    collection_point TEXT,
    contact_no TEXT,

    ai_insights JSONB,
    ai_insights_review_count INT DEFAULT 0,

    ai_verified BOOL,
    ai_score FLOAT8,
    ai_feedback TEXT,
    ai_reason TEXT,
    ai_confidence DECIMAL,

    views INT DEFAULT 0
);