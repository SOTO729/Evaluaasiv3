using System.Data;

namespace CulturaDigital.xmn
{
    /// <summary>
    /// Contrato del cliente Usuario.
    /// Ya NO es un ServiceContract WCF — ahora es una interfaz plana implementada
    /// por <see cref="UsuarioSoapClient"/> con HTTP+JSON contra MotorV2.
    /// Las firmas se mantienen idénticas a la versión legacy (DataTable de 25 columnas)
    /// para no romper los call sites en Forms/Models.
    /// </summary>
    public interface UsuarioSoap
    {
        DataTable Login(string UsuarioNombre, string Password, int AppId, string VersionOffice, string VersionAplicacion);
        DataTable LoginTest(string UsuarioNombre, string Password, int AppId, string VersionOffice, string VersionAplicacion);
        DataTable LoginV2(string UsuarioNombre, string Password, int AppId, string VersionOffice, string VersionAplicacion);
        DataTable LoginDiscapacidadVisual(string usuarioNombre, string password, int appId, string versionOffice, string versionAplicacion);
        DataTable Inicio(int VoucherId, string UserPC, string NombrePC, string IP, string MAC, string VersionExamen, string VersionApp, string Subsistema, int AvisoPrivacidad);
        DataTable InicioTest(int VoucherId, string UserPC, string NombrePC, string IP, string MAC, string VersionExamen, string VersionApp, string Subsistema, int AvisoPrivacidad);
        DataTable Fin(int VoucherId, int Resultado, int Escenario, string Subsistema);
        DataTable FinTest(int VoucherId, int Resultado, int Escenario, string Subsistema);
        int CaducaVoucherPorPin(int VoucherId, string Subsistema);
        Examen[] Examenes(int subsistema, int plantel);
        DataTable DescargarExamen(int AplicacionId);
        string VersionExamen(int aplicacion);
        double Fecha();
    }
}
