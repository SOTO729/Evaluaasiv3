/**
 * GroupCertConocerPage – Certificado CONOCER (tier_advanced)
 * Solo UI — No se toca la lógica de descarga por el momento.
 */
import { Shield } from 'lucide-react';
import CertificateTypePage from './CertificateTypePage';

export default function GroupCertConocerPage() {
  return (
    <CertificateTypePage
      certType="tier_advanced"
      title="Certificado CONOCER"
      subtitle="Certificación de competencias laborales SEP-CONOCER — Solo visualización"
      icon={Shield}
      headerGradient="bg-gradient-to-r from-emerald-600 to-emerald-800"
      accentColor="emerald"
      downloadEnabled={false}
      canGenerate={false}
    />
  );
}
