using System.Data;

namespace CulturaDigital.motor
{
    /// <summary>
    /// Contrato del cliente MotorUniversal — versión REST.
    /// </summary>
    public interface MotorUniversalSoap
    {
        Licencia[] Licencias(bool partner);
        Licencia[] ExamenesDisponibles(string usuario);
        Examen[] Examenes(int subsistema, int plantel);
        DataTable DescargarExamen(int AplicacionId);
        string VersionExamen(int aplicacion);
        string VersionAplicacion(int tipo, bool produccion);
    }
}
