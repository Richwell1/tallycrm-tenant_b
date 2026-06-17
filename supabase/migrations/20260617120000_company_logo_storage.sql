INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'public',
  'public',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can upload company logos'
  ) THEN
    CREATE POLICY "Authenticated users can upload company logos"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'public'
        AND (storage.foldername(name))[1] = 'company-logos'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can update company logos'
  ) THEN
    CREATE POLICY "Authenticated users can update company logos"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'public'
        AND (storage.foldername(name))[1] = 'company-logos'
      )
      WITH CHECK (
        bucket_id = 'public'
        AND (storage.foldername(name))[1] = 'company-logos'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can read company logos for upsert'
  ) THEN
    CREATE POLICY "Authenticated users can read company logos for upsert"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'public'
        AND (storage.foldername(name))[1] = 'company-logos'
      );
  END IF;
END $$;
