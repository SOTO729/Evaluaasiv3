/**
 * GroupCertEduitPage – Certificado Eduit (tier_standard)
 * Página independiente con tabla, selección y descarga completa.
 * Solo admin/developer pueden regenerar PDFs.
 */
import { Award } from 'lucide-react';
import CertificateTypePage from './CertificateTypePage';
import { useAuthStore } from '../../../store/authStore';

export default function GroupCertEduitPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'developer';

  return (
    <CertificateTypePage
      certType="tier_standard"
      title="Certificado Eduit"
      subtitle="Certificado oficial de Eduit — Generados automáticamente al aprobar el examen"
      icon={Award}
      headerGradient="bg-gradient-to-r from-purple-600 to-purple-800"
      accentColor="purple"
      downloadEnabled={true}
      canGenerate={isAdmin}
    />
  );
}
