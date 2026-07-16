
-- Roles
CREATE TYPE public.app_role AS ENUM ('patient', 'hospital_admin', 'super_admin');
CREATE TYPE public.hospital_status AS ENUM ('pending', 'verified', 'suspended');
CREATE TYPE public.availability_status AS ENUM ('available', 'busy', 'off');
CREATE TYPE public.appointment_status AS ENUM ('requested', 'confirmed', 'cancelled', 'completed');
CREATE TYPE public.notification_status AS ENUM ('pending', 'sent', 'failed');

-- Hospitals (declared first for FK)
CREATE TABLE public.hospitals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  registration_no text,
  status public.hospital_status NOT NULL DEFAULT 'pending',
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  address text,
  phone text,
  email text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.hospitals TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospitals TO authenticated;
GRANT ALL ON public.hospitals TO service_role;

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  hospital_id uuid REFERENCES public.hospitals(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- User roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_hospital_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT hospital_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Specialists
CREATE TABLE public.specialists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  specialization text NOT NULL,
  license_no text,
  photo_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.specialists TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.specialists TO authenticated;
GRANT ALL ON public.specialists TO service_role;

-- Availability
CREATE TABLE public.availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id uuid NOT NULL REFERENCES public.specialists(id) ON DELETE CASCADE,
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  date date NOT NULL,
  status public.availability_status NOT NULL,
  updated_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (specialist_id, date)
);
GRANT SELECT ON public.availability TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability TO authenticated;
GRANT ALL ON public.availability TO service_role;

-- Appointments
CREATE SEQUENCE public.appointment_ref_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_appointment_ref()
RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT 'APT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.appointment_ref_seq')::text, 5, '0');
$$;

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text UNIQUE NOT NULL DEFAULT public.generate_appointment_ref(),
  patient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  specialist_id uuid NOT NULL REFERENCES public.specialists(id),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id),
  status public.appointment_status NOT NULL DEFAULT 'requested',
  scheduled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;

-- Notification log
CREATE TABLE public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  hospital_id uuid REFERENCES public.hospitals(id) ON DELETE SET NULL,
  recipient_phone text NOT NULL,
  message text NOT NULL,
  status public.notification_status NOT NULL DEFAULT 'pending',
  provider_message_id text,
  provider_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.notification_log TO authenticated;
GRANT ALL ON public.notification_log TO service_role;

-- Enable RLS
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specialists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

-- Policies: hospitals
CREATE POLICY "Public can view verified hospitals" ON public.hospitals
  FOR SELECT TO anon, authenticated USING (status = 'verified' OR public.has_role(auth.uid(), 'super_admin') OR (auth.uid() IS NOT NULL AND id = public.current_hospital_id()));

CREATE POLICY "Hospital admins can insert their hospital" ON public.hospitals
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Hospital admins can update own hospital" ON public.hospitals
  FOR UPDATE TO authenticated USING (id = public.current_hospital_id() OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (id = public.current_hospital_id() OR public.has_role(auth.uid(), 'super_admin'));

-- Policies: profiles
CREATE POLICY "Profiles are viewable by self and super admin" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Policies: user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

-- Policies: specialists
CREATE POLICY "Public can view active specialists at verified hospitals" ON public.specialists
  FOR SELECT TO anon, authenticated USING (
    (is_active = true AND EXISTS (SELECT 1 FROM public.hospitals h WHERE h.id = hospital_id AND h.status = 'verified'))
    OR hospital_id = public.current_hospital_id()
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Hospital admins can manage their specialists" ON public.specialists
  FOR ALL TO authenticated USING (hospital_id = public.current_hospital_id())
  WITH CHECK (hospital_id = public.current_hospital_id());

-- Policies: availability
CREATE POLICY "Public can view availability" ON public.availability
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Hospital admins manage own availability" ON public.availability
  FOR ALL TO authenticated USING (hospital_id = public.current_hospital_id())
  WITH CHECK (hospital_id = public.current_hospital_id());

-- Policies: appointments
CREATE POLICY "Patients view own appointments" ON public.appointments
  FOR SELECT TO authenticated USING (
    patient_id = auth.uid()
    OR hospital_id = public.current_hospital_id()
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Patients create own appointments" ON public.appointments
  FOR INSERT TO authenticated WITH CHECK (patient_id = auth.uid());

CREATE POLICY "Patients cancel own, hospital admins update theirs" ON public.appointments
  FOR UPDATE TO authenticated USING (
    patient_id = auth.uid() OR hospital_id = public.current_hospital_id()
  ) WITH CHECK (
    patient_id = auth.uid() OR hospital_id = public.current_hospital_id()
  );

-- Notification log: no client access (service_role only)

-- Handle new user signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  meta jsonb := NEW.raw_user_meta_data;
  desired_role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, COALESCE(meta->>'full_name', ''), COALESCE(meta->>'phone', ''));

  desired_role := COALESCE((meta->>'role')::public.app_role, 'patient');
  -- Never allow self-provisioning as super_admin via signup metadata
  IF desired_role = 'super_admin' THEN
    desired_role := 'patient';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, desired_role);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Bootstrap super admin: only works if no super admin exists yet
CREATE OR REPLACE FUNCTION public.claim_super_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'super_admin') THEN
    RETURN false;
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'super_admin')
    ON CONFLICT DO NOTHING;
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.claim_super_admin() TO authenticated;

-- Nearby specialists RPC (haversine)
CREATE OR REPLACE FUNCTION public.nearby_specialists(
  lat double precision,
  lng double precision,
  specialization_filter text DEFAULT NULL,
  radius_km double precision DEFAULT 50,
  date_filter date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  specialist_id uuid,
  specialist_name text,
  specialization text,
  photo_url text,
  hospital_id uuid,
  hospital_name text,
  hospital_address text,
  hospital_lat double precision,
  hospital_lng double precision,
  distance_km double precision,
  availability_status text
) LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT
    s.id AS specialist_id,
    s.full_name AS specialist_name,
    s.specialization,
    s.photo_url,
    h.id AS hospital_id,
    h.name AS hospital_name,
    h.address AS hospital_address,
    h.latitude AS hospital_lat,
    h.longitude AS hospital_lng,
    (6371 * acos(
      cos(radians(lat)) * cos(radians(h.latitude)) *
      cos(radians(h.longitude) - radians(lng)) +
      sin(radians(lat)) * sin(radians(h.latitude))
    )) AS distance_km,
    COALESCE(a.status::text, 'off') AS availability_status
  FROM public.specialists s
  JOIN public.hospitals h ON h.id = s.hospital_id
  LEFT JOIN public.availability a
    ON a.specialist_id = s.id AND a.date = date_filter
  WHERE s.is_active = true
    AND h.status = 'verified'
    AND (specialization_filter IS NULL OR specialization_filter = '' OR s.specialization ILIKE '%' || specialization_filter || '%')
    AND (6371 * acos(
      cos(radians(lat)) * cos(radians(h.latitude)) *
      cos(radians(h.longitude) - radians(lng)) +
      sin(radians(lat)) * sin(radians(h.latitude))
    )) <= radius_km
  ORDER BY distance_km ASC
  LIMIT 100;
$$;
GRANT EXECUTE ON FUNCTION public.nearby_specialists(double precision, double precision, text, double precision, date) TO anon, authenticated;

-- Log SMS (client-callable stub; log-only)
CREATE OR REPLACE FUNCTION public.log_sms(
  _appointment_id uuid,
  _hospital_id uuid,
  _phone text,
  _message text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
  INSERT INTO public.notification_log (appointment_id, hospital_id, recipient_phone, message, status)
  VALUES (_appointment_id, _hospital_id, _phone, _message, 'sent')
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.log_sms(uuid, uuid, text, text) TO authenticated;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.availability;
