/**
 * GroupCertInsigniaPage – Insignia Digital (digital_badge)
 * Solo tabla — Sin descarga.
 */
import { BadgeCheck } from 'lucide-react';
import CertificateTypePage from './CertificateTypePage';

export default function GroupCertInsigniaPage() {
  return (
    <CertificateTypePage
      certType="digital_badge"
      title="Insignia Digital"
      subtitle="Insignia digital verificable — Solo tabla de seguimiento"
      icon={BadgeCheck}
      headerGradient="bg-gradient-to-r from-amber-500 to-amber-700"
      accentColor="amber"
      downloadEnabled={false}
      canGenerate={false}
    />
  );
}
