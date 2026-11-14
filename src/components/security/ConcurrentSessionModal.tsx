import React, { useState, useEffect } from 'react';
import { ShieldAlert, LogIn, AlertTriangle, Monitor, Smartphone, Lock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { onSessionTerminated, SessionTerminationReason } from '@/lib/singleSessionGuard';
import { supabase } from '@/integrations/supabase/client';

export function ConcurrentSessionModal() {
  // Desativado: Multi-dispositivos permitidos na concessionária (celular, desktop, tablet sem conflito)
  return null;
}
