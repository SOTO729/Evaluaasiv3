/**
 * GroupCertConocerPage – Certificado CONOCER (tier_advanced)
 * Permite visualizar y descargar los certificados CONOCER originales.
 */
import { Shield } from 'lucide-react';
import CertificateTypePage from './CertificateTypePage';

export default function GroupCertConocerPage() {
  return (
    <CertificateTypePage
      certType="tier_advanced"
      title="Certificado CONOCER"
      subtitle="Certificación de competencias laborales SEP-CONOCER"
      icon={Shield}
      headerGradient="bg-gradient-to-r from-emerald-600 to-emerald-800"
      accentColor="emerald"
      downloadEnabled={true}
      canGenerate={false}
    />
  );
}
