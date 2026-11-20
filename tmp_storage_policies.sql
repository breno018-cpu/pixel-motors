SELECT schemaname, tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'storage' ORDER BY tablename, cmd;
