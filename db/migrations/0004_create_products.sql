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