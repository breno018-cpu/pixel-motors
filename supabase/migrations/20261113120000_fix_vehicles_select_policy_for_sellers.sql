-- Allow all authenticated users (including sellers and consultants) to view vehicles in inventory
-- This ensures sellers see both local vehicles and network-wide vehicles for transfer sales

DROP POLICY IF EXISTS "View vehicles based on role" ON public.vehicles;

CREATE POLICY "View vehicles based on role"
ON public.vehicles
FOR SELECT
TO authenticated
USING (true);
