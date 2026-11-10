CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  phone text,
  account_type text NOT NULL DEFAULT 'Personal',
  notifications_enabled boolean NOT NULL DEFAULT true,
  theme text NOT NULL DEFAULT 'system' CHECK (theme IN ('light','system','dark')),
  ai_detail_level text NOT NULL DEFAULT 'balanced' CHECK (ai_detail_level IN ('concise','balanced','detailed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source text NOT NULL CHECK (source IN ('paypal_sandbox','demo')),
  reference text NOT NULL,
  merchant text NOT NULL,
  description text,
  category text,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL CHECK (status IN ('created','approved','pending','completed','failed','on_hold','refunded','partially_refunded','voided','cancelled')),
  payment_method text,
  location text,
  device_status text CHECK (device_status IN ('known','new')),
  paypal_order_id text UNIQUE,
  paypal_capture_id text,
  paypal_status text,
  paypal_capture_status text,
  payer_email text,
  payer_id text,
  approve_url text,
  create_request_id uuid UNIQUE,
  capture_request_id uuid,
  raw jsonb,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX transactions_user_created_idx ON public.transactions (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tx_select_own" ON public.transactions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "tx_insert_own_demo" ON public.transactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND source = 'demo');
CREATE POLICY "tx_update_own_demo" ON public.transactions FOR UPDATE TO authenticated USING (user_id = auth.uid() AND source = 'demo') WITH CHECK (user_id = auth.uid() AND source = 'demo');
CREATE POLICY "tx_delete_own_demo" ON public.transactions FOR DELETE TO authenticated USING (user_id = auth.uid() AND source = 'demo');
CREATE TRIGGER transactions_updated BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  title text NOT NULL,
  description text,
  source text NOT NULL CHECK (source IN ('paypal_api','paypal_webhook','demo','system')),
  paypal_event_id text UNIQUE,
  payload jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payment_events_tx_idx ON public.payment_events (transaction_id, occurred_at);
GRANT SELECT ON public.payment_events TO authenticated;
GRANT ALL ON public.payment_events TO service_role;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_select_own" ON public.payment_events FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'New conversation',
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_sessions_user_idx ON public.chat_sessions (user_id, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_sessions TO authenticated;
GRANT ALL ON public.chat_sessions TO service_role;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions_select_own" ON public.chat_sessions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "sessions_insert_own" ON public.chat_sessions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "sessions_update_own" ON public.chat_sessions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "sessions_delete_own" ON public.chat_sessions FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER chat_sessions_updated BEFORE UPDATE ON public.chat_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  agent_run jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_session_idx ON public.chat_messages (session_id, created_at);
GRANT SELECT, INSERT, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_select_own" ON public.chat_messages FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "messages_insert_own" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.chat_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
);
CREATE POLICY "messages_delete_own" ON public.chat_messages FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.fraud_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  severity text NOT NULL CHECK (severity IN ('low','medium','high')),
  title text NOT NULL,
  explanation text NOT NULL,
  risk_score numeric(4,1) NOT NULL DEFAULT 0,
  indicators jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','confirmed_legit','reported','dismissed')),
  source text NOT NULL DEFAULT 'rules' CHECK (source IN ('rules','demo')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, transaction_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fraud_alerts TO authenticated;
GRANT ALL ON public.fraud_alerts TO service_role;
ALTER TABLE public.fraud_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alerts_select_own" ON public.fraud_alerts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "alerts_insert_own" ON public.fraud_alerts FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND t.user_id = auth.uid())
);
CREATE POLICY "alerts_update_own" ON public.fraud_alerts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "alerts_delete_own" ON public.fraud_alerts FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER fraud_alerts_updated BEFORE UPDATE ON public.fraud_alerts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('paypal_sandbox','demo')),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'USD',
  reason text,
  status text NOT NULL CHECK (status IN ('requested','under_review','processing','completed','failed','cancelled')),
  paypal_refund_id text,
  paypal_status text,
  request_id uuid UNIQUE,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.refunds TO authenticated;
GRANT ALL ON public.refunds TO service_role;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "refunds_select_own" ON public.refunds FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "refunds_insert_own_demo" ON public.refunds FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() AND source = 'demo' AND EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND t.user_id = auth.uid() AND t.source = 'demo')
);
CREATE POLICY "refunds_update_own_demo" ON public.refunds FOR UPDATE TO authenticated USING (user_id = auth.uid() AND source = 'demo') WITH CHECK (user_id = auth.uid() AND source = 'demo');
CREATE POLICY "refunds_delete_own_demo" ON public.refunds FOR DELETE TO authenticated USING (user_id = auth.uid() AND source = 'demo');
CREATE TRIGGER refunds_updated BEFORE UPDATE ON public.refunds FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  reference text NOT NULL,
  source text NOT NULL DEFAULT 'case_file' CHECK (source IN ('case_file','demo')),
  reason text NOT NULL CHECK (reason IN ('item_not_received','not_as_described','unauthorized','duplicate_charge','billing_issue','other')),
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','opened','evidence_submitted','under_review','resolved','closed')),
  ai_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.disputes TO authenticated;
GRANT ALL ON public.disputes TO service_role;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "disputes_select_own" ON public.disputes FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "disputes_insert_own" ON public.disputes FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND t.user_id = auth.uid())
);
CREATE POLICY "disputes_update_own" ON public.disputes FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "disputes_delete_own" ON public.disputes FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER disputes_updated BEFORE UPDATE ON public.disputes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.dispute_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  dispute_id uuid NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text,
  file_size integer NOT NULL DEFAULT 0 CHECK (file_size >= 0 AND file_size <= 10485760),
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','application/pdf')),
  checklist_item text NOT NULL CHECK (checklist_item IN ('order_confirmation','seller_communication','proof_of_issue','additional_details')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.dispute_evidence TO authenticated;
GRANT ALL ON public.dispute_evidence TO service_role;
ALTER TABLE public.dispute_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evidence_select_own" ON public.dispute_evidence FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "evidence_insert_own" ON public.dispute_evidence FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.disputes d WHERE d.id = dispute_id AND d.user_id = auth.uid())
);
CREATE POLICY "evidence_delete_own" ON public.dispute_evidence FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "evidence_files_select_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'dispute-evidence' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "evidence_files_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dispute-evidence' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "evidence_files_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'dispute-evidence' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE OR REPLACE FUNCTION public.seed_demo_data(_uid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t_amazon uuid; t_flip uuid; t_netflix uuid; t_game uuid; t_google uuid; t_electro uuid;
  t_digital uuid; t_dup1 uuid; t_dup2 uuid; t_spotify uuid; t_uber uuid; t_flip_old uuid; t_zomato uuid;
  d_id uuid;
BEGIN
  INSERT INTO transactions (user_id, source, reference, merchant, description, category, amount, status, payment_method, location, device_status, created_at)
  VALUES (_uid,'demo','DEMO-8F7K2D1','Amazon India','Electronics order','Shopping',49.99,'pending','PayPal Balance','India','known', now() - interval '40 minutes') RETURNING id INTO t_amazon;
  INSERT INTO transactions (user_id, source, reference, merchant, description, category, amount, status, payment_method, location, device_status, created_at)
  VALUES (_uid,'demo','DEMO-3N8Q1L4','Flipkart','Home essentials','Shopping',29.50,'pending','Visa •• 4242','India','known', now() - interval '1 day 2 hours') RETURNING id INTO t_flip;
  INSERT INTO transactions (user_id, source, reference, merchant, description, category, amount, status, payment_method, location, device_status, created_at)
  VALUES (_uid,'demo','DEMO-7H2M5P9','Netflix Subscription','Monthly plan','Subscription',12.99,'completed','PayPal Balance','India','known', now() - interval '2 days 6 hours') RETURNING id INTO t_netflix;
  INSERT INTO transactions (user_id, source, reference, merchant, description, category, amount, status, payment_method, location, device_status, created_at)
  VALUES (_uid,'demo','DEMO-5K9R2T6','Gaming Purchase','In-game credits','Gaming',69.99,'failed','Mastercard •• 8812','India','known', now() - interval '3 days 1 hour') RETURNING id INTO t_game;
  INSERT INTO transactions (user_id, source, reference, merchant, description, category, amount, status, payment_method, location, device_status, created_at)
  VALUES (_uid,'demo','DEMO-2G6W8E3','Google Workspace','Business Starter','Software',14.00,'completed','PayPal Balance','India','known', now() - interval '4 days 3 hours') RETURNING id INTO t_google;
  INSERT INTO transactions (user_id, source, reference, merchant, description, category, amount, status, payment_method, location, device_status, created_at)
  VALUES (_uid,'demo','DEMO-9D4K8Z1','OnlineElectro Store','Headphones','Electronics',249.99,'on_hold','PayPal Balance','Singapore','new', now() - interval '5 hours') RETURNING id INTO t_electro;
  INSERT INTO transactions (user_id, source, reference, merchant, description, category, amount, status, payment_method, location, device_status, created_at)
  VALUES (_uid,'demo','DEMO-6C1V7B2','Digital Service','Annual license','Software',199.00,'completed','Visa •• 4242','India','known', now() - interval '5 days 4 hours') RETURNING id INTO t_digital;
  INSERT INTO transactions (user_id, source, reference, merchant, description, category, amount, status, payment_method, location, device_status, created_at)
  VALUES (_uid,'demo','DEMO-4X2Y9A1','Online Store','Accessories','Shopping',49.99,'completed','PayPal Balance','India','known', now() - interval '1 day 8 hours') RETURNING id INTO t_dup1;
  INSERT INTO transactions (user_id, source, reference, merchant, description, category, amount, status, payment_method, location, device_status, created_at)
  VALUES (_uid,'demo','DEMO-4X2Y9A2','Online Store','Accessories','Shopping',49.99,'completed','PayPal Balance','India','known', now() - interval '1 day 7 hours 55 minutes') RETURNING id INTO t_dup2;
  INSERT INTO transactions (user_id, source, reference, merchant, description, category, amount, status, payment_method, location, device_status, created_at)
  VALUES (_uid,'demo','DEMO-1S5P3F8','Spotify','Premium Individual','Subscription',9.99,'completed','PayPal Balance','India','known', now() - interval '7 days') RETURNING id INTO t_spotify;
  INSERT INTO transactions (user_id, source, reference, merchant, description, category, amount, status, payment_method, location, device_status, created_at)
  VALUES (_uid,'demo','DEMO-8U3B6R4','Uber','Ride','Travel',23.40,'completed','Visa •• 4242','India','known', now() - interval '9 days') RETURNING id INTO t_uber;
  INSERT INTO transactions (user_id, source, reference, merchant, description, category, amount, status, payment_method, location, device_status, created_at)
  VALUES (_uid,'demo','DEMO-4D9K3M8','Flipkart','Kitchen set','Shopping',29.99,'refunded','PayPal Balance','India','known', now() - interval '13 days') RETURNING id INTO t_flip_old;
  INSERT INTO transactions (user_id, source, reference, merchant, description, category, amount, status, payment_method, location, device_status, created_at)
  VALUES (_uid,'demo','DEMO-7Z1Q4N6','Zomato','Food order','Food',18.75,'failed','Mastercard •• 8812','India','known', now() - interval '16 days') RETURNING id INTO t_zomato;

  INSERT INTO payment_events (user_id, transaction_id, event_type, title, description, source, occurred_at) VALUES
    (_uid,t_amazon,'initiated','Payment initiated','Your payment request was created.','demo', now() - interval '40 minutes'),
    (_uid,t_amazon,'processing','Processing','Payment is being processed.','demo', now() - interval '39 minutes'),
    (_uid,t_electro,'initiated','Transaction initiated','Payment request created.','demo', now() - interval '5 hours'),
    (_uid,t_electro,'risk_scan','Risk analysis (automated)','Transaction scanned by fraud rules.','demo', now() - interval '5 hours'),
    (_uid,t_electro,'on_hold','Flagged for review','Marked as high risk and put on hold.','demo', now() - interval '4 hours 59 minutes'),
    (_uid,t_netflix,'initiated','Payment initiated','Recurring subscription charge.','demo', now() - interval '2 days 6 hours'),
    (_uid,t_netflix,'completed','Payment completed','Funds transferred to merchant.','demo', now() - interval '2 days 6 hours'),
    (_uid,t_game,'initiated','Payment initiated','Card payment attempted.','demo', now() - interval '3 days 1 hour'),
    (_uid,t_game,'failed','Payment failed','The card issuer declined the payment.','demo', now() - interval '3 days 1 hour'),
    (_uid,t_flip_old,'completed','Payment completed','Funds transferred to merchant.','demo', now() - interval '13 days'),
    (_uid,t_flip_old,'refunded','Refund completed','Refund credited to original payment method.','demo', now() - interval '11 days');

  INSERT INTO fraud_alerts (user_id, transaction_id, severity, title, explanation, risk_score, indicators, source, created_at) VALUES
   (_uid, t_electro, 'high', 'Unusual amount from new location',
    'Multiple risk signals: amount well above your usual spend, new location (Singapore) and an unrecognized device.', 7.0,
    '[{"code":"HIGH_AMOUNT","name":"Unusual amount","detail":"$249.99 is about 4.3x your average of $58.20","impact":3.0},{"code":"NEW_LOCATION","name":"New location","detail":"Initiated from Singapore (usual: India)","impact":2.5},{"code":"NEW_DEVICE","name":"New device","detail":"Unrecognized browser/device","impact":1.5}]'::jsonb,
    'demo', now() - interval '5 hours'),
   (_uid, t_dup2, 'medium', 'Possible duplicate payment',
    'A payment with the same merchant and amount was made 5 minutes earlier.', 2.5,
    '[{"code":"DUPLICATE","name":"Possible duplicate","detail":"Same merchant and amount ($49.99) within 24 hours","impact":2.5}]'::jsonb,
    'demo', now() - interval '1 day 7 hours'),
   (_uid, t_digital, 'medium', 'High amount transaction',
    'Amount is significantly above your usual payments. Review recommended.', 3.0,
    '[{"code":"HIGH_AMOUNT","name":"Unusual amount","detail":"$199.00 is about 3.4x your average","impact":3.0}]'::jsonb,
    'demo', now() - interval '5 days 4 hours');

  INSERT INTO refunds (user_id, transaction_id, source, amount, reason, status, created_at) VALUES
    (_uid, t_netflix, 'demo', 12.99, 'Charged after cancellation', 'processing', now() - interval '1 day'),
    (_uid, t_flip_old, 'demo', 29.99, 'Item damaged', 'completed', now() - interval '12 days');

  INSERT INTO disputes (user_id, transaction_id, reference, source, reason, description, status, created_at)
  VALUES (_uid, t_flip, 'DEMO-DP-7F6K2M1', 'demo', 'item_not_received', 'Order placed but never delivered; seller not responding.', 'evidence_submitted', now() - interval '20 hours')
  RETURNING id INTO d_id;
  INSERT INTO dispute_evidence (user_id, dispute_id, file_name, file_size, mime_type, checklist_item, note) VALUES
    (_uid, d_id, 'Order_Confirmation.pdf', 262144, 'application/pdf', 'order_confirmation', 'Demo placeholder (no file stored)'),
    (_uid, d_id, 'Email_Communication.png', 493568, 'image/png', 'seller_communication', 'Demo placeholder (no file stored)');
END; $$;
REVOKE EXECUTE ON FUNCTION public.seed_demo_data(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reset_demo_data()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  DELETE FROM transactions WHERE user_id = _uid AND source = 'demo';
  PERFORM public.seed_demo_data(_uid);
END; $$;
REVOKE EXECUTE ON FUNCTION public.reset_demo_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_demo_data() TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  PERFORM public.seed_demo_data(NEW.id);
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();